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
# Pinned to the commit running in production. The pooch cache filenames under
# models/ encode the md5 of each model URL, so upgrading scoutbot requires
# re-checking that its model names/URLs have not changed.
RUN pip install git+https://github.com/WildMeOrg/scoutbot.git@e0bb33a0f72f2dfd0c21e0ee46852dba2be1fdd0 --timeout=100
RUN pip3 uninstall -y onnxruntime
RUN pip3 install onnxruntime-gpu
# The upstream model CDN (wildbookiarepository.azureedge.net) no longer exists,
# so `scoutbot fetch` cannot download anything. Instead we pre-seed pooch's
# download cache with the model files, named <md5(url)>-<filename> exactly as
# pooch stores them; scoutbot then resolves every fetch() from this cache
# without touching the network. Populate ./models before building - see
# README.md for details.
COPY models/ /root/.cache/pooch/
WORKDIR /workspace
COPY code /workspace
RUN pip install --user -r requirements.txt
CMD ["python3", "processSQS.py"]
