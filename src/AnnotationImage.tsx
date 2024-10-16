import { useMemo,useContext} from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { GlobalContext, ProjectContext } from './Context';
// import { UserContext } from './UserContext';
// import { useMapEvents } from 'react-leaflet';
import { ShowMarkers } from './ShowMarkers';
import { useOptimisticAnnotation } from './useOptimisticUpdates';
import CreateAnnotationOnHotKey from './CreateAnnotationOnHotKey';

const Image = withCreateObservation(withAckOnTimeout(BaseImage));



export default function AnnotationImage(props) {
  const { location, next, prev, containerheight = 800, containerwidth = 1024, visible, id, ack, annotationSetId, allowOutside } = props
  const {client} = useContext(GlobalContext)!;
  const subscriptionFilter = useMemo(() => ({
    filter: { and:[{setId: { eq: location.annotationSetId }}, {imageId: { eq: location.image.id }}]}
  }), [annotationSetId, location.image.id]);
  const {categoriesHook:{data:categories},currentCategory,setCurrentCategory} = useContext(ProjectContext)!;
  const annotationsHook = useOptimisticAnnotation(
    async () => client.models.Annotation.annotationsByImageIdAndSetId({imageId: location.image.id, setId: {eq: annotationSetId}}),
    subscriptionFilter)
  const memoizedChildren = useMemo(() => (
    <>
      {categories?.map(category => (
        <CreateAnnotationOnHotKey
          key={category.id}
          hotkey={category.shortcutKey}
          setId={location.annotationSetId}
          category={category}
          image={location.image.id}
          createAnnotation={annotationsHook.create}
        />
      ))}
    </>
  ), [categories, location.annotationSetId, location.image.id, annotationsHook.create]);
    
  return (<Image
            containerwidth={containerwidth}
            containerheight={containerheight}
            visible={visible}
            location={location}
            id={id} 
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}>
            {location && <Location {...location}/>} 
            <CreateAnnotationOnClick {...{ annotationsHook, allowOutside, location, annotationSet: annotationSetId, source: 'manual' }} />
            {visible && memoizedChildren}
            <ShowMarkers annotationsHook={annotationsHook}/>
    {/* <PushToSecondary {...props} /> */}
    
          <Legend position="bottomright" /> 
        </Image >
  );
}

