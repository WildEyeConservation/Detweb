import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import { Row,Col } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { useContext, useState,useEffect } from "react";
import "./UserManagement.css"; // Import the CSS file
import Form from "react-bootstrap/Form";
import { ManagementContext } from "./Context";
import LaunchTask from "./LaunchTask";

export default function TaskManagement() {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!
  const { locationSetsHook: { data: tasks, delete: deleteTask } } = useContext(ManagementContext)!;
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ [key: string]: number }>({}); 
 
 
  // useEffect(() => {
  //   const fetchCounts = async () => {
  //     setCounts(Object.fromEntries(await Promise.all(tasks?.map(async (task) => 
  //       [task.id, (await client.queries.getLocationCounts({ imageSetId: task.id })).data]))));
  //   };
  //   fetchCounts();
  // }, [tasks]);

  const tableData = tasks?.sort((a,b)=> a.name.localeCompare(b.name)).map((task) => {
    const { id, name, locationCount } = task;
    return {
      id,
      rowData: [
        <Form.Check // prettier-ignore
        type="switch"
        id="custom-switch"
        checked={selectedTasks.includes(id)}
        onChange={(x) => {
          console.log(x.target.checked);
          if (x.target.checked) {
            setSelectedTasks([...selectedTasks, id]);
          } else {
            setSelectedTasks(selectedTasks.filter((set) => set !== id));
          }
        }}
        />,
        name,
        locationCount || "Unknown",
        <span>
          <Button
            variant="info"
            className="me-2 fixed-width-button"
            onClick={() => {showModal("launchTask")}}
            >
              Launch
            </Button>
            <Button 
              variant="danger"
              className="me-2 fixed-width-button"
            onClick={() => {if (confirm(`Are you sure you want to delete task ${name}?`)) deleteTask({ id: id })}}
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
    { content: "Number of locations", style: { width: "500px" } },
    { content: "Actions" },
    
  ];
  return (
    <>
      <LaunchTask
        show={modalToShow == "launchTask"}
        handleClose={() => showModal(null)}
        selectedTasks={selectedTasks}
        setSelectedTasks={setSelectedTasks}
      />
      <Row className="justify-content-center mt-3">
      <div>
        <h2>Task Management</h2>
          <MyTable
            tableHeadings={tableHeadings}
            tableData={tableData}
          /> 
          {/* <Col className="text-center mt-3">
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
        </Col> */}
        </div>
      </Row>
    </>
  );
}

