import json
import os
import random
import time
from datetime import datetime, timezone
from tempfile import NamedTemporaryFile

import boto3
import cv2
import kornia as K
import kornia.feature as KF
import numpy as np
import torch
from gql import gql
from gql.client import Client
from gql.transport.requests import RequestsHTTPTransport
from requests_aws4auth import AWS4Auth
from shapely.geometry import Point, Polygon
from torchvision.io import ImageReadMode, read_image

# LoFTR is trained at 528px on the short side; matching quality drops sharply off that.
TARGET_SIZE = 528
# Cap on points shown to the manual homography workbench.
MAX_SUGGESTED_POINTS = 10
# Grid cells used to force spatial spread; oversamples past the cap so empty cells don't starve the pick.
SUGGESTION_GRID = (5, 3)
# Below this many RHO inliers, the plane fit is unreliable and we skip using it as a seed.
MIN_HOMOGRAPHY_SEED = 4
# Minimum RHO inliers before we trust the homography.
MIN_HOMOGRAPHY_INLIERS = 10

torch.set_default_device("cuda")
matcher = KF.LoFTR(pretrained="outdoor")

updateNeighbour = gql("""
mutation MyMutation($homography: [Float], $image1Id: ID!, $image2Id: ID!) {
  updateImageNeighbour(input: {homography: $homography, image1Id: $image1Id, image2Id: $image2Id}) {
    image1Id
    image2Id
  }
}
""")

# Used when automatic homography fails: persist the best candidate matches
# so the manual workbench can seed the user with a starting point.
updateSuggestions = gql("""
mutation SaveSuggestions($image1Id: ID!, $image2Id: ID!, $suggestedPoints1: [Float], $suggestedPoints2: [Float]) {
  updateImageNeighbour(input: {image1Id: $image1Id, image2Id: $image2Id, suggestedPoints1: $suggestedPoints1, suggestedPoints2: $suggestedPoints2}) {
    image1Id
    image2Id
  }
}
""")

# Three transition-specific mutations. Each is conditional on a precise prior
# state so we can tell, from which one succeeded, whether to bump the counter:
#
#   - markImageNeighbourProcessedFresh: pair has never been tracked (neither
#     processedAt nor failedAt set). On success we bump pairsProcessed.
#
#   - markImageNeighbourProcessedAfterFail: pair was previously marked failed
#     and is now succeeding (redelivery after retry). Clears failedAt and sets
#     processedAt. Counter was already bumped on the failed-mark, so we DON'T
#     bump again here.
#
#   - markImageNeighbourFailed: pair has never been tracked and processing
#     blew up before a homography or suggestions could be written. On success
#     we bump pairsProcessed so the cleanup gate doesn't stall even if the
#     pair eventually DLQs.
#
# A pair that's already-processed (processedAt set) is invariant — we never
# downgrade it to failed.
markImageNeighbourProcessedFresh = gql("""
mutation MarkProcessedFresh($image1Id: ID!, $image2Id: ID!, $now: AWSDateTime!) {
  updateImageNeighbour(
    input: {image1Id: $image1Id, image2Id: $image2Id, registrationProcessedAt: $now}
    condition: {registrationProcessedAt: {attributeExists: false}, registrationFailedAt: {attributeExists: false}}
  ) {
    image1Id
    image2Id
  }
}
""")

markImageNeighbourProcessedAfterFail = gql("""
mutation MarkProcessedAfterFail($image1Id: ID!, $image2Id: ID!, $now: AWSDateTime!) {
  updateImageNeighbour(
    input: {image1Id: $image1Id, image2Id: $image2Id, registrationProcessedAt: $now, registrationFailedAt: null}
    condition: {registrationProcessedAt: {attributeExists: false}, registrationFailedAt: {attributeExists: true}}
  ) {
    image1Id
    image2Id
  }
}
""")

markImageNeighbourFailed = gql("""
mutation MarkFailed($image1Id: ID!, $image2Id: ID!, $now: AWSDateTime!) {
  updateImageNeighbour(
    input: {image1Id: $image1Id, image2Id: $image2Id, registrationFailedAt: $now}
    condition: {registrationProcessedAt: {attributeExists: false}, registrationFailedAt: {attributeExists: false}}
  ) {
    image1Id
    image2Id
  }
}
""")

