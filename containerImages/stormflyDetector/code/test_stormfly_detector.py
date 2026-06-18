import sys
import types
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.modules.setdefault('onnxruntime', types.SimpleNamespace())

from stormfly_detector import StormflyDetector


class StormflyGraphQLTests(unittest.TestCase):
    def test_required_location_ids_use_non_null_graphql_variables(self):
        source = Path(__file__).with_name('processSQS.py').read_text()

        self.assertNotIn('$projectId: ID=""', source)
        self.assertNotIn("'$projectId: ID'", source)
        self.assertGreaterEqual(source.count('$projectId: ID!'), 2)


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

    def test_detect_keeps_low_confidence_local_maxima_when_threshold_allows(self):
        image = Image.new('RGB', (6, 6))

        detector = object.__new__(StormflyDetector)
        detector.threshold = 0.0

        def fake_heatmap(_arr):
            heatmap = np.zeros((3, 3), dtype=np.float32)
            heatmap[1, 1] = 0.2
            return heatmap

        detector._heatmap = fake_heatmap

        detections = detector.detect(image)

        self.assertEqual(len(detections), 1)
        self.assertEqual((detections[0].x, detections[0].y), (2, 2))
        self.assertAlmostEqual(detections[0].score, 0.2)

    def test_zero_threshold_does_not_emit_zero_confidence_locations(self):
        image = Image.new('RGB', (6, 6))

        detector = object.__new__(StormflyDetector)
        detector.threshold = 0.0
        detector._heatmap = lambda _arr: np.zeros((3, 3), dtype=np.float32)

        detections = detector.detect(image)

        self.assertEqual(detections, [])


if __name__ == '__main__':
    unittest.main()
