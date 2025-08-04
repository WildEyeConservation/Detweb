import { useContext, useEffect, useMemo, useState } from 'react';
import { GlobalContext, UserContext } from './Context.tsx';
import { useOptimisticUpdates } from './useOptimisticUpdates.tsx';
import { Schema } from '../amplify/data/resource.ts';
import { Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function SharedResults() {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;
  const navigate = useNavigate();
  const [annotationSets, setAnnotationSets] = useState<
    { id: string; name: string; projectId: string; projectName: string }[]
  >([]);

  const subscriptionFilter = useMemo(
    () => ({
      filter: { userId: { eq: user?.userId } },
    }),
    [user?.userId]
  );

  const sharedResultsHook = useOptimisticUpdates<
    Schema['JollyResultsMembership']['type'],
    'JollyResultsMembership'
  >(
    'JollyResultsMembership',
    async (nextToken) => {
      const result = await client.models.JollyResultsMembership.list({
        filter: {
          userId: { eq: user?.userId },
        },
      });
      return { data: result.data, nextToken: result.nextToken ?? undefined };
    },
    subscriptionFilter
  );

  useEffect(() => {
    async function fetchAnnotationSets() {
      const annotationSets = await Promise.all(
        sharedResultsHook.data?.map(async (result) => {
          const { data: annotationSet } = await client.models.AnnotationSet.get(
            { id: result.annotationSetId },
            {
              selectionSet: ['id', 'name', 'projectId', 'project.name'],
            }
          );
          return annotationSet;
        })
      );
      if (annotationSets) {
        setAnnotationSets(
          annotationSets.map((annotationSet) => ({
            id: annotationSet.id,
            name: annotationSet.name,
            projectId: annotationSet.projectId,
            projectName: annotationSet.project.name,
          }))
        );
      }
    }

    fetchAnnotationSets();
  }, [sharedResultsHook.data]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Header className='d-flex justify-content-between align-items-center gap-2'>
          <Card.Title className='mb-0 w-100' style={{ maxWidth: '300px' }}>
            <h4 className='mb-0'>Shared Results</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body className='d-flex flex-column gap-2'>
          {annotationSets.length > 0 ? (
            annotationSets.map((annotationSet) => (
              <div
                key={annotationSet.id}
                className='d-flex flex-row justify-content-between align-items-center gap-2 border border-dark p-3'
              >
                <div>
                  <p className='mb-0'>Survey: {annotationSet.projectName}</p>
                  <p className='mb-0'>Annotation Set: {annotationSet.name}</p>
                </div>
                <Button
                  variant='primary'
                  onClick={() => {
                    navigate(
                      `/jolly/${annotationSet.projectId}/${annotationSet.id}`
                    );
                  }}
                >
                  View Results
                </Button>
              </div>
            ))
          ) : (
            <p>No results have been shared with you.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
