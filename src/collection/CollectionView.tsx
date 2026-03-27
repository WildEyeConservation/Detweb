import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner } from 'react-bootstrap';
import { GlobalContext, UserContext } from '../Context';
import { Tabs, Tab } from '../Tabs';
import { fetchAllPaginatedResults } from '../utils';
import ManageProjectsTab from './ManageProjectsTab';
import CollectionAnnotationExport from './CollectionAnnotationExport';
import CollectionScoutbotExport from './CollectionScoutbotExport';
import CollectionLogsExport from './CollectionLogsExport';
import CollectionUserStats from './CollectionUserStats';

export type CollectionProject = {
  id: string;
  projectId: string;
  projectName: string;
};

export default function CollectionView() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { client } = useContext(GlobalContext)!;
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const navigate = useNavigate();

  const [collectionName, setCollectionName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<CollectionProject[]>([]);
  const [loading, setLoading] = useState(true);

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  useEffect(() => {
    if (!collectionId) return;
    loadCollection();
  }, [collectionId]);

  async function loadCollection() {
    setLoading(true);
    try {
      const { data: collection } = await client.models.Collection.get(
        { id: collectionId! },
        { selectionSet: ['id', 'name', 'organizationId'] }
      );
      if (!collection) {
        navigate('/collections');
        return;
      }
      setCollectionName(collection.name);
      setOrganizationId(collection.organizationId);
      await loadProjects(collectionId!);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects(cId: string) {
    const memberships = await fetchAllPaginatedResults(
      client.models.CollectionProject.collectionProjectsByCollectionId,
      { collectionId: cId, selectionSet: ['id', 'projectId', 'project.name'] as const }
    );
    setProjects(
      memberships.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        projectName: m.project?.name ?? m.projectId,
      }))
    );
  }

  if (loading) {
    return (
      <div className='d-flex justify-content-center align-items-center py-5'>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '1555px', marginTop: '16px', marginBottom: '16px' }}>
      <Card className='h-100'>
        <Card.Header className='d-flex align-items-center gap-2'>
          <Button variant='link' className='p-0 me-2' onClick={() => navigate('/collections')}>
            ← Collections
          </Button>
          <Card.Title className='mb-0'>
            <h4 className='mb-0'>{collectionName}</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body className='p-0 d-flex flex-column'>
          <Tabs>
            <Tab label='Projects'>
              <ManageProjectsTab
                collectionId={collectionId!}
                organizationId={organizationId}
                projects={projects}
                onProjectsChange={() => loadProjects(collectionId!)}
              />
            </Tab>
            <Tab label='Export Annotations'>
              <CollectionAnnotationExport
                collectionName={collectionName}
                projects={projects}
              />
            </Tab>
            <Tab label='Export Scoutbot'>
              <CollectionScoutbotExport
                collectionName={collectionName}
                projects={projects}
              />
            </Tab>
            <Tab label='Logs'>
              <CollectionLogsExport projects={projects} />
            </Tab>
            <Tab label='User Stats'>
              <CollectionUserStats
                collectionName={collectionName}
                projects={projects}
              />
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
}
