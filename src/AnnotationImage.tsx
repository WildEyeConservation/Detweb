import { useMemo,useContext,useCallback} from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { GlobalContext, ProjectContext } from './Context';
import { ShowMarkers } from './ShowMarkers';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { ImageContextFromHook } from './ImageContext';
import CreateAnnotationOnHotKey from './CreateAnnotationOnHotKey';
import { Schema } from '../amplify/data/resource';
import useImageStats from './useImageStats';
const Image = withCreateObservation(withAckOnTimeout(BaseImage));

export default function AnnotationImage(props) {
  const { location, next, prev, containerheight = 800, containerwidth = 1024, visible, id, ack, annotationSetId, allowOutside, zoom } = props
  const {client} = useContext(GlobalContext)!;
  const subscriptionFilter = useMemo(() => ({
    filter: { and:[{setId: { eq: location.annotationSetId }}, {imageId: { eq: location.image.id }}]}
  }), [annotationSetId, location.image.id]);
  const {categoriesHook:{data:categories},currentCategory,setCurrentCategory} = useContext(ProjectContext)!;
  const annotationsHook = useOptimisticUpdates<Schema['Annotation']['type'], 'Annotation'>(
    'Annotation',
    async (nextToken) => client.models.Annotation.annotationsByImageIdAndSetId(
      { imageId: location.image.id, setId: { eq: location.annotationSetId } },
      { nextToken }
    ),
    subscriptionFilter
  )
  const stats = useImageStats(annotationsHook);
  const memoizedChildren = useMemo(() => {
    console.log('memoizing')
    const source = props.taskTag ? `manual-${props.taskTag}` : 'manual';
    return [
      <CreateAnnotationOnClick key="caok" allowOutside={allowOutside} location={location} annotationSet={annotationSetId} source={source} />,
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
        source={source}
      />
    )))
  }, [props.taskTag,location.image.id,annotationSetId]);

  return (<ImageContextFromHook hook={annotationsHook} image={location.image} secondaryQueueUrl={props.secondaryQueueUrl} taskTag={props.taskTag}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              width: '80%',  // Match the parent container width from withPriorityQueue
              position: 'relative'
            }}>
      <Image
                stats={stats}
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
                {visible && memoizedChildren}
              </Image>
              {visible && props.taskTag && 
                <div style={{ 
                  marginTop: '1rem',
                  position: 'absolute',
                  bottom: '-2rem'  // Position below the image container
                }}>
                  Now working on task {props.taskTag}
                </div>
              }
            </div>
    </ImageContextFromHook>
  );
}

