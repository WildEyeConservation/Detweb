import { useMemo, useContext, useEffect, useState } from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { MapLegend, SideLegend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import {
  GlobalContext,
  ProjectContext,
  UserContext,
  ImageContext,
} from './Context';
import { ShowMarkers } from './ShowMarkers';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { ImageContextFromHook } from './ImageContext';
import CreateAnnotationOnHotKey from './CreateAnnotationOnHotKey';
import { Schema } from './amplify/client-schema';
import useImageStats from './useImageStats';
import { Badge, Button } from 'react-bootstrap';
import { Share2, SearchCheck, RotateCcw, LogOut } from 'lucide-react';
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
    testPresetId,
    isTest,
    config,
    hideZoomSetting = false,
    queueId,
  } = props;

  const { annotationSetId } = location;
  const { client } = useContext(GlobalContext)!;
  //testing
  const { currentTaskTag, isAnnotatePath, myMembershipHook } =
    useContext(UserContext)!;
  const navigate = useNavigate();
  const { surveyId } = useParams();
  // Read localStorage synchronously during initialization to avoid loading tiles at wrong zoom
  const [defaultZoom, setDefaultZoom] = useState<number | null>(() => {
    if (surveyId) {
      const storedZoom = localStorage.getItem(`defaultZoom-${surveyId}`);
      if (storedZoom) {
        return Number(storedZoom);
      }
    }
    return zoom;
  });
  const [isFalseNegativesJob, setIsFalseNegativesJob] =
    useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    async function checkQueue() {
      try {
        const membership = myMembershipHook.data?.find(
          (m: any) => m.projectId === (surveyId as string)
        );
        const queueId = membership?.queueId;
        if (!queueId) {
          if (!cancelled) setIsFalseNegativesJob(false);
          return;
        }
        const { data: q } = await client.models.Queue.get({ id: queueId });
        if (!cancelled)
          setIsFalseNegativesJob((q?.name ?? '') === 'False Negatives');
      } catch {
        if (!cancelled) setIsFalseNegativesJob(false);
      }
    }
    checkQueue();
    return () => {
      cancelled = true;
    };
  }, [client.models.Queue, myMembershipHook.data, surveyId]);

  const testSetId = useMemo(
    () => (isTest ? crypto.randomUUID() : annotationSetId),
    [isTest, annotationSetId]
  );
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
    categoriesHook: { data: projectCategories },
  } = useContext(ProjectContext)!;
  const [externalCategories, setExternalCategories] = useState<any[] | null>(
    null
  );
  const [legendCategories, setLegendCategories] = useState<any[] | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState<boolean>(() => {
    if (surveyId) {
      const stored = localStorage.getItem(`legendCollapsed-${surveyId}`);
      return stored === 'true';
    }
    return false;
  });

  const toggleLegendCollapsed = () => {
    setLegendCollapsed((prev) => {
      const newValue = !prev;
      if (surveyId) {
        localStorage.setItem(`legendCollapsed-${surveyId}`, String(newValue));
      }
      return newValue;
    });
  };

  // If the annotation set on the test belongs to a different project than the current one,
  // fetch its categories directly by annotation set id so legend, hotkeys and icons work.
  useEffect(() => {
    let cancelled = false;
    async function ensureCategories() {
      try {
        // Fetch the annotation set to discover its project id
        const { data: annSet } = await client.models.AnnotationSet.get({
          id: annotationSetId,
        });
        if (!annSet) {
          setExternalCategories(null);
          setLegendCategories(projectCategories ?? null);
          return;
        }
        // If the set's project matches the current survey, use project categories; else, fetch by set id
        if (annSet.projectId === (surveyId as string)) {
          if (!cancelled) {
            setExternalCategories(null);
            setLegendCategories(projectCategories ?? null);
          }
        } else {
          const { data: cats } =
            await client.models.Category.categoriesByAnnotationSetId({
              annotationSetId,
            });
          if (!cancelled) {
            setExternalCategories(cats ?? []);
            setLegendCategories(cats ?? []);
          }
        }
      } catch (e) {
        console.error(
          'Failed to ensure categories for annotation set',
          annotationSetId,
          e
        );
        if (!cancelled) {
          setExternalCategories(null);
          setLegendCategories(projectCategories ?? null);
        }
      }
    }
    ensureCategories();
    return () => {
      cancelled = true;
    };
  }, [client, annotationSetId, surveyId, projectCategories]);
  const annotationsHook = useOptimisticUpdates<
    Schema['Annotation']['type'],
    'Annotation'
  >(
    'Annotation',
    async (nextToken) =>
      client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: location.image.id, setId: { eq: location.annotationSetId } },
        { limit: 1000, nextToken }
      ) as any,
    subscriptionFilter
  );
  const stats = useImageStats(annotationsHook);

  // Compute source tag for annotations and observations
  const source = useMemo(() => {
    const baseSource = props.taskTag ? `manual-${props.taskTag}` : 'manual';
    return isFalseNegativesJob
      ? `${baseSource}-false-negative`
      : baseSource;
  }, [props.taskTag, isFalseNegativesJob]);

  const memoizedChildren = useMemo(() => {
    return [
      <CreateAnnotationOnClick
        key='caok'
        allowOutside={allowOutside}
        location={location}
        source={source}
        setId={testSetId}
      />,
      <ShowMarkers
        key='showMarkers'
        annotationSetId={testSetId}
        realAnnotationSetId={annotationSetId}
        categoriesOverride={legendCategories ?? undefined}
      />,
      <Location key='location' {...location} />,
      <MapLegend
        key='legend'
        position='bottomright'
        annotationSetId={annotationSetId}
        categoriesOverride={legendCategories ?? undefined}
        forceVisible={legendCollapsed}
      />,
    ].concat(
      (legendCategories ?? projectCategories)
        ?.filter((c) => c.annotationSetId == annotationSetId)
        ?.map((category) => (
          <CreateAnnotationOnHotKey
            key={category.id}
            hotkey={category.shortcutKey}
            setId={testSetId}
            category={category}
            imageId={location.image.id}
            source={source}
            isTest={isTest}
          />
        ))
    );
  }, [
    source,
    location.image.id,
    annotationSetId,
    legendCategories,
    projectCategories,
    legendCollapsed,
    allowOutside,
    location,
    testSetId,
    isTest,
  ]);

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

    if (navigator.share) {
      try {
        await navigator.share({ url: url });
      } catch (error) {
        console.error(error);
      }
    } else {
      //write to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      } catch (error) {
        console.error(error);
      }
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
      <div className={`d-flex flex-md-row flex-column w-100 h-100 gap-3 overflow-auto ${legendCollapsed ? 'legend-collapsed' : 'justify-content-center'}`}>
        <div
          className={`d-flex flex-column ${legendCollapsed ? 'align-items-stretch' : 'align-items-center'} w-100 h-100 gap-3`}
          style={{
            maxWidth: legendCollapsed ? 'none' : '1024px',
            flex: legendCollapsed ? 1 : undefined,
          }}
        >
          <div
            className='d-flex flex-row justify-content-center align-items-center w-100 gap-3 overflow-hidden'
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
                onClick={!isTest ? handleShare : undefined}
                style={{ cursor: 'pointer' }}
              />
            </div>
            {visible && (
              <>
                <Badge bg='secondary'>
                  Working on:{' '}
                  {props.taskTag || currentTaskTag
                    ? `${props.taskTag || currentTaskTag}`
                    : 'Viewing image'}
                </Badge>
                {!hideZoomSetting && (
                  <SetDefaultZoom
                    setDefaultZoom={setDefaultZoom}
                    originalZoom={zoom}
                    adminMemberships={myMembershipHook.data
                      ?.filter((membership) => membership.isAdmin)
                      .map((membership) => ({
                        projectId: membership.projectId,
                        queueId: membership.queueId!,
                      }))}
                  />
                )}
              </>
            )}
          </div>
          <Image
            stats={stats}
            visible={visible}
            location={location}
            image={location.image}
            taskTag={props.taskTag}
            zoom={defaultZoom}
            viewBoundsScale={props.viewBoundsScale}
            id={id}
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}
            hideNavButtons={hideNavButtons}
            testPresetId={testPresetId}
            isTest={isTest}
            testSetId={testSetId}
            config={config}
            queueId={queueId}
            observationSource={source}
          >
            {visible && memoizedChildren}
          </Image>
        </div>
        <div className='d-flex flex-column align-items-center gap-3'>
          <SideLegend
            annotationSetId={annotationSetId}
            categoriesOverride={legendCategories ?? undefined}
            collapsed={legendCollapsed}
            onToggleCollapse={toggleLegendCollapsed}
          />
          {isAnnotatePath && (
            legendCollapsed ? (
              <Button
                variant='success'
                onClick={() => navigate('/jobs')}
                className='d-none d-md-flex align-items-center justify-content-center'
                style={{ width: '40px', height: '40px', padding: 0 }}
                title='Save & Exit'
              >
                <LogOut size={20} />
              </Button>
            ) : (
              <div className='d-none d-md-block w-100 ps-2'>
                <Button
                  variant='success'
                  onClick={() => navigate('/jobs')}
                  className='d-none d-md-block w-100'
                >
                  Save & Exit
                </Button>
              </div>
            )
          )}
          {/* Mobile Save & Exit button (always shown on mobile) */}
          {isAnnotatePath && (
            <Button
              variant='success'
              onClick={() => navigate('/jobs')}
              className='w-100 d-md-none'
            >
              Save & Exit
            </Button>
          )}
        </div>
      </div>
    </ImageContextFromHook>
  );
}

