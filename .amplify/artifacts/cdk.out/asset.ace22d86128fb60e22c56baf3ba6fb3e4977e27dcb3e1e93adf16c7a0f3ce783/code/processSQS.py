import time
# For now I just want this task to hang and do nothing. This is so that I can connect to the running container and debug it at my convenience 
# in a separate process
# while True:
#     print('In lightglue container. Going to sleep...')
#     time.sleep(10)

import json
import os
from boto3 import Session as AWSSession
from requests_aws4auth import AWS4Auth
from gql import gql
from gql.client import Client
from gql.transport.requests import RequestsHTTPTransport
import boto3
from botocore.exceptions import ClientError
from tempfile import NamedTemporaryFile
from torchvision.io import read_image,ImageReadMode
import torch
import kornia as K
import kornia.feature as KF
import cv2


torch.set_default_device('cuda')
matcher = KF.LoFTR(pretrained="outdoor")
createN=gql("""
mutation MyMutation ($input: CreateImageNeighbourInput!){
  createImageNeighbour(input: $input) {
    id
  }
}
""")

updateN=gql("""mutation MyMutation($input: UpdateImageNeighbourInput!) {
  updateImageNeighbour(input: $input){
    id
  }
}
""")

# Create SQS client
sqs = boto3.client('sqs',os.environ['SQS_REGION'])
queue_url = os.environ['SQS_QUEUE_URL']

# Create graphQL client that we'll use to post results back to the DetwebAPI
headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}
aws = boto3.Session()
credentials = aws.get_credentials().get_frozen_credentials()
auth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    os.environ['API_REGION'],
    'appsync',
    session_token=credentials.token,
)
transport = RequestsHTTPTransport(url=os.environ['API_ENDPOINT'],
                                    headers=headers,
                                    auth=auth)
client = Client(transport=transport,
                fetch_schema_from_transport=False)

def process(body):
    s3_client = boto3.client('s3',body['region'])
    keys=body['keys']
    with NamedTemporaryFile(suffix=os.path.splitext(keys[0])[1]) as tmpFile1,NamedTemporaryFile(suffix=os.path.splitext(keys[1])[1]) as tmpFile2:
        s3_client.download_file(body['inputBucket'],'public/images/'+keys[0],tmpFile1.name)
        s3_client.download_file(body['inputBucket'],'public/images/'+keys[1],tmpFile2.name)
        img1=read_image(tmpFile1.name,mode=ImageReadMode.GRAY).to('cuda',dtype=torch.float32)/255
        img2=read_image(tmpFile2.name,mode=ImageReadMode.GRAY).to('cuda',dtype=torch.float32)/255
    img1 = K.geometry.resize(img1, 528, antialias=True).unsqueeze(0)
    img2 = K.geometry.resize(img2, 528, antialias=True).unsqueeze(0)
    input_dict = {
        "image0": img1, #K.color.rgb_to_grayscale(img1),  # LofTR works on grayscale images only
        "image1": img2 #K.color.rgb_to_grayscale(img2),
    }
    with torch.inference_mode():
        correspondences = matcher(input_dict)
    mkpts0 = correspondences["keypoints0"].cpu().numpy()*12
    mkpts1 = correspondences["keypoints1"].cpu().numpy()*12
    _, inliers = cv2.findFundamentalMat(mkpts0, mkpts1, cv2.USAC_MAGSAC, 0.5, 0.999, 100000)
    inliers = inliers > 0    
    M, mask = cv2.findHomography(mkpts0[inliers.squeeze(),:], mkpts1[inliers.squeeze(),:], cv2.USAC_MAGSAC,30.0)
    print(sum(mask))
    if sum(mask)>10:
        params = {'id':body['id'], 'homography': M.reshape(-1).tolist()}
        resp = client.execute(updateN, variable_values=json.dumps({'input': params}))
        print(resp)
    return True

# Receive message from SQS queue
while True:
    response = sqs.receive_message(
        QueueUrl=queue_url,
        AttributeNames=[
            'SentTimestamp'
        ],
        MaxNumberOfMessages=1,
        MessageAttributeNames=[
            'All'
        ],
        VisibilityTimeout=120,
        WaitTimeSeconds=0
    )
    try:
        for message in response['Messages']:
            receipt_handle = message['ReceiptHandle']
            #print(message['Body'])
            body=json.loads(message['Body'])
            if process(body):
                print(f'Task {body["id"]} completed. Removing from queue')
                # Delete received message from queue
                sqs.delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=receipt_handle)
            else:
                print(f'Task {message["Body"]} could not be completed. If no dead letter queue is set up this may lead to infinite loop.')

    except KeyError:
        print('Queue empty. Task exiting...')
        #break


