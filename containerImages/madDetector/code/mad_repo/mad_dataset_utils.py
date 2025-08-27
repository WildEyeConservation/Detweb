#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""

This module contains classes and functions to prepare a PyTorch dataset
from a A collection of folders with jpg or png images and 

The horizontal axis is x,  the vertical axis is y and the origin is the 
topleft of the image.

Each folder with its own json annotation file in the format yxYX for the bbox.
The format yxYX means (top, left, bottom, right)

However, some authors don't use x for the left-right axis and y for the top-bottom axis.
Be carefull!

The sequence of steps to process each folder is a follows
- Step 1 : Ensure each animal is of diameter smaller than the input of 
  the neural network with the function shrink_dataset_images_if_needed
- Step 2 : Ensure each image is at least ready_image_side x ready_image_side 
  where ready_image_side is the size of the input of the neural network.
  Typically, ready_image_side = 800.
  This step is done by padding on the right and the bottom of the 
  images if needed using the function pad_dataset_images_if_needed.

After the first two steps, we have a collection of folders with 
appropriate annotated images. A training set and a validation set can be created
by calling ... 


Created on Mon Jun 19 18:09:36 2023 by @author: f.maire@gmail.com

Last modified on 05/02/2024
- added the arg val_max to split_folders

- moved CLASSES in this file 
- corrected the documentation on the json format yxYX for the bounding boxes
- introduced my_evaluate() 


todo: 
     
<<<<<<< HEAD
- have a new version of show?
- split into training and validation sets 
- write a script to perform the processing

    
    a dataset based on a list of folders
    Use  "ConcatDataset" from torch/utils/data/dataset.py
    
Note the handy function random_split in torch/utils/data/dataset.py


