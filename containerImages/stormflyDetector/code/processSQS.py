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
THRESHOLD = float(os.environ.get('STORMFLY_THRESHOLD', '0.00'))
BOX_SIZE = int(os.environ.get('STORMFLY_BOX_SIZE', '64'))

sqs = boto3.client('sqs', region_name=REGION)
s3 = boto3.client('s3', region_name=REGION)
# ECS task-role credentials rotate every few hours; passing the refreshable
# botocore credentials object (instead of a frozen snapshot) makes AWS4Auth
# re-read keys on every request, so long-lived workers keep signing correctly.
auth = AWS4Auth(
    region=REGION,
    service='appsync',
    refreshable_credentials=boto3.Session().get_credentials(),
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


# Optional rotation support (mirrors the Scoutbot worker).
#
# Some surveys hold landscape images whose correct orientation is only reached by
# rotating them (e.g. 270 CCW), but that rotation was never written to EXIF, so the
# detector sees them in the wrong orientation. When a message carries a `rotation`
# (CCW degrees, one of 90/180/270 - message-level, or per-image as an override) we
# rotate the pixels before inference and map every detection point back into the
# original/stored frame so the saved Locations still line up with the image.
#
# An optional `landscape` flag gates the rotation on the image's actual dimensions:
#   landscape=True  -> only rotate when width  > height
#   landscape=False -> only rotate when height > width
#   landscape unset -> rotate regardless of dimensions
_TRANSPOSE = getattr(Image, 'Transpose', Image)  # enum moved under Image.Transpose in Pillow 9.1
_ROTATE_TRANSPOSE = {
    90: _TRANSPOSE.ROTATE_90,    # PIL transpose rotations are counter-clockwise
    180: _TRANSPOSE.ROTATE_180,
    270: _TRANSPOSE.ROTATE_270,
}


def _normalize_rotation(value):
    """Return rotation in CCW degrees (0/90/180/270), or 0 if unset/invalid."""
    if value is None:
        return 0
    try:
        rotation = int(value) % 360
    except (TypeError, ValueError):
        print(f'Ignoring invalid rotation value: {value!r}', flush=True)
        return 0
    if rotation not in _ROTATE_TRANSPOSE:
        if rotation != 0:
            print(f'Ignoring unsupported rotation {value!r} (expected 0/90/180/270 CCW)', flush=True)
        return 0
    return rotation


def _get_rotation(body, image):
    """Per-image rotation overrides the message-level rotation; both are CCW degrees."""
    if image.get('rotation') is not None:
        return _normalize_rotation(image.get('rotation'))
    return _normalize_rotation(body.get('rotation'))


def _normalize_landscape(value):
    """Return True/False for the landscape constraint, or None when unset/invalid."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ('true', '1', 'yes'):
            return True
        if lowered in ('false', '0', 'no'):
            return False
    print(f'Ignoring invalid landscape value: {value!r}', flush=True)
    return None


def _get_landscape(body, image):
    """Per-image landscape constraint overrides the message-level one. Returns
    True/False, or None when unset (no orientation check)."""
    if image.get('landscape') is not None:
        return _normalize_landscape(image.get('landscape'))
    return _normalize_landscape(body.get('landscape'))


def _orientation_qualifies(orig_width, orig_height, landscape):
    """Whether an image's orientation matches the optional landscape constraint.
    landscape=True requires width > height; False requires height > width;
    None imposes no constraint. Square images never qualify when a constraint is set."""
    if landscape is None:
        return True
    if landscape:
        return orig_width > orig_height
    return orig_height > orig_width


def _maybe_rotate_image(pil_image, rotation, landscape):
    """Return (image_for_inference, rotation_info).

    When `rotation` (CCW degrees) is set and the image's orientation satisfies the
    optional `landscape` constraint, the returned image is rotated and rotation_info
    records the rotation + pre-rotation dimensions so detection points can be mapped
    back to the stored frame. Otherwise the original image is returned unchanged."""
    if not rotation:
        return pil_image, {'rotation': 0}
    orig_width, orig_height = pil_image.size
    if not _orientation_qualifies(orig_width, orig_height, landscape):
        print(
            f'Skipping {rotation}-degree rotation: {orig_width}x{orig_height} '
            f'does not satisfy landscape={landscape}',
            flush=True,
        )
        return pil_image, {'rotation': 0}
    rotated = pil_image.transpose(_ROTATE_TRANSPOSE[rotation])
    return rotated, {'rotation': rotation, 'origWidth': orig_width, 'origHeight': orig_height}


def _map_point_to_original(x, y, rotation_info):
    """Map a detection point (x, y - in the rotated frame) back to the original
    pre-rotation frame, using the rotation recorded in rotation_info."""
    rotation = rotation_info.get('rotation', 0) if rotation_info else 0
    if not rotation:
        return x, y
    orig_width = rotation_info['origWidth']
    orig_height = rotation_info['origHeight']
    if rotation == 90:
        return orig_width - y, x
    if rotation == 180:
        return orig_width - x, orig_height - y
    if rotation == 270:
        return y, orig_height - x
    return x, y


def handle_message(body):
    model = _get_detector()
    for image in body['images']:
        key = image['key']
        suffix = os.path.splitext(key)[1] or '.jpg'
        rotation = _get_rotation(body, image)
        landscape = _get_landscape(body, image) if rotation else None
        with NamedTemporaryFile(suffix=suffix) as temp_file:
            _download_s3_object(
                body['bucket'],
                key,
                temp_file.name,
                f'survey image {image["imageId"]}',
            )
            with Image.open(temp_file.name) as pil_image:
                inference_image, rotation_info = _maybe_rotate_image(
                    pil_image, rotation, landscape
                )
                detections = model.detect(inference_image)

        if not detections:
            _write_location(body, image['imageId'], 0, 0, 0.0, 0)
            continue

        for detection in detections:
            x, y = _map_point_to_original(detection.x, detection.y, rotation_info)
            _write_location(
                body,
                image['imageId'],
                x,
                y,
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
                # Release the message immediately so retries (and eventual DLQ
                # redrive) happen promptly instead of after the full 30-minute
                # visibility timeout.
                try:
                    sqs.change_message_visibility(
                        QueueUrl=QUEUE_URL,
                        ReceiptHandle=message['ReceiptHandle'],
                        VisibilityTimeout=0,
                    )
                except ClientError as visibility_error:
                    print(
                        f'Failed to reset message visibility: {visibility_error}',
                        flush=True,
                    )
        if 'Messages' not in response:
            time.sleep(5)


if __name__ == '__main__':
    main()
