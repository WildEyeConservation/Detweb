import { useMemo, useContext, useCallback, useEffect, useState } from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { MapLegend, SideLegend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { GlobalContext, ProjectContext, UserContext } from './Context';
import { ShowMarkers } from './ShowMarkers';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { ImageContextFromHook } from './ImageContext';
import CreateAnnotationOnHotKey from './CreateAnnotationOnHotKey';
import { Schema } from '../amplify/data/resource';
import useImageStats from './useImageStats';
import { Badge, Button } from 'react-bootstrap';
import { Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const Image = withCreateObservation(withAckOnTimeout(BaseImage));

export default function AnnotationImage(props: any) {
  const {
    location,
    next,
    prev,
    visible,
    id,
    ack,
    allowOutside,
    zoom,
    hideNavButtons,
  } = props;
  const { annotationSetId } = location;
  const { client } = useContext(GlobalContext)!;
  //testing
  const { currentTaskTag, isTesting, isAnnotatePath } =
    useContext(UserContext)!;
  const navigate = useNavigate();
  const subscriptionFilter = useMemo(
    () => ({
      filter: {
        and: [
          { setId: { eq: location.annotationSetId } },
          { imageId: { eq: location.image.id } },
        ],
      },
    }),
    [annotationSetId, location.image.id]
  );
  const {
    categoriesHook: { data: categories },
  } = useContext(ProjectContext)!;
  const annotationsHook = useOptimisticUpdates<
    Schema['Annotation']['type'],
    'Annotation'
  >(
    'Annotation',
    async (nextToken) =>
      client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: location.image.id, setId: { eq: location.annotationSetId } },
        { nextToken }
      ),
    subscriptionFilter
  );
  const stats = useImageStats(annotationsHook);
  const memoizedChildren = useMemo(() => {
    console.log('memoizing');
    // non-existing setId for testing since annotations are recorded in context
    const setId = isTesting ? '123' : annotationSetId;
    const source = props.taskTag ? `manual-${props.taskTag}` : 'manual';
    return [
      <CreateAnnotationOnClick
        key="caok"
        allowOutside={allowOutside}
        location={location}
        annotationSet={setId}
        source={source}
      />,
      <ShowMarkers key="showMarkers" annotationSetId={setId} />,
      <Location key="location" {...location} />,
      <MapLegend
        key="legend"
        position="bottomright"
        annotationSetId={annotationSetId}
      />,
    ].concat(
      categories
        ?.filter((c) => c.annotationSetId == annotationSetId)
        ?.map((category) => (
          <CreateAnnotationOnHotKey
            key={category.id}
            hotkey={category.shortcutKey}
            setId={setId}
            category={category}
            imageId={location.image.id}
            source={source}
          />
        ))
    );
  }, [props.taskTag, location.image.id, annotationSetId, isTesting]);

  async function handleShare() {
    const windowUrl = new URL(window.location.href);
    let url = '';

    if (location.id && location.annotationSetId) {
      url = `${windowUrl.origin}/location/${location?.id}/${location?.annotationSetId}`;
    } else if (location.image.id && location.annotationSetId) {
      url = `${windowUrl.origin}/image/${location.image.id}/${location?.annotationSetId}`;
    } else {
      return;
    }

    try {
      await navigator.share({ url: url });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <ImageContextFromHook
      hook={annotationsHook}
      locationId={location.id}
      image={location.image}
      secondaryQueueUrl={props.secondaryQueueUrl}
      taskTag={props.taskTag}
    >
      <div className="d-flex flex-md-row flex-column justify-content-center w-100 h-100 gap-3 overflow-auto">
        <div
          className={`d-flex flex-column align-items-center w-100 h-100 gap-3`}
          style={{
            maxWidth: '1024px',
          }}
        >
          <div
            className="d-flex flex-row justify-content-center align-items-center w-100 gap-3 overflow-hidden"
            style={{ position: 'relative', height: '26px' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <Share2
                size={24}
                onClick={handleShare}
                style={{ cursor: 'pointer' }}
              />
            </div>
            {visible && (
              <Badge bg="secondary">
                Working on:{' '}
                {props.taskTag || currentTaskTag
                  ? `${props.taskTag || currentTaskTag}`
                  : 'Viewing image'}
              </Badge>
            )}
          </div>
          <Image
            stats={stats}
            visible={visible}
            location={location}
            taskTag={props.taskTag}
            zoom={zoom}
            id={id}
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}
            hideNavButtons={hideNavButtons}
          >
            {visible && memoizedChildren}
          </Image>
        </div>
        <div className="d-flex flex-column align-items-center gap-3">
          <SideLegend annotationSetId={annotationSetId} />
          {isAnnotatePath && (
            <Button
              variant="success"
              onClick={() => {
                navigate('/jobs');
              }}
              className="w-100"
            >
              Save & Exit
            </Button>
          )}
        </div>
      </div>
    </ImageContextFromHook>
  );
}
