"""Minimal Stormfly ONNX inference wrapper for the Detweb queue worker."""

import os
from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None

PATCH = 512
DOWN_RATIO = 2
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
BATCH = int(os.environ.get('STORMFLY_BATCH', '16'))
FP16 = os.environ.get('STORMFLY_FP16', '0').strip().lower() in ('1', 'true', 'yes', 'on')


@dataclass(frozen=True)
class Detection:
    x: int
    y: int
    score: float


def _tile_starts(total, patch, overlap):
    if total <= patch:
        return [0]
    stride = max(1, patch - overlap)
    starts = list(range(0, total - patch + 1, stride))
    if starts[-1] != total - patch:
        starts.append(total - patch)
    return starts


def _ensure_fp16_model(model_path):
    """Return a path to an fp16 copy of the model, converting and caching once.

    keep_io_types leaves the graph inputs/outputs as fp32 (cast nodes are
    inserted at the boundary), so callers keep feeding fp32 tiles and reading
    fp32 heatmaps — only the internal convolutions run in half precision. The
    converter also clamps large activations so a regression head cannot overflow
    to inf. onnx/onnxconverter-common are imported lazily so the fp32 path (and
    the unit tests, which stub onnxruntime) never need them installed.
    """
    fp16_path = f'{os.path.splitext(model_path)[0]}_fp16.onnx'
    if not os.path.isfile(fp16_path):
        import onnx
        from onnxconverter_common import float16

        converted = float16.convert_float_to_float16(
            onnx.load(model_path), keep_io_types=True
        )
        onnx.save(converted, fp16_path)
    return fp16_path


class StormflyDetector:
    def __init__(self, model_path, threshold=0.00, overlap=160):
        if not os.path.isfile(model_path):
            raise FileNotFoundError(f'Stormfly model not found: {model_path}')

        providers = ['CPUExecutionProvider']
        if 'CUDAExecutionProvider' in ort.get_available_providers():
            providers.insert(0, 'CUDAExecutionProvider')

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.log_severity_level = 3
        load_path = _ensure_fp16_model(model_path) if FP16 else model_path
        self.session = ort.InferenceSession(
            load_path,
            sess_options=options,
            providers=providers,
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.threshold = threshold
        self.overlap = overlap
        # Honour a fixed batch axis if the export declares one. A symbolic
        # (str), None, or negative dim means the batch axis is dynamic and we
        # can stack tiles; a concrete int pins us to that size (usually 1).
        batch_dim = self.session.get_inputs()[0].shape[0]
        self.max_batch = (
            max(1, batch_dim)
            if isinstance(batch_dim, int) and batch_dim > 0
            else BATCH
        )
        print(
            f'Stormfly providers: {self.session.get_providers()} '
            f'(precision: {"fp16" if FP16 else "fp32"}, tile batch: {self.max_batch})'
        )

    def detect(self, image):
        # The web tile pipeline auto-rotates from EXIF. Run inference in that
        # same orientation so detections use the displayed image coordinates.
        oriented_image = ImageOps.exif_transpose(image)
        arr = np.asarray(oriented_image.convert('RGB'), dtype=np.uint8)
        heatmap = self._heatmap(arr)
        height, width = heatmap.shape
        padded = np.pad(heatmap, 1, mode='constant', constant_values=-1.0)
        local_max = np.maximum.reduce([
            padded[dy:dy + height, dx:dx + width]
            for dy in range(3)
            for dx in range(3)
        ])
        confidence_mask = (
            heatmap > 0
            if self.threshold <= 0
            else heatmap >= self.threshold
        )
        ys, xs = np.nonzero((heatmap == local_max) & confidence_mask)
        return [
            Detection(
                x=int(x * DOWN_RATIO),
                y=int(y * DOWN_RATIO),
                score=float(heatmap[y, x]),
            )
            for y, x in zip(ys, xs)
        ]

    def _heatmap(self, arr):
        height, width = arr.shape[:2]
        xs = _tile_starts(width, PATCH, self.overlap)
        ys = _tile_starts(height, PATCH, self.overlap)
        heat_height = height // DOWN_RATIO
        heat_width = width // DOWN_RATIO
        patch_heat = PATCH // DOWN_RATIO
        total = np.zeros((heat_height, heat_width), dtype=np.float32)
        count = np.zeros((heat_height, heat_width), dtype=np.float32)

        coords = [(y, x) for y in ys for x in xs]
        for start in range(0, len(coords), self.max_batch):
            batch_coords = coords[start:start + self.max_batch]
            batch = np.empty(
                (len(batch_coords), 3, PATCH, PATCH), dtype=np.float32
            )
            for i, (y, x) in enumerate(batch_coords):
                tile = arr[y:y + PATCH, x:x + PATCH, :].astype(np.float32) / 255.0
                tile = (tile - MEAN) / STD
                batch[i] = np.transpose(tile, (2, 0, 1))
            outputs = self.session.run(
                [self.output_name],
                {self.input_name: batch},
            )[0]
            for i, (y, x) in enumerate(batch_coords):
                output = outputs[i, 0]
                heat_y, heat_x = y // DOWN_RATIO, x // DOWN_RATIO
                total[
                    heat_y:heat_y + patch_heat,
                    heat_x:heat_x + patch_heat,
                ] += output
                count[
                    heat_y:heat_y + patch_heat,
                    heat_x:heat_x + patch_heat,
                ] += 1.0

        count[count == 0] = 1.0
        return total / count
