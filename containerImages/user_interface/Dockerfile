FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY user_interface/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your app code
COPY user_interface/app.py .

CMD ["python", "app.py"]
