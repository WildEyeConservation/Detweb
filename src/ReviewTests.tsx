import { Button } from 'react-bootstrap';
import {
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { GlobalContext, UserContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import { FetcherType, PreloaderFactory } from './Preloader';
import { TaskSelector } from './TaskSelector';
import TestPresetsModal from './TestPresetsModal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { Schema } from '../amplify/data/resource';

type Preset = {
  id: string;
  name: string;
  accuracy: number;
};

export default function ReviewTests({
  organizationId,
  allPresets,
}: {
  organizationId: string;
  allPresets: Schema['TestPreset']['type'][];
}) {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!;
  const { currentAnnoCount, setCurrentAnnoCount } = useContext(UserContext)!;
  const [presets, setPresets] = useState<Preset[]>([]);
  const [filteredPreset, setFilteredPreset] = useState<
    { label: string; value: string } | undefined
  >(undefined);
  const [locationPresets, setLocationPresets] = useState<
    { label: string; value: string }[]
  >([]);
  const [index, setIndex] = useState<number>(0);

  const allLocations = useRef<
    { testPresetId: string; locationId: string; annotationSetId: string }[]
  >([]);
  const filteredLocations = useRef<
    { locationId: string; annotationSetId: string }[]
  >([]);
  const currentLocation = useRef<{
    locationId: string;
    annotationSetId: string;
  } | null>(null);
  const locationIndex = useRef<number>(0);
  const [finished, setFinished] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const ogActivePresets = useRef<{ id: string }[]>([]);

  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

  const fetcher: FetcherType = useCallback(async () => {
    const location = filteredLocations.current[locationIndex.current];

    locationIndex.current = locationIndex.current + 1;

    const id = crypto.randomUUID();
    return {
      id: id,
      message_id: id,
      location: {
        id: location.locationId || '',
        annotationSetId: location.annotationSetId || '',
      },
      ack: () => {
        console.log('Ack successful for test review');
      },
    };
  }, [filteredLocations, locationIndex]);

  async function saveAnnotations(cLocation: {
    locationId: string;
    annotationSetId: string;
  }) {
    // This counts the annotations per category for this location

    const { data: location } = await client.models.Location.get({
      id: cLocation.locationId,
      selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const,
    });

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location!.imageId,
        setId: { eq: cLocation.annotationSetId },
        selectionSet: ['categoryId', 'x', 'y'] as const,
      }
    );

    const boundsxy: [number, number][] = [
      [location!.x - location!.width / 2, location!.y - location!.height / 2],
      [location!.x + location!.width / 2, location!.y + location!.height / 2],
    ];

    // keep count of annotations per category
    const annotationCounts: { [key: string]: number } = {};
    for (const annotation of annotations) {
      const isWithin =
        annotation.x >= boundsxy[0][0] &&
        annotation.y >= boundsxy[0][1] &&
        annotation.x <= boundsxy[1][0] &&
        annotation.y <= boundsxy[1][1];

      if (isWithin) {
        annotationCounts[annotation.categoryId] =
          (annotationCounts[annotation.categoryId] || 0) + 1;
      }
    }

    // create entries in bridge table
    for (const [categoryId, count] of Object.entries(annotationCounts)) {
      const { data: locationAnnotationCount } =
        await client.models.LocationAnnotationCount.get({
          locationId: cLocation.locationId,
          categoryId: categoryId,
          annotationSetId: cLocation.annotationSetId,
        });

      if (locationAnnotationCount) {
        await client.models.LocationAnnotationCount.update({
          locationId: cLocation.locationId,
          categoryId: categoryId,
          annotationSetId: cLocation.annotationSetId,
          count: count,
        });
      } else {
        await client.models.LocationAnnotationCount.create({
          locationId: cLocation.locationId,
          categoryId: categoryId,
          annotationSetId: cLocation.annotationSetId,
          count: count,
        });
      }
    }

    setCurrentAnnoCount({});
  }

  async function savePresets(clocation: {
    locationId: string;
    annotationSetId: string;
  }) {
    // delete all inactive presets that were part of ogActivePresets
    for (const ogPreset of ogActivePresets.current) {
      if (!locationPresets.some((sp) => sp.value === ogPreset.id)) {
        await client.models.TestPresetLocation.delete({
          testPresetId: ogPreset.id,
          locationId: clocation.locationId,
          annotationSetId: clocation.annotationSetId,
        });
      }
    }

    // create new active presets that are not part of ogActivePresets
    for (const preset of locationPresets) {
      if (!ogActivePresets.current.some((p) => p.id === preset.value)) {
        await client.models.TestPresetLocation.create({
          testPresetId: preset.value,
          locationId: clocation.locationId,
          annotationSetId: clocation.annotationSetId,
        });
      }
    }

    ogActivePresets.current = locationPresets.map((p) => ({ id: p.value }));
  }

  useEffect(() => {
    if (Object.keys(currentAnnoCount).length > 0 && currentLocation.current) {
      saveAnnotations(currentLocation.current);
    }
  }, [currentAnnoCount]);

  useEffect(() => {
    if (currentLocation.current) {
      savePresets(currentLocation.current);
    }
  }, [locationPresets]);

  useEffect(() => {
    async function getLocationPresets() {
      const l = filteredLocations.current[index];

      const lPresets = await fetchAllPaginatedResults(
        client.models.TestPresetLocation.testPresetsByLocationId,
        {
          locationId: l.locationId,
          selectionSet: ['testPresetId'],
        }
      );

      currentLocation.current = l;

      ogActivePresets.current = lPresets.map((p) => ({ id: p.testPresetId }));
      setLocationPresets(
        lPresets.map((p) => ({
          label: presets.find((pr) => pr.id === p.testPresetId)!.name,
          value: p.testPresetId,
        }))
      );
    }

    if (finished && filteredPreset && filteredLocations.current.length > 0)
      getLocationPresets();
  }, [index, finished, filteredPreset]);

  useEffect(() => {
    async function getPresets() {
      for (const preset of allPresets) {
        const locations = await fetchAllPaginatedResults(
          client.models.TestPresetLocation.locationsByTestPresetId,
          {
            testPresetId: preset.id,
            selectionSet: ['testPresetId', 'locationId', 'annotationSetId'],
          }
        );

        allLocations.current.push(...locations);
      }

      setPresets(
        allPresets.map((p) => ({
          id: p.id,
          name: p.name,
          accuracy: p.accuracy,
        }))
      );

      if (allLocations.current.length > 0) {
        setFinished(true);
      }
    }

    if (organizationId) {
      locationIndex.current = 0;
      allLocations.current = [];
      filteredLocations.current = [];
      currentLocation.current = null;

      setIndex(0);
      setFilteredPreset(undefined);
      setLocationPresets([]);

      getPresets();
    } else {
      setFinished(false);
    }
  }, [allPresets]);

  async function handleDeletePool() {
    setDeleting(true);
    if (
      filteredPreset &&
      window.confirm('Are you sure you want to delete this pool?')
    ) {
      const { data: categories } =
        await client.models.TestPresetCategory.categoriesByTestPresetId(
          {
            testPresetId: filteredPreset.value,
          },
          {
            selectionSet: ['categoryId'],
          }
        );

      await Promise.all([
        client.models.TestPreset.delete({
          id: filteredPreset.value,
        }),
        ...categories.map((category) =>
          client.models.TestPresetCategory.delete({
            testPresetId: filteredPreset.value,
            categoryId: category.categoryId,
          })
        ),
      ]);
    }

    setDeleting(false);
  }

  return (
    <>
      <Form>
        <Form.Group>
          <Form.Label>Filter locations by pool</Form.Label>
          <div className="d-flex gap-2">
            <Select
              className="flex-grow-1 text-black"
              isDisabled={deleting}
              value={filteredPreset || null}
              options={presets.map((p) => ({ label: p.name, value: p.id }))}
              onChange={(e) => {
                setFilteredPreset(e);
                filteredLocations.current = allLocations.current.filter(
                  (l) => e?.value === l.testPresetId
                );
                setIndex(0);
              }}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  minHeight: '48px',
                  overflowY: 'auto',
                }),
              }}
            />
            <Button
              variant="info"
              onClick={() => {
                showModal('editPoolModal');
              }}
              disabled={filteredPreset === undefined || deleting}
            >
              Edit Pool
            </Button>
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>
                  This will remove all locations from this pool and delete the
                  pool.
                  <br />
                  Locations will not be removed from other pools.
                </Tooltip>
              }
            >
              <Button
                variant="danger"
                onClick={handleDeletePool}
                disabled={filteredPreset === undefined || deleting}
              >
                Delete Pool
              </Button>
            </OverlayTrigger>
          </div>
        </Form.Group>
        {filteredPreset ? (
          finished && filteredLocations.current.length > 0 ? (
            <>
              <Form.Group className="mt-3" style={{ paddingBottom: '800px' }}>
                <Preloader
                  index={index}
                  setIndex={setIndex}
                  fetcher={fetcher}
                  preloadN={2}
                  historyN={2}
                />
              </Form.Group>
              <Form.Group className="mt-3">
                <Form.Label className="mb-0">
                  This location is part of the following pools
                </Form.Label>
                <span
                  className="text-muted d-block mb-2"
                  style={{ fontSize: 12, lineHeight: 1.2 }}
                >
                  To edit the pools this location is part of, select the pools
                  you would like to add the location to or deselect the pools
                  you would like to remove the location from.
                </span>
                <Select
                  className="flex-grow-1"
                  value={locationPresets}
                  isDisabled={
                    filteredPreset === undefined ||
                    !finished ||
                    filteredLocations.current.length === 0
                  }
                  options={presets.map((p) => ({ label: p.name, value: p.id }))}
                  onChange={setLocationPresets}
                  isMulti
                  styles={{
                    valueContainer: (base) => ({
                      ...base,
                      minHeight: '48px',
                      overflowY: 'auto',
                    }),
                  }}
                />
              </Form.Group>
            </>
          ) : (
            <p className="mt-3 mb-0 text-center">Loading...</p>
          )
        ) : null}
      </Form>
      {filteredPreset && (
        <TestPresetsModal
          show={modalToShow === 'editPoolModal'}
          onClose={() => showModal(null)}
          isNewPreset={false}
          organizationId={organizationId}
          preset={{
            name: filteredPreset.label,
            id: filteredPreset.value,
          }}
        />
      )}
    </>
  );
}
