import time
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
from point_finder import MultiTypeBlockPointFinder
import h5py 
import numpy as np
from abc import ABCMeta

class HMVisProjector():
    """Base class for projectors."""
    __metaclass__ = ABCMeta

    def __init__(self):
        self.offset = 0.0
        self.stride = 0.0
        self.id_str = None

    def hm_to_vis(self, hm_xy):
        vis_x = hm_xy['x']*self.stride + self.offset
        vis_y = hm_xy['y']*self.stride + self.offset
        return vis_x, vis_y

    def vis_to_hm(self, vis_xy):
        hm_x = int(round((vis_xy['x'] - self.offset)/self.stride))
        hm_y = int(round((vis_xy['y'] - self.offset)/self.stride))
        return hm_x, hm_y

class MobileNetNormalProjector(HMVisProjector):
    def __init__(self):
        HMVisProjector.__init__(self)
        self.offset = 0
        self.stride = 32.0
        self.id_str = 'mobilenet_padded_normal'

proj=MobileNetNormalProjector()

createLocation=gql("""
mutation MyMutation($confidence: Float, $height: Int, $imageId: ID!, $projectId: ID="", $setId: ID!, $source: String!, $width: Int, $x: Int!, $y: Int!) {
  createLocation(input: {confidence: $confidence, height: $height, imageId: $imageId, projectId: $projectId, setId: $setId, source: $source, x: $x, y: $y, width: $width}){
    id
  }
}
""")

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

def processFile(file,height,width,threshold):
    blockFinder = MultiTypeBlockPointFinder(smoothing_flag=True, block_width=width,block_height=height,threshold=threshold)
    with h5py.File(file, 'r') as h5f:
        hm_xyvs=blockFinder.detect(np.asarray(h5f['heatmap']))
    return [(proj.hm_to_vis(hm_xyv),float(hm_xyv['features']['hm_block_max'])) for hm_xyv in hm_xyvs]
        
def process(body):
    #s3_client = boto3.client('s3',body['region'])
    width=body['width']
    height=body['height']
    threshold=body['threshold']
    setId=body['setId']
    s3_client = boto3.client('s3',os.environ['REGION'])
    key=body['key']
    with NamedTemporaryFile(suffix=os.path.splitext(key)[1]) as tmpFile:
        print(key)
        s3_client.download_file(body['bucket'],key,tmpFile.name)
        print(tmpFile.name)
        pts=processFile(tmpFile.name,height,width,threshold)
        print(pts)
    if not pts:
        resp = client.execute(createLocation, variable_values=json.dumps({
            'height': 0,
            'imageId': body['imageId'],
            'projectId': body['projectId'],
            'x': 0,
            'y': 0,
            'width': 0,
            'setId': setId,
            'confidence': 0,
            'source': 'heatmap'}))
        print(resp)
    else:
        for point,val in pts:
            resp = client.execute(createLocation, variable_values=json.dumps({
                'height': height , 
                'imageId': body['imageId'], 
                'projectId': body['projectId'],
                'x': point[0], 
                'y':point[1], 
                'width': width,             
                'setId': setId,
                'confidence':val,
                'source': 'heatmap'}))
            print(resp)
    return True
        # location=Location(x=int(pt[0]), y=int(pt[1]), image=image)
        # for ftype in hm_xyv['features'].keys():
        #     feature = Feature(type=ftype, vector_string=str(hm_xyv['features'][ftype]),
        #                             vector_val=hm_xyv['features'][ftype].item(),
        #                             location=location)
    #     db.session.add(location)
    # db.session.commit()

#processFile('./11126RB.h5')
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
            print(message['Body'])
            body=json.loads(message['Body'])
            if process(body):
                print(f'Task {message["Body"]} completed. Removing from queue')
                # Delete received message from queue
                sqs.delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=receipt_handle)
            else:
                print(f'Task {message["Body"]} could not be completed. If no dead letter queue is set up this may lead to infinite loop.')

    except KeyError:
        time.sleep(10)
        print('Queue empty.')
    #     break