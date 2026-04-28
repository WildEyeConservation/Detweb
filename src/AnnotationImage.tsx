import { useMemo, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { AnnotateChromeContext } from './ss/AnnotateChrome';
import { useLegendCollapse } from './LegendCollapseContext';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Image = withCreateObservation(withAckOnTimeout(BaseImage as any) as any);

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
  const { centerEl, rightEl } = useContext(AnnotateChromeContext);
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
  const [, setExternalCategories] = useState<any[] | null>(null);
  const [legendCategories, setLegendCategories] = useState<any[] | null>(null);

  // Prefer shared collapse state from LegendCollapseProvider (so all
  // AnnotationImage instances in the preloader buffer stay in sync).
  // Fall back to local state when no provider is mounted (e.g., when
  // AnnotationImage is rendered standalone via LocationLoader).
  const sharedLegend = useLegendCollapse();
  const [localLegendCollapsed, setLocalLegendCollapsed] = useState<boolean>(
    () => {
      if (surveyId) {
        const stored = localStorage.getItem(`legendCollapsed-${surveyId}`);
        return stored === 'true';
      }
      return false;
    }
  );
  const legendCollapsed = sharedLegend
    ? sharedLegend.collapsed
    : localLegendCollapsed;
  const toggleLegendCollapsed = sharedLegend
    ? sharedLegend.toggle
    : () => {
        setLocalLegendCollapsed((prev) => {
          const newValue = !prev;
          if (surveyId) {
            localStorage.setItem(
              `legendCollapsed-${surveyId}`,
              String(newValue)
            );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotationsHook = (useOptimisticUpdates as any)(
    'Annotation',
    async (nextToken: string | null | undefined) =>
      client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: location.image.id, setId: { eq: location.annotationSetId } },
        { limit: 10000, nextToken }
      ) as any,
    subscriptionFilter
  ) as ReturnType<typeof useOptimisticUpdates<Schema['Annotation']['type'], never>>;
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
        hideFnAnnotations={!isFalseNegativesJob}
        locationBounds={
          !allowOutside && location?.width && location?.height
            ? { x: location.x, y: location.y, width: location.width, height: location.height }
            : undefined
        }
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
            location={location}
            allowOutside={allowOutside}
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
    isFalseNegativesJob,
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

  const workingOnLabel =
    props.taskTag || currentTaskTag
      ? `${props.taskTag || currentTaskTag}`
      : 'Viewing image';

  const chromeCenter =
    visible && centerEl
      ? createPortal(
          <Badge bg='secondary'>Working on: {workingOnLabel}</Badge>,
          centerEl
        )
      : null;

  const chromeRight =
    visible && rightEl
      ? createPortal(
          <>
            <button
              onClick={!isTest ? handleShare : undefined}
              title='Share link to this location'
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.85)',
                padding: 6,
                cursor: !isTest ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
              }}
            >
              <Share2 size={18} />
            </button>
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
            {isAnnotatePath && (
              <Button
                onClick={() => navigate('/jobs')}
                className='d-flex align-items-center gap-2'
                style={{
                  background: 'transparent',
                  borderColor: 'rgba(255,255,255,0.4)',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: 13,
                  padding: '5px 12px',
                  borderRadius: 6,
                }}
              >
                <LogOut size={14} />
                <span className='d-none d-sm-inline'>Save &amp; Exit</span>
              </Button>
            )}
          </>,
          rightEl
        )
      : null;

  return (
    <ImageContextFromHook
      hook={annotationsHook}
      locationId={location.id}
      image={location.image}
      taskTag={props.taskTag}
    >
      {chromeCenter}
      {chromeRight}
      <div className={`d-flex flex-md-row flex-column w-100 h-100 gap-3 overflow-auto ${legendCollapsed ? 'legend-collapsed' : 'justify-content-center'}`}>
        <div
          className={`d-flex flex-column ${legendCollapsed ? 'align-items-stretch' : 'align-items-center'} w-100 h-100`}
          style={{
            maxWidth: legendCollapsed ? 'none' : '1024px',
            flex: legendCollapsed ? 1 : undefined,
          }}
        >
          <div
            className='w-100 h-100'
            style={{
              background: 'var(--ss-surface)',
              border: '1.5px solid var(--ss-border)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(28, 28, 26, 0.03)',
              minHeight: 0,
            }}
          >
            <Image
              stats={stats}
              visible={visible}
              location={location}
              image={location.image}
              taskTag={props.taskTag}
              zoom={defaultZoom ?? undefined}
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
        </div>
        <div className='d-flex flex-column align-items-center'>
          <SideLegend
            annotationSetId={annotationSetId}
            categoriesOverride={legendCategories ?? undefined}
            collapsed={legendCollapsed}
            onToggleCollapse={toggleLegendCollapsed}
          />
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
      onClick={saveDefaultZoom}
      title={storedZoom ? 'Reset zoom' : 'Set as default zoom'}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.85)',
        padding: '6px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 6,
        fontSize: 13,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
      }}
    >
      {storedZoom ? <RotateCcw size={18} /> : <SearchCheck size={18} />}
      <span className='d-none d-lg-inline'>
        {storedZoom ? 'Reset zoom' : 'Set as default zoom'}
      </span>
    </button>
  );
}
