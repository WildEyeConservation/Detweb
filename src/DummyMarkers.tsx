import { Marker, Popup } from 'react-leaflet';

function DummyMarkers({ number: number = 500 }) {
  return Array.from({ length: number }, (_, i) => (
    <Marker key={i} position={[Math.random() * -99, Math.random() * 98]}>
      <Popup>
        A pretty CSS3 popup. <br /> Easily customizable.
      </Popup>
    </Marker>
  ));
}

export default DummyMarkers;
