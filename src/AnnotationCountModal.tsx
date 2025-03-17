import React, { useContext, useEffect, useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import MyTable from "./Table";

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
  const [categoryCounts, setCategoryCounts] = useState<
    { categoryId: string; annotationCount: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function getAnnotationCounts() {
      setLoading(true);

      const result = await fetchAllPaginatedResults(
        client.models.AnnotationCountPerCategoryPerSet
          .categoryCountsByAnnotationSetId,
        {
          annotationSetId: setId,
          selectionSet: [
            "categoryId",
            "annotationCount",
            "category.name",
          ] as const,
        }
      );
      setCategoryCounts(result);

      setLoading(false);
    }

    if (setId && show) {
      getAnnotationCounts();
    }
  }, [setId, show]);

  const tableData = categoryCounts
    .filter((categoryCount) => categoryCount.annotationCount > 0)
    .sort((a, b) => a.category.name.localeCompare(b.category.name))
    .map((categoryCount) => ({
      id: categoryCount.categoryId,
      rowData: [categoryCount.category.name, categoryCount.annotationCount],
    }));

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Annotation Set Details</Modal.Title>
      </Modal.Header>
      <Modal.Body className="pb-0">
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <Spinner animation="border" variant="light" />
          </div>
        ) : (
          <MyTable
            tableHeadings={[
              { content: "Label", style: { width: "50%" } },
              { content: "Raw Annotation Count", style: { width: "50%" } },
            ]}
            tableData={tableData}
            emptyMessage="No annotations found"
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="dark" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AnnotationCountModal;
