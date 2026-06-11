FROM nvidia/cuda:12.9.0-cudnn-runtime-ubuntu22.04

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY code /workspace
RUN pip3 install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1
CMD ["python3", "-u", "processSQS.py"]

