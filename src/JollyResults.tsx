import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalContext } from './Context.tsx';
import { fetchAllPaginatedResults } from './utils.tsx';
import MyTable from './Table.tsx';

export default function JollyResults() {
  const { surveyId, annotationSetId } = useParams<{ surveyId: string; annotationSetId: string }>();
  const { client } = useContext(GlobalContext)!;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

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
          const filtered = data.filter((r) => r.annotationSetId === annotationSetId);
          setResults(filtered);
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
      r.stratumId,
      String(r.animals),
      String(r.areaSurveyed),
      String(r.estimate),
      String(r.density),
      String(r.variance),
      String(r.standardError),
      String(r.numSamples),
      String(r.lowerBound95),
      String(r.upperBound95),
    ],
  }));

  return (
    <div>
      <h3>Jolly Results</h3>
      <MyTable
        tableHeadings={tableHeadings}
        tableData={tableData}
        pagination={false}
        emptyMessage="No Jolly results found."
      />
    </div>
  );
}
