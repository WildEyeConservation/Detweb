import { Button, Form, Modal } from "react-bootstrap";
import { useState, useEffect, useContext, useRef } from "react";
import { GlobalContext, ProjectContext } from "./Context";
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Select from "react-select";
import { fetchAllPaginatedResults } from "./utils";

type TestType = 'random' | 'interval';

export default function ConfigureUserTestModal({show, onClose, userId}: {show: boolean, onClose: () => void, userId: string}) {
    const [testInterval, setTestInterval] = useState<number>(0);
    const [enableTesting, setEnableTesting] = useState<boolean>(false);
    const [testType, setTestType] = useState<TestType>('interval');
    const [testChance, setTestChance] = useState<number>(0);
    const [deadzone, setDeadzone] = useState<number>(0);
    const [confirmation, setConfirmation] = useState<boolean>(false);
    const [selectedPresets, setSelectedPresets] = useState<{label: string, value: string}[]>([]);
    const [presets, setPresets] = useState<{label: string, value: string}[]>([]);
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!;
    const ogConfig = useRef<{id: string | null, presets: {label: string, value: string}[]} | null>(null);

    useEffect(() => {
        const fetchTestConfig = async () => {
            const {data: configs} = await client.models.UserTestConfig.testConfigByUserId({ userId: userId });

            const config = configs.find((c) => c.projectId === project.id);

            if (!config) {
                setEnableTesting(false);
                ogConfig.current = {id: null, presets: []};
                return;
            }


            setEnableTesting(true);
            setTestType(config.testType as TestType);

            if (config.testType === 'interval') {
                setTestInterval(config.interval!);
            } else {
                setTestChance(config.random!);
                setDeadzone(config.deadzone!);
            }

            setConfirmation(config.postTestConfirmation!);

            const assignedPresets = await fetchAllPaginatedResults(client.models.TestPresetUser.testPresetsByUserConfigId,
                {
                    userConfigId: config.id,
                    selectionSet: ['testPresetId'],
                }
            );

            ogConfig.current = {
                id: config.id,
                presets: assignedPresets.map((ap) => 
                    (
                        {

                            label: presets.find((p) => p.value === ap.testPresetId)!.label,
                            value: ap.testPresetId
                        }
                    )
                )
            }
            setSelectedPresets(ogConfig.current.presets);
        };
        if (show) {
            setEnableTesting(false);
            setTestInterval(0);
            setSelectedPresets([]);
            setEnableTesting(false);
            setDeadzone(0);
            setTestChance(0);
            setConfirmation(false);

            fetchTestConfig();
        }
    }, [show]);

    useEffect(() => {
        async function getPresets() {
            const allPresets = await fetchAllPaginatedResults(client.models.TestPreset.testPresetsByProjectId, {
                projectId: project.id,
                selectionSet: ['id', 'name'],
            });

            setPresets(allPresets.map((p) => ({label: p.name, value: p.id})));
        }

        getPresets();
    }, []);   

    async function handleSave() {
        if (testType === 'interval' && testInterval <= 0) {

            alert("Test interval must be greater than 0");
            return;
        }

        if (testType === 'random') {
            if (testChance < 0 || testChance > 100) {
                alert("Test chance must be between 0 and 100");
                return;
            }
            if (deadzone <= 0) {
                alert("Deadzone must be greater than 0");
                return;
            }
        }

        if (enableTesting && selectedPresets.length === 0) {
            alert("Please select at least one preset");
            return;
        }

        onClose();

        if (ogConfig.current?.id) {
            if (!enableTesting) {
                await client.models.UserTestConfig.delete({
                    id: ogConfig.current.id
                });

                for (const preset of ogConfig.current.presets) {
                    await client.models.TestPresetUser.delete({
                        testPresetId: preset.value,
                        userConfigId: ogConfig.current.id
                    });
                }
                return;
            }

            await client.models.UserTestConfig.update({
                id: ogConfig.current.id,
                testType: testType,
                random: testType === 'random' ? testChance : undefined,
                deadzone: testType === 'random' ? deadzone : undefined,
                interval: testType === 'interval' ? testInterval : undefined,
                postTestConfirmation: confirmation,
            });

            // delete all test preset user that are not in ogPresets
            for (const preset of ogConfig.current!.presets) {
                if (!selectedPresets.some((p) => p.value === preset.value)) {
                    await client.models.TestPresetUser.delete({
                        testPresetId: preset.value,
                        userConfigId: ogConfig.current.id
                    });
                }
            }

            //create test preset user for all selectedPresets that are not in ogPresets
            for (const preset of selectedPresets) {
                if (!ogConfig.current!.presets.some((p) => p.value === preset.value)) {
                    await client.models.TestPresetUser.create({
                        testPresetId: preset.value,
                        userConfigId: ogConfig.current.id
                    });
                }
            }

        } else {
            const {data: utc} = await client.models.UserTestConfig.create({
                userId: userId,
                projectId: project.id,
                testType: testType,
                random: testType === 'random' ? testChance : undefined,
                deadzone: testType === 'random' ? deadzone : undefined,
                interval: testType === 'interval' ? testInterval : undefined,
                postTestConfirmation: confirmation,
            });

            if (!utc) {
                alert("Failed to create user test config");
                return;
            }

            for (const preset of selectedPresets) {
                await client.models.TestPresetUser.create({
                    testPresetId: preset.value,
                    userConfigId: utc.id
                });
            }
        }
    }

    return (
        <Modal show={show} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Configure User Tests</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className="mb-2">
                        <Form.Switch id="enableTesting" label="Enable testing" checked={enableTesting} onChange={(e) => {
                            setEnableTesting(e.target.checked);
                        }} />
                        {enableTesting && (
                            <>
                                <Form.Label>Test type</Form.Label>
                                <Form.Select value={testType} onChange={(e) => setTestType(e.target.value as 'random' | 'interval')}>
                                    <option value="random">Random</option>
                                    <option value="interval">Interval</option>
                                </Form.Select>
                            </>
                        )}
                    </Form.Group>
                    {enableTesting && testType === 'interval' && (
                        <Form.Group className="mb-2">
                            <OverlayTrigger
                                placement="right-end"
                                overlay={
                                <Tooltip>
                                    User will be tested if they haven't consecutively annotated in the amount
                                    of jobs specified. <br/> Note: Navigating to and annotating a previous job will
                                    not reset the counter.
                                </Tooltip>
                                }
                                trigger={['hover', 'focus']}
                            >
                                <Form.Label>Test after * unannotated jobs</Form.Label>
                            </OverlayTrigger>
                            <Form.Control type="number" value={testInterval} onChange={(e) => setTestInterval(parseInt(e.target.value || '0'))} min={1} />
                        </Form.Group>
                    )}
                    {enableTesting && testType === 'random' && (
                        <Form.Group className="mb-2">
                            <OverlayTrigger
                                placement="right-end"
                                overlay={
                                <Tooltip>
                                    After the amount of jobs specified in deadzone, each of the following jobs will
                                    have the specified probability of being a test.
                                </Tooltip>
                                }
                                trigger={['hover', 'focus']}
                            >
                                <Form.Label>Deadzone</Form.Label>                         
                            </OverlayTrigger>
                            <Form.Control type="number" value={deadzone} onChange={(e) => setDeadzone(parseInt(e.target.value || '0'))} min={0} className="mb-2"/>
                            <Form.Label>Test probability (%)</Form.Label>
                            <Form.Control type="number" value={testChance} onChange={(e) => setTestChance(parseInt(e.target.value || '0'))} min={0} max={100} />
                        </Form.Group>
                    )}
                    {enableTesting && 
                        <>
                            <Form.Label>Presets</Form.Label>
                            <Select 
                                value={selectedPresets}
                                options={presets.sort((a, b) => a.label.localeCompare(b.label))}
                                isMulti
                                onChange={setSelectedPresets}
                                styles={{
                                    valueContainer: (base) => ({
                                        ...base,
                                        minHeight: '48px',
                                        overflowY: 'auto',
                                    }),
                                }}
                            />
                            <Form.Switch className="mt-3" id="enableConfirmation" label="Enable post test result confirmation" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)} />
                        </>     
                    }
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save</Button>
            </Modal.Footer>
        </Modal>
    )
}