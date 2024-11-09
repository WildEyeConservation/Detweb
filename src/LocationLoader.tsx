import { useParams } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from './Context';
import AnnotationImage from './AnnotationImage';

export function LocationLoader() {
  const { locationId,annotationSetId } = useParams();
  const [element, setElement] = useState<JSX.Element | null>(null);
  const { client } = useContext(GlobalContext)!;
  
  useEffect(() => {
    client.models.Location.get({ id: locationId! }, { selectionSet: ['id', 'x', 'y', 'width', 'height', 'confidence', 'image.id', 'image.width', 'image.height'] }).then(({ data }) => {
        setElement(<AnnotationImage visible={true} location={{...data,annotationSetId}} />);
      });
  }, [locationId, annotationSetId]);
    
    return <div style={{ 
        position: 'relative',  // Add this container
        width: '100%',
        minHeight: '800px'     // Adjust this value based on your needs
      }}>
    <div
    style={{
    visibility: "visible",
    position: "absolute",
    justifyContent: "center",
    display: "flex",
    width: "80%",
    left: '50%',                    // Add these positioning properties
    transform: 'translateX(-50%)',   // to maintain horizontal centering
    top: 0
    }}
    >
    <div style={{ 
        display: 'flex', 
        marginTop: '1rem',
        flexDirection: 'column', 
        alignItems: 'center',
        width: '100%',
        gap: '1rem'  // Adds vertical spacing between components
      }}>
        {element}
        </div>
        </div>
        </div>
}