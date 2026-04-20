import json
import os
import time
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
    # Return True so SQS drops the message — the pair now lives in the manual queue.
    return True


def process(body):
    s3_client = boto3.client("s3", os.environ["REGION"])
    key0, key1 = body["keys"]
    with NamedTemporaryFile(suffix=os.path.splitext(key0)[1]) as file0, \
         NamedTemporaryFile(suffix=os.path.splitext(key1)[1]) as file1:
        s3_client.download_file(os.environ["BUCKET"], "images/" + key0, file0.name)
        s3_client.download_file(os.environ["BUCKET"], "images/" + key1, file1.name)
        img0 = read_image(file0.name, mode=ImageReadMode.GRAY, apply_exif_orientation=True).to("cuda", dtype=torch.float32) / 255
        img1 = read_image(file1.name, mode=ImageReadMode.GRAY, apply_exif_orientation=True).to("cuda", dtype=torch.float32) / 255
    return alignImages(body, img0, img1)


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
