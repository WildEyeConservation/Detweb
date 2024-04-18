import React, {useEffect, useState, useRef, useContext } from 'react';
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import {addLocal} from './Files'
import { UserContext } from './UserContext';
import { createImageSet } from './graphql/mutations';
import { useUpdateProgress } from './useUpdateProgress';
import {list, uploadData} from 'aws-amplify/storage'
import { limitConnections } from "./App"

async function recurseFolder(dirHandle,path){
  let files=[]
  for await (const entry of dirHandle.values()) {
    if (entry.kind==='directory'){
      files=files.concat(await recurseFolder(entry,path+'/'+entry.name))
    } else {
      const upper=entry.name.toUpperCase()
      if (upper.endsWith('.JPG') || upper.endsWith('.JPEG')){
        entry.path=path
        addLocal(entry)      
        files.push({entry})
      }
    }
  }
  return files
}


export default function FilesUploadComponent({show,handleClose,dirHandle}){
const [upload,setUpload]=useState(true)
const [name,setName]=useState("")
const [integrityCheck,setIntegrityCheck]=useState(true)
const [recurseResult,setRecurseResult]=useState(undefined)
const submitButtonRef = useRef(null);
const {currentProject,gqlSend}=useContext(UserContext)
const [setStepsCompleted,setTotalSteps] = useUpdateProgress({
  taskId:`Upload files`,
  determinateTaskName:'Uploading files',
  stepName:'files'})


useEffect(() => { 
    if (show) {
        submitButtonRef.current.focus();
    }
}, [show]);

async function upload2S3storage(entry){
  console.log('uploading' + entry.path+'/'+entry.name)
  const key='images/'+entry.path+'/'+entry.name
  await uploadData({key, data: await entry.getFile()}).result
  setStepsCompleted(fc=>fc+1)
  return entry
}

// async function calcMD5(data){
//   if (integrityCheck){
//     return new Promise((resolve,reject)=>{
//     var reader = new FileReader();
//     reader.addEventListener('load',function () {
//       var hash = MD5(enc.Latin1.parse(this.result));
//       resolve({...data,hash:hash.toString(enc.Hex)})})
//       reader.readAsBinaryString(data.file);
//     })}
//     else{
//       return {...data,hash:undefined}
//     }
// }

// function exifDateTimeToUnix(tags) {
//   /*Exif DateTime strings are a little ugly. They seem to use the non standard datetime format "yyyy:MM:dd HH:mm:ssZZ", which is not great to start with 
//   but the time zone informtion [ZZ] is not always present, which sucks.*/
//   var dateString=tags['DateTimeOriginal'].description
//   if (dateString.length<20){
//     dateString+=tags['OffsetTimeOriginal'].description
//   }
//   var dt=DateTime.fromFormat(dateString, "yyyy:MM:dd HH:mm:ssZZ")
//   if (!dt.isValid){
//     dt=DateTime.fromFormat(dateString, "yyyy:MM:dd HH:mm:ss")
//   }
//   return dt.toSeconds();
// }


/* I used to extract the exif metadata on the client side and then update the database from here. This functionality is now a part of the handleS3upload lambda, 
so it has been commented here. The reason why I have not removed it is that I will need a client side version if we are to support a fully or partially 
offline mode */
// async function getExifmeta(data){
//     const file=await data.entry.getFile()
//     const tags = await ExifReader.load(file)
//     /* I am saving all of the exifdata to make it easier to answer questions about eg. lens used/ISO/shutterTime/aperture distributions later on. However, some 
//     EXIF fields are absolutely huge and make writing to my database impossibly slow. I explicitly drop those here*/
//     delete tags['Thumbnail']
//     delete tags['Images']
//     delete tags['MakerNote']
//     return ({...data,
//               file,
//               key:data.entry.path+'/'+data.entry.name,
//               width:tags['Image Width'].value,
//               height:tags['Image Height'].value, 
//               timestamp:exifDateTimeToUnix(tags),
//               cameraSerial:tags['Internal Serial Number']?.value,
//               exifData:JSON.stringify(tags)})
// }
// async function updateDB(data,imageSetId){
//   const {data:{createImage:{key:imageKey}}}=await gqlClient.graphql({query: createImage,variables:{input:{hash:data.hash,key:data.key,timestamp:data.timestamp,exifData:data.exifData,height:data.height,width:data.width}}});
//   await gqlClient.graphql({query: createImageSetMembership,variables:{input:{imageKey,imageSetId}}})
//   console.log(data)
//   return data
// }


useEffect(()=>{
  if (dirHandle){
    setName(dirHandle.name)
    setRecurseResult(recurseFolder(dirHandle,dirHandle.name))
  }
},[dirHandle]
)

  const handleSubmit = async()=>{
    handleClose()
    const files=await recurseResult
    const {items} = await list({prefix:'images/'+dirHandle.name+'/',options:{listAll:true}});
    var existingFiles = items.reduce(function(set, x) {
      set.add(x.key.substring('images/'.length))
      return set;
    }, new Set());
    var filesToUpload=files.reduce(function(files,file){
      if (!existingFiles.has(file.entry.path+'/'+file.entry.name)){
        files.push(file)
      }
      return files
    }, [])
    setTotalSteps(filesToUpload.length)
    setStepsCompleted(0)
    const promises=filesToUpload.map(({entry})=>limitConnections(()=>upload2S3storage(entry)))
    Promise.all(promises).then(()=>gqlSend(createImageSet,{input:{name,projectName:currentProject}}))
  }

  return <Modal show={show} onHide={handleClose}>
  <Modal.Header closeButton>
    <Modal.Title>Add files</Modal.Title>
  </Modal.Header>
  <Modal.Body>
  <Form>
  <Form.Group>
  <Form.Check // prettier-ignore
          type="switch"
          id="custom-switch"
          label="Upload files to S3"
          checked={upload}
          onChange={(x)=>{setUpload(x.target.checked)}}
      />
      </Form.Group>
      <Form.Group>
      <Form.Check // prettier-ignore
          type="switch"
          id="custom-switch"
          label="Do integrity check"
          checked={integrityCheck}
          onChange={(x)=>{setIntegrityCheck(x.target.checked)}}
        />
      <Form.Group>
      <Form.Label>Imageset Name</Form.Label>
      <Form.Control type="string" value={name} onChange={(x)=>setName(x.target.value)} disabled/>  
      </Form.Group>
    </Form.Group>
  </Form>
  </Modal.Body>
  <Modal.Footer>
  <Button variant="primary" onClick={handleSubmit} ref={submitButtonRef}>
                    Submit 
  </Button>
  <Button variant="primary" onClick={handleClose}>
    Cancel 
  </Button>
  </Modal.Footer>
</Modal>;
}
