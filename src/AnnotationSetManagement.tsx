import MyTable from "./Table";
import { Row,Col, Button, Form } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { useContext, useState,useEffect } from "react";
import "./UserManagement.css"; // Import the CSS file
import { ManagementContext } from "./Context";
import LaunchRegistration from "./LaunchRegistration";
import { ExportData } from "./ExportData";
import { fetchAllPaginatedResults } from "./utils";
import exportFromJSON from 'export-from-json';
import { useUpdateProgress } from "./useUpdateProgress";
import EditAnnotationSet from "./EditAnnotationSet";
import MoveObservations from "./MoveObservations";

export default function AnnotationSetManagement() {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!
  const { annotationSetsHook: { data: annotationSets, delete: deleteAnnotationSet } } = useContext(ManagementContext)!;
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [editSetName, setEditSetName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  // const [counts, setCounts] = useState<{ [key: string]: number }>({});
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Export data`,
    indeterminateTaskName: `Exporting data`,
    determinateTaskName: "Exporting data",
    stepFormatter: (count)=>`${count} annotations`,
  }); 
 
  // useEffect(() => {
  //   const fetchCounts = async () => {
  //     setCounts(Object.fromEntries(await Promise.all(annotationSets?.map(async (annotationSet) => 
  //       [annotationSet.id, (await client.queries.getAnnotationCounts({ annotationSetId: annotationSet.id })).data]))));
  //   };
  //   fetchCounts();
  // }, [annotationSets]);

  const tableHeadings = [{ content: "Selected" },
    { content: "Name" },
    { content: "Number of raw annotations", style: { width: "500px" } },
    { content: "Actions" },
    
  ];

  async function exportData(annotationSets: { id: string, name: string }[]) {
    setBusy(true);

    setStepsCompleted(0);
    setTotalSteps(0);

    const annotationSetQ = [];

    for (const annotationSet of annotationSets) {
      annotationSetQ.push(fetchAllPaginatedResults(
        client.models.Annotation.annotationsByAnnotationSetId,
        {
          setId: annotationSet.id,

          selectionSet: ['y', 'x', 'category.name','owner','source','obscured', 'id','objectId','image.originalPath', 'image.timestamp', 'image.latitude', 'image.longitude'] as const
        },
        setStepsCompleted
      ));
    }

    const annotationSetsResult = await Promise.all(annotationSetQ);

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
    setBusy(false);
  }

  const tableData = annotationSets?.sort((a,b)=> a.name.localeCompare(b.name)).map((annotationSet) => {
    const { id, name, annotationCount } = annotationSet;
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
        annotationCount != null ? annotationCount : "Unknown",
        <span>
            <Button 
              variant="warning"
              className="me-2"
              onClick={() => { 
                setSelectedSets([id]);
                setEditSetName(name);
                showModal('editAnnotationSet') 
              }
            }
            >
              Edit
            </Button>
            <Button 
              variant="danger"
              className="me-2 fixed-width-button"
              onClick={()=> {if (confirm(`Are you sure you want to delete annotation set ${name}?`)) deleteAnnotationSet({id: id})}}
            >
              Delete
            </Button>
            <Button 
              variant="info"
              className="me-2 fixed-width-button"
            onClick={() => { exportData([{ id, name }])}}
            >
              Export
            </Button>
              <Button 
              variant="info"
              className="fixed-width-button"
              onClick={() => {
                setSelectedSets([id]);
                showModal('moveObservations') 
              }}
            >
              Move Observations
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

  return (
    <>
    <MoveObservations
        show={modalToShow == "moveObservations"}
        handleClose={() => showModal(null)}
        selectedAnnotationSets={selectedSets}
        setSelectedAnnotationSets={setSelectedSets}
    />
        {busy && (
            <div className="text-center mt-3">
                <p>Exporting data...</p>
            </div>
        )}
        <ExportData
      show={modalToShow == "exportData"}
        handleClose={() => showModal(null)}
        selectedSets={selectedSets}
        setSelectedSets={setSelectedSets}/>

      <LaunchRegistration
        show={modalToShow == "launchRegistration"}
        handleClose={() => showModal(null)}
        selectedSets={selectedSets}
        setSelectedSets={setSelectedSets}
      />

      <EditAnnotationSet
        show={modalToShow == "editAnnotationSet"}
        handleClose={() => showModal(null)}
        annotationSet={{id: selectedSets[0], name: editSetName}}
        setSelectedSets={setSelectedSets}
      />
      <Row className="justify-content-center mt-3">
      <div>
        <h2>Annotation Sets Management</h2>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          /> 
          <Col className="text-center mt-3">
            <span>
          <Button variant="primary" disabled={selectedSets.length == 0} className="me-2" onClick={() => showModal('launchRegistration')}>
            Launch registration task
          </Button>
          </span>
        </Col>
        </div>
      </Row>
    </>
  );
}
