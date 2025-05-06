FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime
#NVidia updated their key. See https://developer.nvidia.com/blog/updating-the-cuda-linux-gpg-repository-key/
#RUN apt-key del 7fa2af80
#RUN curl -O https://developer.download.nvidia.com/compute/cuda/repos/$distro/$arch/cuda-keyring_1.0-1_all.deb 
#RUN dpkg -i cuda-keyring_1.0-1_all.deb

#wget does not exist in this image and my curl equivalent does not appear to work, so I am falling back to the alternate method.
#RUN apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/$distro/$arch/3bf863cc.pub
#RUN pip install --upgrade pip
ENV TORCH_HOME=/workspace
#RUN adduser myuser
#USER myuser
#WORKDIR /home/myuser
#RUN pip install kornia
# RUN apt-get update
# RUN apt-get install -y git 
# RUN git clone https://github.com/cvg/LightGlue.git 
WORKDIR /workspace
# RUN python -m pip install -e .
# RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y
COPY code /workspace
RUN pip install --user -r requirements.txt
#ENV PATH="/home/myuser/.local/bin:${PATH}"
#COPY --chown=myuser:myuser code code
#WORKDIR /home/myuser/code
CMD ["python3", "processSQS.py"]
