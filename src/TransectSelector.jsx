import {LayerGroup, Polyline,useMap} from "react-leaflet";
import React,{useEffect} from "react";

function getBounds(input){
  return input.reduce((x,y) => [[Math.min(x[0][0],y[0]),Math.min(x[0][1],y[1])],[Math.max(x[1][0],y[0]),Math.max(x[1][1],y[1])]],[[Infinity,Infinity],[-Infinity,-Infinity]])
}

function TransectSelector(props) {
  const map=useMap();
  useEffect(()=>{map.fitBounds(getBounds(props.coords))},[props.coords,map]);
  useEffect(()=>{map.setView(props.coords[props.index],map.getZoom())},[props.coords,map,props.index]);
  return <LayerGroup>
    <Polyline pathOptions={{color:'blue'}} positions={props.coords.slice(0,props.startIndex)}/>
    <Polyline pathOptions={{color:'red'}} positions={props.coords.slice(props.startIndex,props.index)}/>
    <Polyline pathOptions={{color:'lightblue'}} positions={props.coords.slice(props.index)}/>
  </LayerGroup>
}

export default TransectSelector;
