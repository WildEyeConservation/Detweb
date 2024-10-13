import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import { Row,Col } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { useContext, useState,useEffect } from "react";
import "./UserManagement.css"; // Import the CSS file
import Form from "react-bootstrap/Form";
import { ManagementContext } from "./Context";
import CreateSubsetModal from "./CreateSubset";
import SpatiotemporalSubset from "./SpatioTemporalSubset";
import SubsampleModal from "./Subsample";
import AddGpsData from "./AddGpsData";
import CreateTask from "./CreateTask";
import ProcessImages from './ProcessImages.tsx';
import FileStructureSubset from "./filestructuresubset";

export default function ImageSetManagement() {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!
  const { imageSetsHook: { data: imageSets, delete: deleteImageSet } } = useContext(ManagementContext)!;
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ [key: string]: number }>({}); 
 
 
  useEffect(() => {
    const fetchCounts = async () => {
      setCounts(Object.fromEntries(await Promise.all(imageSets?.map(async (imageSet) => 
        [imageSet.id, (await client.queries.getImageCounts({ imageSetId: imageSet.id })).data]))));
    };
    fetchCounts();
  }, [imageSets]);

  const tableData = imageSets?.sort((a,b)=> a.name.localeCompare(b.name)).map((imageSet) => {
    const { id, name } = imageSet;
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
        counts[id]
        ,
        <span>
            <Button 
              variant="danger"
              className="me-2 fixed-width-button"
              onClick={()=> deleteImageSet({id: id})}
            >
              Delete
            </Button>
        </span>
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

  const tableHeadings = [{ content: "Selected" },
    { content: "Name" },
    { content: "Number of images", style: { width: "500px" } },
    { content: "Actions" },
    
  ];
  return (
    <>
    <CreateSubsetModal
    show={modalToShow == "createSubset"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets} />
      <SpatiotemporalSubset
        show={modalToShow == "SpatiotemporalSubset"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets} />
      <SubsampleModal
        show={modalToShow == "Subsample"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <AddGpsData
        show={modalToShow == "addGps"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <CreateTask
        show={modalToShow == "createTask"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <ProcessImages
        show={modalToShow == "processImages"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
        setSelectedImageSets={setSelectedSets}
      />
      <FileStructureSubset
        show={modalToShow == "FileStructureSubset"}
        handleClose={() => showModal(null)}
        selectedImageSets={selectedSets}
      />

      <Row className="justify-content-center mt-3">
      <div>
        <h2>Image Sets Management</h2>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          /> 
          <Col className="text-center mt-3">
            <span>
          <Button variant="primary" className="me-2" onClick={() => showModal('addFiles')}>
            Upload New Image Set
          </Button>
          <Button variant="primary" disabled={selectedSets.length == 0} className="me-2" onClick={() => showModal('createTask')}>
            Create Task
          </Button>
          <Button variant="primary" disabled={selectedSets.length == 0} className="me-2" onClick={() => showModal('addGps')}>
            Add GPS Data
          </Button>
          <Button variant="primary" disabled={selectedSets.length == 0} className="me-2" onClick={() => showModal('processImages')}>
            Process Images
              </Button>
          <Button 
                className="me-2 fixed-width-button"
                disabled={selectedSets.length == 0}
          onClick={() => showModal('createSubset')}>
              Create Subsets
          </Button>
          </span>
        </Col>
        </div>
      </Row>
    </>
  );
}

