import React, { useCallback, useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapEvents } from 'react-leaflet';
import { ImageContext } from './BaseImage';

export default function CreateAnnotationOnHotKey({ hotkey, category, createAnnotation }) {
  const [currentPosition, setCurrentPosition] = React.useState({ x: 0, y: 0 });
  const { latLng2xy } = useContext(ImageContext);

    useMapEvents({
        mousemove: (e) => {
            setCurrentPosition(latLng2xy(e.latlng));
        },
    });

    const handleHotkey = useCallback(() => {
        createAnnotation({ 
            categoryId: category.id, 
            x: currentPosition.x, 
            y: currentPosition.y 
        });
    }, [category.id, createAnnotation, currentPosition]);

    useHotkeys(hotkey, handleHotkey, [handleHotkey]);

    return null;
}
