import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
//import { UserContext } from "./UserContext";
import { GlobalContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import exportFromJSON from 'export-from-json';
interface ExportDataProps {
  show: boolean;
  handleClose: () => void;
}

export const ExportData: React.FC<ExportDataProps> = ({ show, handleClose }) => {
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const { client } = useContext(GlobalContext)!;


  async function handleSubmit() {
    handleClose();
    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByAnnotationSetId,
      {
        setId: annotationSet,
        selectionSet: ['y', 'x', 'category.name','image.*','image.files.*','owner','source','obscured'] as const
      }
    );
    const fileName = `DetWebExport-${annotationSet}`;
    const exportType = exportFromJSON.types.csv;
    exportFromJSON({
      data: annotations.map((anno) => {
        return {
          category: anno.category?.name,
          image: anno.image.files.find(f => f.type == 'image/jpeg')?.path,
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
