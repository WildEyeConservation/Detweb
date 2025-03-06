import { Button } from 'react-bootstrap';
import { useContext, useState, useEffect } from 'react';
import { GlobalContext, TestingContext, UserContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import MyTable from '../Table';
import { BarChart } from '@mui/x-charts/BarChart';
import { Tab, Tabs } from '../Tabs';
import exportFromJSON from 'export-from-json';
import { useUpdateProgress } from '../useUpdateProgress';
import { Schema } from '../../amplify/data/resource';
import { useUsers } from '../apiInterface';
import Select from 'react-select';

export default function Results() {
  const { client } = useContext(GlobalContext)!;
  const { organizationMembershipsHook } = useContext(TestingContext)!;
  const { myMembershipHook, myOrganizationHook } = useContext(UserContext)!;
  const { users: allUsers } = useUsers();
  const [results, setResults] = useState<Schema['TestResult']['type'][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [projects, setProjects] = useState<
    {
      id: string;
      name: string;
      annotationSets: { id: string; name: string }[];
      organization: { name: string };
    }[]
  >([]);
  const [selectedProject, setSelectedProject] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState<{
    label: string;
    value: string;
  } | null>(null);

  const [setCompilingFiles, setTotalFilesCompiled] = useUpdateProgress({
    taskId: `Compiling files`,
    indeterminateTaskName: `Compiling files`,
    determinateTaskName: 'Compiling files',
    stepFormatter: (count) => `${count} files`,
  });

  useEffect(() => {
    async function setup() {
      setIsLoading(true);

      const results = await fetchAllPaginatedResults(
        client.models.TestResult.testResultsByUserId,
        {
          userId: selectedUser?.value,
          selectionSet: [
            'id',
            'projectId',
            'testPreset.name',
            'testAnimals',
            'totalMissedAnimals',
            'passedOnCategories',
            'passedOnTotal',
            'createdAt',
            'categoryCounts.categoryId',
            'categoryCounts.userCount',
            'categoryCounts.testCount',
            'categoryCounts.category.name',
          ],
        }
      );

      setResults(
        results
          .filter((result) => result.projectId === selectedProject?.value)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      );

      setIsLoading(false);
    }
    if (!isPurging && selectedUser) setup();
  }, [isPurging, selectedUser]);

  useEffect(() => {
    async function loadProjects() {
      const userProjects = [
        ...new Set(myMembershipHook.data?.map((m) => m.projectId) || []),
      ];

      const projectPromises = userProjects.map((projectId) =>
        client.models.Project.get(
          { id: projectId },
          {
            selectionSet: [
              'id',
              'name',
              'annotationSets.id',
              'annotationSets.name',
              'organization.name',
            ],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      const validProjects = projectResults
        .map((result) => result.data)
        .filter(
          (project): project is NonNullable<typeof project> => project !== null
        );

      setProjects(validProjects);
    }

    loadProjects();
  }, [myOrganizationHook.data]);

  const headings = [
    { content: 'Date', sort: true },
    { content: 'Preset', sort: true },
    { content: 'Test Animals', sort: true },
    { content: 'Missed Animals', sort: true },
    { content: 'Passed on Labels', sort: true },
    { content: 'Passed on Total', sort: true },
  ];

  const tableData = results.map((result) => {
    const date = new Date(result.createdAt).toISOString().split('T');
    return {
      id: result.id,
      rowData: [
        `${date[0].replace(/-/g, '/')} - ${date[1].substring(0, 8)}`,
        result.testPreset.name,
        result.testAnimals,
        result.totalMissedAnimals,
        result.passedOnCategories ? 'Yes' : 'No',
        result.passedOnTotal ? 'Yes' : 'No',
      ],
    };
  });

  const passed = results.filter((result) => result.passedOnCategories).length;
  const failed = results.length - passed;
  const totalAnimals = results.reduce(
    (acc, result) => acc + result.testAnimals,
    0
  );

  // Calculate Undercounted and Overcounted Animals
  const undercountedAnimals = results.reduce(
    (acc, result) =>
      acc + (result.totalMissedAnimals > 0 ? result.totalMissedAnimals : 0),
    0
  );
  const overcountedAnimals = results.reduce(
    (acc, result) =>
      acc +
      (result.totalMissedAnimals < 0 ? Math.abs(result.totalMissedAnimals) : 0),
    0
  );

  const countsByCategory = results
    .flatMap((result) => result.categoryCounts)
    .reduce((acc, category) => {
      if (!acc[category.categoryId]) {
        acc[category.categoryId] = {
          userCount: 0,
          testCount: 0,
          name: category.category.name,
        };
      }
      acc[category.categoryId].userCount += category.userCount;
      acc[category.categoryId].testCount += category.testCount;
      return acc;
    }, {} as Record<string, { userCount: number; testCount: number; name: string }>);

  const accuracyByCategory = Object.entries(countsByCategory)
    .map(([categoryId, counts]) => {
      const accuracy = counts.userCount / counts.testCount;
      let countPercentage =
        accuracy > 1
          ? parseFloat(((accuracy - 1) * 100).toFixed(2))
          : parseFloat(((1 - accuracy) * 100).toFixed(2)) * -1;

      if (Object.is(countPercentage, -0)) {
        countPercentage = 0;
      }

      return {
        categoryId,
        name: counts.name,
        countPercentage: countPercentage / 100,
      };
    })
    .filter((entry) => !isNaN(entry.countPercentage))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summaryCards = [
    {
      content: [
        `Undercounted animals: ${undercountedAnimals}`,
        `Overcounted animals: ${overcountedAnimals}`,
      ],
    },
    {
      content: [
        `Undercounted rate: ${(
          (undercountedAnimals / totalAnimals) *
          100
        ).toFixed(2)}%`,
        `Overcounted rate: ${(
          (overcountedAnimals / totalAnimals) *
          100
        ).toFixed(2)}%`,
      ],
    },
    {
      content: [
        `Test success rate: ${((passed / results.length) * 100).toFixed(2)}%`,
        `Tests passed and failed: ${passed} - ${failed}`,
      ],
    },
  ];

  function exportResults() {
    setCompilingFiles(0);
    setTotalFilesCompiled(2);

    exportFromJSON({
      data: results.map((result) => ({
        date: result.createdAt,
        preset: result.testPreset.name,
        testAnimals: result.testAnimals,
        missedAnimals: result.totalMissedAnimals,
        passedOnLabels: result.passedOnCategories,
        passedOnTotal: result.passedOnTotal,
      })),
      fileName: `${selectedUser?.label}-test-results`,
      exportType: 'csv',
    });

    setCompilingFiles(1);

    exportFromJSON({
      data: accuracyByCategory.map((category) => ({
        label: category.name,
        overUnderPercentage: category.countPercentage.toFixed(4),
      })),
      fileName: `${selectedUser?.label}-label-accuracy`,
      exportType: 'csv',
    });

    setCompilingFiles(2);
  }

  async function purgeResults() {
    if (!confirm('Are you sure you want to purge all results for this user?')) {
      return;
    }

    setIsPurging(true);

    const results = await fetchAllPaginatedResults(
      client.models.TestResult.testResultsByUserId,
      {
        userId: selectedUser?.value,
        selectionSet: ['id', 'projectId', 'categoryCounts.categoryId'],
      }
    );

    const filteredResults = results.filter(
      (result) => result.projectId === selectedProject?.value
    );

    for (const result of filteredResults) {
      await client.models.TestResult.delete({ id: result.id });

      for (const categoryId of result.categoryCounts.map(
        (category) => category.categoryId
      )) {
        await client.models.TestResultCategoryCount.delete({
          testResultId: result.id,
          categoryId: categoryId,
        });
      }
    }

    setIsPurging(false);
  }

  return (
    <div className="d-flex flex-column gap-2 mt-3 w-100">
      <div>
        <label className="mb-2">Select Survey</label>
        <Select
          className="text-black"
          value={selectedProject}
          options={projects.map((p) => ({
            label: `${p.name} (${p.organization.name})`,
            value: p.id,
          }))}
          onChange={(e) => {
            setSelectedProject(e);
            setSelectedUser(null);
            setResults([]);
          }}
          styles={{
            valueContainer: (base) => ({
              ...base,
              minHeight: '48px',
              overflowY: 'auto',
            }),
          }}
        />
      </div>
      <div>
        <label className="mb-2">Select user</label>
        <Select
          className="mb-3 text-black"
          value={selectedUser}
          options={organizationMembershipsHook.data?.map((m) => ({
            label: allUsers.find((user) => user.id === m.userId)?.name || '',
            value: m.userId,
          }))}
          onChange={(e) => {
            setSelectedUser(e);
          }}
          styles={{
            valueContainer: (base) => ({
              ...base,
              minHeight: '48px',
              overflowY: 'auto',
            }),
          }}
        />
      </div>
      {selectedProject && selectedUser && (
        <>
          <div>
            {results.length === 0 ? (
              <p className="mt-2">
                {isLoading ? 'Loading...' : 'No test results'}
              </p>
            ) : (
              <Tabs defaultTab={0}>
                <Tab label="All Results">
                  <p className="my-2">Summary</p>
                  <div className="d-flex gap-3 mb-3">
                    {summaryCards.map((card, index) => (
                      <SummaryCard key={index} content={card.content} />
                    ))}
                  </div>
                  <p className="mb-2">All Results</p>
                  <MyTable
                    tableHeadings={headings}
                    tableData={tableData}
                    pagination={true}
                    itemsPerPage={5}
                  />
                </Tab>
                <Tab label="Label Accuracy">
                  <p
                    className="text-center mb-0 mt-3"
                    style={{ fontSize: '1.5rem' }}
                  >
                    Over/Under Count Percentage By Label
                  </p>
                  <BarChart
                    dataset={accuracyByCategory}
                    margin={{ bottom: 80 }}
                    sx={{
                      '& .MuiChartsAxis-bottom .MuiChartsAxis-line': {
                        stroke: '#FFFFFF',
                        strokeWidth: 1,
                      },
                      '& .MuiChartsAxis-left .MuiChartsAxis-line': {
                        stroke: '#FFFFFF',
                        strokeWidth: 1,
                      },
                      '& .MuiChartsAxis-tickContainer .MuiChartsAxis-tickLabel':
                        {
                          fill: '#FFFFFF',
                          fontSize: 12,
                        },
                      '& .MuiChartsAxis-tick': {
                        stroke: '#FFFFFF',
                        strokeWidth: 1,
                      },
                    }}
                    xAxis={[
                      {
                        scaleType: 'band',
                        dataKey: 'name',
                      },
                    ]}
                    yAxis={[
                      {
                        colorMap: {
                          type: 'piecewise',
                          thresholds: [0],
                          colors: ['#DF691A', '#5bc0de'],
                        },
                      },
                    ]}
                    bottomAxis={{
                      tickLabelStyle: {
                        angle: 45,
                        textAnchor: 'start',
                        fontSize: 12,
                      },
                    }}
                    series={[
                      {
                        dataKey: 'countPercentage',
                      },
                    ]}
                    height={400}
                    borderRadius={4}
                  />
                </Tab>
              </Tabs>
            )}
          </div>
          {results.length > 0 && (
            <div className="d-flex gap-2 justify-content-end mt-2">
              <Button
                variant="danger"
                onClick={purgeResults}
                disabled={isPurging}
              >
                Purge Results
              </Button>
              <Button variant="primary" onClick={exportResults}>
                Export Results
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ content }: { content: (string | JSX.Element)[] }) {
  return (
    <div className="rounded-3 p-3 bg-dark text-white d-flex flex-column gap-1">
      {content.map((item, index) => (
        <p key={index} className="mb-0">
          {item}
        </p>
      ))}
    </div>
  );
}
