import os
import json
import time
import boto3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize SQS client
sqs = boto3.client('sqs', region_name=os.environ['REGION'])
queue_url = os.environ['QUEUE_URL']

def consume_queue():
    while True:
        try:
            response = sqs.receive_message(
                QueueUrl=queue_url,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20
            )
        except Exception as e:
            logger.error(f"Error receiving message: {e}")
            time.sleep(10)
            continue
        
        if 'Messages' in response:
            for message in response['Messages']:
                receipt_handle = message['ReceiptHandle']
                body = json.loads(message['Body'])

                # Log received message
                logger.info(f"Received message: {body}")

                # Extract image_id from the message
                try:
                    image_info = body.get('location', {}).get('image', {})
                    image_id = image_info.get('id')
                    if not image_id:
                        raise ValueError("Message does not contain 'image.id'")

                    # Construct the image URL (assuming public access or use presigned URLs)
                    image_url = f"https://{os.environ['S3_BUCKET']}.s3.{os.environ['REGION']}.amazonaws.com/images/{image_id}.jpg"

                    # Pass the image URL to your processing function
                    logger.info(f"Processing image URL: {image_url}")
                    #process_image(image_url)  # Replace with your actual processing function

                    # Delete the message from the queue after processing
                    # try:
                    #     sqs.delete_message(
                    #         QueueUrl=queue_url,
                    #         ReceiptHandle=receipt_handle
                    #     )
                    #     logger.info("Message deleted from queue")
                    # except Exception as e:
                    #     logger.error(f"Error deleting message: {e}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        else:
            logger.info("No messages in queue. Waiting...")
            time.sleep(10)

if __name__ == "__main__":
    consume_queue()
