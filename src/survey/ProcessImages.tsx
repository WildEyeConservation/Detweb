import { Form, Spinner, Button, Card, Modal } from 'react-bootstrap';
import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalContext } from '../Context';
import Select from 'react-select';

export default function ProcessImages({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const { client, backend } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const [model, setModel] = useState<{ label: string; value: string } | null>(
    null
  );
  const [scanning, setScanning] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<number | null>(null);
  const [pendingImages, setPendingImages] = useState<
    { id: string; originalPath: string }[] | null
  >(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNothingToDo, setShowNothingToDo] = useState(false);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const findLocationSetByName = useCallback(
    async (name: string) => {
      let nextToken: string | null | undefined = undefined;
      do {
        const res = await client.models.LocationSet.locationSetsByProjectId(
          {
            projectId,
            nextToken,
          } as {
            projectId: string;
            nextToken?: string | null;
          },
          {
            selectionSet: ['id', 'name'],
            limit: 10000,
          }
        );
        const match =
          res.data?.find((ls: { name?: string | null }) => ls?.name === name) ??
          null;
        if (match) {
          return match;
        }
        nextToken = res.nextToken as string | null | undefined;
      } while (nextToken);
      return null;
    },
    [client.models.LocationSet, projectId]
  );

  const scanImages = useCallback(async (): Promise<
    { id: string; originalPath: string }[] | null
  > => {
    if (!model) return null;
    setScanning(true);
    setImagesLoaded(0);
    let unprocessed: { id: string; originalPath: string }[] = [];
    let nextToken: string | null | undefined = undefined;
    let imgCount = 0;
    do {
      if (!isActiveRef.current) {
        setScanning(false);
        return null;
      }
      const res = await client.models.Image.imagesByProjectId(
        { projectId },
        { selectionSet: ['id', 'originalPath', 'processedBy.source'], nextToken, limit: 10000 }
      );
      const page = (res.data ?? []).flatMap((img) =>
        img?.id && img?.originalPath && !img.processedBy?.some((p: { source: string }) => p.source === model.value)
          ? [{ id: img.id, originalPath: img.originalPath }]
          : []
      );
      unprocessed = unprocessed.concat(page);
      nextToken = res.nextToken as string | null | undefined;
      imgCount += (res.data ?? []).length;
      setImagesLoaded(imgCount);
    } while (nextToken);

    setScanning(false);
    if (!isActiveRef.current) return null;
    return unprocessed;
  }, [client, projectId, model]);

  const handleProcessClick = async () => {
    if (!model) return;
    const result = await scanImages();
    if (!result) return;
    if (result.length === 0) {
      setShowNothingToDo(true);
      return;
    }
    setPendingImages(result);
    setShowConfirm(true);
  };

  const dispatchProcessing = async () => {
    if (!model || !pendingImages) return;

    setShowConfirm(false);
    setDispatching(true);

    const locationSetName =
      model.value === 'heatmap'
        ? `${projectId}_elephant-detection-nadir`
        : `${projectId}_scoutbot`;
    let locationSet =
      (await findLocationSetByName(locationSetName)) ??
      null;
    if (!locationSet) {
      const { data: createdLocationSet } =
        await client.models.LocationSet.create({
          name: locationSetName,
          projectId: projectId,
          group: organizationId,
        });
      locationSet = createdLocationSet ?? null;
    }

    if (!locationSet?.id) {
      console.error('Failed to create location set');
      alert('Something went wrong, please try again.');
      setDispatching(false);
      return;
    }

    const { data: project } = await client.models.Project.get(
      { id: projectId },
      { selectionSet: ['id', 'organizationId', 'tags'] as const }
    );
    const projRecord = (project ?? {}) as Record<string, unknown>;
    const projOrganizationId: string | undefined =
      typeof projRecord['organizationId'] === 'string'
        ? (projRecord['organizationId'] as string)
        : undefined;
    const tagsVal = projRecord['tags'];
    const isLegacyProject: boolean = Array.isArray(tagsVal)
      ? (tagsVal as unknown[]).some((t) => t === 'legacy')
      : false;

    const makeKey = (orig: string): string =>
      !isLegacyProject && projOrganizationId
        ? `${projOrganizationId}/${projectId}/${orig}`
        : orig;

    const BATCH_SIZE = 500;

    switch (model.value) {
      case 'scoutbotv3':
        for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
          const batch = pendingImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${makeKey(image.originalPath)}`
          );

          client.mutations.runScoutbot({
            projectId: projectId,
            images: batchStrings,
            setId: locationSet.id,
            bucket: backend.storage.buckets[1].bucket_name,
            queueUrl: backend.custom.scoutbotTaskQueueUrl,
          }, { retry: false });

          await client.models.Project.update({
            id: projectId,
            status: 'processing-scoutbot',
          });
        }
        break;
      case 'heatmap':
        for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
          const batch = pendingImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map((image) =>
            makeKey(image.originalPath)
          );

          client.mutations.runHeatmapper({
            projectId,
            images: batchStrings,
          }, { retry: false });
        }

        await client.models.Project.update({
          id: projectId,
          status: 'processing-heatmap-busy',
        });
        break;
      case 'mad':
        for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
          const batch = pendingImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${makeKey(image.originalPath)}`
          );

          client.mutations.runMadDetector({
            projectId: projectId,
            images: batchStrings,
            setId: locationSet.id,
            bucket: backend.storage.buckets[1].bucket_name,
            queueUrl: backend.custom.madDetectorTaskQueueUrl,
          }, { retry: false });

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

    setDispatching(false);
    navigate('/surveys');
  };

  const busy = scanning || dispatching;

  return (
    <div className='d-flex flex-column gap-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Model</h5>
        </Card.Header>
        <Card.Body>
          <Form.Label>Select a model</Form.Label>
          <Select
            value={model}
            onChange={(m) => setModel(m)}
            options={[
              { label: 'ScoutBot', value: 'scoutbotv3' },
              { label: 'Elephant Detection Nadir', value: 'heatmap' },
              { label: 'MAD', value: 'mad' },
            ]}
            placeholder='Select a model'
            isDisabled={busy}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition='fixed'
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
          />
          {scanning && (
            <div className='d-flex flex-column align-items-center mt-3'>
              <Spinner animation='border' role='status' />
              <p className='mb-0 mt-2'>Determining images to process...</p>
              <p className='mb-0'>Found {imagesLoaded ?? 0} images</p>
            </div>
          )}
          {dispatching && (
            <div className='d-flex flex-column align-items-center mt-3'>
              <Spinner animation='border' role='status' />
              <p className='mb-0 mt-2'>Submitting processing jobs...</p>
            </div>
          )}
        </Card.Body>
      </Card>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant='primary'
          onClick={handleProcessClick}
          disabled={!model || busy}
        >
          Process Images
        </Button>
      </div>

      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm processing</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingImages?.length ?? 0} image
          {(pendingImages?.length ?? 0) === 1 ? '' : 's'} will be processed with{' '}
          <strong>{model?.label}</strong>. Continue?
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant='primary' onClick={dispatchProcessing}>
            Process Images
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showNothingToDo}
        onHide={() => setShowNothingToDo(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Nothing to process</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          All images have already been processed with{' '}
          <strong>{model?.label}</strong>.
        </Modal.Body>
        <Modal.Footer>
          <Button variant='primary' onClick={() => setShowNothingToDo(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
