import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, useContext, useMemo } from 'react';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import Select, { MultiValue } from 'react-select';
import { ProjectContext, ManagementContext, GlobalContext } from './Context';
import { Form } from 'react-bootstrap';
import './Review.css';
import Button from 'react-bootstrap/Button';
import { PanelBottom } from 'lucide-react';
import { Tab, Tabs } from './Tabs';
import ReviewCarousel from './ReviewCarousel';
import DensityMap from './DensityMap';
import { useUsers } from './apiInterface';
import { fetchAllPaginatedResults } from './utils';
import { Page, PageHeader, ContentArea, Crumb, CrumbSep } from './ss/PageShell';

export function Review({ showAnnotationSetDropdown = true }) {
  const [selectedCategories, setSelectedCategories] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedUsers, setSelectedUsers] = useState<
    { label: string; value: string }[]
  >([]);
  const [tab, setTab] = useState<'carousel' | 'map'>('carousel');
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>('');
  const [imageBased] = useState(true);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const { client } = useContext(GlobalContext)!;
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const { annotationSetId } = useParams();
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;
  const navigate = useNavigate();

  // Fetch users with project membership
  const { users } = useUsers();
  const [projectMemberships, setProjectMemberships] = useState<
    { userId: string }[]
  >([]);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;

    async function fetchMemberships() {
      const memberships = await fetchAllPaginatedResults(
        client.models.UserProjectMembership.userProjectMembershipsByProjectId,
        {
          projectId: project.id,
          selectionSet: ['userId'],
          limit: 1000,
        }
      );
      if (!cancelled) {
        setProjectMemberships(memberships as { userId: string }[]);
      }
    }

    fetchMemberships();
    return () => {
      cancelled = true;
    };
  }, [client, project?.id]);

  // Build user options from memberships + users lookup (deduplicated by userId)
  const userOptions = useMemo(() => {
    if (!users || !projectMemberships.length) return [];
    const seenUserIds = new Set<string>();
    return projectMemberships
      .filter((membership) => {
        if (seenUserIds.has(membership.userId)) return false;
        seenUserIds.add(membership.userId);
        return true;
      })
      .map((membership) => {
        const user = users.find((u) => u.id === membership.userId);
        return user
          ? { label: user.name || user.email || user.id, value: user.id }
          : null;
      })
      .filter((opt): opt is { label: string; value: string } => opt !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users, projectMemberships]);

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  const currentSetName =
    annotationSets?.find((set) => set.id === selectedAnnotationSet)?.name;

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <Crumb onClick={() => navigate(`/surveys/${project.id}/detail`)}>
        {project.name}
      </Crumb>
      {!showAnnotationSetDropdown && currentSetName && (
        <>
          <CrumbSep />
          <span>{currentSetName}</span>
        </>
      )}
      <CrumbSep />
      <span>Review</span>
    </>
  );

  // Keep imageBased in state for future toggling; carousel handles data fetching
  return (
    <Page>
      <PageHeader title='Review' breadcrumb={breadcrumb} />
      <ContentArea style={{ paddingTop: 16 }}>
        <div
          className='d-flex flex-column flex-sm-row gap-3'
          style={{ minHeight: '100%' }}
        >
          <div
            className='d-flex flex-column gap-3'
            style={{ width: '100%', maxWidth: 300, flexShrink: 0 }}
          >
            <div className='ss-card'>
              <div
                className='d-flex align-items-center justify-content-between'
                style={{ marginBottom: showFilters ? 12 : 0 }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>Filters</div>
                <Button
                  className='p-0 d-sm-none'
                  variant='link'
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label='Toggle filters'
                >
                  <PanelBottom
                    style={{
                      transform: showFilters
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  />
                </Button>
              </div>
              {showFilters && (
                <div className='d-flex flex-column gap-3'>
                  <div className='w-100'>
                    <Form.Label
                      className='mb-1'
                      style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}
                    >
                      Labels
                    </Form.Label>
                    <Select
                      value={selectedCategories}
                      onChange={(
                        newValue: MultiValue<{ label: string; value: string }>
                      ) =>
                        setSelectedCategories([
                          ...(newValue as { label: string; value: string }[]),
                        ])
                      }
                      isMulti
                      name='Labels to review'
                      options={categories
                        ?.filter(
                          (c) => c.annotationSetId === selectedAnnotationSet
                        )
                        .map((q) => ({
                          label: q.name,
                          value: q.id,
                        }))}
                      className='text-black w-100'
                      closeMenuOnSelect={false}
                      menuPortalTarget={document.body}
                      menuPosition='fixed'
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                    {tab === 'map' && (
                      <Form.Switch
                        label='Primary sightings only'
                        className='mt-3'
                        checked={primaryOnly}
                        onChange={(e) => setPrimaryOnly(e.target.checked)}
                      />
                    )}
                  </div>

                  <div className='w-100'>
                    <Form.Label
                      className='mb-1'
                      style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}
                    >
                      Users
                    </Form.Label>
                    <Select
                      value={selectedUsers}
                      onChange={(
                        newValue: MultiValue<{ label: string; value: string }>
                      ) =>
                        setSelectedUsers([
                          ...(newValue as { label: string; value: string }[]),
                        ])
                      }
                      isMulti
                      name='Users to filter'
                      options={userOptions}
                      className='text-black w-100'
                      closeMenuOnSelect={false}
                      placeholder='All users'
                      menuPortalTarget={document.body}
                      menuPosition='fixed'
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                  </div>

                  {showAnnotationSetDropdown && (
                    <div className='w-100'>
                      <AnnotationSetDropdown
                        selectedSet={selectedAnnotationSet}
                        setAnnotationSet={setSelectedAnnotationSet}
                        canCreate={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            className='ss-card flex-grow-1 d-flex flex-column'
            style={{ minWidth: 0, padding: 12 }}
          >
            <Tabs
              onTabChange={(tab) => {
                switch (tab) {
                  case 0:
                    setTab('carousel');
                    break;
                  case 1:
                    setTab('map');
                    break;
                }
              }}
            >
              <Tab label='Carousel'>
                <ReviewCarousel
                  selectedAnnotationSet={selectedAnnotationSet}
                  selectedCategories={selectedCategories}
                  selectedUsers={selectedUsers}
                  imageBased={imageBased}
                />
              </Tab>
              <Tab label='Map'>
                <div className='h-100 w-100 pt-3'>
                  <DensityMap
                    surveyId={project.id}
                    annotationSetId={selectedAnnotationSet}
                    categoryIds={selectedCategories.map((c) => c.value)}
                    selectedUserIds={selectedUsers.map((u) => u.value)}
                    primaryOnly={primaryOnly}
                    editable
                  />
                </div>
              </Tab>
            </Tabs>
          </div>
        </div>
      </ContentArea>
    </Page>
  );
}
