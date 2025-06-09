import { Form, Spinner } from 'react-bootstrap';
import { useState, useContext, useEffect, useCallback } from 'react';
import { GlobalContext, UserContext } from '../Context';
import Select from 'react-select';
import { fetchAllPaginatedResults } from '../utils';

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

  useEffect(() => {
    async function scanImages() {
      setLoading(true);

      const images = await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'originalPath'],
        },
        setImagesLoaded
      );

      const locations = await fetchAllPaginatedResults(
        client.models.Location.list,
        {
          selectionSet: ['id', 'imageId', 'source'],
          filter: {
            projectId: {
              eq: projectId,
            },
          },
        },
        setLocationsLoaded
      );

      // Get all images that don't have a location with source "scoutbot"
      const unprocessedImages = images.filter((image) => {
        return !locations.some(
          (location) =>
            location.imageId === image.id &&
            location.source.includes('scoutbot')
        );
      });

      setUnprocessedImages(unprocessedImages);
      setLoading(false);
    }
    scanImages();
  }, [projectId]);

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

    await client.models.Project.update({
      id: projectId,
      status: 'processing',
    });

    client.mutations.updateProjectMemberships({
      projectId: projectId,
    });

    onClose();

    switch (model.value) {
      case 'scoutbot':
        const BATCH_SIZE = 500;
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
        }
        break;
    }

    setLoading(false);
  }, [
    model,
    projectId,
    unprocessedImages,
    client,
    backend,
    getSqsClient,
  ]);

  useEffect(() => {
    setHandleSubmit(() => processImages);
  }, [processImages, setHandleSubmit]);

  useEffect(() => {
    setSubmitDisabled(loading || !model || !unprocessedImages.length);
  }, [loading, model, unprocessedImages.length, setSubmitDisabled]);

  return (
    <Form>
      <Form.Group>
        {loading ? (
          <div className="d-flex flex-column align-items-center">
            <Spinner animation="border" role="status" />
            <p className="mb-0">Determining images to process...</p>
            <p className="mb-1">Found {imagesLoaded ?? 0} images</p>
            {locationsLoaded !== null && (
              <>
                <p className="mb-0">Searching for detections on images...</p>
                <p className="mb-0">Found {locationsLoaded} detections</p>
              </>
            )}
          </div>
        ) : unprocessedImages.length > 0 ? (
          <>
            <Form.Label className="mb-0">Model</Form.Label>
            <Select
              value={model}
              onChange={(m) => setModel(m)}
              options={[{ label: 'ScoutBot', value: 'scoutbot' }]}
              placeholder="Select a model"
              className="text-black"
            />
          </>
        ) : (
          <p className="mb-0 mt-2">All images have been processed</p>
        )}
      </Form.Group>
    </Form>
  );
}
