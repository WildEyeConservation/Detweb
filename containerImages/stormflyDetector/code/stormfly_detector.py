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


class StormflyDetector:
    def __init__(self, model_path, threshold=0.30, overlap=160):
        if not os.path.isfile(model_path):
            raise FileNotFoundError(f'Stormfly model not found: {model_path}')

        providers = ['CPUExecutionProvider']
        if 'CUDAExecutionProvider' in ort.get_available_providers():
            providers.insert(0, 'CUDAExecutionProvider')

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.log_severity_level = 3
        self.session = ort.InferenceSession(
            model_path,
            sess_options=options,
            providers=providers,
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.threshold = threshold
        self.overlap = overlap
        print(f'Stormfly providers: {self.session.get_providers()}')

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
        ys, xs = np.nonzero(
            (heatmap == local_max) & (heatmap >= self.threshold)
        )
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

        for y in ys:
            for x in xs:
                tile = arr[y:y + PATCH, x:x + PATCH, :]
                normalized = tile.astype(np.float32) / 255.0
                normalized = (normalized - MEAN) / STD
                normalized = np.ascontiguousarray(
                    np.transpose(normalized, (2, 0, 1))[None]
                )
                output = self.session.run(
                    [self.output_name],
                    {self.input_name: normalized},
                )[0][0, 0]
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
