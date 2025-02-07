import { Button, Modal } from "react-bootstrap";
import { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { GlobalContext, ProjectContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import { Form } from "react-bootstrap";
import Select from "react-select";
import { FetcherType, PreloaderFactory } from "./Preloader";
import { TaskSelector } from "./TaskSelector";

type Preset = {
    id: string;
    name: string;
    accuracy: number;
}

export default function ReviewTestsModal({show, onClose}: {show: boolean, onClose: () => void}) {
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!
    const [presets, setPresets] = useState<Preset[]>([]);
    const [filteredPresets, setFilteredPresets] = useState<{label: string, value: string}[]>([]);
    const [locationPresets, setLocationPresets] = useState<{label: string, value: string}[]>([]);
    const [index, setIndex] = useState<number>(0);

    const allLocations = useRef<{testPresetId: string, locationId: string, annotationSetId: string}[]>([]);
    const filteredLocations = useRef<{locationId: string, annotationSetId: string}[]>([]);
    const currentLocation = useRef<{locationId: string, annotationSetId: string} | null>(null);
    const locationIndex = useRef<number>(0);
    const [finished, setFinished] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const ogActivePresets = useRef<{id: string}[]>([]);

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
            }
        };
    }, [filteredLocations, locationIndex]);

    async function handleSave() {
        setSaving(true);

        const cLocation = currentLocation.current!;

        // delete all inactive presets that were part of ogActivePresets
        for (const ogPreset of ogActivePresets.current) {
            if (!locationPresets.some((sp) => sp.value === ogPreset.id)) {
                await client.models.TestPresetLocation.delete(
                    {
                        testPresetId: ogPreset.id,
                        locationId: cLocation.locationId,
                        annotationSetId: cLocation.annotationSetId
                    }
                )
            }
        }

        // create new active presets that are not part of ogActivePresets
        for (const preset of locationPresets) {
            if (!ogActivePresets.current.some((p) => p.id === preset.value)) {
                await client.models.TestPresetLocation.create(
                    {
                        testPresetId: preset.value,
                        locationId: cLocation.locationId,
                        annotationSetId: cLocation.annotationSetId
                    }
                )
            }
        }

        // This counts the annotations per category for this location

        const { data: location } = await client.models.Location.get({
            id: cLocation.locationId,
            selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const,
        });

        const annotations = await fetchAllPaginatedResults(client.models.Annotation.annotationsByImageIdAndSetId, {
            imageId: location!.imageId,
            setId: { eq: cLocation.annotationSetId },
            selectionSet: ['categoryId', 'x', 'y'] as const,
        });

        const boundsxy: [number, number][] = [
            [location!.x - location!.width / 2, location!.y - location!.height / 2],
            [location!.x + location!.width / 2, location!.y + location!.height / 2],
          ];

        // keep count of annotations per category
        const annotationCounts: {[key: string]: number} = {};
        for (const annotation of annotations) {
            const isWithin = 
                annotation.x >= boundsxy[0][0] && 
                annotation.y >= boundsxy[0][1] && 
                annotation.x <= boundsxy[1][0] && 
                annotation.y <= boundsxy[1][1];
            
            if (isWithin) {
                annotationCounts[annotation.categoryId] = (annotationCounts[annotation.categoryId] || 0) + 1;
            }
        }

        // create entries in bridge table
        for (const [categoryId, count] of Object.entries(annotationCounts)) {
            const { data: locationAnnotationCount } = await client.models.LocationAnnotationCount.get({
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

        setSaving(false);
    }

    useEffect(() => {
        async function getLocationPresets() {
            const l = filteredLocations.current[index];

            const lPresets = await fetchAllPaginatedResults(client.models.TestPresetLocation.testPresetsByLocationId, {
                locationId: l.locationId,
                selectionSet: ['testPresetId'],
            });

            currentLocation.current = l;

            ogActivePresets.current = lPresets.map((p) => ({id: p.testPresetId}));
            setLocationPresets(lPresets.map((p) => ({label: presets.find((pr) => pr.id === p.testPresetId)!.name, value: p.testPresetId}))); 
        }

        if (finished && filteredPresets.length > 0 && filteredLocations.current.length > 0) getLocationPresets();   
    }, [index, finished, filteredPresets]);

    useEffect(() => {
        async function getPresets() {
            const allPresets = await fetchAllPaginatedResults(client.models.TestPreset.testPresetsByProjectId, {
                projectId: project.id,
                selectionSet: ['id', 'name', 'accuracy'],
            });

            for (const preset of allPresets) {
                const locations = await fetchAllPaginatedResults(client.models.TestPresetLocation.locationsByTestPresetId, {
                    testPresetId: preset.id,
                    selectionSet: ['testPresetId', 'locationId', 'annotationSetId'],
                });

                allLocations.current.push(...locations);
            }

            setPresets(allPresets.map((p) => ({id: p.id, name: p.name, accuracy: p.accuracy})));
            
            if(allLocations.current.length > 0) {
                setFinished(true);
            }
        }

        if (show) {
            locationIndex.current = 0;
            allLocations.current = [];
            filteredLocations.current = [];
            currentLocation.current = null;

            setIndex(0);
            setFilteredPresets([]);
            setLocationPresets([]);

            getPresets();
        } else {
            setFinished(false);
        }

    }, [show]);

    return (
        <Modal show={show} onHide={onClose} size="xl">
            <Modal.Header closeButton>
                <Modal.Title>Review test locations</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className="d-flex flex-row gap-3">
                        <div className="flex-grow-1">
                            <Form.Label>Filter locations by presets</Form.Label>
                            <Select
                                value={filteredPresets}
                                options={presets.map((p) => ({label: p.name, value: p.id}))}
                                onChange={(e) => {
                                    setFilteredPresets(e);
                                    filteredLocations.current = allLocations.current.filter((l) => e.some((p) => p.value === l.testPresetId));
                                    setIndex(0);
                                }}
                                isMulti
                                styles={{
                                    valueContainer: (base) => ({
                                        ...base,
                                        minHeight: '48px',
                                        overflowY: 'auto',
                                    }),
                                }}
                            />
                        </div>
                        <div className="flex-grow-1">
                            <Form.Label>Presets that use this location</Form.Label>
                            <Select 
                                value={locationPresets}
                                isDisabled={filteredPresets.length === 0 || !finished || filteredLocations.current.length === 0}
                                options={presets.map((p) => ({label: p.name, value: p.id}))}
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
                        </div>
                    </Form.Group>  
                    {filteredPresets.length > 0 ?
                        finished && filteredLocations.current.length > 0 ?
                            <>
                                <Form.Group className="mt-3" style={{paddingBottom: "800px"}}>
                                    <Preloader
                                        index={index}
                                        setIndex={setIndex}
                                        fetcher={fetcher}
                                        preloadN={2}
                                        historyN={2}
                                    />
                                </Form.Group>
                            </>
                        : <p className="mt-2 mb-0 text-center">Loading...</p>
                    : null}            
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save this test'}
                </Button>
            </Modal.Footer>
        </Modal>
    )
}
