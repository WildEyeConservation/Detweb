import { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Table } from 'react-bootstrap';
import { GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import type { Schema } from './amplify/client-schema';

type ProjectType = Schema['Project']['type'];

type GroupedSurveys = {
  orgId: string;
  orgName: string;
  surveys: ProjectType[];
};

export default function AdminSurveys() {
  const global = useContext(GlobalContext);
  const client = global?.client;
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ variant: 'success' | 'danger'; text: string } | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    void loadData();
  }, [client]);

  const loadData = async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    setBanner(null);
    try {
      const [allProjects, allOrganizations] = await Promise.all([
        fetchAllPaginatedResults<ProjectType>(client.models.Project.list, {
          selectionSet: [
            'id',
            'name',
            'createdAt',
            'updatedAt',
            'status',
            'organizationId',
            'imageSets.id',
            'imageSets.name',
            'imageSets.imageCount',
          ],
        }),
        fetchAllPaginatedResults<Schema['Organization']['type']>(client.models.Organization.list, {
          selectionSet: ['id', 'name'],
        }),
      ]);

      const orgMap = allOrganizations.reduce<Record<string, string>>((acc, org) => {
        if (org.id) {
          acc[org.id] = org.name || 'Unnamed organization';
        }
        return acc;
      }, {});

      setProjects(allProjects);
      setOrgNames(orgMap);
    } catch (err) {
      console.error('Failed to load surveys', err);
      setError(err instanceof Error ? err.message : 'Failed to load surveys.');
    } finally {
      setIsLoading(false);
    }
  };

  const groupedSurveys = useMemo<GroupedSurveys[]>(() => {
    if (!projects.length) {
      return [];
    }
    const groups = projects.reduce<Record<string, GroupedSurveys>>((acc, project) => {
      const orgId = project.organizationId || 'unassigned';
      if (!acc[orgId]) {
        acc[orgId] = {
          orgId,
          orgName: project.organizationId ? orgNames[project.organizationId] || 'Unknown organization' : 'Unassigned',
          surveys: [],
        };
      }
      acc[orgId].surveys.push(project);
      return acc;
    }, {});
    return Object.values(groups).sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [projects, orgNames]);

  const handleUpdateStatus = async (project: ProjectType) => {
    if (!client || !project.id) return;
    const nextStatus = window.prompt(
      `Update status for "${project.name}"`,
      project.status ?? ''
    );
    if (nextStatus === null) {
      return;
    }
    const trimmedStatus = nextStatus.trim();
    if (!trimmedStatus) {
      alert('Status cannot be empty.');
      return;
    }

    setUpdatingProjectId(project.id);
    setBanner(null);
    try {
      await client.models.Project.update({
        id: project.id,
        status: trimmedStatus,
      });
      await client.mutations.updateProjectMemberships({
        projectId: project.id,
      });
      setBanner({
        variant: 'success',
        text: `Updated status for "${project.name}".`,
      });
      await loadData();
    } catch (err) {
      console.error('Failed to update project status', err);
      setBanner({
        variant: 'danger',
        text:
          err instanceof Error ? err.message : 'Unable to update survey status.',
      });
    } finally {
      setUpdatingProjectId(null);
    }
  };

  if (!client) {
    return (
      <Card className='mt-3'>
        <Card.Body>
          <Alert variant='warning' className='mb-0'>
            Unable to load surveys because the admin client is not available.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className='mt-3'>
      <Card.Header className='d-flex justify-content-between align-items-center'>
        <div>
          <Card.Title className='mb-0'>Surveys</Card.Title>
          <div className='text-muted small'>
            Review all surveys grouped by organization.
          </div>
        </div>
        <Button variant='outline-primary' onClick={loadData} disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner animation='border' size='sm' className='me-2' />
              Refreshing
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant='danger' className='mb-3'>
            {error}
          </Alert>
        )}
        {banner && (
          <Alert
            variant={banner.variant === 'success' ? 'success' : 'danger'}
            onClose={() => setBanner(null)}
            dismissible
            className='mb-3'
          >
            {banner.text}
          </Alert>
        )}
        {isLoading ? (
          <div className='d-flex justify-content-center py-4'>
            <Spinner animation='border' />
          </div>
        ) : groupedSurveys.length === 0 ? (
          <Alert variant='info'>No surveys found.</Alert>
        ) : (
          <div className='d-flex flex-column gap-4'>
            {groupedSurveys.map((group) => (
              <div key={group.orgId}>
                <div className='d-flex align-items-center justify-content-between mb-2'>
                  <h5 className='mb-0'>{group.orgName}</h5>
                  <Badge bg='secondary'>{group.surveys.length} surveys</Badge>
                </div>
                <div className='table-responsive'>
                  <Table hover responsive className='align-middle'>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th className='text-end'>Total Images</th>
                        <th className='text-nowrap'>Created</th>
                        <th className='text-nowrap'>Updated</th>
                        <th>Status</th>
                        <th className='text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.surveys
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt || 0).getTime() -
                            new Date(a.createdAt || 0).getTime()
                        )
                        .map((survey) => (
                          <tr key={survey.id}>
                            <td>{survey.name}</td>
                            <td className='text-end'>{formatImageCount(survey)}</td>
                            <td className='text-nowrap'>
                              {formatDate(survey.createdAt)}
                            </td>
                            <td className='text-nowrap'>
                              {formatDate(survey.updatedAt)}
                            </td>
                            <td>{survey.status || '—'}</td>
                            <td className='text-end'>
                              <Button
                                size='sm'
                                variant='outline-primary'
                                onClick={() => handleUpdateStatus(survey)}
                                disabled={updatingProjectId === survey.id}
                              >
                                {updatingProjectId === survey.id ? (
                                  <>
                                    <Spinner animation='border' size='sm' className='me-2' />
                                    Updating
                                  </>
                                ) : (
                                  'Update Status'
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatImageCount(project: ProjectType): string {
  const sets = (project.imageSets as { imageCount?: number | null }[] | undefined) ?? [];
  if (!sets.length) {
    return '0';
  }
  const total = sets.reduce((sum, set) => sum + (set.imageCount ?? 0), 0);
  return total.toLocaleString();
}

