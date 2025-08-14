import { Form } from 'react-bootstrap';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../Context';
import { useQueryClient } from '@tanstack/react-query';

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

  const queryClient = useQueryClient();

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

    getProject();
  }, [projectId]);

  return (
    <Form>
      <Form.Group className='d-flex flex-column'>
        <Form.Label className='mb-0'>Survey Name</Form.Label>
        <Form.Control
          type='text'
          value={newProjectName}
          disabled={fetching}
          onChange={(e) => setNewProjectName(e.target.value)}
        />
      </Form.Group>
    </Form>
  );
}
