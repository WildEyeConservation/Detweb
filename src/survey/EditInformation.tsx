import { Form, Button, Spinner } from 'react-bootstrap';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../Context';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAllPaginatedResults } from '../utils';
import { TreeNode, Camera } from './SurveyStructure';

export default function EditInformation({
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
  const { client } = useContext(GlobalContext)!;
  const [oldProjectName, setOldProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [fetching, setFetching] = useState(false);
  const [structure, setStructure] = useState<Camera[]>([]);
  const [expandedCameras, setExpandedCameras] = useState<Set<string>>(
    new Set()
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const queryClient = useQueryClient();

  const toggleCamera = (cameraName: string) => {
    setExpandedCameras((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cameraName)) {
        newSet.delete(cameraName);
      } else {
        newSet.add(cameraName);
      }
      return newSet;
    });
  };

  const toggleAllCameras = () => {
    if (expandedCameras.size === structure.length) {
      // All are expanded, collapse all
      setExpandedCameras(new Set());
      setExpandedFolders(new Set()); // Also collapse all folders
    } else {
      // Expand all
      setExpandedCameras(new Set(structure.map((camera) => camera.name)));
      // Expand all folders too
      const allFolders = new Set<string>();
      structure.forEach((camera) => {
        camera.folders.forEach((folder) => {
          allFolders.add(camera.name + '-' + folder.path);
        });
      });
      setExpandedFolders(allFolders);
    }
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderKey)) {
        newSet.delete(folderKey);
      } else {
        newSet.add(folderKey);
      }
      return newSet;
    });
  };

  useEffect(() => {
    setHandleSubmit(() => async () => {
      setSubmitDisabled(true);
      setCloseDisabled(true);

      const { data: project } = await client.models.Project.update({
        id: projectId,
        name: newProjectName,
      });

      if (project?.name === newProjectName) {
        const {
          data: [testPreset],
        } = await client.models.TestPreset.testPresetsByName({
          name: oldProjectName,
        });

        if (testPreset) {
          await client.models.TestPreset.update({
            id: testPreset.id,
            name: newProjectName,
          });
        }

        setOldProjectName(newProjectName);
      }

      await client.mutations.updateProjectMemberships({
        projectId,
      });

      setSubmitDisabled(false);
      setCloseDisabled(false);

      queryClient.invalidateQueries({ queryKey: ['Project'] });
      queryClient.invalidateQueries({ queryKey: ['TestPreset'] });
    });
  }, [
    projectId,
    setHandleSubmit,
    setSubmitDisabled,
    setCloseDisabled,
    oldProjectName,
    newProjectName,
  ]);

  useEffect(() => {
    async function getProject() {
      setFetching(true);

      const { data: project } = await client.models.Project.get({
        id: projectId,
      });

      if (project) {
        setOldProjectName(project.name);
        setNewProjectName(project.name);
      }

      setFetching(false);
    }

    async function buildSurveyStructure() {
      const { data: cameras } = await client.models.Camera.camerasByProjectId({
        projectId,
      });

      const images = await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'cameraId', 'originalPath'],
          limit: 1000,
        }
      );

      // In case there are no cameras, add a default camera
      if (cameras.length === 0) {
        cameras.push({
          id: '0000',
          name: 'Survey Camera',
        });
      }

      const structure = cameras.map((camera) => {
        const cameraImages =
          camera.id === '0000'
            ? images
            : images.filter((image) => image.cameraId === camera.id);

        // create a set of unique parent directories and the image count in each directory
        const cameraFolders = new Set<string>();
        for (const image of cameraImages) {
          // Extract the parent directory (second-to-last part of the path)
          if (image.originalPath) {
            const pathParts = (image.originalPath as string)
              .split(/[/\\]/)
              .filter((part: string) => part.length > 0);
            if (pathParts.length > 1) {
              const parentDir = pathParts[pathParts.length - 2];
              cameraFolders.add(parentDir);
            } else if (pathParts.length === 1) {
              // If only one part, use it as the directory
              cameraFolders.add(pathParts[0]);
            }
          }
        }

        return {
          name: camera.name as string,
          folders: Array.from(cameraFolders).map((parentDir) => {
            // Get images that belong to this folder
            const folderImages = cameraImages.filter((image) => {
              if (!image.originalPath) return false;
              const pathParts = (image.originalPath as string)
                .split(/[/\\]/)
                .filter((part: string) => part.length > 0);
              if (pathParts.length > 1) {
                return pathParts[pathParts.length - 2] === parentDir;
              } else if (pathParts.length === 1) {
                return pathParts[0] === parentDir;
              }
              return false;
            });

            return {
              path: parentDir,
              imageCount: folderImages.length,
              images: folderImages.map((img) => ({
                id: String(img.id),
                originalPath: (img.originalPath ?? '') as string,
                cameraId: (img.cameraId ?? undefined) as string | undefined,
              })),
            };
          }),
        } as Camera;
      });

      setStructure(structure as Camera[]);
    }

    getProject();
    buildSurveyStructure();
  }, [projectId]);

  return (
    <Form className='d-flex flex-column gap-2'>
      <Form.Group className='d-flex flex-column'>
        <Form.Label className='mb-0'>Survey Name</Form.Label>
        <Form.Control
          type='text'
          value={newProjectName}
          disabled={fetching}
          onChange={(e) => setNewProjectName(e.target.value)}
        />
      </Form.Group>
      <Form.Group className='d-flex flex-column'>
        <div className='d-flex align-items-center justify-content-between'>
          <Form.Label className='mb-0'>Survey Structure</Form.Label>
          {structure.length > 0 && (
            <Button
              variant='link'
              size='sm'
              onClick={toggleAllCameras}
              className='text-white'
            >
              {expandedCameras.size === structure.length
                ? 'Collapse All'
                : 'Expand All'}
            </Button>
          )}
        </div>
        {fetching || structure.length === 0 ? (
          <div className='text-muted'>
            <Spinner animation='border' size='sm' /> Loading structure...
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {structure.map((camera, index) => (
              <TreeNode
                key={camera.name + index}
                camera={camera}
                isOpen={expandedCameras.has(camera.name)}
                onToggle={() => toggleCamera(camera.name)}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
              />
            ))}
          </div>
        )}
      </Form.Group>
    </Form>
  );
}
