import { useParams } from 'react-router-dom';
import { useEffect, useState, useContext } from 'react';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import Select, { MultiValue } from 'react-select';
import { ProjectContext, ManagementContext } from './Context';
import { Form } from 'react-bootstrap';
import './Review.css';
import { Card } from 'react-bootstrap';
import Button from 'react-bootstrap/Button';
import { PanelBottom } from 'lucide-react';
import { Tab, Tabs } from './Tabs';
import ReviewCarousel from './ReviewCarousel';
import DensityMap from './DensityMap';

export function Review({ showAnnotationSetDropdown = true }) {
  const [selectedCategories, setSelectedCategories] = useState<
    { label: string; value: string }[]
  >([]);
  const [tab, setTab] = useState<'carousel' | 'map'>('carousel');
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>('');
  const [imageBased] = useState(true);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const { annotationSetId } = useParams();
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  // Keep imageBased in state for future toggling; carousel handles data fetching
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <div className='w-100 h-100 d-flex flex-column flex-sm-row gap-2'>
        <div
          className='d-flex flex-column gap-2 w-100'
          style={{ maxWidth: '300px' }}
        >
          <Card className='d-sm-block d-none w-100'>
            <Card.Header>
              <Card.Title className='mb-0'>Information</Card.Title>
            </Card.Header>
            <Card.Body className='d-flex flex-column gap-2'>
              <p className='mb-0'>
                <strong>Survey:</strong> {project.name}
              </p>
              <p className='mb-0'>
                <strong>Annotation Set:</strong>{' '}
                {annotationSets?.find((set) => set.id === selectedAnnotationSet)
                  ?.name ?? 'Unknown'}
              </p>
            </Card.Body>
          </Card>
          <Card className='w-100 flex-grow-1'>
            <Card.Header>
              <Card.Title className='mb-0 d-flex align-items-center'>
                <Button
                  className='p-0 mb-0'
                  variant='outline'
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <PanelBottom
                    className='d-sm-none'
                    style={{
                      transform: showFilters
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                    }}
                  />
                </Button>
                Filters
              </Card.Title>
            </Card.Header>
            {showFilters && (
              <Card.Body className='d-flex flex-column gap-2'>
                <div className='w-100'>
                  <Form.Label>Labels</Form.Label>
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

                {showAnnotationSetDropdown && (
                  <AnnotationSetDropdown
                    selectedSet={selectedAnnotationSet}
                    setAnnotationSet={setSelectedAnnotationSet}
                    canCreate={false}
                  />
                )}
              </Card.Body>
            )}
          </Card>
        </div>
        <Card className='h-100 w-100'>
          <Card.Body>
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
                  imageBased={imageBased}
                />
              </Tab>
              <Tab label='Map'>
                <div className='h-100 w-100 pt-3'>
                  <DensityMap
                    surveyId={project.id}
                    annotationSetId={selectedAnnotationSet}
                    categoryIds={selectedCategories.map((c) => c.value)}
                    primaryOnly={primaryOnly}
                    editable
                  />
                </div>
              </Tab>
            </Tabs>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
