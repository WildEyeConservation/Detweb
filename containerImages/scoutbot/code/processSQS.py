import json
import os
from boto3 import Session as AWSSession
from gql import gql
from gql.client import Client
from gql.transport.requests import RequestsHTTPTransport
import boto3
from botocore.exceptions import ClientError
from tempfile import NamedTemporaryFile
import time
from contextlib import ExitStack
import scoutbot
from requests_aws4auth import AWS4Auth
import multiprocessing
from multiprocessing import Queue
import logging        
import torch
                                                                                                                                         
logging.basicConfig(level=logging.INFO)   
from gql.transport.requests import log as requests_logger                                                               
                                                                                                                        
requests_logger.setLevel(logging.WARNING)

sqs = boto3.client('sqs',os.environ['REGION'])
queue_url = os.environ['QUEUE_URL']

createLocation=gql("""
mutation MyMutation($confidence: Float, $height: Int, $imageId: ID!, $projectId: ID="", $setId: ID!, $source: String!, $width: Int, $x: Int!, $y: Int!) {
  createLocation(input: {confidence: $confidence, height: $height, imageId: $imageId, projectId: $projectId, setId: $setId, source: $source, x: $x, y: $y, width: $width}){
    id
  }
}
""")


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

def process_scoutbot(input_queue, output_queue):
    while True:
        startTime= time.time()
        task = input_queue.get()
        logging.info(f'GPU Waited {time.time()-startTime} seconds for task {json.dumps(task)}')
        if task is None:  # Sentinel value to stop the process
            output_queue.put(None)
            logging.info('Scoutbot process received sentinel value. Exiting.')
            break
        _, detects_list = scoutbot.batch_v3(task['files'], 'v3', torch.cuda.current_device())
        # Delete the files
        for file in task['files']:
            os.remove(file)
        output_queue.put((detects_list, task['message']))

def process_output(output_queue):
    while True:
        output = output_queue.get() 
        if output is None:
            logging.info('Output process received sentinel value. Exiting.')
            break
        detects_list, message = output
        body = json.loads(message['Body'])
        for detects, image in zip(detects_list, body['images']):
            logging.info(f"Image {image['imageId']} detects: {detects}")
            if not detects:
                resp = client.execute(createLocation, variable_values=json.dumps({
                    'height': 0,
                    'imageId': image['imageId'],
                    'projectId': body['projectId'],
                    'x': 0,
                    'y': 0,
                    'width': 0,
                    'setId': body['setId'],
                    'confidence': 0,
                    'source': 'scoutbotv3'
                }))
                logging.info(f"Added zero location for image {image['imageId']}.")
            else:
                for detect in detects:
                    resp = client.execute(createLocation, variable_values=json.dumps({
                        'height': round(detect['h']),
                        'imageId': image['imageId'],
                        'projectId': body['projectId'],
                        'x': round(detect['x'] + detect['w'] / 2),
                        'y': round(detect['y'] + detect['h'] / 2),
                        'width': round(detect['w']),
                        'setId': body['setId'],
                        'confidence': detect['c'],
                        'source': 'scoutbotv3'
                    }))
                    logging.info(f"Added location for image {image['imageId']} with confidence {detect['c']}.")
        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=message['ReceiptHandle'])

def main():
    sqs = boto3.client('sqs', os.environ['REGION'])
    queue_url = os.environ['QUEUE_URL']
    s3_client = boto3.client('s3', os.environ['REGION'])

    # Create queues for inter-process communication
    input_queue = Queue(maxsize=5)  # Adjust capacity as needed
    output_queue = Queue()

    # Start the scoutbot process
    scoutbot_process = multiprocessing.Process(target=process_scoutbot, args=(input_queue, output_queue))
    output_process = multiprocessing.Process(target=process_output, args=(output_queue,))
    scoutbot_process.start()
    output_process.start()

    try:
        while True:
            response = sqs.receive_message(
                QueueUrl=queue_url,
                AttributeNames=['SentTimestamp'],
                MaxNumberOfMessages=1,
                MessageAttributeNames=['All'],
                VisibilityTimeout=120,
                WaitTimeSeconds=0
            )

            if 'Messages' in response:
                for message in response['Messages']:
                    receipt_handle = message['ReceiptHandle']
                    body = json.loads(message['Body'])
                    logging.info(f'Task {message["Body"]} received')

                    keys= [image['key'] for image in body['images']]
                    files = [NamedTemporaryFile(suffix=os.path.splitext(key)[1]).name for key in keys]
                    for key,file in zip(keys,files):
                        s3_client.download_file(body['bucket'], key, file)
                    
                    # Put task in the input queue
                    input_queue.put({'files':files, 'message': message})
            else:
                print('Queue empty.')
                time.sleep(30)

    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        # Signal the scoutbot process to stop
        input_queue.put(None)
        scoutbot_process.join()
        output_process.join()

if __name__ == "__main__":
    main()
