from gradio_client import Client, handle_file

def predict_image(image_url, config="MVP", wic_thresh=7, loc_thresh=38, nms_thresh=60):
    client = Client("http://scoutbot:7860/")
    result = client.predict(
        filepath=handle_file(image_url),
        config=config,
        wic_thresh=wic_thresh,
        loc_thresh=loc_thresh,
        nms_thresh=nms_thresh,
        api_name="/predict"
    )
    return result