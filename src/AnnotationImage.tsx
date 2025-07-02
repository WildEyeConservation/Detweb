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
import { useNavigate, useParams } from 'react-router-dom';
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
    isTest,
  } = props;
  const { annotationSetId } = location;
  const { client } = useContext(GlobalContext)!;
  //testing
  const { currentTaskTag, isTesting, isAnnotatePath } =
    useContext(UserContext)!;
  const navigate = useNavigate();
  const { surveyId } = useParams();
  const subscriptionFilter = useMemo(() => {
    const conditions: any[] = [];
    if (!isTest) {
      // normal mode: only subscribe to this annotation set
      conditions.push({ setId: { eq: annotationSetId } });
    }
    // always subscribe to changes for this image
    conditions.push({ imageId: { eq: location.image.id } });
    return { filter: { and: conditions } };
  }, [annotationSetId, location.image.id, isTest]);
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
    const source = props.taskTag ? `manual-${props.taskTag}` : 'manual';
    return [
      <CreateAnnotationOnClick
        key='caok'
        allowOutside={allowOutside}
        location={location}
        source={source}
        isTest={isTest}
      />,
      <ShowMarkers
        key='showMarkers'
        annotationSetId={isTest ? '123' : annotationSetId}
        realAnnotationSetId={annotationSetId}
      />,
      <Location key='location' {...location} />,
      <MapLegend
        key='legend'
        position='bottomright'
        annotationSetId={annotationSetId}
      />,
    ].concat(
      categories
        ?.filter((c) => c.annotationSetId == annotationSetId)
        ?.map((category) => (
          <CreateAnnotationOnHotKey
            key={category.id}
            hotkey={category.shortcutKey}
            setId={annotationSetId}
            category={category}
            imageId={location.image.id}
            source={source}
            isTest={isTest}
          />
        ))
    );
  }, [props.taskTag, location.image.id, annotationSetId, isTesting]);

  async function handleShare() {
    const windowUrl = new URL(window.location.href);
    let url = `${windowUrl.origin}/surveys/${surveyId}`;

    if (location.id && location.annotationSetId) {
      url = `${url}/location/${location.id}/${location.annotationSetId}`;
    } else if (location.image.id && location.annotationSetId) {
      url = `${url}/image/${location.image.id}/${location.annotationSetId}`;
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
      <div className='d-flex flex-md-row flex-column justify-content-center w-100 h-100 gap-3 overflow-auto'>
        <div
          className={`d-flex flex-column align-items-center w-100 h-100 gap-3`}
          style={{
            maxWidth: '1024px',
          }}
        >
          <div
            className='d-flex flex-row justify-content-center align-items-center w-100 gap-3 overflow-hidden'
            style={{ position: 'relative', height: '26px' }}
          >
            {!isTest && (
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
            )}

            {visible && (
              <Badge bg='secondary'>
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
            isTest={isTest}
          >
            {visible && memoizedChildren}
          </Image>
        </div>
        <div className='d-flex flex-column align-items-center gap-3'>
          <SideLegend annotationSetId={annotationSetId} />
          {isAnnotatePath && (
            <Button
              variant='success'
              onClick={() => {
                navigate('/jobs');
              }}
              className='w-100'
            >
              Save & Exit
            </Button>
          )}
        </div>
      </div>
    </ImageContextFromHook>
  );
}
