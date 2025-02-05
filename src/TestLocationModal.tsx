import { Button, Modal } from "react-bootstrap";
import { useContext, useState, useEffect, useRef } from "react";
import { GlobalContext, ProjectContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import { Form } from "react-bootstrap";
import Select from "react-select";

type Preset = {
    id: string;
    name: string;
    active: boolean;
}

export default function TestLocationModal({show, onClose, locationId, annotationSetId}: {show: boolean, onClose: () => void, locationId: string, annotationSetId: string}) {
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<{label: string, value: string}[]>([]);
    const ogActivePresets = useRef<{id: string}[]>([]);

    useEffect(() => {
        async function getPresets() {
            const allPresets = await fetchAllPaginatedResults(client.models.TestPreset.testPresetsByProjectId, {
                projectId: project.id,
                selectionSet: ['id', 'name'],
            });

            const activePresets = await fetchAllPaginatedResults(client.models.TestPresetLocation.testPresetsByLocationId, {
                locationId: locationId,
                selectionSet: ['testPresetId'],
            });

            ogActivePresets.current = activePresets.map((p) => ({id: p.testPresetId}));

            setPresets(allPresets.map((p) => ({id: p.id, name: p.name, active: activePresets.some((ap) => ap.testPresetId === p.id)})));
        }

        if (show) getPresets();
    }, [show])


    async function handleSubmit() {
        onClose();

        // delete all inactive presets that were part of ogActivePresets
        for (const ogPreset of ogActivePresets.current) {
            if (!selectedPresets.some((sp) => sp.value === ogPreset.id)) {
                await client.models.TestPresetLocation.delete(
                    {
                        testPresetId: ogPreset.id,
                        locationId: locationId,
                        annotationSetId: annotationSetId
                    }
                )
            }
        }

        // create new active presets that are not part of ogActivePresets
        for (const preset of selectedPresets) {
            if (!ogActivePresets.current.some((p) => p.id === preset.value)) {
                await client.models.TestPresetLocation.create(
                    {
                        testPresetId: preset.value,
                        locationId: locationId,
                        annotationSetId: annotationSetId
                    }
                )
            }
        }

        // Below counts the annotations per category for this location

        const { data: location } = await client.models.Location.get({
            id: locationId,
            selectionSet: ['imageId', 'width', 'height', 'x', 'y'],
        });

        const rawAnnotations = await fetchAllPaginatedResults(client.models.Annotation.annotationsByImageIdAndSetId, {
            imageId: location!.imageId,
            setId: { eq: annotationSetId },
            selectionSet: ['categoryId', 'x', 'y'],
        });

        const selectedPresetCategories: {categoryId: string}[] = [];
        for (const preset of selectedPresets) {
            const { data: categories } = await client.models.TestPresetCategory.categoriesByTestPresetId({
                testPresetId: preset.value,
                selectionSet: ['categoryId'],
            });
            selectedPresetCategories.push(...categories);
        }

        const annotations = rawAnnotations.filter((a) => selectedPresetCategories.some((spc) => spc.categoryId === a.categoryId));

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
                locationId: locationId,
                categoryId: categoryId,
                annotationSetId: annotationSetId,
            });

            if (locationAnnotationCount) {
                await client.models.LocationAnnotationCount.update({
                    locationId: locationId,
                    categoryId: categoryId,
                    annotationSetId: annotationSetId,
                    count: count,
                });
            } else {
                await client.models.LocationAnnotationCount.create({
                    locationId: locationId,
                    categoryId: categoryId,
                    annotationSetId: annotationSetId,
                    count: count,
                });
            }
        }
    }

    return (
        <Modal show={show} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Configure tests for this location</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group>
                        <Form.Label>Presets that use this location</Form.Label>
                        <Select 
                            value={selectedPresets}
                            options={presets.map((p) => ({label: p.name, value: p.id}))}
                            onChange={setSelectedPresets}
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
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={handleSubmit}>
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
    )
}