function SetDefaultZoom({
  setDefaultZoom,
  originalZoom,
  adminMemberships,
}: {
  setDefaultZoom: (zoom: number | null) => void;
  originalZoom: number | null;
  adminMemberships: { projectId: string; queueId: string }[];
}) {
  const { zoom, setZoom } = useContext(ImageContext)!;
  const { surveyId } = useParams();
  const { client } = useContext(GlobalContext)!;
  // Initialize storedZoom flag synchronously to match parent's initialization
  const [storedZoom, setStoredZoom] = useState<boolean>(() => {
    if (surveyId) {
      return localStorage.getItem(`defaultZoom-${surveyId}`) !== null;
    }
    return false;
  });

  // Note: localStorage zoom is now read synchronously in parent component,
  // so this effect is mainly for keeping storedZoom flag in sync if localStorage changes externally
  useEffect(() => {
    const storedZoomValue = localStorage.getItem(`defaultZoom-${surveyId!}`);
    const hasStoredZoom = storedZoomValue !== null;
    if (hasStoredZoom !== storedZoom) {
      setStoredZoom(hasStoredZoom);
    }
  }, [surveyId, storedZoom]);

  const saveDefaultZoom = async () => {
    if (!storedZoom) {
      const currentProjectMembership = adminMemberships.find(
        (membership) => membership.projectId === surveyId!
      );

      if (currentProjectMembership) {
        const result = window.prompt(
          'Set as default zoom for all users on this job? (y/n)'
        );

        if (result === null) {
          return;
        }

        if (result?.toLowerCase() === 'y') {
          await client.models.Queue.update({
            id: currentProjectMembership.queueId,
            zoom: zoom,
          });
          alert(
            'Please save this job and pick it up again for the default zoom to take effect.'
          );
          return;
        }
      }
    }

    if (storedZoom) {
      localStorage.removeItem(`defaultZoom-${surveyId!}`);
      setStoredZoom(false);
      setDefaultZoom(originalZoom);
      setZoom(originalZoom || 1);
    } else {
      localStorage.setItem(`defaultZoom-${surveyId!}`, zoom.toString());
      setStoredZoom(true);
      setDefaultZoom(zoom);
      setZoom(zoom);
    }
  };

  return (
    <button
      className='p-0 m-0 border-0 bg-transparent d-flex align-items-center text-white'
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
      }}
      onClick={saveDefaultZoom}
    >
      {storedZoom ? <RotateCcw size={24} /> : <SearchCheck size={24} />}
      <span className='ms-2 mb-0 d-none d-md-block'>
        {storedZoom ? 'Reset zoom' : 'Set as default zoom'}
      </span>
    </button>
  );
}