# Per-image "this image has been touched by registration" marker. Composite key
# is (imageId, source) so duplicate creates fail loudly — we swallow that.
createImageProcessedBy = gql("""
mutation CreateProcessedBy($imageId: ID!, $source: String!, $projectId: ID!, $group: String) {
  createImageProcessedBy(input: {imageId: $imageId, source: $source, projectId: $projectId, group: $group}) {
    imageId
    source
  }
}
""")

# Atomic ADD on RegistrationProgress.pairsProcessed (and upserts the row if it
# doesn't exist yet — unlikely, but the runImageRegistration kickoff guarantees
# it).
incrementRegistrationProgress = gql("""
mutation IncProgress($projectId: ID!, $pairsProcessedDelta: Int, $group: String) {
  incrementRegistrationProgress(
    projectId: $projectId
    pairsProcessedDelta: $pairsProcessedDelta
    group: $group
  )
}
""")

# Atomic ADD 1 on RegistrationBucketStat.successCount. Only called for
# cross-camera pairs on successful homography. bucketKey is the composite
# "<cameraPairKey>#<bucketIndex>" sort-key value; the other two are kept as
# denormalised attributes on the row.
incrementRegistrationBucketStat = gql("""
mutation IncBucket($projectId: ID!, $bucketKey: String!, $cameraPairKey: String!, $bucketIndex: Int!, $group: String) {
  incrementRegistrationBucketStat(
    projectId: $projectId
    bucketKey: $bucketKey
    cameraPairKey: $cameraPairKey
    bucketIndex: $bucketIndex
    group: $group
  )
}
""")

sqs = boto3.client("sqs", os.environ["REGION"])
queue_url = os.environ["QUEUE_URL"]

aws = boto3.Session()
credentials = aws.get_credentials().get_frozen_credentials()
auth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    os.environ["REGION"],
    "appsync",
    session_token=credentials.token,
)
transport = RequestsHTTPTransport(
    url=os.environ["API_ENDPOINT"],
    headers={"Accept": "application/json", "Content-Type": "application/json"},
    auth=auth,
)
client = Client(transport=transport, fetch_schema_from_transport=False)


def _resize_for_matcher(img):
    """Resize so the short side is TARGET_SIZE; return tensor and scale factor."""
    height, width = img.shape[1], img.shape[2]
    scale = min(height, width) / TARGET_SIZE
    resized = K.geometry.resize(img, TARGET_SIZE, antialias=True, align_corners=False).unsqueeze(0)
    return resized, scale


def _match(img0, img1):
    """Run LoFTR and return matched points in each image's original coordinates plus confidences."""
    resized0, scale0 = _resize_for_matcher(img0)
    resized1, scale1 = _resize_for_matcher(img1)

    with torch.inference_mode():
        correspondences = matcher({"image0": resized0, "image1": resized1})

    # +0.5 / -0.5 converts between pixel-centre and pixel-corner conventions
    # because we resized with align_corners=False.
    matches0 = (correspondences["keypoints0"].cpu().numpy() + 0.5) * scale0 - 0.5
    matches1 = (correspondences["keypoints1"].cpu().numpy() + 0.5) * scale1 - 0.5
    confidences = correspondences.get("confidence")
    if confidences is not None:
        confidences = confidences.cpu().numpy()
    return matches0, matches1, confidences, max(scale0, scale1)


def _apply_masks(matches0, matches1, confidences, masks):
    """Drop matches whose endpoint falls inside any exclusion polygon."""
    polygons = [Polygon(m) for m in masks]
    points = [[Point(x, y) for x, y in pts] for pts in [matches0, matches1]]
    excluded = np.array([p.contains(points) for p in polygons]).any(axis=(0, 1))
    keep = ~excluded
    return matches0[keep], matches1[keep], (confidences[keep] if confidences is not None else None)


