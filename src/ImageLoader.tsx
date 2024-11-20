import { useParams } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from './Context';
import AnnotationImage from './AnnotationImage';

export function ImageLoader() {
  const { imageId,annotationSetId } = useParams();
  const [element, setElement] = useState<JSX.Element | null>(null);
  const { client } = useContext(GlobalContext)!;
  
  useEffect(() => {
    client.models.Image.get({ id: imageId! }, { selectionSet: ['id', 'width', 'height'] }).then(({ data }) => {
        setElement(<AnnotationImage visible={true} location={{image:{...data},annotationSetId,x:data.width/2,y:data.height/2,width:data.width,height:data.height}} />);
      });
  }, [imageId, annotationSetId]);
    
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