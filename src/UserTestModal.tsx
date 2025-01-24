import { Button, Form, Modal } from "react-bootstrap";
import { useState, useEffect, useContext } from "react";
import { GlobalContext } from "./Context";
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";

type TestType = 'random' | 'interval' | 'none';

export default function UserTestModal({show, onClose, userId}: {show: boolean, onClose: () => void, userId: string}) {
    const [testInterval, setTestInterval] = useState<number>(0);
    const [enableTesting, setEnableTesting] = useState<boolean>(false);
    const [testType, setTestType] = useState<TestType>('none');
    const [testChance, setTestChance] = useState<number>(0);
    const [deadzone, setDeadzone] = useState<number>(0);

    const { client } = useContext(GlobalContext)!;

    useEffect(() => {
        const fetchTestConfig = async () => {
            const {data: [config]} = await client.models.UserTestConfig.testConfigByUserId({ userId: userId });

            if (!config || config.testType === 'none') {
                setEnableTesting(false);
                setTestType('none');
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
        };
        if (show) {
            fetchTestConfig();
        }
    }, [show]);

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

        onClose();

        const {data: [config]} = await client.models.UserTestConfig.testConfigByUserId({ userId: userId });

        if (config) {
            await client.models.UserTestConfig.update({
                id: config.id,
                testType: testType,
                random: testType === 'random' ? testChance : undefined,
                deadzone: testType === 'random' ? deadzone : undefined,
                interval: testType === 'interval' ? testInterval : undefined
            });
        } else {
            await client.models.UserTestConfig.create({
                userId: userId,
                testType: testType,
                random: testType === 'random' ? testChance : undefined,
                deadzone: testType === 'random' ? deadzone : undefined,
                interval: testType === 'interval' ? testInterval : undefined
            });
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
                            setTestType(e.target.checked ? 'interval' : 'none');
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
                        <Form.Group className="mb-3">
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
                        <Form.Group className="mb-3">
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
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save</Button>
            </Modal.Footer>
        </Modal>
    )
}