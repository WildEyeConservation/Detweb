import { Button, Form, Modal } from 'react-bootstrap';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import { useState } from 'react';
import { ManagementContext } from './Context';
import { useContext, useEffect } from 'react';

export default function EditQueueModal({
  show,
  onClose,
  queueId,
}: {
  show: boolean;
  onClose: () => void;
  queueId: string;
}) {
  const [limitedBatchSize, setLimitedBatchSize] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [hidden, setHidden] = useState<boolean>(false);
  const {
    queuesHook: { data: queues, update: updateQueue },
  } = useContext(ManagementContext)!;

  useEffect(() => {
    const queue = queues?.find((q) => q.id === queueId);
    if (queue) {
      setLimitedBatchSize(queue.batchSize !== 0 && queue.batchSize !== null);
      setBatchSize(queue.batchSize || 100);
      setZoom(queue.zoom || undefined);
      setHidden(queue.hidden);
    }
  }, [show, queues]);

  function handleSave() {
    updateQueue({
      id: queueId,
      batchSize: limitedBatchSize ? batchSize : 0,
      zoom: zoom,
      hidden: hidden,
    });
    onClose();
  }

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Job</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Batch size</Form.Label>
            <LabeledToggleSwitch
              leftLabel="Infinite"
              rightLabel="Limited"
              checked={limitedBatchSize}
              onChange={(checked) => {
                setLimitedBatchSize(checked);
              }}
            />
            {limitedBatchSize && (
              <Form.Control
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
              />
            )}
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Switch
              label="Hidden"
              checked={hidden}
              onChange={() => {
                setHidden((h) => !h);
              }}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Zoom level</Form.Label>
            <Form.Select
              value={zoom}
              onChange={(e) => {
                setZoom(
                  e.target.value == 'auto' ? undefined : Number(e.target.value)
                );
                console.log(zoom);
              }}
            >
              <option value="auto">Auto</option>
              {[...Array(13)].map((_, i) => (
                <option key={i} value={i}>
                  Level {i}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
