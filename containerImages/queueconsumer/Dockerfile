FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install
COPY queueconsumer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared module
COPY shared /app/shared

# Copy your queue_consumer code
COPY queueconsumer/queue_consumer.py .

CMD ["python", "queue_consumer.py"]
