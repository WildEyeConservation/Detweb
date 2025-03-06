import MyTable from './Table';
import Button from 'react-bootstrap/Button';
import { Row, Col } from 'react-bootstrap';
import { GlobalContext } from './Context';
import { useContext, useState, useEffect } from 'react';
import './UserManagement.css'; // Import the CSS file
import Form from 'react-bootstrap/Form';
import { ManagementContext } from './Context';
import CreateSubsetModal from './CreateSubset';
import SpatiotemporalSubset from './SpatioTemporalSubset';
import SubsampleModal from './Subsample';
import AddGpsData from './AddGpsData';
import CreateTask from './CreateTask';
import ProcessImages from './ProcessImages.tsx';
import FileStructureSubset from './filestructuresubset';

export default function ImageSetManagement() {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!;
  const {
    imageSetsHook: { data: imageSets, delete: deleteImageSet },
  } = useContext(ManagementContext)!;
  const [selectedSets, setSelectedSets] = useState<string[]>([]);

  const tableData = imageSets
    ?.sort((a, b) => a.name.localeCompare(b.name))
    .map((imageSet) => {
      const { id, name, imageCount } = imageSet;
      return {
        id,
        rowData: [
          <Form.Check // prettier-ignore
            type="switch"
            id="custom-switch"
            checked={selectedSets.includes(id)}
            onChange={(x) => {
              console.log(x.target.checked);
              if (x.target.checked) {
                setSelectedSets([...selectedSets, id]);
              } else {
                setSelectedSets(selectedSets.filter((set) => set !== id));
              }
            }}
          />,
          name,
          imageCount || 'Unknown',
          <span>
            <Button
              variant="info"
              className="me-2 fixed-width-button"
              onClick={() => {
                const newName = prompt('Enter new name for image set', name);
                if (newName) {
                  client.models.ImageSet.update({ id, name: newName });
                }
              }}
            >
              Rename
            </Button>
            <Button
              variant="danger"
              className="me-2 fixed-width-button"
              onClick={() => {
                if (
                  confirm(`Are you sure you want to delete image set ${name}?`)
                )
                  deleteImageSet({ id: id });
              }}
            >
              Delete
            </Button>
          </span>,
          // <Form.Check
          //   id="custom-switch"
          //   disabled={currentUser?.id === id}
          //   key={id + "1"}
          //   checked={belongsToCurrentProject?.id || false}
          //   onChange={(e) =>
          //     e.target.checked
          //       ? createProjectMembership({
          //           userId: user.id,
          //           projectId: currentProject,
          //         })
          //       : deleteProjectMembership({ id: belongsToCurrentProject?.id })
          //   }
          // />
        ],
      };
    });

  const toggleAll = () => {
    setSelectedSets(
      imageSets
        ?.map((imageSet) => imageSet.id)
        .filter((id) => !selectedSets.includes(id)) || []
    );
  };

  const tableHeadings = [
    { content: <span onClick={toggleAll}>Selected</span> },
    { content: 'Name' },
    { content: 'Number of images', style: { width: '500px' } },
    { content: 'Actions' },
  ];

  return (
    <>
      <CreateSubsetModal
        show={modalToShow == 'createSubset'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
      />
      <SpatiotemporalSubset
        show={modalToShow == 'SpatiotemporalSubset'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
      />
      <SubsampleModal
        show={modalToShow == 'Subsample'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <AddGpsData
        show={modalToShow == 'addGps'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <CreateTask
        show={modalToShow == 'createTask'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <ProcessImages
        show={modalToShow == 'processImages'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <FileStructureSubset
        show={modalToShow == 'FileStructureSubset'}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
      />

      <Row className="justify-content-center mt-3">
        <div>
          <h5>Image Sets Management</h5>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
          <Col className="d-flex justify-content-center mt-3 border-top pt-3 border-dark">
            <span>
              <Button
                variant="primary"
                className="me-2"
                onClick={() => showModal('addFiles')}
              >
                Upload New Image Set
              </Button>
              <Button
                variant="primary"
                disabled={selectedSets.length == 0}
                className="me-2"
                onClick={() => showModal('createTask')}
              >
                Create Task
              </Button>
              <Button
                variant="primary"
                disabled={selectedSets.length == 0}
                className="me-2"
                onClick={() => showModal('addGps')}
              >
                Add GPS Data
              </Button>
              <Button
                variant="primary"
                disabled={selectedSets.length == 0}
                className="me-2"
                onClick={() => showModal('processImages')}
              >
                Process Images
              </Button>
              <Button
                className="me-2 fixed-width-button"
                disabled={selectedSets.length == 0}
                onClick={() => showModal('createSubset')}
              >
                Create Subsets
              </Button>
            </span>
          </Col>
        </div>
      </Row>
    </>
  );
}
