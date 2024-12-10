import React, { useContext, useEffect, useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { GlobalContext, ProjectContext } from './Context';
import { fetchAllPaginatedResults } from './utils';

interface Props {
  show: boolean;
  handleClose: () => void;
  setId: string;
}

const AnnotationCountModal: React.FC<Props> = ({ show, handleClose, setId }) => {
    const { client } = useContext(GlobalContext)!
    const { categoriesHook: {data: categories } } = useContext(ProjectContext)!;
    const [categoryCounts, setCategoryCounts] = useState<{categoryId: string, annotationCount: number}[]>([]);
    const [loading, setLoading] = useState(false);
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    useEffect(() => {
        async function getAnnotationCounts() {
            setLoading(true);

            const result = await fetchAllPaginatedResults(client.models.AnnotationCountPerCategoryPerSet.categoryCountsByAnnotationSetId, {
                annotationSetId: setId,
                selectionSet: ['categoryId', 'annotationCount'] as const
            });
            setCategoryCounts(result);
            
            setLoading(false);
        }

        if (setId && show) {
            getAnnotationCounts();
        }
    }, [setId, show])

    return (
        <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
            <Modal.Title>Raw annotation counts</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {loading ? 
                <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <Spinner animation="border" variant="secondary" />
                </div>
            : categoryCounts.length > 0 ?
                categoryCounts.map((categoryCount, i) => (
                    <div 
                        key={i}
                        style={{
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            borderTop: `${i > 0 ? '1px solid rgba(0, 0, 0, 0.2)' : 'none'}`, 
                            paddingTop: '10px', 
                            paddingBottom: '10px', 
                            // todo: prob use CSS hover - state is a quick fix
                            backgroundColor: hoveredId === i ? 'rgba(0, 0, 0, 0.1)' : 'transparent'
                        }}
                        onMouseEnter={() => setHoveredId(i)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <p style={{marginBottom: '0px'}}>{categories.find(category => category.id === categoryCount.categoryId)?.name}:</p>
                        <p style={{marginBottom: '0px'}}>{categoryCount.annotationCount}</p>
                    </div>
                ))
            : <p style={{marginBottom: '0px'}}>No annotation counts found</p> }
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
                Close
            </Button>
        </Modal.Footer>
        </Modal>
    );
};

export default AnnotationCountModal;
