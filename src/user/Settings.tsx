import { UserIcon } from 'lucide-react';
import { useContext, useState, useEffect, useCallback } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { UserContext, GlobalContext } from '../Context';
import { useUsers } from '../apiInterface';
import { Button, Form, Badge, Spinner, Alert, Card } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../Modal';
import { Tabs, Tab } from '../Tabs';

interface MembershipInfo {
  organizationId: string;
  organizationName: string;
  isAdmin: boolean;
  isActive: boolean;
}

export default function Settings({ signOut }: { signOut: () => void }) {
  const [show, setShow] = useState(false);
  const { user, cognitoGroups } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext);
  const { users } = useUsers();

  const [userAttributes, setUserAttributes] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    fetchUserAttributes().then((attrs) => {
      setUserAttributes({ name: attrs.name, email: attrs.email });
    });
  }, []);

  const username = users?.find((u) => u.id === user.username)?.name ?? userAttributes.name;
  const email = users?.find((u) => u.id === user.username)?.email ?? userAttributes.email;

  // Active Organisations tab state
  const [memberships, setMemberships] = useState<MembershipInfo[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [maxActive, setMaxActive] = useState(5);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const currentCognitoGroupOrgIds = cognitoGroups.filter(
    (g) => g !== 'sysadmin' && g !== 'orgadmin'
  );

  const fetchMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.mutations.updateActiveOrganizations({
        activatedOrganizationIds: currentCognitoGroupOrgIds,
      });
      if (result.data) {
        let parsed = result.data;
        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (parsed.success && parsed.memberships) {
          setMemberships(parsed.memberships);
          setSelectedOrgIds(new Set(parsed.activeOrganizationIds));
          setMaxActive(parsed.maxActive);
          setHasChanges(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch memberships:', err);
      setError('Failed to load organisation memberships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      fetchMemberships();
    }
  }, [show]);

  const allAutoActivated = memberships.length <= maxActive;

  const handleToggle = (orgId: string) => {
    if (allAutoActivated) return;
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        if (next.size >= maxActive) return prev;
        next.add(orgId);
      }
      setHasChanges(true);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await client.mutations.updateActiveOrganizations({
        activatedOrganizationIds: Array.from(selectedOrgIds),
      });
      if (result.data) {
        let parsed = result.data;
        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (parsed.success) {
          // Clear all cached data and sign out to refresh cognito tokens
          localStorage.clear();
          sessionStorage.clear();
          if (window.indexedDB && 'databases' in indexedDB) {
            indexedDB.databases().then((databases) => {
              databases.forEach((db) => {
                if (db.name) indexedDB.deleteDatabase(db.name);
              });
            });
          }
          if ('caches' in window) {
            caches.keys().then((names) => {
              names.forEach((name) => caches.delete(name));
            });
          }
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Failed to update active organisations:', err);
      setError('Failed to update active organisations');
      setSaving(false);
    }
  };

  const clearSiteData = () => {
    if (
      !window.confirm(
        'Are you sure you want to clear the site data? Do not proceed if you have unsaved work or busy uploading files.'
      )
    ) {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    if (window.indexedDB) {
      if ('databases' in indexedDB) {
        indexedDB.databases().then((databases) => {
          databases.forEach((db) => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }
    }

    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    window.location.reload();
  };

  return (
    <>
      <button
        className='text-muted px-2 d-flex align-items-center justify-content-center'
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => setShow(true)}
      >
        <UserIcon size={18} color='rgba(255,255,255,0.5)'/>
      </button>

      <Modal
        show={show}
        onHide={() => setShow(false)}
        size='lg'
        centered
      >
        <Header>
          <Title>Settings</Title>
        </Header>
        <Body className='p-0'>
          <Tabs>
            <Tab label='Account'>
              <div className='p-3 d-flex flex-column gap-3'>
                <Card>
                  <Card.Header>
                    <h5 className='mb-0'>Profile</h5>
                  </Card.Header>
                  <Card.Body className='d-flex flex-column gap-2'>
                    <p className='mb-0'>
                      <strong>Username:</strong> {username}
                    </p>
                    <p className='mb-0'>
                      <strong>Email:</strong> {email}
                    </p>
                  </Card.Body>
                </Card>

                <Card>
                  <Card.Header>
                    <h5 className='mb-0'>Account Actions</h5>
                  </Card.Header>
                  <Card.Body className='d-flex flex-column gap-2'>
                    <Button variant='danger' onClick={signOut}>
                      Sign Out
                    </Button>
                    <Button variant='warning' onClick={clearSiteData}>
                      Clear Cache
                    </Button>
                  </Card.Body>
                </Card>
              </div>
            </Tab>
            <Tab label='Active Organisations'>
              <div className='p-3 d-flex flex-column gap-3'>
                {loading ? (
                  <div className='d-flex justify-content-center py-4'>
                    <Spinner animation='border' />
                  </div>
                ) : error ? (
                  <Alert variant='danger' className='mb-0'>
                    {error}
                  </Alert>
                ) : (
                  <>
                    <Card>
                      <Card.Header>
                        <h5 className='mb-0'>Active Status</h5>
                      </Card.Header>
                      <Card.Body>
                        <span>
                          <strong>
                            {allAutoActivated
                              ? memberships.length
                              : selectedOrgIds.size}
                          </strong>{' '}
                          / {maxActive} active
                        </span>
                      </Card.Body>
                    </Card>

                    <Card>
                      <Card.Header>
                        <h5 className='mb-0'>Organisations</h5>
                      </Card.Header>
                      <Card.Body>
                        {memberships.length === 0 ? (
                          <p className='mb-0 text-muted'>
                            No organisation memberships found.
                          </p>
                        ) : (
                          <div className='d-flex flex-column gap-2'>
                            {memberships.map((m) => (
                              <div
                                key={m.organizationId}
                                className='d-flex align-items-center justify-content-between'
                              >
                                <div className='d-flex align-items-center gap-2'>
                                  <Form.Check
                                    type='switch'
                                    checked={
                                      allAutoActivated ||
                                      selectedOrgIds.has(m.organizationId)
                                    }
                                    disabled={
                                      allAutoActivated ||
                                      saving ||
                                      (!selectedOrgIds.has(m.organizationId) &&
                                        selectedOrgIds.size >= maxActive)
                                    }
                                    onChange={() => handleToggle(m.organizationId)}
                                  />
                                  <span>{m.organizationName}</span>
                                  {m.isAdmin && (
                                    <Badge bg='warning' text='dark'>
                                      Admin
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </>
                )}
              </div>
            </Tab>
          </Tabs>
        </Body>
        <Footer>
          <Button variant='secondary' onClick={() => setShow(false)}>
            Close
          </Button>
          {hasChanges && !allAutoActivated && (
            <Button
              variant='primary'
              onClick={handleSave}
              disabled={saving || selectedOrgIds.size === 0}
            >
              {saving ? (
                <>
                  <Spinner size='sm' className='me-2' />
                  Saving...
                </>
              ) : (
                'Save & Sign Out'
              )}
            </Button>
          )}
        </Footer>
      </Modal>
    </>
  );
}
