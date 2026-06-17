import json
import os
import sys
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
import logging
import torch
                                                                                                                                         
logging.basicConfig(level=logging.INFO)   
from gql.transport.requests import log as requests_logger                                                               
                                                                                                                        
requests_logger.setLevel(logging.WARNING)

sqs = boto3.client('sqs',os.environ['REGION'])
queue_url = os.environ['QUEUE_URL']
single_image_failure_visibility_seconds = int(
    os.environ.get('SINGLE_IMAGE_FAILURE_VISIBILITY_SECONDS', '1800')
)

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

def _message_context(message):
    body = json.loads(message['Body'])
    image_ids = [image.get('imageId') for image in body.get('images', [])]
    receive_count = message.get('Attributes', {}).get('ApproximateReceiveCount', 'unknown')
    return body, message.get('MessageId', 'unknown'), image_ids, receive_count

def _split_batch_message(body, source_message_id):
    images = body.get('images', [])
    for image in images:
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({
                **body,
                'images': [image],
                'splitFromBatch': True,
                'splitFromMessageId': source_message_id,
            }),
        )
    logging.info(
        'Split failed batch message %s into %d single-image messages: %s',
        source_message_id,
        len(images),
        [image.get('imageId') for image in images],
    )

def _split_and_delete_batch_message(body, source_message_id, receipt_handle):
    try:
        _split_batch_message(body, source_message_id)
        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
        logging.info('Deleted failed batch message %s after successful split.', source_message_id)
        return True
    except Exception as error:
        logging.error(
            'Failed to split/delete batch message %s; original message will retry. Error: %s',
            source_message_id,
            _error_summary(error),
        )
        return False

def _cleanup_files(files):
    for file in files:
        try:
            if os.path.exists(file):
                os.remove(file)
        except Exception:
            logging.warning('Failed to remove temporary file %s', file)

def _error_summary(error):
    return f'{type(error).__name__}: {error}'

def _extend_failed_single_image_visibility(message, message_id, image_ids):
    try:
        sqs.change_message_visibility(
            QueueUrl=queue_url,
            ReceiptHandle=message['ReceiptHandle'],
            VisibilityTimeout=single_image_failure_visibility_seconds,
        )
        logging.info(
            'Delayed retry for failed single-image Scoutbot message %s by %d seconds. Image ids: %s',
            message_id,
            single_image_failure_visibility_seconds,
            image_ids,
        )
    except Exception as error:
        logging.error(
            'Failed to delay retry for single-image Scoutbot message %s. It will use the current visibility timeout. Error: %s',
            message_id,
            _error_summary(error),
        )

def process_scoutbot(input_queue, output_queue):
    while True:
        task = input_queue.get()
        if task is None:  # Sentinel value to stop the process
            output_queue.put(None)
            logging.info('Scoutbot process received sentinel value. Exiting.')
            break
        body, message_id, image_ids, receive_count = _message_context(task['message'])
        logging.info(
            'Processing Scoutbot message %s attempt %s with image ids: %s',
            message_id,
            receive_count,
            image_ids,
        )
        try:
            _, detects_list = scoutbot.batch_v3(task['files'], 'v3', torch.cuda.current_device())
            output_queue.put((detects_list, task['message']))
        except Exception as error:
            if len(body.get('images', [])) > 1 and not body.get('splitFromBatch'):
                logging.error(
                    'Scoutbot batch failed for message %s; splitting image ids into single-image messages: %s; error: %s',
                    message_id,
                    image_ids,
                    _error_summary(error),
                )
                _split_and_delete_batch_message(
                    body,
                    message_id,
                    task['message']['ReceiptHandle'],
                )
            else:
                logging.error(
                    'Scoutbot single-image message %s failed and will retry/DLQ via SQS. Image ids: %s; error: %s',
                    message_id,
                    image_ids,
                    _error_summary(error),
                )
                _extend_failed_single_image_visibility(task['message'], message_id, image_ids)
        finally:
            _cleanup_files(task['files'])

