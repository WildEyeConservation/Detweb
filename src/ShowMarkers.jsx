import React,{ useContext,useEffect,useState } from "react";
import { UserContext } from "./UserContext";
import { CategoriesContext } from "./Categories";
import './index.css'
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook"
import { ImageContext } from "./BaseImage";
import { Marker,Tooltip } from "react-leaflet";
import { uniqueNamesGenerator, adjectives, names } from "unique-names-generator";
import * as L from 'leaflet'

function createIcon(categories,annotation,activeAnnotation) {
    const color=categories?.find(category=>category.id===annotation.categoryId)?.color ?? 'red'
    let attributes=''
    const id =annotation.objectId || annotation.proposedObjectId
    const activeId =activeAnnotation?.objectId || activeAnnotation?.proposedObjectId
    if (activeId && id==activeId)
      attributes+=' selected'
    if (annotation.candidate)
      attributes+=' candidate'
    if (annotation.obscured)
      attributes+=' obscured'
    if (annotation.shadow)
      attributes+=' shadow'
    let html = `<div class="marker" ${attributes}><div style="background-color: ${color}; border-color: ${annotation.objectId ? '#ffffff' : annotation.proposedObjectId ? '#888888' :'#000000'}">
       <span class="markerLabel">${id ? jdenticon.toSvg( id,24) : ""}</svg></span></div></div>`;
    //let html = `<svg width="80" height="80" data-jdenticon-value="user127"/>`;
    //TODO : Confirm the units implicit in the various anchors defined below. If these are in pixels (or any other
    // absolute unit) then things may break upon a resize or even just on different resolution screens.
    // if (detection.selected)
    //   html =`<div class="spinning">${html}</div>`;
    // if (detection.candidate)
    //   html =`<div class="throbbing">${html}</div>`;
    return L.divIcon({
      className: "my-custom-pin", iconAnchor: [0, 0], labelAnchor: [0, -100],
      popupAnchor: [0, -30], html: html
    })
  }
    
export function ShowMarkers({annotations,deleteAnnotation,updateAnnotation,activeAnnotation}){
    const [categories,] = useContext(CategoriesContext)
    const {latLng2xy,xy2latLng}=useContext(ImageContext)
    const {user,sendToQueue,createQueue,currentProject} = useContext(UserContext)
    const [enabled,setEnabled]=useState(true)

    useHotkeys("Shift",()=>{
      setEnabled(!isHotkeyPressed("Shift"))
    },{keyup:true,keydown:true})

    function getContextMenuItems(det,user,categories,deleteAnnotation,updateAnnotation){
      let contextmenuItems = [];
      contextmenuItems.push({text: 'Delete',
                              index: contextmenuItems.length,
                              callback: async () => {
                                deleteAnnotation(det)
                              }
                            })
      contextmenuItems.push({text: det.obscured ?  'Mark as visible':'Mark as obscured',
                            index: contextmenuItems.length,
                            callback: async () => {
                              updateAnnotation({...det,obscured:!det.obscured})
                            }
                          })
      if (det.objectId){
        contextmenuItems.push({text:'Remove assigned name',
                          index: contextmenuItems.length,
                          callback: async () => {
                            updateAnnotation({...det,objectId:null})
                          }
                        })
                      }
  // contextmenuItems.push({text: det.note ? 'Edit Note' : 'Add Note',
      //                         index: contextmenuItems.length,
      //                       });
      // contextmenuItems.push({text: 'Link',
      //                         index: contextmenuItems.length,
      //                       });
      if (contextmenuItems.length){
        contextmenuItems.push({separator: true,
                                index: contextmenuItems.length});
      }
      for (let category of categories) {
        if (det.categoryId !== category.id) {
          let item = {
            text: `Change to ${category.name}`,
            index: contextmenuItems.length,
            callback: async () => {
              updateAnnotation({...det,categoryId:category.id});
            }
          };
          contextmenuItems.push(item)
        }
      }
      if (user.isAdmin){
        const item = {
          text: "Send message to "+det.owner,
          index: contextmenuItems.length,
          callback: async () => {
            let msg = prompt("Type the message here", "This is not an elephant");
            /* I do not know if a suitable message queue exists. But it seems that if it does allready exist, createQueue will simply return the URL for
            the existing queue. So no need to check.*/
            const {QueueUrl:url}=await createQueue({ 
                  QueueName: `${det.owner}_${currentProject}`, // required
                  Attributes:{
                  MessageRetentionPeriod:'1209600',//This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
                  }
                })
            det.message=msg
            sendToQueue({QueueUrl:url,MessageBody:JSON.stringify(det)})
            console.log(msg)
          }     
        };
        contextmenuItems.push(item)
      }
      return contextmenuItems
    }
    const getType=(annotation)=>categories?.find(category=>category.id===annotation.categoryId)?.name ?? 'Unknown'
    if (enabled)
    return (<>{annotations?.map(annotation=>
        <Marker
          /* Because I am potentially changing immutable properties below (specifically contextMenuItems), 
          I need to ensure that the key changes on every render, so that instead of trying to modify props and expecting the component to 
          update, I am replacing the entire component on every render.
          */
          //key={annotation.y + annotation.id + annotation.categoryId + annotation.x +annotation.selected + annotation.obscured + annotation.objectId + annotation.proposedObjectId} 
          key={annotation.id || annotation.x} 
          eventHandlers={{
            dragend:(e)=>{
                let coords = latLng2xy(e.target.getLatLng());
                updateAnnotation({...annotation,y:Math.round(coords.y),x:Math.round(coords.x)});      
            },
          }}
          position={xy2latLng(annotation)}
          draggable={true}
          autopan={true}
          icon={createIcon(categories,annotation,activeAnnotation)}
          contextmenu={true}
          contextmenuInheritItems={false}
          contextmenuItems={getContextMenuItems(annotation,user,categories,deleteAnnotation,updateAnnotation)}
        >
        <Tooltip>Category: {getType(annotation)} <br/>
        Created by : {annotation?.owner}<br/>
        {annotation?.createdAt && <>Created at : {annotation?.createdAt} <br/></>} 
        {annotation.objectId && `Name: ${uniqueNamesGenerator({dictionaries: [ adjectives, names],seed: annotation.objectId,style:'capital',separator:' '})}`}
        {!annotation.objectId && annotation.proposedObjectId && `Proposed Name: ${uniqueNamesGenerator({dictionaries: [ adjectives, names],seed: annotation.proposedObjectId,style:'capital',separator:' '})}`}
        </Tooltip>
      </Marker>
      )}</>)
      else{return null}
      
}