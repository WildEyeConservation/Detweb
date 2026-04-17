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
import time
import numpy as np
from shapely.geometry import Polygon, Point

torch.set_default_device('cuda')
matcher = KF.LoFTR(pretrained="outdoor")
updateN=gql("""
mutation MyMutation($homography: [Float], $image1Id: ID!, $image2Id: ID!) {
  updateImageNeighbour(input: {homography: $homography, image1Id: $image1Id, image2Id: $image2Id}) {
    image1Id
    image2Id
  }
}
""")

# Used when automatic homography fails: we persist a small set of the best
# candidate matches so the manual workbench can show the user a starting point.
updateSuggestions = gql("""
mutation SaveSuggestions($image1Id: ID!, $image2Id: ID!, $suggestedPoints1: [Float], $suggestedPoints2: [Float]) {
  updateImageNeighbour(input: {image1Id: $image1Id, image2Id: $image2Id, suggestedPoints1: $suggestedPoints1, suggestedPoints2: $suggestedPoints2}) {
    image1Id
    image2Id
  }
}
""")

# The manual workbench is designed for up to 12 paired points
MAX_SUGGESTED_POINTS = 12

# Create SQS client
sqs = boto3.client('sqs',os.environ['REGION'])
queue_url = os.environ['QUEUE_URL']

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
    os.environ['REGION'],
    'appsync',
    session_token=credentials.token,
)
transport = RequestsHTTPTransport(url=os.environ['API_ENDPOINT'],
                                    headers=headers,
                                    auth=auth)
client = Client(transport=transport,
                fetch_schema_from_transport=False)

TARGET_SIZE = 528

def alignImages( body, img0, img1):
    img0_height, img0_width = img0.shape[1], img0.shape[2]
    img1_height, img1_width = img1.shape[1], img1.shape[2]
    img0_ratio = min(img0_height, img0_width)/TARGET_SIZE
    img1_ratio = min(img1_height, img1_width)/TARGET_SIZE
    # Resize img0 to have shortest side of TARGET_SIZE
    img0 = K.geometry.resize(img0, TARGET_SIZE, antialias=True, align_corners=False).unsqueeze(0)
    # Resize img1 to have shortest side of TARGET_SIZE
    img1 = K.geometry.resize(img1, TARGET_SIZE, antialias=True, align_corners=False).unsqueeze(0)
    input_dict = {
        "image0": img0, #K.color.rgb_to_grayscale(img1),  # LofTR works on grayscale images only
        "image1": img1 #K.color.rgb_to_grayscale(img2),
    }
    with torch.inference_mode():
        correspondences = matcher(input_dict)
    # Convert to origin coordinate system, bearing in mind that align_corners=False . See https://kornia.readthedocs.io/en/latest/geometry.html
    mkpts0 = (correspondences["keypoints0"].cpu().numpy()+0.5)*img0_ratio-0.5
    mkpts1 = (correspondences["keypoints1"].cpu().numpy()+0.5)*img1_ratio-0.5
    # LoFTR returns a per-match confidence; keep it aligned with mkpts0/mkpts1
    # so we can rank the candidates we surface to the user on failure.
    confidence = correspondences.get("confidence")
    if confidence is not None:
        confidence = confidence.cpu().numpy()
    if 'masks' in body:
        masks=[Polygon(mask) for mask in body['masks']]
        points = [[Point(x,y) for x,y in points] for points in [mkpts0,mkpts1]]
        masked=np.array([mask.contains(points) for mask in masks]).any(axis=(0,1))
        mkpts0=mkpts0[~masked]
        mkpts1=mkpts1[~masked]
        if confidence is not None:
            confidence = confidence[~masked]
    _, inliers = cv2.findFundamentalMat(mkpts0, mkpts1, cv2.USAC_MAGSAC, max(img0_ratio,img1_ratio), 0.999, 100000)
    inliers = inliers > 0
    inlier_mask = inliers.squeeze()
    inlier_pts0 = mkpts0[inlier_mask,:]
    inlier_pts1 = mkpts1[inlier_mask,:]
    inlier_conf = confidence[inlier_mask] if confidence is not None else None
    M, mask = cv2.findHomography(inlier_pts0, inlier_pts1, cv2.RHO,max(img0_ratio,img1_ratio)*2)
    if sum(mask)>10:
        params = {'image1Id':body['image1Id'], 'image2Id':body['image2Id'], 'homography': M.reshape(-1).tolist()}
        resp = client.execute(updateN, variable_values=params)
        print(f'Linked {body["image1Id"]}/{body["image2Id"]}')
        return True
    else:
        print(f'Failed to link {body["image1Id"]}/{body["image2Id"]}')
        print(sum(mask))
        # Persist up to MAX_SUGGESTED_POINTS candidate correspondences so the
        # manual workbench can pre-populate the user with a starting set.
        try:
            n_candidates = min(len(inlier_pts0), len(inlier_pts1))
            if n_candidates > 0:
                if n_candidates > MAX_SUGGESTED_POINTS:
                    if inlier_conf is not None and len(inlier_conf) == n_candidates:
                        # Take the highest-confidence matches so the user gets
                        # the model's best guesses, not an arbitrary subset.
                        idx = np.argsort(-inlier_conf)[:MAX_SUGGESTED_POINTS]
                    else:
                        idx = np.linspace(0, n_candidates - 1, MAX_SUGGESTED_POINTS).astype(int)
                    pts0 = inlier_pts0[idx]
                    pts1 = inlier_pts1[idx]
                else:
                    pts0 = inlier_pts0
                    pts1 = inlier_pts1
                params = {
                    'image1Id': body['image1Id'],
                    'image2Id': body['image2Id'],
                    'suggestedPoints1': pts0.reshape(-1).astype(float).tolist(),
                    'suggestedPoints2': pts1.reshape(-1).astype(float).tolist(),
                }
                client.execute(updateSuggestions, variable_values=params)
                print(f'Saved {len(pts0)} suggested points for {body["image1Id"]}/{body["image2Id"]}')
        except Exception as e:
            print(f'Failed to persist suggested points for {body["image1Id"]}/{body["image2Id"]}: {e}')
        # Return True so the message is removed from SQS — we've recorded
        # what we could and the pair will be picked up by the manual queue.
        return True

