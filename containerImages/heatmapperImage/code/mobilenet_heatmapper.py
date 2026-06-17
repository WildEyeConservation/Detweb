"""Elephant heatmap generation with the MobileNet-v1 classifier (TF1 checkpoint).

Ported from the Heatmapper4 EC2 AMI worker
(detweb-server/app/detweb/tf_detect/infer/MobileNetHeatmapper.py). The network is
fully convolutional: a full-resolution RGB image goes in, a stride-32
(H/32 x W/32 x 2) softmax map comes out, and channel 1 is the elephant class.

The graph and preprocessing are identical to the original so the TF1 checkpoint
loads unchanged. The only change is the input: the original decoded the image
inside the graph (`tf.read_file` -> `tf.image.decode_png`), whereas here we feed an
already-decoded uint8 RGB array. That lets us decode + rotate the image with PIL/numpy
before inference (for the optional rotation support) and avoids the original's
decode_png-on-jpeg fragility.
"""

import tensorflow as tf
from tensorflow.contrib import slim

from mobilenet_ivx import mobilenet_v1


class MobileNetHeatmapper(object):
    """Generate elephant heatmaps using the MobileNet network."""

    def __init__(self, nn_model_fp):
        graph = tf.Graph()
        with graph.as_default():
            # uint8 HxWx3 RGB image (decoded + optionally rotated outside the graph)
            self.image_in = tf.placeholder(dtype=tf.uint8, shape=[None, None, 3])
            image = tf.image.convert_image_dtype(self.image_in, dtype=tf.float32)  # -> [0,1]
            image = tf.subtract(image, 0.5)
            image = tf.multiply(image, 2.0)                                        # -> [-1,1]
            image = tf.expand_dims(image, 0)

            logits, _ = mobilenet_v1(
                image, num_classes=2, is_training=False, spatial_squeeze=False
            )
            self.probs = tf.nn.softmax(logits)

            init_fn = slim.assign_from_checkpoint_fn(
                nn_model_fp, slim.get_model_variables()
            )
            init_op = tf.local_variables_initializer()
            self.sess = tf.Session(graph=graph)
            self.sess.run(init_op)
            init_fn(self.sess)

    def generate(self, image_rgb):
        """Run inference on an HxWx3 uint8 RGB array.

        Returns the 2D elephant heatmap (H/32 x W/32 float32), i.e. softmax channel 1.
        """
        probs = self.sess.run(self.probs, feed_dict={self.image_in: image_rgb})
        return probs[0, :, :, 1]