def _pick_suggested(matches0, matches1, confidences, homography_mask):
    """Return up to MAX_SUGGESTED_POINTS pairs, seeded from RHO inliers and spread across a grid.

    Picking purely by confidence clusters points on the most textured region; grid-binning
    forces coverage. RHO inliers get priority when there are enough of them because they're
    already plane-consistent — better anchors for a manual seed than raw feature matches.
    """
    count = min(len(matches0), len(matches1))
    if count <= MAX_SUGGESTED_POINTS:
        return matches0, matches1

    picked = []
    chosen = set()

    if homography_mask is not None and int(homography_mask.sum()) >= MIN_HOMOGRAPHY_SEED:
        hom_idx = np.where(homography_mask)[0]
        if confidences is not None:
            hom_idx = hom_idx[np.argsort(-confidences[hom_idx])]
        for i in hom_idx[:MAX_SUGGESTED_POINTS]:
            picked.append(int(i))
            chosen.add(int(i))

    cols, rows = SUGGESTION_GRID
    xs, ys = matches0[:, 0], matches0[:, 1]
    x_range = max(xs.max() - xs.min(), 1e-6)
    y_range = max(ys.max() - ys.min(), 1e-6)
    bx = np.clip(((xs - xs.min()) / x_range * cols).astype(int), 0, cols - 1)
    by = np.clip(((ys - ys.min()) / y_range * rows).astype(int), 0, rows - 1)
    bins = by * cols + bx

    used_bins = {int(bins[i]) for i in picked}

    remaining = np.array([i for i in range(count) if i not in chosen], dtype=int)
    if confidences is not None and len(remaining):
        remaining = remaining[np.argsort(-confidences[remaining])]

    # One top-confidence match per empty cell — this is what kills the clustering.
    for i in remaining:
        if len(picked) >= MAX_SUGGESTED_POINTS:
            break
        b = int(bins[i])
        if b in used_bins:
            continue
        picked.append(int(i))
        chosen.add(int(i))
        used_bins.add(b)

    # Cells exhausted — top off by raw confidence, clustering allowed.
    if len(picked) < MAX_SUGGESTED_POINTS:
        for i in remaining:
            if len(picked) >= MAX_SUGGESTED_POINTS:
                break
            if int(i) in chosen:
                continue
            picked.append(int(i))
            chosen.add(int(i))

    idx = np.array(picked[:MAX_SUGGESTED_POINTS])
    return matches0[idx], matches1[idx]


def _save_suggestions(body, matches0, matches1, confidences, homography_mask):
    if len(matches0) == 0 or len(matches1) == 0:
        return
    try:
        matches0, matches1 = _pick_suggested(matches0, matches1, confidences, homography_mask)
        client.execute(updateSuggestions, variable_values={
            "image1Id": body["image1Id"],
            "image2Id": body["image2Id"],
            "suggestedPoints1": matches0.reshape(-1).astype(float).tolist(),
            "suggestedPoints2": matches1.reshape(-1).astype(float).tolist(),
        })
        print(f'Saved {len(matches0)} suggested points for {body["image1Id"]}/{body["image2Id"]}')
    except Exception as e:
        print(f'Failed to persist suggested points for {body["image1Id"]}/{body["image2Id"]}: {e}')


def alignImages(body, img0, img1):
    """Return True iff a homography was written; False if we fell back to suggestions."""
    matches0, matches1, confidences, scale = _match(img0, img1)

    if "masks" in body:
        matches0, matches1, confidences = _apply_masks(matches0, matches1, confidences, body["masks"])

    # USAC_MAGSAC filters epipolar outliers before we try to fit a homography.
    _, epipolar_inliers = cv2.findFundamentalMat(matches0, matches1, cv2.USAC_MAGSAC, scale, 0.999, 100000)
    epipolar_mask = (epipolar_inliers > 0).squeeze()
    inliers0 = matches0[epipolar_mask, :]
    inliers1 = matches1[epipolar_mask, :]
    inlier_confidences = confidences[epipolar_mask] if confidences is not None else None

    homography, homography_inliers = cv2.findHomography(inliers0, inliers1, cv2.RHO, scale * 2)
    homography_mask = homography_inliers.ravel().astype(bool) if homography_inliers is not None else None

    if sum(homography_inliers) > MIN_HOMOGRAPHY_INLIERS:
        client.execute(updateNeighbour, variable_values={
            "image1Id": body["image1Id"],
            "image2Id": body["image2Id"],
            "homography": homography.reshape(-1).tolist(),
        })
        print(f'Linked {body["image1Id"]}/{body["image2Id"]}')
        return True

    print(f'Failed to link {body["image1Id"]}/{body["image2Id"]} ({int(sum(homography_inliers))} inliers)')
    _save_suggestions(body, inliers0, inliers1, inlier_confidences, homography_mask)
    return False


def _is_already_processed_error(exc):
    """ConditionalCheckFailedException = SQS redelivered a pair we already tracked."""
    msg = str(exc)
    return 'ConditionalCheckFailedException' in msg or 'conditional' in msg.lower()


