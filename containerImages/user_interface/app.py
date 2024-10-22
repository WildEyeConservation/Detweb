import gradio as gr
from gradio_client import Client, handle_file
from httpx import ConnectError
import time


def gradio_predict_image(filepath, config, wic_thresh, loc_thresh, loc_nms_thresh, agg_thresh, agg_nms_thresh):
    max_retries = 10
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            client = Client("http://scoutbot:7860/")
            result = client.predict(
                filepath=handle_file(filepath),
                config=config,
                wic_thresh=wic_thresh,
                loc_thresh=loc_thresh,
                loc_nms_thresh=loc_nms_thresh,
                agg_thresh=agg_thresh,
                agg_nms_thresh=agg_nms_thresh,
                api_name="/predict"
            )
            # Extract the results
            image_data = result[0]
            prediction_speed = result[1]
            predicted_wic_confidence = result[2]
            predicted_detections = result[3]

            return image_data, prediction_speed, predicted_wic_confidence, predicted_detections
        except ConnectError as e:
            print(f"Connection failed (attempt {attempt + 1}/{max_retries}): {e}")
            time.sleep(retry_delay)
    raise Exception("Failed to connect to scoutbot after multiple attempts")
    
iface = gr.Interface(
    fn=gradio_predict_image,
    inputs=[
        gr.Image(type="filepath", label="Upload Image"),
        gr.Radio(choices=["MVP", "Phase 1"], value="MVP", label="Model Configuration"),
        gr.Slider(minimum=0, maximum=100, value=7, label="WIC Confidence Threshold"),
        gr.Slider(minimum=0, maximum=100, value=38, label="Localizer Confidence Threshold"),
        gr.Slider(minimum=0, maximum=100, value=60, label="Localizer NMS Threshold"),
        gr.Slider(minimum=0, maximum=100, value=0, label="Aggregation Confidence Threshold"),
        gr.Slider(minimum=0, maximum=100, value=80, label="Aggregation NMS Threshold")
    ],
    outputs=[
        gr.Image(type="filepath", label="Processed Image"),
        gr.Textbox(label="Prediction Speed"),
        gr.Number(label="Predicted WIC Confidence"),
        gr.Textbox(label="Predicted Detections")
    ],
    title="Image Prediction Interface",
    description="Upload an image and adjust parameters to get predictions from ScoutBot."
)

if __name__ == "__main__":
    iface.launch(server_name="0.0.0.0", server_port=7861)
