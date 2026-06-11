"""SQS worker for Stormfly.

TESTING ONLY: Stormfly weights are intentionally not included in this image.
"""

import json
import os
import time
from pathlib import Path
from tempfile import NamedTemporaryFile

import boto3
from botocore.exceptions import ClientError
from gql import gql
from gql.client import Client
from gql.transport.requests import RequestsHTTPTransport
from PIL import Image
from requests_aws4auth import AWS4Auth

from stormfly_detector import StormflyDetector

REGION = os.environ['REGION']
QUEUE_URL = os.environ['QUEUE_URL']
API_ENDPOINT = os.environ['API_ENDPOINT']
MODEL_S3_URI = os.environ.get('STORMFLY_MODEL_S3', '')
THRESHOLD = float(os.environ.get('STORMFLY_THRESHOLD', '0.30'))
BOX_SIZE = int(os.environ.get('STORMFLY_BOX_SIZE', '64'))

sqs = boto3.client('sqs', region_name=REGION)
s3 = boto3.client('s3', region_name=REGION)
credentials = boto3.Session().get_credentials().get_frozen_credentials()
auth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    REGION,
    'appsync',
    session_token=credentials.token,
)
client = Client(
    transport=RequestsHTTPTransport(
        url=API_ENDPOINT,
        headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
        auth=auth,
    ),
    fetch_schema_from_transport=False,
)

create_location = gql("""
mutation CreateLocation($confidence: Float, $height: Int, $imageId: ID!, $projectId: ID="", $setId: ID!, $source: String!, $width: Int, $x: Int!, $y: Int!) {
  createLocation(input: {confidence: $confidence, height: $height, imageId: $imageId, projectId: $projectId, setId: $setId, source: $source, x: $x, y: $y, width: $width}) {
    id
  }
}
""")

detector = None


def _download_s3_object(bucket, key, destination, object_label):
    try:
        s3.download_file(bucket, key, str(destination))
    except ClientError as error:
        code = error.response.get('Error', {}).get('Code', 'unknown')
        raise RuntimeError(
            f'Failed to download {object_label} from s3://{bucket}/{key} '
            f'(S3 error {code})'
        ) from error


def _download_model():
    if not MODEL_S3_URI.startswith('s3://'):
        raise RuntimeError('STORMFLY_MODEL_S3 must be set to a private s3://bucket/key')
    bucket_and_key = MODEL_S3_URI[5:]
    bucket, key = bucket_and_key.split('/', 1)
    model_path = Path('/workspace/model_cache/stormfly.onnx')
    if not model_path.exists():
        model_path.parent.mkdir(parents=True, exist_ok=True)
        print(
            f'Downloading private Stormfly testing weights from '
            f's3://{bucket}/{key}',
            flush=True,
        )
        _download_s3_object(bucket, key, model_path, 'Stormfly model')
    return model_path


def _get_detector():
    global detector
    if detector is None:
        detector = StormflyDetector(str(_download_model()), threshold=THRESHOLD)
    return detector


def _write_location(body, image_id, x, y, confidence, size):
    client.execute(
        create_location,
        variable_values=json.dumps({
            'height': size,
            'imageId': image_id,
            'projectId': body['projectId'],
            'x': x,
            'y': y,
            'width': size,
            'setId': body['setId'],
            'confidence': confidence,
            'source': 'stormfly-testing',
        }),
    )


def handle_message(body):
    model = _get_detector()
    for image in body['images']:
        key = image['key']
        suffix = os.path.splitext(key)[1] or '.jpg'
        with NamedTemporaryFile(suffix=suffix) as temp_file:
            _download_s3_object(
                body['bucket'],
                key,
                temp_file.name,
                f'survey image {image["imageId"]}',
            )
            with Image.open(temp_file.name) as pil_image:
                detections = model.detect(pil_image)

        if not detections:
            _write_location(body, image['imageId'], 0, 0, 0.0, 0)
            continue

        for detection in detections:
            _write_location(
                body,
                image['imageId'],
                detection.x,
                detection.y,
                detection.score,
                BOX_SIZE,
            )


def main():
    while True:
        response = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            AttributeNames=['SentTimestamp'],
            MaxNumberOfMessages=1,
            MessageAttributeNames=['All'],
            VisibilityTimeout=1800,
            WaitTimeSeconds=10,
        )
        for message in response.get('Messages', []):
            try:
                handle_message(json.loads(message['Body']))
                sqs.delete_message(
                    QueueUrl=QUEUE_URL,
                    ReceiptHandle=message['ReceiptHandle'],
                )
            except Exception as error:
                print(f'Error processing Stormfly message: {error}', flush=True)
        if 'Messages' not in response:
            time.sleep(5)


if __name__ == '__main__':
    main()