"""
from typing import Any, Callable, List, Optional, Tuple

from pathlib import Path
#Path("/my/directory").mkdir(parents=True, exist_ok=True)

import PIL.Image

import torch
import torch.utils.data
from torch.utils.data.dataset import Dataset

import os
import random
import torchvision
import copy, json, shutil

import util.misc as utils

import torchvision.transforms as transforms
# from pycocotools.coco import COCO
# from torchvision.datasets.vision import VisionDataset
import numpy as np
# import skimage.io as io

from util.box_ops import box_cxcywh_to_xyxy

import matplotlib.pyplot as plt
import pylab
pylab.rcParams['figure.figsize'] = (8.0, 10.0)


CLASSES = [
    'N/A',
    'turtle',
    'dugong',
    'shark',
    'ray',
    'dolphin',
    'whale',
    'beluga',
    'bird',
    'fish',
    'jellyfish',
    'seasnake',
    'crocodile',
    'blow'    
    ]


# image input size for the neural network
READY_IMAGE_SIDE = 800

def make_categories():
    '''
     Return a list of category dictionary based on CLASSES.
     This "categories" list is used in the instances.json files
    '''
    cat_dict = []
    for k in range(1,len(CLASSES)):
        cat_dict.append({'id':k, 'name':CLASSES[k]})
    return cat_dict
           

def box_yxyx_to_cxcywh(bb):
    '''
    Convert a tensor representing a bbox bb in format yxYX 
    in the format cxcywh
    
    bb can be of the shape N by 4
    '''
    y0, x0, y1, x1 = bb.unbind(-1)
    bb_new = [(x0 + x1) / 2, (y0 + y1) / 2,
         (x1 - x0), (y1 - y0)]
    return torch.stack(bb_new, dim=-1)

def normalize_cxcywh(bb,wi,hi):
    '''
    Return a normalized bbox x, in an image of size wi,hi
    '''
    cx, cy, w, h = bb.unbind(-1)
    wi = torch.as_tensor(float(wi))
    hi = torch.as_tensor(float(hi))
    bb_new = [cx/wi, cy/hi, w/wi, h/hi]
    return torch.stack(bb_new, dim=-1)



def show(sample):
    '''
    Display a training example 
             image,target = sample
    '''
    from torchvision.transforms.v2 import functional as F
    from torchvision.utils import draw_bounding_boxes

    image, target = sample
    if isinstance(image, PIL.Image.Image):
        image = F.to_image_tensor(image)
        
    image = torchvision.transforms.functional.convert_image_dtype(image, dtype=torch.uint8)        
    # image = F.convert_dtype(image, torch.uint8)
    
    # boxes_tensor = torch.tensor([a['bbox'] for a in target])
    
    boxes_tensor = target['boxes']
    # (N,4) tensor of normalized cx,cy,w,h of the box  
    # bbox is of the format yxYX, we need xyXY
    # boxes_tensor = boxes_tensor[:,[1,0,3,2]]
    
    boxes_tensor = box_cxcywh_to_xyxy(boxes_tensor)*800  # assuming
    annotated_image = draw_bounding_boxes(
        image, 
        boxes_tensor, 
        colors="yellow", width=3)

    fig, ax = plt.subplots()
    ax.imshow(annotated_image.permute(1, 2, 0).numpy())
    ax.set(xticklabels=[], yticklabels=[], xticks=[], yticks=[])
    fig.tight_layout()

    fig.show()


def contains_images(folder_path, image_extensions = ('.jpg', '.jpeg', '.png','tif') ):
    '''
        Determine whether the folder named folder_path
        contains images with image_extensions = ('.jpg', '.jpeg', '.png','tif')
        If yes, return True, else return False
    '''
    # List all files in the folder
    files = os.listdir(folder_path)
    # Define the list of image file extensions
    
    # Check if any file has an image extension
    for file in files:
        if file.lower().endswith(image_extensions):
            return True
    return False

def list_images(directory):
    """
    Returns all non hidden image files in a given directory
    """
    return [
        f
        for f in Path(directory).iterdir()
        if f.is_file() 
        and not f.name.startswith(".")
        and f.name.endswith(('JPG','jpg','JPEG','jpeg','PNG','png'))
    ] 

# ----------------------------------------------------------------

def preparatory_walk(top = '/home/frederic/Documents/DataOneTB/MAD training images'):
    '''
     Walk through a tree of folders. Create the list of the
     folders containing image datasets.  Ensure that each of these folders
     contains images and instances.json file 
     
     return the list of image dataset folders
 
    '''
    print(f'>>> starting the preparatory walk from {top=}\n')
    data_folder_list = []
    for folder, dirs, files in os.walk(top, topdown=True):
        folder = Path(folder)          
        print(f"Examining image folder -> {folder=} \r")
        folder_has_images = contains_images(folder) 
        if not folder_has_images:
            continue
        instances_path = folder/'instances.json'
        if instances_path.exists():
            data_folder_list.append(folder)            
    return data_folder_list
 
# ----------------------------------------------------------------


# deprecated
def split_folders( 
        scr_list, # list of the dataset folders
        dst_train, # root folder where the training folders will be created
        dst_val, # root folder where the validation folders will be created
        val_ratio = 0.08,  #  8%
        val_max = 100 # max number of images we take from a single folder for validation
        ):
    '''
     Given a list of dataset folders, split the original folders into
     a training collection of folders located at dst_train and 
     a validation collection of folders located at dst_val 
     
     We assume that the dataset folders have different names
    '''
       
    # Make sure that the two folders dst_train and dst_val exist
    train_root_path = Path(dst_train)
    train_root_path.mkdir(parents=True, exist_ok=True)
    val_root_path = Path(dst_val)
    val_root_path.mkdir(parents=True, exist_ok=True)

    for k, src_folder in enumerate(scr_list):
        print(f"Split processing folder {src_folder}")
        # Fred Hack: introduce k to make sure the name of the dest folder are distincts
        L = list_images(src_folder)
        random.shuffle(L) # in place op
        n_val = round(len(L)*val_ratio)
        n_val = min(val_max, n_val) # we don't want to take too many 
        n_val = max(1, n_val) # ensure 1 example at least kept for validation
        
        src_path = Path(src_folder)
        
        # copy the instances.json file of this src folder 
        # to the train and val folders
        distinct_name = src_path.name+'_'+str(k)
        # val_folder_path = val_root_path/src_path.name
        # train_folder_path = train_root_path/src_path.name
        val_folder_path = val_root_path/distinct_name
        train_folder_path = train_root_path/distinct_name
        val_folder_path.mkdir(parents=True, exist_ok=True)
        train_folder_path.mkdir(parents=True, exist_ok=True)
        shutil.copy(src_path/'instances.json',
                    train_folder_path)
        shutil.copy(src_path/'instances.json',
                    val_folder_path)
        # Deal with the images of src_folder
        # Move the first images in L in the val destination
        for im_p in L[:n_val]:
            shutil.copy(src_path/im_p.name,
                        val_folder_path/im_p.name)
        # Move the remaining images in L in the train destination            
        for im_p in L[n_val:]:
            shutil.copy(src_path/im_p.name,
                        train_folder_path/im_p.name)
            

def add_margins(pil_img, right, bottom, top = 0, left = 0 ):
    '''
    Create a new PIL image by adding black margins to 
    the image pil_img

    Parameters
    ----------
    pil_img : PIL Image
    right : int, number of columns added at the right
    bottom : int, number of rows added at the bottom
    top : int, number of rows added at the top
    left : int, number of columns added at the left

    Returns
    -------
    result : new padded image.

    '''
    width, height = pil_img.size
    new_width = width + right + left
    new_height = height + top + bottom
    # The mode of an image is a string 
    # which defines the type and depth of a pixel in the image.
    result = PIL.Image.new(pil_img.mode, (new_width, new_height))
    result.paste(pil_img, (left, top))
    return result
    
    
def shrink_dataset_images_if_needed(
        input_root : str, # folder of the original dataset 
        output_root : str,# folder of the processed dataset        
        annFile: str = 'instances.json', # name of the annotation file
        ready_image_side: int = 800, # input to the neural network
        side_ratio_thr = 0.75 # max ratio allowed 
                             # for the side of an annotation wrt 
                             # side of the window fed to the NN.
                             # We don't want to have bbox more than 70% of
                             # the input to the neural network       
                  ):
    '''
    Given a single folder dataset located at input_root,
    we create a new single folder dataset with images resized if needed
    so that every bounding box fits in the input of a NN which expects
     images of side ready_image_side

    '''
    
    # Create the output folder
    Path(output_root).mkdir(parents=True, exist_ok=True)
    
    sfid = SingleFolderImageDataset(input_root)
    
    import copy, json, shutil
    with open(Path(input_root,annFile)) as f:
        in_instances = json.load(f)
        
    out_instances = {}
    out_instances['info'] = copy.deepcopy(in_instances['info'])
    out_instances['categories'] = copy.deepcopy(in_instances['categories'])
    out_instances['images'] = []
    out_instances['annotations'] = []
    
    # consider all images present in input_root
    for i in sfid.present_image_ids:
        anns_i = sfid.coco.imgToAnns[i] # list of anns of image indexed i
        # ann yxYX
        # Compute max side of bbox in current image
        max_side = max(
            max(ann['bbox'][3]-ann['bbox'][1] for ann in anns_i), # max_dx 
            max(ann['bbox'][2]-ann['bbox'][0] for ann in anns_i)  # max_dy 
                    )
        img = sfid.coco.loadImgs(i)[0] # dict associated to this image
            
        if max_side <= ready_image_side*side_ratio_thr:
            # copy without resizing
            # update  out_instances['images'] and
            #         out_instances['annotations'] 
            out_instances['images'].append(img)
            # 
            out_instances['annotations'].extend(
                              sfid._load_target(i) # list of anns of this image
                              )
            # copy image
            shutil.copy(Path(input_root,img['file_name']), 
                             output_root
                        )
        else:
            # max_side > ready_image_side*side_ratio_thr
            # resize before copying 
            # r is the rescaling factor        
            r = ready_image_side*side_ratio_thr/max_side
            # r is the rescaling factor
            image_i = sfid._load_image(i) # the PIL image 
                                    # the type of image_i is class 'PIL.Image.Image'
            target_i = sfid._load_target(i) # the list of anns of this image
                           # it calls self.coco.loadAnns(self.coco.getAnnIds(...))
                           # target_i is a list of annotations
            image_r = image_i.resize((int(r*image_i.width), 
                                      int(r*image_i.height))
                                     )
            image_r.save(Path(output_root, img['file_name']))
            img_r = copy.deepcopy(img)
            img_r['height'] = image_r.height
            img_r['width'] = image_r.width
            out_instances['images'].append(img_r)
            for ann_i in target_i:
                ann_r = copy.deepcopy(ann_i)
                ann_r['bbox'] = [int(z*r) for z in ann_i['bbox']]
                out_instances['annotations'].append(ann_r)
    # End loop on i         
    
    # Save out_instances
    with open(Path(output_root,'instances.json'), "w") as f:
        json.dump(out_instances, f)
   
    
    
def pad_dataset_images_if_needed(
        input_root : str, # folder of the original dataset 
        output_root : str,# folder of the processed dataset        
        annFile: str = 'instances.json', # name of the annotation file
        ready_image_side: int = 800, # input to the neural network
                  ):
    '''
    Given a single folder dataset located at input_root,
    we create a new single folder dataset with images padded if needed
    so that every image is of side at least ready_image_side.
    The only changes in the new instances.json file are the sizes of 
    the images that have been padded.

    '''
    
    # Create the output folder
    Path(output_root).mkdir(parents=True, exist_ok=True)
    
    sfid = SingleFolderImageDataset(input_root)
    
    with open(Path(input_root,annFile)) as f:
        in_instances = json.load(f)
        
    out_instances = {}
    out_instances['info'] = copy.deepcopy(in_instances['info'])
    out_instances['categories'] = copy.deepcopy(in_instances['categories'])
    out_instances['images'] = []
    out_instances['annotations'] = []
    
    # consider all images present in input_root
    for i in sfid.present_image_ids:
        anns_i = sfid.coco.imgToAnns[i] # list of anns of image indexed i
        out_instances['annotations'].extend(anns_i)
        # old bug: out_instances['annotations'].append(anns_i)
        img_i = sfid.coco.loadImgs(i)[0] # dict associated to this image

        img_r = copy.deepcopy(img_i)
        
        # 
        bottom_pad =  max(0,ready_image_side - img_i['height']) 
        right_pad =  max(0, ready_image_side - img_i['width']) 
        # need padding?
        if bottom_pad>0 or right_pad>0:
            # need padding 
            image_i = sfid._load_image(i) # the PIL image 
                                        # the type of image_i is class 'PIL.Image.Image'
            image_r = add_margins(image_i, right_pad, bottom_pad)
            image_r.save(Path(output_root, img_r['file_name']))
            img_r['height'] = image_r.height
            img_r['width'] = image_r.width
        else:
            # image does not need padding and is simply copied
            shutil.copy(Path(input_root,img_r['file_name']), 
                             output_root
                        )
        # Finally, add the updated dictionnary of the image
        out_instances['images'].append(img_r)
    # End loop on i         
    
    # Save out_instances
    with open(Path(output_root,'instances.json'), "w") as f:
        json.dump(out_instances, f)
   

class SingleFolderDynamicImageDataset(torchvision.datasets.CocoDetection):
    """
    The folder root contains large images and a json annotation file.
    Some images listed in the annotation file might be missing.
    Attributes:
        self.root : the folder of this dataset
        self.coco : COCO(annFile)
        self.ids : list(sorted(self.coco.imgs.keys())) 
        self.present_image_ids : set of the id's  of present images 
                                    in the folder
        self.present_ann_ids : list of the ids of annotations 
                                in the present images        
        Each annotation is a dictionary like 
            {"image_id": 3, "bbox": [1688, 2307, 1913, 3207], 
             "category_id": 6, "id": 3}
            The bbox is in the yxYX format
        

    Args:
        root : folder containing the large images and the annotation file
        annFile : name of the annotation file in the folder
        transform (callable, optional): 
            A function/transform that  takes in an PIL image
            and returns a transformed version. E.g, ``transforms.PILToTensor``
        target_transform (callable, optional): A function/transform that 
           takes in the target and transforms it.
        transforms (callable, optional): 
            A function/transform that takes input sample and its target as entry
            and returns a transformed version.
        ready_image_side :  Target size (side) for an image ready for input 
                 to the neural network   
    """
    def __init__(
        self,
        root : str,
        annFile: str = 'instances.json',        
        transform: Optional[Callable] = None,
        target_transform: Optional[Callable] = None,
        transforms: Optional[Callable] = None,
        ready_image_side: int = 800, #
    ) -> None:
        super().__init__(
            root, 
            os.path.join(root, annFile), 
            transforms, transform, target_transform)
        
        # compute the list of the image id's of present images in the folder
        # image path : self.coco.loadImgs(id)[0]["file_name"]
        self.present_image_ids = set(
            id for id in self.ids if 
                os.path.exists((os.path.join(
                    self.root, 
                    self.coco.loadImgs(id)[0]["file_name"])))
            )
        # Compute the list of annotations ids of present images
        self.present_ann_ids = [
            ann['id'] for ann in self.coco.dataset['annotations']
                    if ann["image_id"] in self.present_image_ids
            ]
        
        self.overlap_thr =  0.5 # Overlap ratio to keep a bounding box annotation
                                # used in self._make_example()
        
        self.ready_image_side = ready_image_side
        
    
    def __getitem__(self, index: int) -> Tuple[Any, Any]:
        '''
        
        Given an example corresponding to the annotation at 
        position index in the  self.present_ann_ids list
    
         - load the corresponding image 
         - load all its annotations
         - create a random window that contains the specified annotation
         - filter out the annotations not in the window

        Parameters
        ----------
        index : int 
            index (wrt to the list self.present_ann_ids) of an annotation id 
            in self.coco.dataset['annotations']

        Returns
        -------
        a training example, that is a pair
        image, target 

        '''

        # pa : present annotation referred by index
        pa = self.coco.loadAnns(self.present_ann_ids[index])[0]        
        # old bug: pa = self.coco.dataset['annotations'][self.present_ann_ids[index]]
        
        # index is wrt to self.present_ann_ids
        id = pa["image_id"] # id of the large image 
        # print('image id is',pa)
        image_l = self._load_image(id) # the large image
                                    # the type of image_l is class 'PIL.Image.Image'
        target_l = self._load_target(id) # the list of anns of this large image
                           # it calls self.coco.loadAnns(self.coco.getAnnIds(...))
                           # target_l is a list of annotations
 
        # show((image_l,target_l))   # debug
        
        image, target = self._make_example(image_l, target_l, pa)

        if self.transforms is not None:
            image, target = self.transforms(image, target)

        return image, target
    
        
    def _make_example(self,
                      image_l, # PIL large image
                      target_l, # list of annotations for image_l
                      pa # the annotation we want the returned window to cover
                      ):
        
        def _convert(image, target):
            '''
            
            returns a dict with the keys
            'boxes', 'labels', 'orig_size' and 'size'
            The value associated to 'boxes' is a Nx4 tensor where N is the
            number of boxes in the window/image.
            The value associated to labels' is a N tensor
            '''
            #
            w, h = image.size 
            tt = {} # target dict
            boxes =   [obj["bbox"] for obj in target]       
            bb0 = torch.as_tensor(boxes,dtype=torch.float32)
            bb1 = box_yxyx_to_cxcywh(bb0) # bb1 is not normalized
            # normalize
            tt['boxes'] = normalize_cxcywh(bb1, w, h)
            labels = [obj['category_id'] for obj in target]
            tt['labels'] = torch.as_tensor(labels,dtype=torch.long)
            tt['size'] =  torch.as_tensor([int(h), int(w)]) 
            tt['orig_size'] =  torch.as_tensor([int(h), int(w)]) 
            tt['image_id'] = torch.as_tensor([pa["image_id"]])
            return transforms.ToTensor()(image), tt
        
        
        # Create a random rectange rr that contains the 
        # bounding box of the annotation pa
        #  random.randint(a, b) returns a random integer N 
        #       such that a <= N <= b.
        # The topleft corner of the rr window is (y_w, x_w)
        ready_image_side = self.ready_image_side
        large_image_width, large_image_height = image_l.size
        assert ( ready_image_side <= large_image_width and
                ready_image_side <= large_image_height) 
        y_i, x_i, Y_i, X_i = pa['bbox'] # format y,x,Y,X
        
        # Fred hack, to address problem of some mislabels
        y_i, Y_i = min(y_i, Y_i), max(y_i, Y_i)
        x_i, X_i = min(x_i, X_i), max(x_i, X_i)
        
        
        Y_i = min(large_image_height-1, Y_i)
        X_i = min(large_image_width-1, X_i)
        
        x_w = random.randint(
                max(0, X_i - ready_image_side) ,
                # old code: min(x_i, large_image_width - ready_image_side-1)                
                min(x_i, large_image_width - ready_image_side)
                )            
        y_w = random.randint(
                max(0, Y_i - ready_image_side) ,
                min(y_i, large_image_height - ready_image_side)
                )
        # rr : the random rectangular window containing the pa bbox
        X_w = min(x_w+ready_image_side, large_image_width-1)
        Y_w = min(y_w+ready_image_side, large_image_height-1)            
        #    rr = np.array([x_w, y_w, X_w, Y_w],dtype=np.int32)

        # debug assert statements
        assert (0<=x_w) and (x_w<=x_i) and (X_i<=X_w) and (X_w<large_image_width) 
        assert (0<=y_w) and (y_w<=y_i) and (Y_i<=Y_w) and (Y_w<large_image_height)
        
        # Get the overlapping bounding boxes with rr
        target = [] # list of the annotations for this new ready image
        for ann_j in target_l:
            #    Compute the ratio of box j overlapping with the random rectangle rr.
            #    This value will be 0 if box j is totally outside, and will be 1
            #    if box j is contained in rr.         
            #    We work with semi open intervals.
            #    The intersection of rr with box j is x_q,y_q, X_q, Y_q 
            #    The coords x_q,y_q, X_q, Y_q are wrt the large image
            y_j,x_j, Y_j, X_j  = ann_j['bbox']                 
            # intersection between rr and jth box
            y_q, Y_q = max(y_w,y_j), min(Y_w,Y_j) 
            x_q, X_q = max(x_w,x_j), min(X_w,X_j) 
            if (X_q<=x_q) or (Y_q<=y_q) :                    
                continue # empty intersection, continue
            ratio =  (X_q-x_q)*(Y_q-y_q) / ( (X_j-x_j)*(Y_j-y_j) )
            #
            if (ratio < self.overlap_thr):
                continue # intersection too small, just ignore this annotation j
            #  If we reach this point we have a significant overlap between ann_j and rr
            # WARNING coords
            # B : bbox relative to ready image origin
            B = [y_q-y_w,x_q-x_w,Y_q-y_w,X_q-x_w]
            ann_j_clone = copy.deepcopy(ann_j)
            ann_j_clone['bbox'] = B
            # print('original ann is',ann_j_clone)
            target.append(ann_j_clone)
            assert all(0<=v<=ready_image_side for v in B)
        # end loop on ann_j

        # debug
        if len(target)==0:
            print("++++ Shit happens!! ++++")
            print(pa)
            print(target_l)
            print(f'{self.coco.imgs[id]=}')
            # print(f"{image_l.filename=}, {image_l.format=}, {image_l.size=}")
        
        assert len(target)>0 # rr should contain at least 'ann_i' !

        # image_l.crop(box) Returns a rectangular region from this image.
        # aka the "ready image"
        # The box is a 4-tuple defining the left, upper, right, and lower pixel 
        
        image = image_l.crop([x_w,y_w,X_w,Y_w])
        
        return _convert(image, target)
    
        

    def __len__(self) -> int:
        #
        return len(self.present_ann_ids)

#-----------------------------------------------------------

class SingleFolderImageDataset(torchvision.datasets.CocoDetection):
    """
    The folder root contains large images and a json annotation file.
    Some images listed in the annotation file might be missing.
    Attributes:
        self.root : the folder of this dataset
        self.coco : COCO(annFile)
        self.ids : list(sorted(self.coco.imgs.keys())) 
        self.present_image_ids : set of the id's  of present images 
                                    in the folder
        self.present_ann_ids : list of the ids of annotations 
                                in the present images        
        Each annotation is a dictionary like 
            {"image_id": 3, "bbox": [1688, 2307, 1913, 3207], 
             "category_id": 6, "id": 3}
            The bbox is in the yxYX format
        

    Args:
        root : folder containing the large images and the annotation file
        annFile : name of the annotation file in the folder
        transform (callable, optional): 
            A function/transform that  takes in an PIL image
            and returns a transformed version. E.g, ``transforms.PILToTensor``
        target_transform (callable, optional): A function/transform that 
           takes in the target and transforms it.
        transforms (callable, optional): 
            A function/transform that takes input sample and its target as entry
            and returns a transformed version.
        ready_image_side :  Target size (side) for an image ready for input 
                 to the neural network   
    """
    def __init__(
        self,
        root : str,
        annFile: str = 'instances.json',        
        transform: Optional[Callable] = None,
        target_transform: Optional[Callable] = None,
        transforms: Optional[Callable] = None
    ) -> None:
        super().__init__(
            root, 
            os.path.join(root, annFile) )
            # transforms, transform, target_transform)
        
        
        # compute the list of the image id's of present images in the folder
        # image path : self.coco.loadImgs(id)[0]["file_name"]
        self.present_image_ids = list(
            id for id in self.ids if 
                os.path.exists((os.path.join(
                    self.root, 
                    self.coco.loadImgs(id)[0]["file_name"])))
            )
        # Compute the list of annotations ids of present images
        self.present_ann_ids = [
            ann['id'] for ann in self.coco.dataset['annotations']
                    if ann["image_id"] in self.present_image_ids
            ]
                        
    
    def __getitem__(self, index: int) -> Tuple[Any, Any]:
        '''
        
        Returns
        -------
        a training example, that is a pair
        image, target 

        '''
        
        id = self.present_image_ids[index] # image_id
        image = self._load_image(id) # the large image
                                    # the type of image_l is class 'PIL.Image.Image'
        target = self._load_target(id) # the list of anns of this large image
                           # it calls self.coco.loadAnns(self.coco.getAnnIds(...))
                           # target_l is a list of annotations

        # returns a dict with the keys
        # 'boxes', 'labels', 'orig_size' and 'size'
        # The value associated to 'boxes' is a Nx4 tensor where N is the
        # number of boxes in the window/image.
        # The value associated to labels' is a N tensor
        #
        w, h = image.size 
        tt = {} # target dict
        boxes =   [obj["bbox"] for obj in target]       
        bb0 = torch.as_tensor(boxes,dtype=torch.float32)
        bb1 = box_yxyx_to_cxcywh(bb0) # bb1 is not normalized
        # normalize
        tt['boxes'] = normalize_cxcywh(bb1, w, h)
        labels = [obj['category_id'] for obj in target]
        tt['labels'] = torch.as_tensor(labels,dtype=torch.long)
        tt['size'] =  torch.as_tensor([int(h), int(w)]) 
        tt['orig_size'] =  torch.as_tensor([int(h), int(w)]) 
        tt['image_id'] = torch.as_tensor([id])
        image, target = transforms.ToTensor()(image), tt
        
        if self.transforms is not None:
            image, target = self.transforms(image, target)

        return image, target
    

    def __len__(self) -> int:
        #
        return len(self.present_image_ids)
    
    def split(self, train_folder, val_folder, val_ratio = 0.05):
        '''
        Split the dataset into a training dataset an a validation dataset.
        '''
        # Make sure that the two folders dst_train and dst_val exist
        train_folder = Path(train_folder)
        train_folder.mkdir(parents=True, exist_ok=True)
        val_folder = Path(val_folder)
        val_folder.mkdir(parents=True, exist_ok=True)
        
        src_path = Path(self.root)
        L = list_images(src_path)
        random.shuffle(L) # in place op
        n_val = round(len(L)*val_ratio)
        n_val = max(1, n_val) # ensure 1 example at least kept for validation
        shutil.copy(src_path/'instances.json',
                    train_folder)
        shutil.copy(src_path/'instances.json',
                    val_folder)
        
        # Deal with the images of src_folder
        # Move the first images in L in the val destination
        for im_p in L[:n_val]:
            shutil.copy(src_path/im_p.name,
                        val_folder/im_p.name)
        # Move the remaining images in L in the train destination            
        for im_p in L[n_val:]:
            shutil.copy(src_path/im_p.name,
                        train_folder/im_p.name)

    def clean_instances(self, force_no_crowd=None):
        '''
        Create a new instances.json file where references to missing images 
        have been removed from the new "instances.json" file. 
        If force_no_crowd is not None, set the field "iscrowd" to 0 
        for each annotations
        '''
        out_instances = dict()
        out_instances['info'] = copy.deepcopy(self.coco.dataset['info'])
        out_instances['categories'] = copy.deepcopy(self.coco.dataset['categories'])
        # we need to make sure that the categories of the other dataset folders
        # are compatible in the loop on folder_list
        out_instances['images'] = []
        out_instances['annotations'] = []

        for ii in self.present_image_ids: 
            # ii: image index
            out_instances['images'].append(self.coco.imgs[ii])
            out_instances['annotations'].extend(self.coco.imgToAnns[ii])
        
        if force_no_crowd:
            for ann in out_instances['annotations']:
                ann['iscrowd'] = 0
                y,x,Y,X = ann['bbox']
                ann['area'] = abs(X-x)*abs(Y-y)
        
        # save json file
        with open(Path(self.root)/"instances.json", "w") as f:
            json.dump(out_instances, f)
        print('Cleaning instances.json completed!')

#-----------------------------------------------------------


def merge_dataset_folders(folder_list, dst_folder):
    '''
    Merge several coco image dataset folders into a single dataset folder.
    The key task is to create a unified "instances.json" file for the 
    new dataset folder.
    

    Parameters
    ----------
    folder_list : list of image folders, each folder containing an
                instances.json file
    dst_folder : the destination folder where the unified dataset is created
    
    Returns
    -------
    None.

    '''
    
    def check_categories(unified_cat_list, current_cat_list):
        ud = dict( (d['id'], d['name']) for d in unified_cat_list)
        # ud dictionary of the form { 3:'shark', 5:'dolphin'}
        for cd in current_cat_list:
            if cd['id'] in ud.keys():
                if ud[cd['id']] == cd['name']:
                    continue # same info
                else:
                    print(f' {cd=} whereas {unified_cat_list=}')
                    raise Exception("incompatible categories dictionaries")
            # key is new, update unified_dict
            unified_cat_list.append(cd)
                        
    # Make sure that the destination folder for the static dataset exist
    dst_folder = Path(dst_folder)
    dst_folder.mkdir(parents=True, exist_ok=True)
    
    # create a new instances.json file
    
    # use the information of the first folder in the list to initialize 
    # the resulting "instances.json" out_instances
    with open(Path(folder_list[0],"instances.json")) as f:
        in_instances = json.load(f)
        
    out_instances = dict()
    out_instances['info'] = copy.deepcopy(in_instances['info'])
    out_instances['categories'] = copy.deepcopy(in_instances['categories'])
    # we need to make sure that the categories of the other dataset folders
    # are compatible in the loop on folder_list
    out_instances['images'] = []
    out_instances['annotations'] = []
    
    # id counters for the unified dictionaries in instances.json
    # out_image_id = 0   , will be len(out_instances['images'])
    # out_annotation_id = 0 , will be len(out_instances['annotations'])
    
    print('>>>   Starting merge of image datasets to {dst_folder=}\n')
    for scr_folder in folder_list:
        
        print(f'Processing  ->  {scr_folder}\r')
        with open(Path(scr_folder,"instances.json")) as f:
            src_instances = json.load(f)
        
        # check_categories, note that out_instances['categories']
        # and src_instances['categories'] are lists of dictionaries
        check_categories(out_instances['categories'], src_instances['categories'])
        
        try:
            src_sfid = SingleFolderImageDataset(scr_folder)
        except:
            print(f'issues with {scr_folder=}')
            raise Exception('Error while creating src_sfid')
        
        # mapping from the src instances image id to the out_instances image id
        # This needed is needed for the unified annotations
        mapping_global_image_id = dict()
        
        # merge src_instances["images"]  into out_instances["images"]
        
        for image_entry in src_instances["images"]:
            if not image_entry['id'] in src_sfid.present_image_ids:
                continue # skip the record of this image as it is missing
            # change the id and name of the images in out_instances to prevent conflict
            out_image_id = len(out_instances['images']) # next available image id
            out_instances['images'].append(copy.deepcopy(image_entry))
            out_image_entry = out_instances['images'][out_image_id] # a dict in the images list
            out_image_entry['id'] = out_image_id
            # update mapping from src instances id to the id in out_instances
            mapping_global_image_id[image_entry['id']] = out_image_id
            out_image_entry['file_name'] = '_'.join((scr_folder.name, image_entry['file_name']))
            # copy the image
            shutil.copy(scr_folder/image_entry['file_name'],
                        dst_folder/out_image_entry['file_name'])
            
        # end of loop over src_instances["images"]
                        
        # consider all annotations in images present in src_folder
        for ann in src_instances["annotations"]:
            if not ann['image_id'] in src_sfid.present_image_ids:
                continue # skip the annotation as the corresponding image is missing
            # annotation is fine, need to update the id's
            out_annotation_id = len(out_instances['annotations'])  # next available annotation id         
            out_instances['annotations'].append(copy.deepcopy(ann))
            out_ann = out_instances['annotations'][out_annotation_id] # a dict in the annotations list
            out_ann['id'] = out_annotation_id
            out_ann['image_id'] = mapping_global_image_id[ann['image_id']]                        
        # end of loop over src_instances["annotations"]
        
    # end of loop on folder_list
        
    # save json file
    with open(dst_folder/"instances.json", "w") as f:
        json.dump(out_instances, f)
    print('Merge operation completed!')
    

#-----------------------------------------------------------

# deprecated
class SmallLabelledDataset(Dataset):
    def __init__(self, small_dataset):
        '''
        small_dataset : path to a pt file containing a 
        labelled dataset of examples of the form (ii, tt) where
        ii is a Tensor of shape (3,800,800) and tt a dictionary
        of the form
        {'boxes': tensor([[0.1013, 0.4844, 0.2025, 0.2713],
                 [0.2313, 0.2800, 0.2375, 0.2675],
                 [0.7800, 0.1050, 0.3450, 0.2025]]),
         'labels': tensor([6, 6, 6]),
         'size': tensor([800, 800]),
         'orig_size': tensor([800, 800]),
         'image_id': tensor([372])}
        The small dataset must have been create with torch.save()
        '''
        self.example_list = torch.load(small_dataset)
        
    def __getitem__(self, index):
        return self.example_list[index]

    def __len__(self):
        return len(self.example_list) # of how many examples(images?) you have
#-----------------------------------------------------------

# deprecated
@torch.no_grad() 
def my_evaluate(model, criterion, postprocessors,  
                data_loader,  
                device, output_dir): 
    '''
    This is a hack to replace the call  test_stats, coco_evaluator = evaluate(..)
    in main.py
    
    '''
    model.eval() 
    criterion.eval() 
    metric_logger = utils.MetricLogger(delimiter="  ") 
    metric_logger.add_meter('class_error', utils.SmoothedValue(window_size=1, fmt='{value:.2f}')) 

    header = 'Test:' 
    print_freq = 10
    
    # max_num_eval = 50 # fred debug
    # num_eval = 0  # fred debug
    
    for samples, targets in metric_logger.log_every(data_loader, print_freq, header): 
        samples = samples.to(device) 
        targets = [{k: v.to(device) for k, v in t.items()} for t in targets] 
        outputs = model(samples) 
        loss_dict = criterion(outputs, targets) 
        weight_dict = criterion.weight_dict 
        # losses = sum(loss_dict[k] * weight_dict[k] for k in loss_dict.keys() if k in weight_dict) 
        # reduce losses over all GPUs for logging purposes 
        loss_dict_reduced = utils.reduce_dict(loss_dict) 
        loss_dict_reduced_scaled = {k: v * weight_dict[k] 
                                    for k, v in loss_dict_reduced.items() if k in weight_dict} 
        loss_dict_reduced_unscaled = {f'{k}_unscaled': v 
                                      for k, v in loss_dict_reduced.items()} 
        metric_logger.update(loss=sum(loss_dict_reduced_scaled.values()), 
                             **loss_dict_reduced_scaled, 
                             **loss_dict_reduced_unscaled) 
        metric_logger.update(class_error=loss_dict_reduced['class_error']) 
        # orig_target_sizes = torch.stack([t["orig_size"] for t in targets], dim=0) 
        # results = postprocessors['bbox'](outputs, orig_target_sizes) 
        
        # num_eval += 1 # fred debug
        # if num_eval >= max_num_eval:# fred debug
        #     break# fred debug

    # gather the stats from all processes 
    metric_logger.synchronize_between_processes() 

    print("Averaged stats:", metric_logger) 
    stats = {k: meter.global_avg for k, meter in metric_logger.meters.items()}

    return stats 

 

def tester_SingleFolderImageDataset(): 
    # Test code for SingleFolderImageDataset class
    print('Running tester_SingleFolderImageDataset')
    dataDir = '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_1'
    sfid = SingleFolderImageDataset(dataDir)
    # Get a variation of an indexed training example 
    ii, tt = sfid[2] 
    return ii, tt # image, target
   
    
if __name__ == '__main__':
    

    # Use the following lines if a folder needs preprocessing
    
    # Step 1 : ---------------------------------------------------------------
    #    Ensure each animal is of diameter smaller than the input of 
    #    the neural network detector    
    if 0:        
        dataDir = '/home/frederic/Documents/RESEARCH/small_datasets/data_1'
        shrink_dataDir = '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_1'
        shrink_dataset_images_if_needed(dataDir,
                                        shrink_dataDir)
    
    # Deal with the preprocessing of several folders
    if 0:
        for raw_dataset_folder, shrink_dataset_folder in zip(
                    [
                    '/home/frederic/Documents/RESEARCH/small_datasets/data_1',
                    '/home/frederic/Documents/RESEARCH/small_datasets/data_2',
                    '/home/frederic/Documents/RESEARCH/small_datasets/data_3',
                    ],
                    [
                    '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_1',
                    '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_2',
                    '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_3',
                    ]
                ):
            shrink_dataset_images_if_needed(raw_dataset_folder, 
                                            shrink_dataset_folder)
        
    

    # Combine the image datasets
    cid = torch.utils.data.dataset.ConcatDataset(
                    [
                        SingleFolderImageDataset(dataDir) 
                        for dataDir in 
                        [
                        '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_1',
                        '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_2',
                        '/home/frederic/Documents/RESEARCH/small_datasets/shrink_data_3',
                        ]
                    ])


    print(f"Number of examples in combined dataset {len(cid)}")

    if 1:
        # Extract the 9th training example of the combined dataset
        ii, tt = cid[9] 
    
    # ---------------  MORE TEST CODE ---------------  

    # id = 7
    # image_l = sfid._load_image(id) # the large image
    #                             # the type of image_l is class 'PIL.Image.Image'
    # target_l = sfid._load_target(id) # the list of anns of this large image
    #                     # it calls self.coco.loadAnns(self.coco.getAnnIds(...))
    #                     # target_l is a list of annotations
    
    # show((image_l,target_l))

    
    
    

    
    # id = 2
    # image_l = sfid._load_image(id) # the large image
    #                             # the type of image_l is class 'PIL.Image.Image'
    # target_l = sfid._load_target(id) # the list of anns of this large image
    #                    # it calls self.coco.loadAnns(self.coco.getAnnIds(...))
    #                    # target_l is a list of annotations

    # show((image_l,target_l))
       
    # import json
    # with open(dataDir+'/instances.json', 'r') as f:
    #     dd = json.load(f)    
    # pass



    # ii, tt = sfid[2]   
