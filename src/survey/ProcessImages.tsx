import { Form, Spinner, Button } from 'react-bootstrap';
import { Footer } from '../Modal';
import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { GlobalContext, UserContext } from '../Context';
import Select from 'react-select';

export default function ProcessImages({ projectId }: { projectId: string }) {
  const { client, backend, showModal } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [model, setModel] = useState<{ label: string; value: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [unprocessedImages, setUnprocessedImages] = useState<
    {
      id: string;
      originalPath: string;
    }[]
  >([]);
  const [imagesLoaded, setImagesLoaded] = useState<number | null>(null);
  const [locationsLoaded, setLocationsLoaded] = useState<number | null>(null);
  const [scanned, setScanned] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const scanImages = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    // Paginated fetch with cancellation
    let allImages: { id: string; originalPath: string }[] = [];
    let nextToken: string | null | undefined = undefined;
    let imgCount = 0;
    do {
      if (!isActiveRef.current) {
        setLoading(false);
        return;
      }
      const res = await client.models.Image.imagesByProjectId(
        { projectId },
        { selectionSet: ['id', 'originalPath'], nextToken, limit: 1000 }
      );
      const page: { id: string; originalPath: string }[] = res.data ?? [];
      allImages = allImages.concat(page);
      nextToken = res.nextToken as string | null | undefined;
      imgCount += page.length;
      setImagesLoaded(imgCount);
    } while (nextToken);

    let allLocations: { id: string; imageId: string; source: string }[] = [];
    nextToken = undefined;
    let locCount = 0;
    do {
      if (!isActiveRef.current) {
        setLoading(false);
        return;
      }
      const res = await client.models.Location.locationsByProjectIdAndSource(
        {
          projectId,
          source: { beginsWith: model.value },
        },
        {
          selectionSet: ['id', 'imageId', 'source'],
          nextToken,
          limit: 1000,
        }
      );
      const page: { id: string; imageId: string; source: string }[] =
        res.data ?? [];
      allLocations = allLocations.concat(page);
      nextToken = res.nextToken as string | null | undefined;
      locCount += page.length;
      setLocationsLoaded(locCount);
    } while (nextToken);

    if (!isActiveRef.current) {
      setLoading(false);
      return;
    }
    const unprocessed = allImages
      .filter(
        (img) =>
          !allLocations.some(
            (loc) => loc.imageId === img.id && loc.source.includes(model.value)
          )
      )
      .map((img) => ({ id: img.id, originalPath: img.originalPath }));
    setUnprocessedImages(unprocessed);
    setLoading(false);
    setScanned(true);
  }, [client, projectId, model]);

  useEffect(() => {
    // reset when model changes
    setScanned(false);
    setUnprocessedImages([]);
    setImagesLoaded(null);
    setLocationsLoaded(null);
  }, [model]);

  const processImages = async () => {
    if (!model) {
      return;
    }

    setDisabled(true);
    setLoading(true);

    const { data: locationSet } = await client.models.LocationSet.create({
      name: projectId + `_${model.value}`,
      projectId: projectId,
    });

    if (!locationSet) {
      console.error('Failed to create location set');
      alert('Something went wrong, please try again.');
      return;
    }

    // Fetch project to determine organization and legacy handling
    const { data: project } = await client.models.Project.get(
      { id: projectId },
      { selectionSet: ['id', 'organizationId', 'tags'] as const }
    );
    const projRecord = (project ?? {}) as Record<string, unknown>;
    const organizationId: string | undefined =
      typeof projRecord['organizationId'] === 'string'
        ? (projRecord['organizationId'] as string)
        : undefined;
    const tagsVal = projRecord['tags'];
    const isLegacyProject: boolean = Array.isArray(tagsVal)
      ? (tagsVal as unknown[]).some((t) => t === 'legacy')
      : false;

    const makeKey = (orig: string): string =>
      !isLegacyProject && organizationId
        ? `${organizationId}/${projectId}/${orig}`
        : orig;

    const BATCH_SIZE = 500;

    switch (model.value) {
      case 'scoutbotv3':
        for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
          const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${makeKey(image.originalPath)}`
          );

          client.mutations.runScoutbot({
            projectId: projectId,
            images: batchStrings,
            setId: locationSet.id,
            bucket: backend.storage.buckets[1].bucket_name,
            queueUrl: backend.custom.scoutbotTaskQueueUrl,
          });

          await client.models.Project.update({
            id: projectId,
            status: 'processing-scoutbot',
          });
        }
        break;
      case 'heatmap':
        for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
          const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map((image) =>
            makeKey(image.originalPath)
          );

          client.mutations.runHeatmapper({
            images: batchStrings,
          });
        }

        await client.models.Project.update({
          id: projectId,
          status: 'processing-heatmap-busy',
        });
        break;
      case 'mad':
        for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
          const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${makeKey(image.originalPath)}`
          );

          client.mutations.runMadDetector({
            projectId: projectId,
            images: batchStrings,
            setId: locationSet.id,
            bucket: backend.storage.buckets[1].bucket_name,
            queueUrl: backend.custom.madDetectorTaskQueueUrl,
          });

          await client.models.Project.update({
            id: projectId,
            status: 'processing-mad',
          });
        }
        break;
    }

    client.mutations.updateProjectMemberships({
      projectId: projectId,
    });

    setLoading(false);
    setDisabled(false);

    showModal(null);
  };

  return (
    <>
      <Form className='p-3'>
        <Form.Group>
          <Form.Label className='mb-0'>Model</Form.Label>
          <Select
            value={model}
            onChange={(m) => setModel(m)}
            options={[
              { label: 'ScoutBot', value: 'scoutbotv3' },
              { label: 'Elephant Detection Nadir', value: 'heatmap' },
              { label: 'MAD', value: 'mad' },
            ]}
            placeholder='Select a model'
            className='text-black'
          />
          <Button
            variant='primary'
            onClick={scanImages}
            disabled={!model || loading}
            className='mt-2'
          >
            Scan
          </Button>
          {loading ? (
            <div className='d-flex flex-column align-items-center'>
              <Spinner animation='border' role='status' />
              <p className='mb-0'>Determining images to process...</p>
              <p className='mb-1'>Found {imagesLoaded ?? 0} images</p>
              {locationsLoaded !== null && (
                <>
                  <p className='mb-0'>Searching for detections on images...</p>
                  <p className='mb-0'>Found {locationsLoaded} detections</p>
                </>
              )}
            </div>
          ) : scanned ? (
            unprocessedImages.length > 0 ? (
              <p className='mb-0 mt-2'>
                Found {unprocessedImages.length} unprocessed images
              </p>
            ) : (
              <p className='mb-0 mt-2'>All images have been processed</p>
            )
          ) : null}
        </Form.Group>
      </Form>
      <Footer>
        <Button variant='primary' onClick={processImages} disabled={disabled}>
          Process Images
        </Button>
        <Button
          variant='dark'
          onClick={() => showModal(null)}
          disabled={disabled}
        >
          Close
        </Button>
      </Footer>
    </>
  );
}
