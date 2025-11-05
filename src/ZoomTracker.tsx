import { useEffect, useState, useContext } from 'react';
import { useMap } from 'react-leaflet';
import { ImageContext } from './Context';

const ZoomTracker = () => {
  const map = useMap();
  const { setZoom } = useContext(ImageContext)!;

  useEffect(() => {
    const handleZoomChange = () => {
      setZoom(map.getZoom());
      console.log('Current zoom level:', map.getZoom());
    };

    map.on('zoomend', handleZoomChange);

    // Cleanup listener when component unmounts
    return () => {
      map.off('zoomend', handleZoomChange);
    };
  }, [map]);

  // This component doesn't render anything
  return null;
};

export default ZoomTracker;
