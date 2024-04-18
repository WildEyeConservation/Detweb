import {Rectangle } from 'react-leaflet'
import React,{ useContext, useState } from 'react'
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css'
import { gqlClient, graphqlOperation } from './App'
import { updateLocation } from './graphql/mutations'
import { UserContext } from './UserContext'
import { ImageContext } from './BaseImage'

export default function Location({x,y,width,height,id,isTest:_isTest,showTestCase,confidence=0}){
    const {xy2latLng}=useContext(ImageContext)
    const [isTest,setTest]=useState(_isTest)
    const {user}=useContext(UserContext)
    const [key,setKey]=useState(crypto.randomUUID())
    let boundsxy=[[x-width/2, y-height/2],[x+width/2, y+height/2]]
    const contextMenuItems=[{text:`Confidence : ${confidence}`,callback:()=>console.log('conf callback')}]
    if (user.isAdmin) {
        contextMenuItems.push({text:isTest ? "Stop using this location as a test location" : "Use this location as a test location",
        callback : changeTest})
    }
    function changeTest(){
        /* the contextmenuItems prop of Rectangle is immutable, so to see the effect of the update we need to force the component to unmount and 
        remount each time there is a change*/
        setKey(crypto.randomUUID())
        setTest(!isTest)
        gqlClient.graphql(graphqlOperation(updateLocation,{input:{id, isTest : !isTest ? Math.floor(Date.now() / 1000) : null}}))
    }
    return <Rectangle key={key} bounds={xy2latLng(boundsxy)} fill={false} 
    contextmenu={true}
    contextmenuInheritItems={false}
    color= {(showTestCase && isTest) ? 'red' : 'blue'}
    contextmenuItems={contextMenuItems}/>
}