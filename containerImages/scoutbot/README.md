# Scoutbot container

Runs scoutbot v3 detection against images queued on SQS (`code/processSQS.py`).

## Model files

Scoutbot historically downloaded its models at build time (`scoutbot fetch`)
from `https://wildbookiarepository.azureedge.net/models/...`. That CDN was
retired (azureedge.net shutdown) and the origin is no longer publicly
reachable, so the models can no longer be downloaded from upstream.

The build instead pre-seeds pooch's download cache: the Dockerfile does
`COPY models/ /root/.cache/pooch/` and scoutbot resolves every `fetch()` from
that cache without network access. The files in `models/` must keep their
exact pooch cache names (`<md5-of-url>-<filename>`):

| File | Size | SHA256 |
|---|---|---|
| `08d2dba76ee6f72c86cad2a8ae2e65b6-scout.loc.mvp.0.onnx` | 203171952 | `f5bd22fbacc91ba4cf5abaef5197d1645ae5bc4e63e88839e6848c48b3710c58` |
| `1531819e3bc2a3f67a7b407832add7fe-yolov8-onecls.kaza.pt` | 103960395 | `4894ed26c9e9b93e68e446bc172e0b3a7d42898542bfcdf0614d42c3a7bac935` |
| `e13f3bfe4c822e4cf14fe8c398ae5a04-yolov8-cls.kaza.pt` | 52065814 | `5666d0cfbb9796b5e3f69fb48be3380ae57b2e4ee8573e6c0941cd064f04083f` |
| `e2bea798d37acd4f1a993fcb1af0af3d-scout.wic.mvp.2.0.onnx` | 94359210 | `3ff3a192803e53758af5e112526ba9622f1dedc55e2fa88850db6f32af160f32` |

These are the `mvp` WIC/LOC models and the `v3`/`v3-cls` YOLOv8 models
(production only uses `v3`/`v3-cls` via `scoutbot.batch_v3`). The `phase1`
models were never present in the deployed image - the old
`scoutbot fetch --config phase1` step silently failed to cache anything - so
they are not preserved here and the fetch line was dropped.

The two `.onnx` SHA256s match the `known_hash` values hard-coded in scoutbot
0.1.18 (commit `e0bb33a0f72f2dfd0c21e0ee46852dba2be1fdd0`, pinned in the
Dockerfile); the `.pt` files have `known_hash=None` upstream. They were
recovered from the pooch cache (`/root/.cache/pooch/`) of the last deployed
container image.

## Restoring `models/`

`models/` is gitignored (~440 MB) and is not part of this repository. The
files are kept in a private project backup - ask a maintainer for access.
After downloading them into `containerImages/scoutbot/models/`, verify the
SHA256 hashes against the table above.

## Verifying a build

```sh
docker build -t scoutbot-local containerImages/scoutbot
docker run --rm --network none --entrypoint python3 scoutbot-local \
    -c "from scoutbot import loc, wic; print(loc.fetch(config='v3')); print(loc.fetch(config='v3-cls')); print(loc.fetch(config='mvp')); print(wic.fetch(config='mvp'))"
```

All four paths must resolve from the cache with no network access.
