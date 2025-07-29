import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalContext } from './Context.tsx';
import { fetchAllPaginatedResults } from './utils.tsx';
import MyTable from './Table.tsx';
import { Card } from 'react-bootstrap';
import DensityMap from './DensityMap.tsx';

export default function JollyResults() {
  const { surveyId, annotationSetId } = useParams<{
    surveyId: string;
    annotationSetId: string;
  }>();
  const { client } = useContext(GlobalContext)!;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [surveyName, setSurveyName] = useState('');
  const [annotationSetName, setAnnotationSetName] = useState('');

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
            <Card.Body>
              <p>...</p>
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
