import { Form, Alert } from 'react-bootstrap';
import { useState, useEffect, useContext, useCallback } from 'react';
import { GlobalContext } from '../Context';
import { Schema } from '../../amplify/data/resource';

interface CameraFormData {
  focalLengthMm?: number;
  sensorWidthMm?: number;
  tiltDegrees?: number;
}

interface CameraFormDataMap {
  [cameraId: string]: CameraFormData;
}

export default function EditCameras({
  projectId,
  setHandleSubmit,
  setSubmitDisabled,
  setCloseDisabled,
}: {
  projectId: string;
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
  setSubmitDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  setCloseDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { client } = useContext(GlobalContext);
  const [cameras, setCameras] = useState<Schema['Camera']['type'][]>([]);
  const [cameraFormDataMap, setCameraFormDataMap] = useState<CameraFormDataMap>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getCameras() {
      const { data: cameras } = await client.models.Camera.camerasByProjectId({
        projectId,
      });
      setCameras(cameras);

      // Populate form with camera data
      const formDataMap: CameraFormDataMap = {};

      if (cameras.length > 0) {
        // Populate form with all existing cameras' data
        cameras.forEach((camera) => {
          formDataMap[camera.id] = {
            focalLengthMm: camera.focalLengthMm ?? undefined,
            sensorWidthMm: camera.sensorWidthMm ?? undefined,
            tiltDegrees: camera.tiltDegrees ?? undefined,
          };
        });
      } else {
        // Initialize form data for new camera
        formDataMap['new-camera'] = {
          focalLengthMm: undefined,
          sensorWidthMm: undefined,
          tiltDegrees: undefined,
        };
      }

      setCameraFormDataMap(formDataMap);

      setIsLoading(false);
    }

    getCameras();
  }, [projectId]);

  const handleFormChange = (
    cameraId: string,
    field: keyof CameraFormData,
    value: string
  ) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setCameraFormDataMap((prev) => ({
      ...prev,
      [cameraId]: {
        ...prev[cameraId],
        [field]: numValue,
      },
    }));
  };

  const handleSubmit = useCallback(async () => {
    setCloseDisabled(true);
    setSubmitDisabled(true);

    // Validate all camera form data
    if (cameras.length === 0) {
      // Validate new camera data
      const newCameraData = cameraFormDataMap['new-camera'];
      if (
        newCameraData?.focalLengthMm === undefined ||
        newCameraData?.sensorWidthMm === undefined ||
        newCameraData?.tiltDegrees === undefined
      ) {
        alert('Please fill in all fields for the new camera');
        setSubmitDisabled(false);
        setCloseDisabled(false);
        return;
      }
    } else {
      // Validate existing camera data
      for (const camera of cameras) {
        const formData = cameraFormDataMap[camera.id];
        if (
          formData?.focalLengthMm === undefined ||
          formData?.sensorWidthMm === undefined ||
          formData?.tiltDegrees === undefined
        ) {
          alert(`Please fill in all fields for camera "${camera.name}"`);
          setSubmitDisabled(false);
          setCloseDisabled(false);
          return;
        }
      }
    }

    if (cameras.length === 0) {
      // Create new camera and link all project images
      const { data: newCamera } = await client.models.Camera.create({
        projectId,
        name: 'Survey Camera',
        focalLengthMm: cameraFormDataMap['new-camera']?.focalLengthMm,
        sensorWidthMm: cameraFormDataMap['new-camera']?.sensorWidthMm,
        tiltDegrees: cameraFormDataMap['new-camera']?.tiltDegrees,
      });

      if (newCamera) {
        // Fetch all project images and link them to the new camera
        const { data: images } = await client.models.Image.imagesByProjectId({
          projectId,
        });

        // Update each image to link to the new camera
        await Promise.all(
          images.map((image) =>
            client.models.Image.update({
              id: image.id,
              cameraId: newCamera.id,
            })
          )
        );
      }
    } else {
      // Update all existing cameras
      await Promise.all(
        cameras.map((camera) => {
          const formData = cameraFormDataMap[camera.id];
          return client.models.Camera.update({
            id: camera.id,
            focalLengthMm: formData.focalLengthMm,
            sensorWidthMm: formData.sensorWidthMm,
            tiltDegrees: formData.tiltDegrees,
          });
        })
      );
    }

    setSubmitDisabled(false);
    setCloseDisabled(false);
  }, [
    cameras,
    cameraFormDataMap,
    client,
    projectId,
    setCloseDisabled,
    setSubmitDisabled,
  ]);

  // Wire up handleSubmit to parent
  useEffect(() => {
    setHandleSubmit(() => handleSubmit);
  }, [handleSubmit, cameraFormDataMap, cameras, projectId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const hasCameras = cameras.length > 0;

  return (
    <Form className='d-flex flex-column gap-3'>
      {hasCameras ? (
        <>
          <Alert variant='warning' className='mb-1'>
            <strong>Warning:</strong> Updating camera details will require you
            to recalculate your Jolly II results.
          </Alert>

          {cameras.map((camera, index) => {
            const formData = cameraFormDataMap[camera.id];
            return (
              <div
                key={camera.id}
                className='border rounded p-3 shadow-sm'
                style={{ backgroundColor: '#697582' }}
              >
                <h5 className='mb-3'>
                  Camera {index + 1}: {camera.name}
                </h5>

                <div className='row g-3'>
                  <div className='col-md-4'>
                    <Form.Group>
                      <Form.Label className='mb-0'>
                        Focal Length (mm)
                      </Form.Label>
                      <Form.Control
                        type='number'
                        step='0.01'
                        value={
                          formData?.focalLengthMm != null
                            ? formData.focalLengthMm.toString()
                            : ''
                        }
                        onChange={(e) =>
                          handleFormChange(
                            camera.id,
                            'focalLengthMm',
                            e.target.value
                          )
                        }
                        placeholder='Enter focal length'
                      />
                    </Form.Group>
                  </div>

                  <div className='col-md-4'>
                    <Form.Group>
                      <Form.Label className='mb-0'>
                        Sensor Width (mm)
                      </Form.Label>
                      <Form.Control
                        type='number'
                        step='0.01'
                        value={
                          formData?.sensorWidthMm != null
                            ? formData.sensorWidthMm.toString()
                            : ''
                        }
                        onChange={(e) =>
                          handleFormChange(
                            camera.id,
                            'sensorWidthMm',
                            e.target.value
                          )
                        }
                        placeholder='Enter sensor width'
                      />
                    </Form.Group>
                  </div>

                  <div className='col-md-4'>
                    <Form.Group>
                      <Form.Label className='mb-0'>Tilt (degrees)</Form.Label>
                      <Form.Control
                        type='number'
                        step='0.01'
                        value={
                          formData?.tiltDegrees != null
                            ? formData.tiltDegrees.toString()
                            : ''
                        }
                        onChange={(e) =>
                          handleFormChange(
                            camera.id,
                            'tiltDegrees',
                            e.target.value
                          )
                        }
                        placeholder='Enter tilt'
                      />
                    </Form.Group>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <>
          <Alert variant='info'>
            No cameras found. Adding a new camera named "Survey Camera".
          </Alert>

          <div className='border rounded p-3'>
            <h5 className='mb-3'>New Camera: Survey Camera</h5>

            <div className='row g-3'>
              <div className='col-md-4'>
                <Form.Group>
                  <Form.Label className='mb-0'>Focal Length (mm)</Form.Label>
                  <Form.Control
                    type='number'
                    step='0.01'
                    value={
                      cameraFormDataMap['new-camera']?.focalLengthMm != null
                        ? cameraFormDataMap[
                            'new-camera'
                          ].focalLengthMm!.toString()
                        : ''
                    }
                    onChange={(e) =>
                      handleFormChange(
                        'new-camera',
                        'focalLengthMm',
                        e.target.value
                      )
                    }
                    placeholder='Enter focal length'
                  />
                </Form.Group>
              </div>

              <div className='col-md-4'>
                <Form.Group>
                  <Form.Label className='mb-0'>Sensor Width (mm)</Form.Label>
                  <Form.Control
                    type='number'
                    step='0.01'
                    value={
                      cameraFormDataMap['new-camera']?.sensorWidthMm != null
                        ? cameraFormDataMap[
                            'new-camera'
                          ].sensorWidthMm!.toString()
                        : ''
                    }
                    onChange={(e) =>
                      handleFormChange(
                        'new-camera',
                        'sensorWidthMm',
                        e.target.value
                      )
                    }
                    placeholder='Enter sensor width'
                  />
                </Form.Group>
              </div>

              <div className='col-md-4'>
                <Form.Group>
                  <Form.Label className='mb-0'>Tilt (degrees)</Form.Label>
                  <Form.Control
                    type='number'
                    step='0.01'
                    value={
                      cameraFormDataMap['new-camera']?.tiltDegrees != null
                        ? cameraFormDataMap[
                            'new-camera'
                          ].tiltDegrees!.toString()
                        : ''
                    }
                    onChange={(e) =>
                      handleFormChange(
                        'new-camera',
                        'tiltDegrees',
                        e.target.value
                      )
                    }
                    placeholder='Enter tilt'
                  />
                </Form.Group>
              </div>
            </div>
          </div>
        </>
      )}
    </Form>
  );
}