def process(body):
    s3_client = boto3.client('s3',os.environ['REGION'])
    keys=body['keys']
    with NamedTemporaryFile(suffix=os.path.splitext(keys[0])[1]) as tmpFile1,NamedTemporaryFile(suffix=os.path.splitext(keys[1])[1]) as tmpFile2:
        s3_client.download_file(os.environ['BUCKET'],'images/'+keys[0],tmpFile1.name)
        s3_client.download_file(os.environ['BUCKET'],'images/'+keys[1],tmpFile2.name)
        img1=read_image(tmpFile1.name,mode=ImageReadMode.GRAY,apply_exif_orientation=True).to('cuda',dtype=torch.float32)/255
        img2=read_image(tmpFile2.name,mode=ImageReadMode.GRAY,apply_exif_orientation=True).to('cuda',dtype=torch.float32)/255
    return alignImages(body, img1, img2)


# For local testing without waiting forever for a download to complete.

# img1=read_image('./testData/42598LA.jpg',mode=ImageReadMode.GRAY,apply_exif_orientation=True).to('cuda',dtype=torch.float32)/255
# img2=read_image('./testData/42599LA.jpg',mode=ImageReadMode.GRAY,apply_exif_orientation=True).to('cuda',dtype=torch.float32)/255

# body = {"image1Id": "b2e3bef7-194d-4705-aff9-aafa07371dac",
#         "image2Id": "e146615a-76c9-4571-9fb7-fc1022b6897a",
#         "action": "register", 
#         "masks": [[[0, 0], [0, 720], [1600, 720], [1600, 0]], [[0, 0], [0, 720], [1600, 720], [1600, 0]]]}
# alignImages(body, img1, img2)

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
                # Delete received message from queue
                sqs.delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=receipt_handle)
            else:
                print(f'Task {message["Body"]} could not be completed. If no dead letter queue is set up this may lead to infinite loop.')

    except KeyError:
        print('Queue empty.')
        time.sleep(60)
        #break