def _is_duplicate_create_error(exc):
    """Composite key conflict on createImageProcessedBy — fine, the marker exists."""
    msg = str(exc).lower()
    return (
        'conditionalcheckfailed' in msg.replace(' ', '')
        or 'already exists' in msg
        or 'conflict' in msg
    )


def _is_terminal_for_retry(exc):
    """
    Errors that should NOT be retried.
    """
    msg = str(exc).lower()
    return (
        'conditionalcheckfailed' in msg.replace(' ', '')
        or 'conditional' in msg
        or 'already exists' in msg
        or 'conflict' in msg
    )


def _exec_with_retry(query, variables, attempts=3):
    """
    Execute an AppSync mutation with exponential-backoff retry on transient errors.
    """
    last_err = None
    for attempt in range(attempts):
        try:
            return client.execute(query, variable_values=variables)
        except Exception as e:
            if _is_terminal_for_retry(e):
                raise
            last_err = e
            if attempt < attempts - 1:
                time.sleep(0.3 * (2 ** attempt) + random.random() * 0.2)
    raise last_err


def _track_processed(body, homography_written):
    """
    Record that this pair has been processed. Handles two transitions:
      (A) fresh:  no prior tracking → set processedAt, bump counter
      (B) upgrade: previously failed → set processedAt, clear failedAt,
                    do NOT bump counter (already bumped on the failed mark)
    Either-already-processed is a no-op (returns immediately).
    """
    image1Id = body["image1Id"]
    image2Id = body["image2Id"]
    project_id = body.get("projectId")
    group = body.get("group")
    camera_pair_key = body.get("cameraPairKey")
    bucket_index = body.get("bucketIndex")

    if not project_id:
        # Older messages (before this rollout) don't carry projectId. Skip
        # tracking rather than failing — the pair was still processed.
        print(f'No projectId in message for {image1Id}/{image2Id}; skipping registration tracking')
        return

    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')

    # Transition A — fresh. Conditional on both processedAt and failedAt unset.
    bump_counter = False
    try:
        _exec_with_retry(markImageNeighbourProcessedFresh, variables={
            "image1Id": image1Id,
            "image2Id": image2Id,
            "now": now_iso,
        })
        bump_counter = True
    except Exception as e:
        if _is_already_processed_error(e):
            # Conditional check failed. Either we're upgrading from failed, or
            # the pair is already processed. Try the upgrade path next.
            try:
                _exec_with_retry(markImageNeighbourProcessedAfterFail, variables={
                    "image1Id": image1Id,
                    "image2Id": image2Id,
                    "now": now_iso,
                })
                print(f'Upgraded pair {image1Id}/{image2Id} from failed to processed (no counter bump)')
                # bump_counter stays False — counter was already incremented
                # when we marked failed earlier.
            except Exception as e2:
                if _is_already_processed_error(e2):
                    print(f'Pair {image1Id}/{image2Id} already processed (SQS redelivery); skipping increments')
                    return
                print(f'Failed to upgrade {image1Id}/{image2Id} from failed to processed: {e2}')
                return
        else:
            # Transient AppSync issue after all retries — log and bail. The
            # pair itself was processed; the counter just won't reflect it.
            print(f'Failed to mark {image1Id}/{image2Id} processed: {e}')
            return

    # Bump the progress counter only on the fresh transition.
    if bump_counter:
        try:
            _exec_with_retry(incrementRegistrationProgress, variables={
                "projectId": project_id,
                "pairsProcessedDelta": 1,
                "group": group,
            })
        except Exception as e:
            print(f'Failed to increment RegistrationProgress for {project_id}: {e}')

    for img_id in (image1Id, image2Id):
        try:
            _exec_with_retry(createImageProcessedBy, variables={
                "imageId": img_id,
                "source": "registration",
                "projectId": project_id,
                "group": group,
            })
        except Exception as e:
            if not _is_duplicate_create_error(e):
                print(f'Failed to create ImageProcessedBy for image {img_id}: {e}')

    if homography_written and camera_pair_key is not None and bucket_index is not None:
        bucket_key = f'{camera_pair_key}#{bucket_index}'
        try:
            _exec_with_retry(incrementRegistrationBucketStat, variables={
                "projectId": project_id,
                "bucketKey": bucket_key,
                "cameraPairKey": camera_pair_key,
                "bucketIndex": bucket_index,
                "group": group,
            })
        except Exception as e:
            print(
                f'Failed to increment RegistrationBucketStat '
                f'({project_id}, {bucket_key}): {e}'
            )


