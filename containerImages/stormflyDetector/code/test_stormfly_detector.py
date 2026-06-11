import sys
import types
import unittest

import numpy as np
from PIL import Image

sys.modules.setdefault('onnxruntime', types.SimpleNamespace())

from stormfly_detector import StormflyDetector


class StormflyDetectorOrientationTests(unittest.TestCase):
    def test_detect_uses_exif_oriented_coordinates(self):
        image = Image.new('RGB', (6, 4))
        image.getexif()[0x0112] = 6

        detector = object.__new__(StormflyDetector)
        detector.threshold = 0.3
        seen_shapes = []

        def fake_heatmap(arr):
            seen_shapes.append(arr.shape)
            heatmap = np.zeros((3, 2), dtype=np.float32)
            heatmap[2, 1] = 0.9
            return heatmap

        detector._heatmap = fake_heatmap

        detections = detector.detect(image)

        self.assertEqual(seen_shapes, [(6, 4, 3)])
        self.assertEqual((detections[0].x, detections[0].y), (2, 4))


if __name__ == '__main__':
    unittest.main()
