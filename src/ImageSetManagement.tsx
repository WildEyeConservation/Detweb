import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import { Row,Col } from "react-bootstrap";
import { GlobalContext , ProjectContext,} from "./Context";
import { useContext, useState,useEffect } from "react";
import { useObserveQuery } from './useObserveQuery';
import "./UserManagement.css"; // Import the CSS file
import Form from "react-bootstrap/Form";

export default function ImageSetManagement() {
  const { client, showModal } = useContext(GlobalContext)!
  const {project} = useContext(ProjectContext)!
  const { items: imageSets } = useObserveQuery('ImageSet', { filter: { projectId: { eq: project.id } } });
  const [counts, setCounts] = useState<{ [key: string]: number }>({}); 
  const deleteImageSet = client.models.ImageSet.delete;
  useEffect(() => {
    const fetchCounts = async () => {
      setCounts(Object.fromEntries(await Promise.all(imageSets?.map(async (imageSet) => 
        [imageSet.id, ((await client.queries.numberOfImagesInSet({ imageSetId: imageSet.id })).data?.[0]?.count || 0)]))));
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
        checked={false}
        onChange={(x) => {
          console.log(x.target.checked);
        }}
        />,
        name,
        counts[id]
        ,
        <span>
            <Button variant="info"
              className="me-2 fixed-width-button"
              //disabled={currentUser?.username === id}
          //onClick={() => () => updateProjectMembership({ id: belongsToCurrentProject.id, isAdmin: 0 })}
          >
              Create Subset
            </Button > 
          <Button variant="danger"
            className="me-2 fixed-width-button"
            onClick={()=> deleteImageSet({id: id})}
              //disabled={currentUser?.username === id}
          //onClick={() => () => updateProjectMembership({ id: belongsToCurrentProject.id, isAdmin: 0 })}
              >
              Delete
            </Button >
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
          <Button variant="primary" className="me-2" onClick={() => showModal('createTask')}>
            Create Task
          </Button>
          <Button variant="primary" className="me-2" onClick={() => showModal('addGps')}>
            Add GPS Data
          </Button>
          <Button variant="primary" className="me-2" onClick={() => showModal('processImages')}>
            Process Images
          </Button>
          </span>
        </Col>

        </div>
      </Row>
    </>
  );
}

