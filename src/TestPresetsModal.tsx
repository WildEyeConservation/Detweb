import { Button, Modal } from "react-bootstrap";
import { useContext, useState, useEffect, useRef } from "react";
import { GlobalContext, ProjectContext } from "./Context";
import LabeledToggleSwitch from "./LabeledToggleSwitch";
import { Form } from "react-bootstrap";
import Select from "react-select";
import { fetchAllPaginatedResults } from "./utils";

export default function TestPresetsModal({show, onClose}: {show: boolean, onClose: () => void}) {
    const [isNewPreset, setIsNewPreset] = useState(false);
    const [editName, setEditName] = useState(false);
    const [presetName, setPresetName] = useState("");
    const [selectedPreset, setSelectedPreset] = useState<{label: string, value: string} | null>(null);
    const [selectedCategories, setSelectedCategories] = useState<{label: string, value: string}[]>([]);
    const [annotationAccuracy, setAnnotationAccuracy] = useState(0);
    const [presets, setPresets] = useState<{name: string, id: string, accuracy: number}[]>([]);
    const { client } = useContext(GlobalContext)!;
    const { categoriesHook: { data: categories }, project } = useContext(ProjectContext)!;
    const ogDetails = useRef<{accuracy: number, categories: string[]} | null>(null);

    function resetState() {
        setSelectedCategories([]);
        setAnnotationAccuracy(0);
        setPresetName("");
        setSelectedPreset(null);
        setIsNewPreset(false);
        setEditName(false);
    }


    async function handleSubmit() {
        if (selectedCategories.length === 0 || 

            annotationAccuracy < 0 || 
            annotationAccuracy > 100 || 
            (isNewPreset && !presetName) ||
            (!isNewPreset && !selectedPreset) ||
            (!isNewPreset && editName && !presetName)

        ) {
            alert("Please fill in all fields");
            return;
        }

        onClose();

        if (isNewPreset) {
            const {data: newPreset} = await client.models.TestPreset.create(
                {
                    name: presetName,
                    projectId: project.id,
                    accuracy: annotationAccuracy,
                }
            );

            for (const category of selectedCategories) {
                await client.models.TestPresetCategory.create(
                    {
                        testPresetId: newPreset!.id,
                        categoryId: category.value,
                    }
                );
            }
        } else {
            await client.models.TestPreset.update(
                {
                    id: selectedPreset!.value,
                    name: presetName || selectedPreset!.label,
                    accuracy: annotationAccuracy,
                }
            )

            // delete categories that are not in selectedCategories
            for (const categoryId of ogDetails.current!.categories) {
                if (!selectedCategories.some((c) => c.value === categoryId)) {
                    await client.models.TestPresetCategory.delete(
                        {
                            testPresetId: selectedPreset!.value,
                            categoryId: categoryId,
                        }
                    )
                }
            }

            // add new categories that are not in ogDetails
            for (const category of selectedCategories) {
                if (!ogDetails.current!.categories.includes(category.value)) {
                    await client.models.TestPresetCategory.create(
                        {
                            testPresetId: selectedPreset!.value,
                            categoryId: category.value,
                        }
                    )
                }
            }
        }
    }

    async function deletePreset() {
        if (!selectedPreset) {
            alert("Please select a preset to delete");
            return;
        }

        if (window.confirm("Are you sure you want to delete this preset?")) {
            onClose();
            await client.models.TestPreset.delete(
                {
                    id: selectedPreset.value,
                }
            )

            for (const category of ogDetails.current!.categories) {
                await client.models.TestPresetCategory.delete(
                    {
                        testPresetId: selectedPreset.value,
                        categoryId: category,
                    }
                )
            }
        }
    }



    useEffect(() => {
        async function getPresets() {
            resetState();
            
            const allPresets = await fetchAllPaginatedResults(client.models.TestPreset.testPresetsByProjectId, {
                projectId: project.id,
                selectionSet: ['id', 'name', 'accuracy'],
            });

            setPresets(allPresets.map((p) => ({id: p.id, name: p.name, accuracy: p.accuracy})));
        }

        if (show) getPresets();

    }, [show]);

    useEffect(() => {
        async function getPresetDetails() {
            const activeCategories = await fetchAllPaginatedResults(client.models.TestPresetCategory.categoriesByTestPresetId, {
                testPresetId: selectedPreset!.value,
                selectionSet: ['categoryId'],
            });

            const annoAccuracy = presets.find((p) => p.id === selectedPreset!.value)!.accuracy;

            ogDetails.current = {
                accuracy: annoAccuracy,
                categories: activeCategories.map((c) => c.categoryId),
            };

            setAnnotationAccuracy(annoAccuracy);
            const allCategories = [{label: "All categories", value: "all"}, ...categories.map((c) => ({label: c.name, value: c.id}))];         
            setSelectedCategories(activeCategories.map((c) => ({label: allCategories.find((cat) => cat.value === c.categoryId)!.label, value: c.categoryId})));
        }



        if (selectedPreset) getPresetDetails();
    }, [selectedPreset]);

    return (
        <Modal show={show} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Edit test presets</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <LabeledToggleSwitch
                    leftLabel="Existing preset"
                    rightLabel="New preset"
                    checked={isNewPreset}
                    onChange={(checked) => {
                        resetState();
                        setIsNewPreset(checked);
                    }}
                />
                <Form.Group>
                    {!isNewPreset &&
                        <>
                            <span className="d-flex justify-content-between">
                                <Form.Label>Preset</Form.Label>
                                <Form.Switch
                                    checked={editName}
                                    onChange={(e) => {
                                        setEditName(e.target.checked);
                                        setPresetName(selectedPreset ? presets.find((p) => p.id === selectedPreset!.value)!.name : "");
                                    }}
                                    label="Edit name"
                                />


                            </span>
                            <Select 
                                options={presets?.map(q => ({ label: q.name, value: q.id })).sort((a, b) => a.label.localeCompare(b.label))}
                                value={selectedPreset}
                                onChange={setSelectedPreset}
                                styles={{
                                    valueContainer: (base) => ({
                                        ...base,
                                        minHeight: '48px',
                                        overflowY: 'auto',
                                    }),
                                }}
                            />
                        </>
                    }
                    {(isNewPreset || editName) && 
                        <>
                            <Form.Label className={!isNewPreset ? "mt-2" : ""}>{isNewPreset ? "Preset name" : "New name"}</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                            />
                        </>
                    }
                </Form.Group>
                <Form.Group className="mt-2">
                    <Form.Label>Categories</Form.Label>
                    <Select 
                        value={selectedCategories}
                        options={[{ label: "All categories", value: "all" }, ...categories?.map(q => ({ label: q.name, value: q.id }))]}
                        isMulti
                        onChange={setSelectedCategories}
                        styles={{
                            valueContainer: (base) => ({
                                ...base,
                                minHeight: '48px',
                                overflowY: 'auto',
                            }),
                        }}
                    />
                </Form.Group>
                <Form.Group className="mt-2">
                    <Form.Label>Annotation accuracy (%)</Form.Label>
                    <Form.Control 
                        type="number" 
                        value={annotationAccuracy}
                        onChange={(e) => setAnnotationAccuracy(e.target.value)}
                        min={0}
                        max={100}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                {!isNewPreset &&
                    <Button 
                        variant="danger" 
                        onClick={() => {
                            deletePreset();
                    }}
                >
                        Delete
                    </Button>
                }
                <Button 
                    variant="primary" 
                    onClick={() => {
                        handleSubmit();
                    }}
                >
                    {isNewPreset ? "Create" : "Save"}
                </Button>
            </Modal.Footer>
        </Modal>
    )
}