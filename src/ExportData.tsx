import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
//import { UserContext } from "./UserContext";
import { GlobalContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import exportFromJSON from 'export-from-json';
import { useUpdateProgress } from "./useUpdateProgress";
interface ExportDataProps {
  show: boolean;
  handleClose: () => void;
}

export const ExportData: React.FC<ExportDataProps> = ({ show, handleClose }) => {
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const { client } = useContext(GlobalContext)!;
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Export data`,
    indeterminateTaskName: `Exporting data`,
    determinateTaskName: "Exporting data",
    stepFormatter: (count)=>`${count} annotations`,
  }); 


  async function handleSubmit() {
    handleClose();
    
    setStepsCompleted(0);
    setTotalSteps(0);

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByAnnotationSetId,
      {
        setId: annotationSet,
        selectionSet: ['y', 'x', 'category.name','owner','source','obscured', 'image.originalPath', 'image.timestamp', 'image.latitude', 'image.longitude'] as const
      },
      setStepsCompleted
    );

    setTotalSteps(annotations.length);
    
    const fileName = `DetWebExport-${annotationSet}`;
    const exportType = exportFromJSON.types.csv;
    exportFromJSON({
      data: annotations.map((anno) => {
        return {
          category: anno.category?.name,
          image: anno.image.originalPath || 'Unknown',
          timestamp: anno.image.timestamp,
          latitude: anno.image.latitude,
          longitude: anno.image.longitude,
          obscured: anno.obscured,
          annotator: anno.owner,
          x: anno.x,
          y: anno.y,
          source: anno.source,
        };
      }),
      fileName,
      exportType,
    });
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Export data</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                setAnnotationSet={setAnnotationSet}
                selectedSet={annotationSet}
              />
            </Form.Group>
            {/* <CsvDownloadButton data={[{x:1,y:2,timestamp:"Now"},{x:1,y:2,timestamp:"Now"},{x:1,timestamp:"Now"}]}>Download</CsvDownloadButton> */}
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!annotationSet}
        >
          Export
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ExportData;
