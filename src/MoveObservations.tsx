import { useState, useContext, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import { ManagementContext, GlobalContext, ProjectContext } from './Context';
import { fetchAllPaginatedResults } from "./utils";
import { useUpdateProgress } from './useUpdateProgress';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import { LocationSetDropdown } from './LocationSetDropDown';

type MoveObservationsProps = {
    show: boolean;
    handleClose: () => void;
    selectedAnnotationSets: string[];
    setSelectedAnnotationSets: (sets: string[]) => void;
}

export default function MoveObservations({ show, handleClose, selectedAnnotationSets, setSelectedAnnotationSets }: MoveObservationsProps) {
    const { allUsers, annotationSetsHook: { data: annotationSets, create: createAnnotationSet } } = useContext(ManagementContext)!;
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!;
    
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
    const [existingAnnotationSetId, setExistingAnnotationSetId] = useState<string>(''); 
    const [filterByUser, setFilterByUser] = useState<boolean>(true);
    const [selectedLocationSets, setSelectedLocationSets] = useState<string[]>([]);
    const [moveToNewAnnotationSet, setMoveToNewAnnotationSet] = useState<boolean>(true);

    const handleMove = async () => {
        if (!moveToNewAnnotationSet && selectedAnnotationSets.includes(existingAnnotationSetId)) {
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

        try {
            // For every annotation set, find all observations that match the criteria and move them to the new annotation set.
            setObservationsFetched(0);
            setTotalObservationsFetched(0);
            const observations = await fetchAllPaginatedResults(client.models.Observation.observationsByAnnotationSetId, 
                {
                    annotationSetId: selectedAnnotationSets[0], 
                    selectionSet: ['id', 'location.setId'] as const,
                    filter: criteria
                },
                setObservationsFetched
            ); 

            setTotalObservationsFetched(observations.length);

            const filteredObservations = selectedLocationSets.length > 0 
                ? observations.filter(observation => selectedLocationSets.includes(observation.location?.setId || ''))
                : observations;

            if (!confirm(`Are you sure you want to move ${filteredObservations.length} observations${selectedLocationSets.length > 0 ? ` (filtered)` : ''}?`)) {
                return;
            }

            const previousAnnotationSetName = (annotationSets.find(set => set.id === selectedAnnotationSets[0])?.name || 'set').replace(/ /g, '_');
            const user = allUsers.find(user => user.id === selectedUserId)?.name;
            let targetAnnotationSetId = '';
            if (moveToNewAnnotationSet) {
                targetAnnotationSetId = createAnnotationSet(
                    { 
                        // name format: M(moved observation) - previous annotation set name - criteria
                        name: `M_${
                            previousAnnotationSetName.length <= 10
                                ? previousAnnotationSetName
                                : `${previousAnnotationSetName.slice(0, 5)}_${previousAnnotationSetName.slice(-4)}`
                        }_${
                            criteria.owner ? user : criteria.timeTaken ? observationTime : ''
                        }`, 
                        projectId: project.id 
                    }
                );
                
            } else {
                targetAnnotationSetId = existingAnnotationSetId;
            }

            // move observations to new/other annotation set
            setObservationsUpdated(0);
            setTotalObservationsUpdated(filteredObservations.length);

            const updateObservationQ = [];
            for (const observation of filteredObservations) {
                updateObservationQ.push(client.models.Observation.update({
                        id: observation.id,
                        annotationSetId: targetAnnotationSetId
                    })).then(() => {
                        setObservationsUpdated(prev => prev + 1);
                    });
            }

            await Promise.all(updateObservationQ);
        } catch (error) {
            console.error("Error moving observations:", error);
            alert("Error moving observations. (See console for details)");
        }
    };

    useEffect(() => {
        setSelectedUserId('');
        setObservationTime('');
        setExistingAnnotationSetId('');
        setSelectedLocationSets([]);
    }, [show]);

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>Move Observations</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <Form.Group controlId="formAnnotationSet">
                        <Form.Label>Select Annotation Set</Form.Label>
                        <AnnotationSetDropdown 
                            selectedSet={selectedAnnotationSets[0]} 
                            setAnnotationSet={(set) => setSelectedAnnotationSets([set])} 
                            canCreate={false}
                        />
                    </Form.Group>
                    <Form.Group controlId="formLocationSets">
                        <Form.Label>Select Location Sets (Tasks)</Form.Label>
                        <LocationSetDropdown 
                            selectedTasks={selectedLocationSets}
                            setTasks={setSelectedLocationSets}
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
                        <Form.Label style={{display: filterByUser ? 'block' : 'none'}}>Select User</Form.Label>
                        <Form.Control
                            as="select"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            disabled={!filterByUser}
                            hidden={!filterByUser}
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
                        <Form.Label style={{display: !filterByUser ? 'block' : 'none'}}>Maximum Observation Time (milliseconds)</Form.Label>
                        <Form.Control
                            type="number"
                            placeholder="Enter time taken"
                            value={observationTime}
                            onChange={(e) => setObservationTime(e.target.value === '' ? '' : Number(e.target.value) < 0 ? 0 : Number(e.target.value))}
                            disabled={filterByUser}
                            hidden={filterByUser}
                        />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Move to * annotation set</Form.Label>
                        <LabeledToggleSwitch
                            leftLabel="Existing"
                            rightLabel="New"
                            checked={moveToNewAnnotationSet}
                            onChange={(checked) => {
                                setMoveToNewAnnotationSet(checked);
                            }}
                        /> 
                    </Form.Group>
                    <Form.Group style={{display: !moveToNewAnnotationSet ? 'block' : 'none'}}>
                        <AnnotationSetDropdown 
                            selectedSet={existingAnnotationSetId} 
                            setAnnotationSet={setExistingAnnotationSetId} 
                            canCreate={false}
                        />
                    </Form.Group>
                </Form>
                <small style={{display: moveToNewAnnotationSet ? 'block' : 'none'}} className="text-muted">
                    Note: A new set will automatically be created with a unique name.
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
                        !selectedUserId && !observationTime || selectedAnnotationSets.length === 0 || (existingAnnotationSetId === '' && !moveToNewAnnotationSet)
                    }
                >
                    Move Observations
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
