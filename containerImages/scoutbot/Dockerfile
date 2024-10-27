FROM nvidia/cuda:12.6.2-cudnn-devel-ubuntu22.04

# BEGIN SCOUTBOT SETUP

# Install apt packages
RUN set -ex \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3-dev \
        python3-pip \
        libgl1 \
        libglib2.0-0 \
 && rm -rf /var/cache/apt \
 && rm -rf /var/lib/apt/lists/*

RUN apt-get -y update && \
    apt-get -y install git && \
    apt-get clean  
RUN pip install git+https://github.com/WildMeOrg/scoutbot.git --timeout=100
RUN pip3 uninstall -y onnxruntime
RUN pip3 install onnxruntime-gpu
RUN scoutbot fetch --config phase1
RUN scoutbot fetch --config mvp
RUN scoutbot fetch --config v3
RUN scoutbot fetch --config v3-cls
WORKDIR /workspace
COPY code /workspace
RUN pip install --user -r requirements.txt
CMD ["python3", "processSQS.py"]


