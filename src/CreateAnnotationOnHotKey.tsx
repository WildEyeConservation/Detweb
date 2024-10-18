import React, { useCallback, useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapEvents } from 'react-leaflet';
import { ImageContext,ProjectContext } from './Context';


export default function CreateAnnotationOnHotKey({ hotkey, category, createAnnotation,setId,imageId,source }) {
  const [currentPosition, setCurrentPosition] = React.useState({ x: 0, y: 0 });
    const { latLng2xy } = useContext(ImageContext);
    const {project} = useContext(ProjectContext)!;

    useMapEvents({
        mousemove: (e) => {
            setCurrentPosition(latLng2xy(e.latlng));
        },
    });

    const handleHotkey = useCallback(() => {
        createAnnotation({ 
            categoryId: category.id, 
            setId: setId,
            imageId: imageId,
            x: Math.round(currentPosition.x), 
            y: Math.round(currentPosition.y),
            projectId: project.id,
            source: source
        });
    }, [category.id, createAnnotation, currentPosition,imageId,setId,project.id,source]);

    useHotkeys(hotkey, handleHotkey, [handleHotkey]);

    return null;
}
