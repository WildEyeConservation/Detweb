import { useContext, useEffect, useState } from 'react';
import { Button, Spinner, Table } from 'react-bootstrap';
import { GlobalContext, UserContext } from '../Context';
import { CollectionProject } from './CollectionView';

type OrgProject = { id: string; name: string };

export default function ManageProjectsTab({
  collectionId,
  organizationId,
  projects,
  onProjectsChange,
}: {
  collectionId: string;
  organizationId: string;
  projects: CollectionProject[];
  onProjectsChange: () => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const { myMembershipHook } = useContext(UserContext)!;
  const [orgProjects, setOrgProjects] = useState<OrgProject[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingOrg(true);

    const projectIds = [
      ...new Set(myMembershipHook.data?.map((m) => m.projectId) ?? []),
    ];

    Promise.all(
      projectIds.map((pid) =>
        client.models.Project.get(
          { id: pid },
          { selectionSet: ['id', 'name', 'organizationId'] }
        ).then((r) => r.data)
      )
    )
      .then((results) => {
        const filtered = results.filter(
          (p): p is NonNullable<typeof p> => p !== null && p.organizationId === organizationId
        );
        setOrgProjects(
          filtered
            .map((p) => ({ id: p.id, name: p.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(console.error)
      .finally(() => setLoadingOrg(false));
  }, [organizationId]);

  const inCollectionIds = new Set(projects.map((p) => p.projectId));
  const available = orgProjects.filter((p) => !inCollectionIds.has(p.id));

  async function handleAdd(project: OrgProject) {
    setPendingId(project.id);
    try {
      await client.models.CollectionProject.create({
        collectionId,
        projectId: project.id,
        group: organizationId,
      });
      onProjectsChange();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(membership: CollectionProject) {
    setPendingId(membership.projectId);
    try {
      await client.models.CollectionProject.delete({ id: membership.id });
      onProjectsChange();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingId(null);
    }
  }

  if (loadingOrg) {
    return (
      <div className='d-flex justify-content-center py-4'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='d-flex gap-3 p-3 flex-column flex-md-row'>
      {/* In collection */}
      <div className='flex-grow-1'>
        <h5>In Collection</h5>
        {projects.length === 0 ? (
          <p className='text-muted'>No surveys added yet.</p>
        ) : (
          <Table hover size='sm'>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId}>
                  <td>{p.projectName}</td>
                  <td className='text-end'>
                    <Button
                      size='sm'
                      variant='outline-danger'
                      disabled={pendingId === p.projectId}
                      onClick={() => handleRemove(p)}
                    >
                      {pendingId === p.projectId ? <Spinner size='sm' /> : 'Remove'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <div className='vr d-none d-md-block' />

      {/* Available to add */}
      <div className='flex-grow-1'>
        <h5>Available Surveys</h5>
        {available.length === 0 ? (
          <p className='text-muted'>All surveys in this organisation are already in the collection.</p>
        ) : (
          <Table hover size='sm'>
            <tbody>
              {available.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className='text-end'>
                    <Button
                      size='sm'
                      variant='outline-primary'
                      disabled={pendingId === p.id}
                      onClick={() => handleAdd(p)}
                    >
                      {pendingId === p.id ? <Spinner size='sm' /> : 'Add'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
