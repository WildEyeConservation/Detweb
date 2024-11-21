import { useState, useContext, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import { ManagementContext, GlobalContext } from './Context';
import { MultiAnnotationSetDropdown } from './MultiAnnotationSetDropDown';
import { fetchAllPaginatedResults } from "./utils";
import { useUpdateProgress } from './useUpdateProgress';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import { MultiLocationSetDropdown } from './MultiLocationSetDropdown';

type MoveObservationsProps = {
    show: boolean;
    handleClose: () => void;
    selectedAnnotationSets: string[];
    setSelectedAnnotationSets: (sets: string[]) => void;
}

export default function MoveObservations({ show, handleClose, selectedAnnotationSets, setSelectedAnnotationSets }: MoveObservationsProps) {
    const { allUsers, locationSetsHook: { data: locationSets } } = useContext(ManagementContext)!;
    const { client } = useContext(GlobalContext)!;

    const [setObservationsFetched, setTotalObservationsFetched] = useUpdateProgress({
        taskId: `Fetching observations`,
        indeterminateTaskName: `Fetching observations`,
        determinateTaskName: "Fetching observations",
        stepFormatter: (count)=>`${count} observations`,
    });

    const [setObservationsUpdated, setTotalObservationsUpdated] = useUpdateProgress({
        taskId: `Updating observations`,
        indeterminateTaskName: `Updating observations`,
        determinateTaskName: "Updating observations",
        stepFormatter: (count)=>`${count} observations`,
    });

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [observationTime, setObservationTime] = useState<number | ''>('');
    const [newAnnotationSetId, setNewAnnotationSetId] = useState<string>(''); 
    const [filterByUser, setFilterByUser] = useState<boolean>(true);
    const [selectedLocationSets, setSelectedLocationSets] = useState<string[]>([]);

    const handleMove = async () => {
        if (selectedAnnotationSets.includes(newAnnotationSetId)) {
            alert("Cannot move observations to the same annotation set");
            return;
        }
        
        const criteria: {
            owner?: { contains: string };
            timeTaken?: { le: number };
        } = {};
    
        if (selectedUserId) {
            criteria.owner = { contains: selectedUserId };
        }
        
        if (observationTime) {
            criteria.timeTaken = { le: observationTime };
        }

        // For every annotation set, find all observations that match the criteria and move them to the new annotation set.
        for (const setId of selectedAnnotationSets) {
            setObservationsFetched(0);
            setTotalObservationsFetched(0);
            const observations = await fetchAllPaginatedResults(client.models.Observation.observationsByAnnotationSetId, 
                {
                    annotationSetId: setId, 
                    selectionSet: ['id', 'location.setId'] as const,
                    filter: criteria
                },
                setObservationsFetched
            ); 

            // filter observations to those that are in the selected location sets
            const filteredObservations = observations.filter(observation => selectedLocationSets.includes(observation.location.setId));

            setTotalObservationsFetched(filteredObservations.length);

            // move observations to new/other annotation set
            setObservationsUpdated(0);
            setTotalObservationsUpdated(filteredObservations.length);
            for (const observation of filteredObservations) {
                await client.models.Observation.update({
                    id: observation.id,
                    annotationSetId: newAnnotationSetId
                });

                setObservationsUpdated(prev => prev + 1);
            }
        }
    };

    useEffect(() => {
        setSelectedUserId('');
        setObservationTime('');
        setNewAnnotationSetId('');
        setSelectedLocationSets([]);
    }, [show]);

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>Move Observations</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <Form.Group controlId="formAnnotationSets">
                        <Form.Label>Select Annotation Sets</Form.Label>
                        <MultiAnnotationSetDropdown
                            selectedSets={selectedAnnotationSets}
                            setAnnotationSets={setSelectedAnnotationSets}
                        />
                    </Form.Group>
                    <Form.Group controlId="formLocationSets">
                        <Form.Label>Select Location Sets (Tasks)</Form.Label>
                        <MultiLocationSetDropdown
                            selectedSets={selectedLocationSets}
                            setLocationSets={setSelectedLocationSets}
                        />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Filter by</Form.Label>
                        <LabeledToggleSwitch
                            leftLabel="User"
                            rightLabel="Time"
                            checked={!filterByUser}
                            onChange={(checked) => {
                                setFilterByUser(!checked);
                            }}
                        /> 
                    </Form.Group>
                    <Form.Group controlId="formUser">
                        <Form.Label>Select User</Form.Label>
                        <Form.Control
                            as="select"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            disabled={!filterByUser}
                        >
                            <option value="">Choose...</option>
                            {allUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.name}
                                </option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group controlId="formTime">
                        <Form.Label>Maximum Observation Time (milliseconds)</Form.Label>
                        <Form.Control
                            type="number"
                            placeholder="Enter time taken"
                            value={observationTime}
                            onChange={(e) => setObservationTime(e.target.value === '' ? '' : Number(e.target.value) < 0 ? 0 : Number(e.target.value))}
                            disabled={filterByUser}
                        />
                    </Form.Group>
                    <Form.Group>
                    <Form.Label>Move to Annotation Set</Form.Label>
                        <AnnotationSetDropdown 
                            selectedSet={newAnnotationSetId} 
                            setAnnotationSet={setNewAnnotationSetId} 
                        />
                    </Form.Group>
                </Form>
                <small className="text-muted">
                    Note: Provide either a user or observation time to filter observations.
                </small>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {handleClose(); handleMove();}}
                    disabled={
                        !selectedUserId && !observationTime || selectedAnnotationSets.length === 0 || newAnnotationSetId === ''
                    }
                >
                    Move Observations
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
