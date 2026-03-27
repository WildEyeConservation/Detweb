import { useContext, useEffect, useState } from 'react';
import { Card, Button, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { GlobalContext, UserContext } from '../Context';
import OrganizationSelector from '../OrganizationSelector';
import { fetchAllPaginatedResults } from '../utils';
import { Schema } from '../amplify/client-schema';
import CreateCollectionModal from './CreateCollectionModal';
import EditCollectionModal from './EditCollectionModal';

type Collection = Schema['Collection']['type'];

export default function Collections() {
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<{ id: string; name: string }>({ id: '', name: '' });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  useEffect(() => {
    if (!organization.id) return;
    setLoading(true);
    fetchAllPaginatedResults(
      client.models.Collection.collectionsByOrganizationId,
      { organizationId: organization.id, selectionSet: ['id', 'name', 'description', 'organizationId', 'group'] }
    )
      .then(setCollections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [organization.id]);

  async function handleDelete(collection: Collection) {
    if (!window.confirm(`Delete collection "${collection.name}"? This cannot be undone.`)) return;
    setDeletingId(collection.id);
    try {
      // Delete all junction records first (no DynamoDB cascade)
      const memberships = await fetchAllPaginatedResults(
        client.models.CollectionProject.collectionProjectsByCollectionId,
        { collectionId: collection.id, selectionSet: ['id'] }
      );
      await Promise.all(memberships.map((m) => client.models.CollectionProject.delete({ id: m.id })));
      await client.models.Collection.delete({ id: collection.id });
      setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '1200px', marginTop: '16px', marginBottom: '16px' }}>
      <Card>
        <Card.Header className='d-flex justify-content-between align-items-center'>
          <Card.Title className='mb-0'>
            <h4 className='mb-0'>Collections</h4>
          </Card.Title>
          <OrganizationSelector organization={organization} setOrganization={setOrganization} />
        </Card.Header>
        <Card.Body>
          {!organization.id ? (
            <p className='text-muted'>Select an organisation to view collections.</p>
          ) : loading ? (
            <div className='text-center py-4'>
              <Spinner />
            </div>
          ) : (
            <>
              <div className='mb-3'>
                <Button onClick={() => setShowCreate(true)}>New Collection</Button>
              </div>
              {collections.length === 0 ? (
                <p className='text-muted'>No collections yet.</p>
              ) : (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th style={{ width: '200px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td className='text-muted'>{c.description ?? '—'}</td>
                        <td>
                          <div className='d-flex gap-2'>
                            <Button size='sm' variant='primary' onClick={() => navigate(`/collections/${c.id}`)}>
                              View
                            </Button>
                            <Button size='sm' variant='secondary' onClick={() => setEditTarget(c)}>
                              Edit
                            </Button>
                            <Button
                              size='sm'
                              variant='danger'
                              disabled={deletingId === c.id}
                              onClick={() => handleDelete(c)}
                            >
                              {deletingId === c.id ? <Spinner size='sm' /> : 'Delete'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <CreateCollectionModal
        show={showCreate}
        organizationId={organization.id}
        onClose={() => setShowCreate(false)}
        onCreate={(c) => {
          setCollections((prev) => [...prev, c]);
          setShowCreate(false);
        }}
      />
      {editTarget && (
        <EditCollectionModal
          show={!!editTarget}
          collection={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(updated) => {
            setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
