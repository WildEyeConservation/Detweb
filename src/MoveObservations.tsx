import { useState, useContext, useEffect, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import { GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import { useUpdateProgress } from './useUpdateProgress';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import { useUsers } from './apiInterface';
import { Schema } from './amplify/client-schema';
import Select from 'react-select';

type MoveObservationsProps = {
  annotationSetId: string;
  project: Schema['Project']['type'];
  setHandleMove: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
};

export default function MoveObservations({
  annotationSetId,
  project,
  setHandleMove,
}: MoveObservationsProps) {
  const { users: allUsers } = useUsers();
  const { client } = useContext(GlobalContext)!;

  const [setObservationsFetched, setTotalObservationsFetched] =
    useUpdateProgress({
      taskId: `Fetching observations`,
      indeterminateTaskName: `Fetching observations`,
      determinateTaskName: 'Fetching observations',
      stepFormatter: (count) => `${count} observations`,
    });

  const [setObservationsUpdated, setTotalObservationsUpdated] =
    useUpdateProgress({
      taskId: `Updating observations`,
      indeterminateTaskName: `Updating observations`,
      determinateTaskName: 'Updating observations',
      stepFormatter: (count) => `${count} observations`,
    });

  const [selectedUser, setSelectedUser] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [observationTime, setObservationTime] = useState<number | ''>('');
  const [existingAnnotationSet, setExistingAnnotationSet] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [filterByUser, setFilterByUser] = useState<boolean>(true);
  const [selectedLocationSets, setSelectedLocationSets] = useState<
    {
      value: string;
      label: string;
    }[]
  >([]);
  const [moveToNewAnnotationSet, setMoveToNewAnnotationSet] =
    useState<boolean>(true);

  const handleMove = useCallback(async () => {
    const existingAnnotationSetId = existingAnnotationSet?.value;
    const selectedUserId = selectedUser?.value;

    if (
      !moveToNewAnnotationSet &&
      existingAnnotationSetId === annotationSetId
    ) {
      alert('Cannot move observations to the same annotation set');
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
      const observations = await fetchAllPaginatedResults(
        client.models.Observation.observationsByAnnotationSetId,
        {
          annotationSetId,
          selectionSet: ['id', 'location.setId'] as const,
          filter: criteria,
        },
        setObservationsFetched
      );

      setTotalObservationsFetched(observations.length);

      const setIds = selectedLocationSets.map((set) => set.value);
      const filteredObservations =
        setIds.length > 0
          ? observations.filter((observation) =>
              setIds.includes(observation.location?.setId || '')
            )
          : observations;

      if (
        !confirm(
          `Are you sure you want to move ${
            filteredObservations.length
          } observations${setIds.length > 0 ? ` (filtered)` : ''}?`
        )
      ) {
        return;
      }

      const previousAnnotationSetName = (
        project.annotationSets.find((set) => set.id === annotationSetId)
          ?.name || 'set'
      ).replace(/ /g, '_');
      const user = allUsers.find((user) => user.id === selectedUserId)?.name;
      let targetAnnotationSetId = '';
      if (moveToNewAnnotationSet) {
        const { data: result } = await client.models.AnnotationSet.create({
          // name format: M(moved observation) - previous annotation set name - criteria
          name: `M_${
            previousAnnotationSetName.length <= 10
              ? previousAnnotationSetName
              : `${previousAnnotationSetName.slice(
                  0,
                  5
                )}_${previousAnnotationSetName.slice(-4)}`
          }_${
            criteria.owner ? user : criteria.timeTaken ? observationTime : ''
          }`,
          projectId: project.id,
          group: project.organizationId,
        });
        targetAnnotationSetId = result?.id;
      } else {
        targetAnnotationSetId = existingAnnotationSetId;
      }

      // move observations to new/other annotation set
      setObservationsUpdated(0);
      setTotalObservationsUpdated(filteredObservations.length);

      const updateObservationQ = [];
      for (const observation of filteredObservations) {
        updateObservationQ.push(
          client.models.Observation.update({
            id: observation.id,
            annotationSetId: targetAnnotationSetId,
          }).then(() => {
            setObservationsUpdated((prev) => prev + 1);
          })
        );
      }

      await Promise.all(updateObservationQ);
    } catch (error) {
      console.error('Error moving observations:', error);
      alert('Error moving observations. (See console for details)');
    }
  }, [
    allUsers,
    client,
    annotationSetId,
    project,
    selectedUser,
    observationTime,
    existingAnnotationSet,
    moveToNewAnnotationSet,
    selectedLocationSets,
  ]);

  // register the handleMove function to be called by the parent
  useEffect(() => {
    setHandleMove(() => handleMove);
  }, [handleMove]);

  return (
    <div className='d-flex flex-column gap-3'>
      <Form.Group controlId='formLocationSets'>
        <Form.Label>Select Location Sets (Tasks)</Form.Label>
        <Select
          className='text-black'
          options={project.locationSets.map((set) => ({
            value: set.id,
            label: set.name,
          }))}
          isMulti
          value={selectedLocationSets}
          onChange={(options) => setSelectedLocationSets(options.map((o) => o))}
        />
      </Form.Group>
      <Form.Group>
        <LabeledToggleSwitch
          className='m-0'
          leftLabel='Filter by User'
          rightLabel='Filter by Time'
          checked={!filterByUser}
          onChange={(checked) => {
            setFilterByUser(!checked);
          }}
        />
      </Form.Group>
      {filterByUser ? (
        <Form.Group controlId='formUser'>
          <Form.Label style={{ display: filterByUser ? 'block' : 'none' }}>
            Select User
          </Form.Label>
          <Select
            className='text-black'
            value={selectedUser}
            onChange={(option) => setSelectedUser(option)}
            options={allUsers.map((user) => ({
              value: user.id,
              label: user.name,
            }))}
            isDisabled={!filterByUser}
            isClearable
            placeholder='Choose...'
          />
        </Form.Group>
      ) : (
        <Form.Group controlId='formTime'>
          <Form.Label style={{ display: !filterByUser ? 'block' : 'none' }}>
            Maximum Observation Time (milliseconds)
          </Form.Label>
          <Form.Control
            type='number'
            placeholder='Enter time taken'
            value={observationTime}
            onChange={(e) =>
              setObservationTime(
                e.target.value === ''
                  ? ''
                  : Number(e.target.value) < 0
                  ? 0
                  : Number(e.target.value)
              )
            }
            disabled={filterByUser}
          />
        </Form.Group>
      )}

      <Form.Group>
        <LabeledToggleSwitch
          className='m-0'
          leftLabel='Existing Annotation Set'
          rightLabel='New Annotation Set'
          checked={moveToNewAnnotationSet}
          onChange={(checked) => {
            setMoveToNewAnnotationSet(checked);
          }}
        />
      </Form.Group>
      <Form.Group
        style={{ display: !moveToNewAnnotationSet ? 'block' : 'none' }}
      >
        <Select
          className='text-black'
          options={project.annotationSets.map((set) => ({
            value: set.id,
            label: set.name,
          }))}
          value={existingAnnotationSet}
          onChange={(option) => setExistingAnnotationSet(option)}
        />
      </Form.Group>
    </div>
  );
}
