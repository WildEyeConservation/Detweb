import React from 'react';
import { TaskSelector } from './TaskSelector';
import { LivenessIndicator } from "./LivenessIndicator";
import { Row } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { StorageLayer } from './StorageLayer';

const QuickTest: React.FC = () => {
    //const entry = {"location":{"id":"330a783a-5bf2-446e-b4fb-fc550103b572","x":1537,"y":3783,"width":20,"height":52,"confidence":null,"image":{"id":"6edc0e1e-5b32-43dd-8b4b-be337d35d847","width":6336,"height":9504},"annotationSetId":"garbage3"},"allowOutside":true}
    const entry = {"selectedSet":"garbage","images":["a29b7b64-6172-41da-a6e5-2fc2831415fd","0aa5a829-51bd-47d5-b8fd-2e3084174759"],"message_id":"37cdacec-c4ec-4a67-9613-1a6cd3bf795b"}
  return (
    <TaskSelector {...entry}/>
  //   <Row className="align-items-center h-100">
  //   {/* <LivenessIndicator /> */}
  // </Row>

  );
//   return (
//     <MapContainer center={[0, 0]} zoom={5} scrollWheelZoom={true} crs={L.CRS.Simple}>
      
//   <StorageLayer source={'Addo2024-1708-Nadir/DSC00044.jpg'}
//                 maxNativeZoom={6}
//         noWrap={true}
//         bounds={[[-98.53,0],[0,147]]}
//               //getObject={getObject}
//               />{Array.from({ length: 500 }, (_, i) => (
//         <Marker key={i} position={[(Math.random())*-99,(Math.random())*98]} >      <Popup>
//       A pretty CSS3 popup. <br /> Easily customizable.
//     </Popup>
// </Marker>
//       ))}
//   </MapContainer>
//   );
};

export default QuickTest;
