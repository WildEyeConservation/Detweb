# Heatmapper (elephant detector) container

Unified GPU worker that does **heatmap generation and point detection in one process**,
replacing the old two-stage pipeline (the `Heatmapper4` EC2 AMI that wrote `.h5`
heatmaps to S3, followed by the separate CPU `pointFinderImage` that read them). The
intermediate heatmap is no longer stored.

## Pipeline (`code/processSQS.py`)

Per SQS message: download the image → (optional) rotate it → MobileNet heatmap →
point finder on the heatmap → map points back to the stored frame → post `Location`s
to AppSync (`source: 'heatmap'`). See the module docstring for the message schema.

**Concurrency.** These steps run as a threaded pipeline so the GPU never idles on
I/O: `downloader(s) → infer_queue → single GPU inferer → post_queue → poster(s)`.
The GPU thread only does `generate()` + (cheap) point-finding back-to-back, while S3
downloads of upcoming images and the per-detection HTTP posts of finished images run
on their own threads. The infer queue is shallow (decoded full-res images are large);
each message is deleted only after its detections are posted, and reset to retry on
any stage failure. Tunable via env vars: `ELEPHANT_DOWNLOAD_THREADS` (2),
`ELEPHANT_POST_THREADS` (3), `ELEPHANT_PREFETCH` (2), `ELEPHANT_POST_QUEUE` (16).

- **Heatmap model** (`mobilenet_heatmapper.py` + `mobilenet_ivx.py`): a fully
  convolutional TF-Slim MobileNet-v1 (`num_classes=2`). Full-resolution image in,
  stride-32 softmax map out; **channel 1** is the elephant class. Ported verbatim from
  the AMI worker except the input is now a uint8 array placeholder (instead of an
  in-graph `decode_png`) so we can decode/rotate with PIL/numpy first.
- **Point finder** (`point_finder.py`): the same `MultiTypeBlockPointFinder` used by
  the legacy point-finder container.
- **Rotation** (optional `rotation` 90/180/270 CCW + `landscape` guard): same semantics
  as the scoutbot/stormfly workers. Because heatmap + point finding happen in-process,
  the original image dimensions are known directly, so points map back exactly.

## Why TensorFlow 1.14

The checkpoint is a TF1 (`tf.contrib.slim`) checkpoint. Keeping the TF 1.14 base
(`tensorflow/tensorflow:1.14.0-gpu-py3`, CUDA 10, Python 3.6) loads it unchanged and
avoids a risky TF2/ONNX port. Modern GPU-host drivers run CUDA 10 containers via
forward compatibility. `code/requirements.txt` is pinned to py3.6-terminal versions;
do not let anything pull `numpy >= 1.17` (breaks TF 1.14).

## Model files (`models/`, gitignored)

`models/batched_ss30_bs10_bg4_0/` holds the TF1 checkpoint, baked into the image via
`COPY models/ /models/`. Only the active checkpoint is kept:

| File | Notes |
|---|---|
| `checkpoint` | pointer → `/models/batched_ss30_bs10_bg4_0/model.ckpt-17334` |
| `model.ckpt-17334.data-00000-of-00001` | ~38 MB weights |
| `model.ckpt-17334.index` | |
| `model.ckpt-17334.meta` | graph metadata |

These were extracted from the `Heatmapper4` AMI (`ami-0d0e015cd8fe6c8c1`, eu-west-1).
`models/` is gitignored; restore it from the project model backup before building.

## Build

```sh
docker build -t heatmapper-local containerImages/heatmapperImage
```

Wired into `amplify/backend.ts` as a GPU `AutoProcessor` (G4DN), triggered by the
`runElephantDetector` mutation.
