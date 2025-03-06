import MyTable from '../Table';
import { useState, useContext, useEffect, useRef } from 'react';
import Select from 'react-select';
import { TestingContext, GlobalContext } from '../Context';
import { Button } from 'react-bootstrap';
import { Settings2 } from 'lucide-react';
import ConfigModal from './ConfigModal';

interface Option {
  label: string;
  value: string;
}

export default function Surveys() {
  const {
    organizationProjects: surveys,
    organizationTestPresets: locationPools,
  } = useContext(TestingContext)!;
  const { client, modalToShow, showModal } = useContext(GlobalContext)!;

  const [selectedSurvey, setSelectedSurvey] = useState<Option | null>(null);
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

  const tableData = surveys.map((survey) => {
    return {
      id: survey.id,
      rowData: [
        survey.name,
        <Select
          className="text-black"
          isMulti
          value={selectedLocationPools[survey.id]}
          options={locationPools.map((pool) => ({
            label: pool.name,
            value: pool.id,
          }))}
          onChange={(e) => handlePoolsChange(survey.id, e)}
          styles={{
            valueContainer: (base) => ({
              ...base,
              minHeight: '48px',
              overflowY: 'auto',
            }),
          }}
        />,
        <Button
          variant="outline-info"
          className="w-100"
          onClick={() => {
            setSelectedSurvey({
              label: survey.name,
              value: survey.id,
            });
            showModal('configModal');
          }}
        >
          <Settings2 />
        </Button>,
      ],
    };
  });

  return (
    <div className="d-flex flex-column gap-2 mt-3 w-100">
      <h5 className="mb-0">Surveys</h5>
      <MyTable
        tableHeadings={[
          { content: 'Name', style: { width: '45%' }, sort: true },
          { content: 'Assigned Location Pools' },
          {
            content: 'Configuration',
            style: { width: '100px' },
          },
        ]}
        tableData={tableData}
        emptyMessage="No surveys found"
      />
      {selectedSurvey && (
        <ConfigModal
          show={modalToShow === 'configModal'}
          onClose={() => showModal(null)}
          survey={{ id: selectedSurvey.value, name: selectedSurvey.label }}
        />
      )}
    </div>
  );
}
