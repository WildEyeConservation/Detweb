import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalContext, UserContext } from './Context.tsx';
import { fetchAllPaginatedResults } from './utils.tsx';
import MyTable from './Table.tsx';
import { Button, Card, Form } from 'react-bootstrap';
import DensityMap from './DensityMap.tsx';
import exportFromJSON from 'export-from-json';
import { useUsers } from './apiInterface';
import { X, Clipboard } from 'lucide-react';

export default function JollyResults() {
  const { surveyId, annotationSetId } = useParams<{
    surveyId: string;
    annotationSetId: string;
  }>();
  const { client } = useContext(GlobalContext)!;
  const { myMembershipHook: myProjectsHook, user: authUser } =
    useContext(UserContext)!;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [surveyName, setSurveyName] = useState('');
  const [annotationSetName, setAnnotationSetName] = useState('');
  const [resultsMemberships, setResultsMemberships] = useState<any[]>([]);
  const [shareWith, setShareWith] = useState('');
  const { users } = useUsers();

  const adminProjects = myProjectsHook.data?.filter((p) => p.isAdmin);
  const isProjectAdmin = adminProjects?.some((p) => p.projectId === surveyId);

  async function handleShare() {
    const windowUrl = new URL(window.location.href);
    let url = `${windowUrl.origin}/jolly/${surveyId}/${annotationSetId}`;

    try {
      await navigator.share({ url: url });
    } catch (error) {
      console.error(error);
    }
  }

  async function addResultsMembership() {
    if (!shareWith) return;

    const userId = users?.find(
      (user) => user.name === shareWith || user.email === shareWith
    )?.id;

    if (!userId) {
      alert('User not found');
      return;
    }

    setShareWith('');

    if (resultsMemberships.some((m) => m.userId === userId)) {
      alert('User already has access to this survey');
      return;
    }

    const { data: newMembership } =
      await client.models.JollyResultsMembership.create({
        surveyId,
        userId,
      });
    setResultsMemberships([...resultsMemberships, newMembership]);
  }

  async function removeResultsMembership(userId: string) {
    await client.models.JollyResultsMembership.delete({
      surveyId,
      userId,
    });
    setResultsMemberships(
      resultsMemberships.filter((m) => m.userId !== userId)
    );
  }
  async function exportResultsAsCSV() {
    exportFromJSON({
      data: results.map((r) => ({
        stratumName: r.stratumName,
        animals: r.animals,
        areaSurveyed: r.areaSurveyed,
        estimate: r.estimate,
        density: r.density,
        variance: r.variance,
        standardError: r.standardError,
        numSamples: r.numSamples,
        lowerBound95: r.lowerBound95,
        upperBound95: r.upperBound95,
      })),
      fileName: `${surveyName} - ${annotationSetName} - Jolly Results`,
      exportType: exportFromJSON.types.csv,
    });
  }

  useEffect(() => {
    if (!surveyId || !annotationSetId) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchAllPaginatedResults(
          client.models.JollyResult.jollyResultsBySurveyId,
          {
            surveyId,
            selectionSet: [
              'surveyId',
              'stratumId',
              'annotationSetId',
              'animals',
              'areaSurveyed',
              'estimate',
              'density',
              'variance',
              'standardError',
              'numSamples',
              'lowerBound95',
              'upperBound95',
            ],
          }
        );
        if (mounted) {
          const filtered = data.filter(
            (r) => r.annotationSetId === annotationSetId
          );
          //fetch stratum name and insert into results
          const stratumNames = await fetchAllPaginatedResults(
            client.models.Stratum.strataByProjectId,
            {
              projectId: surveyId,
              selectionSet: ['id', 'name'],
            }
          );
          const resultsWithStratumName = filtered.map((r) => {
            const stratum = stratumNames.find((s) => s.id === r.stratumId);
            return { ...r, stratumName: stratum?.name };
          });

          const { data: survey } = await client.models.Project.get({
            id: surveyId,
          });
          setSurveyName(survey.name);

          const { data: annotationSet } = await client.models.AnnotationSet.get(
            {
              id: annotationSetId,
            }
          );
          setAnnotationSetName(annotationSet.name);

          setResults(resultsWithStratumName);

          const resultsMemberships = await fetchAllPaginatedResults(
            client.models.JollyResultsMembership
              .jollyResultsMembershipsBySurveyId,
            {
              surveyId,
              selectionSet: ['userId', 'surveyId'],
            }
          );
          setResultsMemberships(resultsMemberships);
        }
      } catch (error) {
        console.error('Error fetching Jolly results:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [client, surveyId, annotationSetId]);

  if (!surveyId || !annotationSetId) {
    return <p>Missing survey or annotation set id.</p>;
  }

  if (loading) {
    return <p>Loading...</p>;
  }
  // Ensure user has access only after loading completes
  if (
    !isProjectAdmin &&
    !resultsMemberships.some((m) => m.userId === authUser.username)
  ) {
    return <p>You have not been granted access to this survey's results.</p>;
  }

  const tableHeadings = [
    { content: 'Stratum ID', sort: true },
    { content: 'Animals', sort: true },
    { content: 'Area Surveyed', sort: true },
    { content: 'Estimate', sort: true },
    { content: 'Density', sort: true },
    { content: 'Variance', sort: true },
    { content: 'Std Error', sort: true },
    { content: '# Samples', sort: true },
    { content: 'Lower 95', sort: true },
    { content: 'Upper 95', sort: true },
  ];

  const tableData = results.map((r) => ({
    id: r.stratumId,
    rowData: [
      r.stratumName,
      String(r.animals),
      String(Number(r.areaSurveyed).toFixed(2)),
      String(r.estimate),
      String(Number(r.density).toFixed(2)),
      String(Number(r.variance).toFixed(2)),
      String(Number(r.standardError).toFixed(2)),
      String(r.numSamples),
      String(r.lowerBound95),
      String(r.upperBound95),
    ],
  }));

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <div className='d-flex flex-row gap-2 w-100 h-100'>
        <div className='d-flex flex-column gap-2' style={{ width: '300px' }}>
          <Card>
            <Card.Header>
              <Card.Title>
                <h4 className='mb-0'>Information</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className='mb-0'>
                <strong>Survey:</strong> {surveyName}
              </p>
              <p className='mb-0'>
                <strong>Annotation Set:</strong> {annotationSetName}
              </p>
            </Card.Body>
          </Card>
          <Card className='flex-grow-1'>
            <Card.Header>
              <Card.Title>
                <h4 className='mb-0'>Sharing</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body className='d-flex flex-column justify-content-between'>
              {isProjectAdmin && (
                <div className='d-flex flex-column gap-3'>
                  <Button
                    variant='link'
                    className='p-0 text-white'
                    onClick={handleShare}
                    style={{ fontSize: '14px', textAlign: 'left' }}
                  >
                    <Clipboard size={16} className='me-1' />
                    Copy Link
                  </Button>
                  <Form.Group>
                    <Form.Label className='m-0'>Share with:</Form.Label>
                    <Form.Control
                      type='text'
                      placeholder='Email or Username'
                      value={shareWith}
                      onChange={(e) => setShareWith(e.target.value)}
                    />
                    <Button
                      onClick={addResultsMembership}
                      disabled={!shareWith}
                      className='mt-2'
                    >
                      Add
                    </Button>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className='m-0'>Shared with:</Form.Label>
                    {resultsMemberships.length > 0 ? (
                      resultsMemberships.map((m) => (
                        <div
                          className='mb-2 w-100 d-flex justify-content-between align-items-center'
                          style={{
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            padding: '0px 0px 0px 8px',
                            fontSize: '14px',
                            overflow: 'hidden',
                          }}
                          key={m.userId}
                        >
                          <span className='m-0'>
                            {users?.find((u) => u.id === m.userId)?.name}
                          </span>
                          <Button
                            variant='danger'
                            size='sm'
                            onClick={() => removeResultsMembership(m.userId)}
                          >
                            <X />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p
                        className='mb-0 text-muted'
                        style={{ fontSize: '14px' }}
                      >
                        No one has been shared with yet.
                      </p>
                    )}
                  </Form.Group>
                </div>
              )}
              <Button onClick={exportResultsAsCSV}>
                Export Results as CSV
              </Button>
            </Card.Body>
          </Card>
        </div>
        <div className='d-flex flex-column gap-2 flex-grow-1'>
          <Card className='flex-grow-1'>
            <Card.Header>
              <Card.Title>
                <h4 className='mb-0'>Density Map</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <DensityMap
                surveyId={surveyId}
                annotationSetId={annotationSetId}
              />
            </Card.Body>
          </Card>
          <Card>
            <Card.Header className='d-flex justify-content-between align-items-center gap-2'>
              <Card.Title className='mb-0 w-100' style={{ maxWidth: '300px' }}>
                <h4 className='mb-0'>Jolly Results</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <MyTable
                tableHeadings={tableHeadings}
                tableData={tableData}
                pagination={false}
                emptyMessage='No Jolly results found.'
              />
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
