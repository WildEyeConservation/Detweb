import { Form, Button, Card } from 'react-bootstrap';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../Context';
import { useQueryClient } from '@tanstack/react-query';

export default function EditInformation({ projectId }: { projectId: string }) {
  const { client } = useContext(GlobalContext)!;
  const [oldProjectName, setOldProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [fetching, setFetching] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    setDisabled(true);

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

    setDisabled(false);

    queryClient.invalidateQueries({ queryKey: ['Project'] });
    queryClient.invalidateQueries({ queryKey: ['TestPreset'] });
  };

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
    <div className='d-flex flex-column gap-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Survey Name</h5>
        </Card.Header>
        <Card.Body>
          <Form.Control
            type='text'
            value={newProjectName}
            disabled={fetching}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
        </Card.Body>
      </Card>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant='primary' onClick={handleSubmit} disabled={disabled}>
          Save
        </Button>
      </div>
    </div>
  );
}
