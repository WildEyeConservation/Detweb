import React, { useContext, useEffect, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from './Modal';

import { GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import { Schema } from './amplify/client-schema';

interface Props {
  show: boolean;
  handleClose: () => void;
  setId: string;
}

const AnnotationCountModal: React.FC<Props> = ({
  show,
  handleClose,
  setId,
}) => {
  const { client } = useContext(GlobalContext)!;
  const [annotations, setAnnotations] = useState<
    Schema['Annotation']['type'][]
  >([]);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasFalseNegatives, setHasFalseNegatives] = useState(false);

  useEffect(() => {
    async function getAnnotationCounts() {
      setLoading(true);

      const result = await fetchAllPaginatedResults(
        client.models.Annotation.annotationsByAnnotationSetId,
        {
          setId: setId,
          selectionSet: ['id', 'category.name', 'objectId', 'source'] as const,
          limit: 10000,
        }
      );
      setAnnotations(result);

      setLoading(false);

      if (
        result.some((annotation) =>
          annotation.source.includes('false-negative')
        )
      ) {
        setHasFalseNegatives(true);
      }
    }

    if (setId && show) {
      getAnnotationCounts();
    }
  }, [setId, show]);

  //reduce to group by category
  const annotationByCategory = annotations.reduce((acc, annotation) => {
    const category = annotation.category?.name ?? 'Unknown';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(annotation);
    return acc;
  }, {} as { [category: string]: Schema['Annotation']['type'][] });

  const falseNegativesByCategory = annotations.reduce((acc, annotation) => {
    const category = annotation.category?.name ?? 'Unknown';
    if (!acc[category]) {
      acc[category] = 0;
    }
    if (annotation.source.includes('false-negative')) {
      acc[category]++;
    }
    return acc;
  }, {} as { [category: string]: number });

  const rows = Object.entries(annotationByCategory).map(
    ([category, annotations]) => ({
      category,
      count: primaryOnly
        ? annotations.filter(
            (annotation) => annotation.objectId === annotation.id
          ).length
        : annotations.length,
      falseNegatives: falseNegativesByCategory[category] ?? 0,
    })
  );

  return (
    <Modal show={show} onHide={handleClose} size='lg'>
      <Header>
        <Title>Annotation Set Details</Title>
      </Header>
      <Body>
        <div className='p-3'>
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <Spinner
                animation='border'
                variant='light'
                size='sm'
                className='me-2'
              />
              Fetching annotations...
            </div>
          ) : (
            <div className='d-flex flex-column gap-3 w-100'>
              <LabeledToggleSwitch
                variant='segmented'
                leftLabel='All annotations'
                rightLabel='Primary only'
                checked={primaryOnly}
                onChange={(checked) => {
                  setPrimaryOnly(checked);
                }}
              />
              <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className='ss-data-table' style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: hasFalseNegatives ? '33.33%' : '50%' }} />
                      <col style={{ width: hasFalseNegatives ? '33.33%' : '50%' }} />
                      {hasFalseNegatives && <col style={{ width: '33.34%' }} />}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>{primaryOnly ? 'Primary only' : 'All annotations'}</th>
                        {hasFalseNegatives && <th>False Negatives</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.category}>
                          <td>{row.category}</td>
                          <td>
                            <span className='ss-pill'>{row.count}</span>
                          </td>
                          {hasFalseNegatives && (
                            <td>
                              <span className='ss-pill'>{row.falseNegatives}</span>
                            </td>
                          )}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={hasFalseNegatives ? 3 : 2}
                            style={{
                              textAlign: 'center',
                              color: 'var(--ss-text-dim)',
                              padding: '24px',
                            }}
                          >
                            No annotations found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Body>
      <Footer>
        <Button variant='secondary' onClick={handleClose}>
          Close
        </Button>
      </Footer>
    </Modal>
  );
};

export default AnnotationCountModal;
