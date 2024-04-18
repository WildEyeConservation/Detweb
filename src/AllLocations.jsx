import React,{ useEffect, useState } from 'react'
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css'
import { getLocationSet, locationsByImageKey } from './graphql/queries'
import Location from './Location'
import { LayerGroup ,LayersControl} from 'react-leaflet'
import { gqlClient, graphqlOperation } from "./App"



export default function AllLocations({image}){
    const [locationSets,setLocationSets]=useState({})
    useEffect(()=>{
        const go=async()=>{
            let locations=[]
            let nextToken=undefined
            do{
                const {data:{locationsByImageKey:locs}}=await gqlClient.graphql(graphqlOperation(locationsByImageKey,{imageKey:image.key,nextToken}))
                for (const item of locs.items){
                    locations.push(item)
                }
                nextToken=locs.nextToken
            } while (nextToken)
            const _locationSets={}
            for (const loc of locations){
                if (loc.setId in _locationSets){
                    _locationSets[loc.setId].locs.push(loc)
                }else{
                    const {data:{getLocationSet:{name}}}= await gqlClient.graphql(graphqlOperation(getLocationSet,{id:loc.setId}))
                    _locationSets[loc.setId]={name,locs:[loc]}
                }
            }
            setLocationSets(_locationSets)
        }
        go()
    },[])

    
                
              
    return <>{Object.keys(locationSets).map(key=><LayersControl.Overlay name={locationSets[key].name} key={key} checked={false}>
        <LayerGroup pane='shadowPane'> 
        {/* By default this layer goes to the overlayPane. We want to lift it slightly to the shadowPane so that it renders over the current
            location (which has showTestCase==false) */}
            {locationSets[key].locs.map( loc => <Location key={loc.id} showTestCase={true} {...loc}/>)}
        </LayerGroup>
        </LayersControl.Overlay>)}</>
        
    }
