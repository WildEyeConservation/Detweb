import { Modal, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useUpdateProgress } from "./useUpdateProgress.tsx";
import { fetchAllPaginatedResults } from "./utils.tsx";
import exportFromJSON from "export-from-json";
import { GlobalContext } from "./Context.tsx";
import { useContext } from "react";

export default function AnnotationSetResults({
  show,
  onClose,
  surveyId,
  annotationSet,
}: {
  show: boolean;
  onClose: () => void;
  surveyId: string;
  annotationSet: { id: string; name: string };
}) {
  const navigate = useNavigate();
  const { client } = useContext(GlobalContext)!;

  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Export data`,
    indeterminateTaskName: `Exporting data`,
    determinateTaskName: 'Exporting data',
    stepFormatter: (count) => `${count} annotations`,
  });

  async function exportData(annotationSets: { id: string; name: string }[]) {
    setStepsCompleted(0);
    setTotalSteps(0);

    const annotationSetsResult = await Promise.all(
      annotationSets.map((annotationSet) => {
        return fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId,
          {
            setId: annotationSet.id,

            selectionSet: [
              'y',
              'x',
              'category.name',
              'owner',
              'source',
              'obscured',
              'id',
              'objectId',
              'image.originalPath',
              'image.timestamp',
              'image.latitude',
              'image.longitude',
            ] as const,
          },
          setStepsCompleted
        );
      })
    );

    let i = 0;
    let a = 0;

    for (const annotations of annotationSetsResult) {
      a += annotations.length;

      const fileName = `DetWebExport-${annotationSets[i].name}`;
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
            isPrimary: anno.objectId === anno.id,
            objectId: anno.objectId,
            x: anno.x,
            y: anno.y,
            source: anno.source,
          };
        }),
        fileName,
        exportType,
      });

      i++;
    }

    setTotalSteps(a);
  }

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{annotationSet.name} Results</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-4">
        <div>
          <h5 className="mb-0">Explore</h5>
          <span className="text-muted" style={{ fontSize: "14px" }}>
            Explore your annotation set by searching for all sightings of a
            specific specific species. Can be used to find and correct errors,
            and reannotate unknown sightings.
          </span>
          <Button
            className="d-block mt-1"
            variant="primary"
            onClick={() =>
              navigate(`/surveys/${surveyId}/set/${annotationSet.id}/review`)
            }
          >
            Explore
          </Button>
        </div>
        <div>
          <h5 className="mb-0">Register</h5>
          <span className="text-muted" style={{ fontSize: "14px" }}>
            Register images from your annotation set.
          </span>
          <Button
            className="d-block mt-1"
            variant="primary"
            onClick={() =>
              navigate(
                `/surveys/${surveyId}/set/${annotationSet.id}/registration`
              )
            }
          >
            Register
          </Button>
        </div>
        <div>
          <h5 className="mb-0">CSV File</h5>
          <span className="text-muted" style={{ fontSize: "14px" }}>
            Download a CSV file of your annotation set.
          </span>
          <Button
            className="d-block mt-1"
            variant="primary"
            onClick={() => {
              onClose();
              exportData([annotationSet]);
            }}
          >
            Download
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
