import { Form, Button } from 'react-bootstrap';
import { useState, useMemo } from 'react';

export default function CameraOverlap({
  cameraSelection,
  interval,
  setInterval,
  overlaps,
  setOverlaps,
}: {
  cameraSelection: [string, string[]];
  interval: number;
  setInterval: (interval: number) => void;
  overlaps: { cameraA: string; cameraB: string }[];
  setOverlaps: (overlaps: { cameraA: string; cameraB: string }[]) => void;
}) {
  const [multipleCameras, setMultipleCameras] = useState(false);
  const cameraList = useMemo(() => cameraSelection[1], [cameraSelection]);

  return (
    <div>
      <Form.Group className='mt-2'>
        <Form.Switch
          label='Multiple Cameras'
          checked={multipleCameras}
          onChange={(e) => setMultipleCameras(e.target.checked)}
        />
      </Form.Group>
      {multipleCameras && (
        <Form.Group className='mt-2'>
          <Form.Label className='mb-0'>
            Define Overlap Between Cameras
          </Form.Label>
          <span
            className='text-muted d-block mb-2'
            style={{ fontSize: '12px' }}
          >
            Leave blank if cameras are not overlapping.
          </span>
          {overlaps.map((pair, idx) => {
            const usedPairs = overlaps
              .filter(
                (_, j) =>
                  j !== idx && overlaps[j].cameraA && overlaps[j].cameraB
              )
              .map(({ cameraA, cameraB }) =>
                [cameraA, cameraB].sort().join('-')
              );
            const bOptions = cameraList.filter(
              (cam) =>
                cam !== pair.cameraA &&
                !usedPairs.includes([pair.cameraA, cam].sort().join('-'))
            );
            return (
              <div className='d-flex align-items-center mb-2' key={idx}>
                <Form.Select
                  aria-label={`Camera A for overlap ${idx + 1}`}
                  value={pair.cameraA}
                  onChange={(e) => {
                    const newA = e.target.value;
                    setOverlaps((ov) => {
                      const newOv = [...ov];
                      newOv[idx] = { cameraA: newA, cameraB: '' };
                      return newOv;
                    });
                  }}
                  className='me-2'
                >
                  <option value=''>Select camera</option>
                  {cameraList.map((cam) => (
                    <option key={cam} value={cam}>
                      {cam}
                    </option>
                  ))}
                </Form.Select>
                <Form.Select
                  aria-label={`Camera B for overlap ${idx + 1}`}
                  value={pair.cameraB}
                  onChange={(e) => {
                    const newB = e.target.value;
                    setOverlaps((ov) => {
                      const newOv = [...ov];
                      newOv[idx] = { ...newOv[idx], cameraB: newB };
                      return newOv;
                    });
                  }}
                >
                  <option value=''>Select camera</option>
                  {bOptions.map((cam) => (
                    <option key={cam} value={cam}>
                      {cam}
                    </option>
                  ))}
                </Form.Select>
                <Button
                  variant='danger'
                  onClick={() =>
                    setOverlaps((ov) => ov.filter((_, j) => j !== idx))
                  }
                  className='ms-2'
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <Button
            variant='info'
            size='sm'
            disabled={
              overlaps.length > 0 &&
              (!overlaps[overlaps.length - 1].cameraA ||
                !overlaps[overlaps.length - 1].cameraB)
            }
            onClick={() =>
              setOverlaps((ov) => [...ov, { cameraA: '', cameraB: '' }])
            }
          >
            Add Overlap
          </Button>
        </Form.Group>
      )}
      {multipleCameras && overlaps.length > 0 && (
        <Form.Group className='mt-2'>
          <Form.Label className='mb-0'>Overlap Window</Form.Label>
          <span
            className='text-muted d-block mb-2'
            style={{ fontSize: '12px' }}
          >
            Define the time taken from the first image a location was captured
            to the last image it was captured in seconds. (Leave blank if the
            cameras capture the same location within a second of each other.)
          </span>
          <Form.Control
            type='number'
            placeholder='Enter overlap window in seconds'
            value={interval}
            onChange={(e) => {
              setInterval(Number(e.target.value));
            }}
          />
        </Form.Group>
      )}
    </div>
  );
}