def process_output(output_queue):
    while True:
        output = output_queue.get() 
        if output is None:
            logging.info('Output process received sentinel value. Exiting.')
            break
        detects_list, message = output
        message_id = message.get('MessageId', 'unknown')
        image_ids = []
        try:
            body, message_id, image_ids, receive_count = _message_context(message)
            for detects, image in zip(detects_list, body['images']):
                detection_count = len(detects) if detects else 0
                logging.info(
                    'Scoutbot message %s image %s produced %d detections.',
                    message_id,
                    image['imageId'],
                    detection_count,
                )
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
            sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=message['ReceiptHandle'])
            logging.info(
                'Completed Scoutbot message %s attempt %s with image ids: %s',
                message_id,
                receive_count,
                image_ids,
            )
        except Exception as error:
            logging.error(
                'Failed to write Scoutbot results for message %s; it will retry/DLQ via SQS. Image ids: %s; error: %s',
                message_id,
                image_ids,
                _error_summary(error),
            )
            if len(image_ids) == 1:
                _extend_failed_single_image_visibility(message, message_id, image_ids)

def main():
    sqs = boto3.client('sqs', os.environ['REGION'])
    queue_url = os.environ['QUEUE_URL']
    s3_client = boto3.client('s3', os.environ['REGION'])

    # Fail fast if CUDA is unavailable, rather than consuming messages we can't process
    if not torch.cuda.is_available():
        logging.error('CUDA is not available. Exiting so ECS can replace this task.')
        sys.exit(1)

    # CUDA cannot be re-initialized in a forked subprocess. The torch.cuda.is_available()
    # check above initializes a CUDA context in this parent process, so children must be
    # started with 'spawn' (a fresh interpreter) rather than the Linux default of 'fork'.
    ctx = multiprocessing.get_context('spawn')

    # Create queues for inter-process communication (must share the spawn context)
    input_queue = ctx.Queue(maxsize=5)  # Adjust capacity as needed
    output_queue = ctx.Queue()

    # Start the scoutbot process
    scoutbot_process = ctx.Process(target=process_scoutbot, args=(input_queue, output_queue))
    output_process = ctx.Process(target=process_output, args=(output_queue,))
    scoutbot_process.start()
    output_process.start()

    try:
        while True:
            # Fail fast if either child process has died so ECS replaces the task
            if not scoutbot_process.is_alive() or not output_process.is_alive():
                logging.error(f'Child process died (scoutbot exitcode={scoutbot_process.exitcode}, output exitcode={output_process.exitcode}). Exiting.')
                scoutbot_process.terminate()
                output_process.terminate()
                sys.exit(1)

            response = sqs.receive_message(
                QueueUrl=queue_url,
                AttributeNames=['SentTimestamp', 'ApproximateReceiveCount'],
                MaxNumberOfMessages=1,
                MessageAttributeNames=['All'],
                VisibilityTimeout=120,
                WaitTimeSeconds=0
            )

            if 'Messages' in response:
                for message in response['Messages']:
                    body, message_id, image_ids, receive_count = _message_context(message)
                    logging.info(
                        'Received Scoutbot message %s attempt %s with image ids: %s',
                        message_id,
                        receive_count,
                        image_ids,
                    )

                    keys= [image['key'] for image in body['images']]
                    files = [NamedTemporaryFile(suffix=os.path.splitext(key)[1]).name for key in keys]
                    try:
                        for key,file in zip(keys,files):
                            s3_client.download_file(body['bucket'], key, file)
                        
                        # Put task in the input queue
                        input_queue.put({'files':files, 'message': message})
                    except Exception as error:
                        _cleanup_files(files)
                        if len(body.get('images', [])) > 1 and not body.get('splitFromBatch'):
                            logging.error(
                                'Failed to prepare Scoutbot batch message %s; splitting image ids into single-image messages: %s; error: %s',
                                message_id,
                                image_ids,
                                _error_summary(error),
                            )
                            _split_and_delete_batch_message(
                                body,
                                message_id,
                                message['ReceiptHandle'],
                            )
                        else:
                            logging.error(
                                'Failed to prepare Scoutbot single-image message %s; it will retry/DLQ via SQS. Image ids: %s; error: %s',
                                message_id,
                                image_ids,
                                _error_summary(error),
                            )
                            _extend_failed_single_image_visibility(message, message_id, image_ids)
            else:
                logging.debug('Scoutbot queue empty.')
                time.sleep(30)

    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        # Signal the scoutbot process to stop (skip if it already died, so we don't
        # block forever on a full queue)
        if scoutbot_process.is_alive():
            input_queue.put(None)
        scoutbot_process.join()
        output_process.join()

if __name__ == "__main__":
    main()