def _track_failed(body, error_msg):
    """
    Mark a pair as having failed processing. Bumps pairsProcessed on the first
    failure so the cleanup gate doesn't stall even if the message eventually
    DLQs. Subsequent failed redeliveries are no-ops on the counter (the
    conditional check prevents double-bumping), and a later successful
    redelivery routes through _track_processed's upgrade path.
    """
    image1Id = body["image1Id"]
    image2Id = body["image2Id"]
    project_id = body.get("projectId")
    group = body.get("group")

    if not project_id:
        print(f'No projectId in message for {image1Id}/{image2Id}; skipping failure tracking')
        return

    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')

    try:
        _exec_with_retry(markImageNeighbourFailed, variables={
            "image1Id": image1Id,
            "image2Id": image2Id,
            "now": now_iso,
        })
    except Exception as e:
        if _is_already_processed_error(e):
            # Either already processed (don't downgrade) or already failed
            # (no double-count). Either way the counter is correctly accounted.
            print(f'Pair {image1Id}/{image2Id} already tracked; skipping failure bump')
            return
        print(f'Failed to mark {image1Id}/{image2Id} as failed: {e}')
        return

    # First-time failure mark — bump pairsProcessed so the gate advances.
    try:
        _exec_with_retry(incrementRegistrationProgress, variables={
            "projectId": project_id,
            "pairsProcessedDelta": 1,
            "group": group,
        })
    except Exception as e:
        print(f'Failed to increment RegistrationProgress (on failed path) for {project_id}: {e}')

    # Truncate the error message so a poison-pill traceback doesn't flood logs.
    print(f'Marked pair {image1Id}/{image2Id} as failed: {error_msg[:300]}')


def process(body):
    # The full processing path is inside a try block: any exception raised
    # before _track_processed has a chance to run (S3 download, image decode,
    # LightGlue crash) routes through _track_failed instead. That keeps the
    # cleanup gate honest even when a message will end up in the DLQ.
    try:
        s3_client = boto3.client("s3", os.environ["REGION"])
        key0, key1 = body["keys"]
        with NamedTemporaryFile(suffix=os.path.splitext(key0)[1]) as file0, \
             NamedTemporaryFile(suffix=os.path.splitext(key1)[1]) as file1:
            s3_client.download_file(os.environ["BUCKET"], "images/" + key0, file0.name)
            s3_client.download_file(os.environ["BUCKET"], "images/" + key1, file1.name)
            img0 = read_image(file0.name, mode=ImageReadMode.GRAY, apply_exif_orientation=True).to("cuda", dtype=torch.float32) / 255
            img1 = read_image(file1.name, mode=ImageReadMode.GRAY, apply_exif_orientation=True).to("cuda", dtype=torch.float32) / 255
        homography_written = alignImages(body, img0, img1)
    except Exception as e:
        print(f'Processing error for {body.get("image1Id")}/{body.get("image2Id")}: {e}')
        try:
            _track_failed(body, str(e))
        except Exception as track_err:
            print(f'Also failed to track failure: {track_err}')
        # Return False so the outer loop doesn't delete the message. SQS will
        # redeliver it up to maxReceiveCount times; eventually it either
        # succeeds (→ _track_processed's upgrade path clears failedAt) or
        # lands in the DLQ (with failedAt set and the counter already bumped).
        return False

    # Tracking is best-effort and idempotent — never propagates exceptions.
    try:
        _track_processed(body, homography_written)
    except Exception as e:
        print(f'Tracking error for {body.get("image1Id")}/{body.get("image2Id")}: {e}')
    return True


# Build marker — bumped to force an image rebuild after adding the
# registration-tracking mutations. Bump again on future container-code changes
# that the deploy diff might otherwise consider a no-op.
print("processSQS build: registration-bucketing v4 (inline failure tracking)")

while True:
    response = sqs.receive_message(
        QueueUrl=queue_url,
        AttributeNames=["SentTimestamp"],
        MaxNumberOfMessages=1,
        MessageAttributeNames=["All"],
        VisibilityTimeout=120,
        WaitTimeSeconds=0,
    )
    try:
        for message in response["Messages"]:
            body = json.loads(message["Body"])
            if process(body):
                sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=message["ReceiptHandle"])
            else:
                # Without a DLQ this can infinite-loop on a poison message.
                print(f'Task {message["Body"]} could not be completed.')
    except KeyError:
        print("Queue empty.")
        time.sleep(60)
