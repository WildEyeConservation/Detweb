import MyTable from '../Table';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { useTestingProjects, useTestingPresets } from '../data/testing';
import { client } from '../stores/appClient';
import { useDialogRoute } from '../routing/useDialogRoute';
import DialogNotice from '../routing/DialogNotice';
import { Button } from 'react-bootstrap';
import { Plus, Settings2, Eye } from 'lucide-react';
const ConfigModal = lazy(() => import('./ConfigModal'));
const EditLocationsModal = lazy(() => import('./EditLocationsModal'));
const AddLocationsModal = lazy(() => import('./AddLocationsModal'));

interface Option {
  label: string;
  value: string;
}

export default function Surveys({
  organizationId,
}: {
  organizationId: string;
}) {
  const surveys = useTestingProjects(organizationId);
  const locationPools = useTestingPresets(organizationId);
  const dialog = useDialogRoute();
  const modalToShow = dialog.name;

  const selectedSurvey = surveys.find(
    (survey) => survey.id === dialog.get('survey')
  );
  const selectedPreset = locationPools.find(
    (pool) => pool.id === dialog.get('preset')
  );
  const knownDialog = [
    'addLocationsToPoolModal',
    'editLocationPoolModal',
    'configModal',
  ].includes(modalToShow ?? '');
  const [selectedLocationPools, setSelectedLocationPools] = useState<{
    [surveyId: string]: Option[];
  }>({});
  const originalSelectedLocationPools = useRef<{
    [surveyId: string]: Option[];
  }>({});

  async function handlePoolsChange(surveyId: string, pools: Option[]) {
    setSelectedLocationPools((prev) => ({
      ...prev,
      [surveyId]: pools,
    }));

    await Promise.all([
      ...originalSelectedLocationPools.current[surveyId]
        .filter((pool) => !pools.some((p) => p.value === pool.value))
        .map((pool) =>
          client.models.TestPresetProject.delete({
            testPresetId: pool.value,
            projectId: surveyId,
          })
        ),
      ...pools
        .filter(
          (pool) =>
            !originalSelectedLocationPools.current[surveyId].some(
              (p) => p.value === pool.value
            )
        )
        .map((pool) =>
          client.models.TestPresetProject.create({
            testPresetId: pool.value,
            projectId: surveyId,
            group: organizationId,
          })
        ),
    ]);

    originalSelectedLocationPools.current[surveyId] = pools;
  }

  useEffect(() => {
    async function getSelectedLocationPools() {
      if (locationPools.length === 0) return;

      await Promise.all(
        surveys.map(async (survey) => {
          if (survey.hidden) return;
          const { data: selectedLocationPools } =
            await client.models.TestPresetProject.testPresetsByProjectId({
              projectId: survey.id,
            });

          setSelectedLocationPools((prev) => {
            originalSelectedLocationPools.current = {
              ...prev,
              [survey.id]: selectedLocationPools.map((pool) => ({
                label: locationPools.find((p) => p.id === pool.testPresetId)!
                  .name,
                value: pool.testPresetId,
              })),
            };
            return originalSelectedLocationPools.current;
          });
        })
      );
    }

    getSelectedLocationPools();
  }, [surveys, locationPools]);

  const tableData = surveys
    .filter((survey) => !survey.hidden)
    .map((survey) => {
      const isDisabled = [
        'addLocationsToPoolModal',
        'editLocationPoolModal',
        'configModal',
      ].includes(modalToShow || '');

      return {
        id: survey.id,
        rowData: [
          survey.name,
          <Select
            className='text-black'
            isMulti
            value={selectedLocationPools[survey.id]}
            options={locationPools.map((pool) => ({
              label: pool.name,
              value: pool.id,
            }))}
            onChange={(e) => handlePoolsChange(survey.id, e as Option[])}
          />,
          <Button
            variant='success'
            className='w-100'
            onClick={() => {
              dialog.open('addLocationsToPoolModal', {
                survey: survey.id,
                preset: locationPools.find((pool) => pool.name === survey.name)
                  ?.id,
              });
            }}
            disabled={isDisabled}
          >
            <Plus />
          </Button>,
          <Button
            variant='info'
            className='w-100'
            onClick={() => {
              dialog.open('editLocationPoolModal', {
                survey: survey.id,
                preset: locationPools.find((pool) => pool.name === survey.name)
                  ?.id,
              });
            }}
            disabled={isDisabled}
          >
            <Eye />
          </Button>,
          <Button
            variant='primary'
            className='w-100'
            onClick={() => {
              dialog.open('configModal', {
                survey: survey.id,
                preset: locationPools.find((pool) => pool.name === survey.name)
                  ?.id,
              });
            }}
            disabled={isDisabled}
          >
            <Settings2 />
          </Button>,
        ],
      };
    });

  return (
    <div className='d-flex flex-column gap-2 mt-3 w-100'>
      <h5 className='mb-0'>Surveys</h5>
      <MyTable
        tableHeadings={[
          { content: 'Name', style: { width: '40%' }, sort: true },
          { content: 'Assigned Location Pools' },
          { content: 'Add Locations', style: { width: '120px' } },
          { content: 'Edit Locations', style: { width: '120px' } },
          {
            content: 'Configuration',
            style: { width: '120px' },
          },
        ]}
        tableData={tableData}
        pagination={true}
        itemsPerPage={5}
        emptyMessage='No surveys found'
      />
      <Suspense
        key={`${dialog.name}:${dialog.get('survey')}:${dialog.get('preset')}`}
        fallback={
          <DialogNotice message='Loading dialog...' onClose={dialog.close} />
        }
      >
        {knownDialog && !selectedSurvey && (
          <DialogNotice
            message='Loading the survey, or it is no longer available in this organization.'
            onClose={dialog.close}
          />
        )}
        {modalToShow === 'configModal' && selectedSurvey && (
          <ConfigModal show survey={selectedSurvey} onClose={dialog.close} />
        )}
        {knownDialog &&
          modalToShow !== 'configModal' &&
          selectedSurvey &&
          !selectedPreset && (
            <DialogNotice
              message='The selected location pool is unavailable.'
              onClose={dialog.close}
            />
          )}
        {modalToShow === 'editLocationPoolModal' &&
          selectedSurvey &&
          selectedPreset && (
            <EditLocationsModal
              key={selectedSurvey.id + selectedPreset.id}
              show
              preset={selectedPreset}
              surveyId={selectedSurvey.id}
              organizationId={organizationId}
              onClose={dialog.close}
            />
          )}
        {modalToShow === 'addLocationsToPoolModal' &&
          selectedSurvey &&
          selectedPreset && (
            <AddLocationsModal
              key={selectedSurvey.id + selectedPreset.id}
              show
              preset={selectedPreset}
              surveyId={selectedSurvey.id}
              organizationId={organizationId}
              onClose={dialog.close}
            />
          )}
      </Suspense>
    </div>
  );
}
