import { Form, Spinner, Button } from 'react-bootstrap';
import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { GlobalContext, UserContext } from '../Context';
import Select from 'react-select';

export default function ProcessImages({
  projectId,
  onClose,
  setHandleSubmit,
  setSubmitDisabled,
}: {
  projectId: string;
  onClose: () => void;
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
  setSubmitDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { client, backend } = useContext(GlobalContext)!;
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
  const [imagesChecked, setImagesChecked] = useState<number | null>(null);
  const [scanned, setScanned] = useState(false);
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
    let allImages: any[] = [];
    let nextToken: string | null | undefined = undefined;
    let imgCount = 0;
    do {
      if (!isActiveRef.current) {
        setLoading(false);
        return;
      }
      const res: any = await client.models.Image.imagesByProjectId({
        projectId,
        selectionSet: ['id', 'originalPath'],
        nextToken,
      });
      allImages = allImages.concat(res.data);
      nextToken = res.nextToken;
      imgCount += res.data.length;
      setImagesLoaded(imgCount);
    } while (nextToken);

    let allLocations: any[] = [];
    nextToken = undefined;
    let locCount = 0;
    do {
      if (!isActiveRef.current) {
        setLoading(false);
        return;
      }
      const res: any = await client.models.Location.list({
        selectionSet: ['id', 'imageId', 'source'],
        filter: {
          projectId: { eq: projectId },
          source: { contains: model.value },
        },
        nextToken,
      });
      allLocations = allLocations.concat(res.data);
      nextToken = res.nextToken;
      locCount += res.data.length;
      setLocationsLoaded(locCount);
      setImagesChecked((imagesChecked) => (imagesChecked ?? 0) + 1);
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

  const processImages = useCallback(async () => {
    if (!model) {
      return;
    }

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

    const BATCH_SIZE = 500;

    switch (model.value) {
      case 'scoutbotv3':
        for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
          const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${image.originalPath}`
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
          const batchStrings = batch.map((image) => image.originalPath);

          client.mutations.runHeatmapper({
            images: batchStrings,
          });
        }

        await client.models.Project.update({
          id: projectId,
          status: 'processing-heatmap-busy',
        });
        break;
    }

    client.mutations.updateProjectMemberships({
      projectId: projectId,
    });

    onClose();

    setLoading(false);
  }, [model, projectId, unprocessedImages, client, backend, getSqsClient]);

  useEffect(() => {
    setHandleSubmit(() => processImages);
  }, [processImages, setHandleSubmit]);

  useEffect(() => {
    setSubmitDisabled(loading || !model || !unprocessedImages.length);
  }, [loading, model, unprocessedImages.length, setSubmitDisabled]);

  return (
    <Form>
      <Form.Group>
        <Form.Label className='mb-0'>Model</Form.Label>
        <Select
          value={model}
          onChange={(m) => setModel(m)}
          options={[
            { label: 'ScoutBot', value: 'scoutbotv3' },
            { label: 'Elephant Detection Nadir', value: 'heatmap' },
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
            {imagesChecked !== null && (
              <p className='mb-0'>
                Checked {imagesChecked} images for detections
              </p>
            )}
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
  );
}
