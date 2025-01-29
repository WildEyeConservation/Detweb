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

export default function TestLocationModal({show, onClose, locationId}: {show: boolean, onClose: () => void, locationId: string}) {
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
    const [annotationCount, setAnnotationCount] = useState<number>(0);
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

            const {data: location} = await client.models.Location.get({
                id: locationId,
                selectionSet: ['annotationCount']
            })

            if (location?.annotationCount) {
                setAnnotationCount(location.annotationCount);
            }

            ogActivePresets.current = activePresets.map((p) => ({id: p.testPresetId}));

            setPresets(allPresets.map((p) => ({id: p.id, name: p.name, active: activePresets.some((ap) => ap.testPresetId === p.id)})));
        }

        if (show) getPresets();
    }, [show])


    async function handleSubmit() {
        onClose();

        await client.models.Location.update({
            id: locationId,
            annotationCount: annotationCount
        })

        // delete all inactive presets that were part of ogActivePresets
        for (const ogPreset of ogActivePresets.current) {
            if (!selectedPresets.includes(ogPreset.id)) {
                await client.models.TestPresetLocation.delete(
                    {
                        testPresetId: ogPreset.id,
                        locationId: locationId,
                    }
                )
            }
        }

        // create new active presets that are not part of ogActivePresets
        for (const presetId of selectedPresets) {
            if (!ogActivePresets.current.some((p) => p.id === presetId)) {
                await client.models.TestPresetLocation.create(
                    {
                        testPresetId: presetId,
                        locationId: locationId,
                    }
                )
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
                    <Form.Group>
                        <Form.Label>Annotation count</Form.Label>
                        <Form.Control 
                            type="number" 
                            value={annotationCount} 
                            onChange={(e) => setAnnotationCount(e.target.value)} 
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