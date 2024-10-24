import { useMemo,useContext,useCallback} from 'react';
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
import { ImageContextFromHook } from './ImageContext';
import CreateAnnotationOnHotKey from './CreateAnnotationOnHotKey';

const Image = withCreateObservation(withAckOnTimeout(BaseImage));



export default function AnnotationImage(props) {
  const { location, next, prev, containerheight = 800, containerwidth = 1024, visible, id, ack, annotationSetId, allowOutside, zoom } = props
  const {client} = useContext(GlobalContext)!;
  const subscriptionFilter = useMemo(() => ({
    filter: { and:[{setId: { eq: location.annotationSetId }}, {imageId: { eq: location.image.id }}]}
  }), [annotationSetId, location.image.id]);
  const {categoriesHook:{data:categories},currentCategory,setCurrentCategory} = useContext(ProjectContext)!;
  const annotationsHook = useOptimisticAnnotation(
    async (nextToken) => client.models.Annotation.annotationsByImageIdAndSetId({ imageId: location.image.id, setId: { eq: location.annotationSetId }},{nextToken}),
    subscriptionFilter)
  const memoizedChildren = useMemo(() => {
    console.log('memoizing')
    return [
      <CreateAnnotationOnClick key="caok" allowOutside={allowOutside} location={location} annotationSet={annotationSetId} source='manual' />,
      <ShowMarkers key="showMarkers" />,
      <Location key="location"{...location} />,
      <Legend key="legend" position="bottomright" />
    ].concat(categories?.map(category => (
      <CreateAnnotationOnHotKey
        key={category.id}
        hotkey={category.shortcutKey}
        setId={location.annotationSetId}
        category={category}
        imageId={location.image.id}
        createAnnotation={annotationsHook.create}
        source='manual'
      />
    )))
  }, []);

  return (<ImageContextFromHook hook={annotationsHook} image={location.image}>
            <Image
            containerwidth={containerwidth}
            containerheight={containerheight}
            visible={visible}
            location={location}
            zoom={zoom}
            id={id} 
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}> 
            {visible &&memoizedChildren}
    {/* <PushToSecondary {...props} /> */}
    </Image >
    </ImageContextFromHook>
  );
}

