import { useContext, useEffect, useState } from "react";
import { UserContext, GlobalContext } from "../Context.tsx";
import { Schema } from "../../amplify/data/resource.ts";
import { Card, Button } from "react-bootstrap";
import MyTable from "../Table.tsx";
import NewSurveyModal from "./NewSurveyModal.tsx";
import { useNavigate } from "react-router-dom";
import FilesUploadComponent from "../FilesUploadComponent.tsx";
import ConfirmationModal from "../ConfirmationModal.tsx";
import AnnotationSetResults from "../AnnotationSetResults.tsx";
import AnnotationCountModal from "../AnnotationCountModal.tsx";
import EditAnnotationSetModal from "../EditAnnotationSet.tsx";

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const { myMembershipHook: myProjectsHook, isOrganizationAdmin } =
    useContext(UserContext)!;
  const [projects, setProjects] = useState<Schema["Project"]["type"][]>([]);
  const [selectedProject, setSelectedProject] = useState<
    Schema["Project"]["type"] | null
  >(null);
  const [selectedAnnotationSet, setSelectedAnnotationSet] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    async function getProjects() {
      const myAdminProjects = myProjectsHook.data?.filter(
        (project) => project.isAdmin
      );

      Promise.all(
        myAdminProjects?.map(
          async (project) =>
            (
              await client.models.Project.get(
                { id: project.projectId },
                {
                  selectionSet: [
                    "name",
                    "id",
                    "organizationId",
                    "organization.name",
                    "hidden",
                    "annotationSets.id",
                    "annotationSets.name",
                    "locationSets.id",
                    "locationSets.name",
                  ],
                }
              )
            ).data
        )
      ).then((projects) => {
        console.log("projects", projects);
        setProjects(
          projects.filter((project) => project !== null && !project.hidden)
        );
      });
    }

    getProjects();
  }, [myProjectsHook.data]);

  async function deleteProject(projectId: string) {
    await client.models.Project.update({ id: projectId, hidden: true });
    setProjects(projects.filter((project) => project.id !== projectId));
  }

  async function deleteAnnotationSet(
    projectId: string,
    annotationSetId: string
  ) {
    await client.models.AnnotationSet.delete({ id: annotationSetId });
    setProjects(
      projects.map((project) => {
        if (project.id === projectId) {
          return {
            ...project,
            annotationSets: project.annotationSets.filter(
              (set) => set.id !== annotationSetId
            ),
          };
        }
        return project;
      })
    );
  }

  const tableData = projects.map((project) => ({
    id: project.id,
    rowData: [
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0">{project.name}</h5>
          <i style={{ fontSize: "14px" }}>{project.organization.name}</i>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            onClick={() => navigate(`/surveys/${project.id}/manage`)}
          >
            Edit
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSelectedProject(project);
              showModal("addFiles");
            }}
          >
            Add files
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setSelectedProject(project);
              showModal("deleteSurvey");
            }}
          >
            Delete
          </Button>
        </div>
      </div>,
      <div className="d-flex flex-column gap-2">
        {project.annotationSets
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((annotationSet, i) => (
            <div
              className={`d-flex justify-content-between align-items-center ${
                i % 2 === 0 ? "" : "border-top border-light pt-2"
              }`}
              key={annotationSet.id}
            >
              <div style={{ fontSize: "16px" }}>{annotationSet.name}</div>
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedAnnotationSet(annotationSet);
                    showModal("annotationCount");
                  }}
                >
                  Details
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedProject(project);
                    setSelectedAnnotationSet(annotationSet);
                    showModal("editAnnotationSet");
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedProject(project);
                    setSelectedAnnotationSet({
                      id: annotationSet.id,
                      name: annotationSet.name,
                    });
                    showModal("annotationSetResults");
                  }}
                >
                  Results
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedProject(project);
                    setSelectedAnnotationSet(annotationSet);
                    showModal("deleteAnnotationSet");
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
      </div>,
    ],
  }));

  if (projects.length === 0 && !isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  return (
    <>
      <div
        style={{
          width: "100%",
          maxWidth: "1555px",
          marginTop: "16px",
          marginBottom: "16px",
        }}
      >
        <Card>
          <Card.Body>
            <Card.Title>
              <h4 className="mb-3">Your Surveys</h4>
            </Card.Title>
            <MyTable
              tableHeadings={[
                { content: "Survey", style: { width: "50%" } },
                { content: "Annotation Sets", style: { width: "50%" } },
              ]}
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage="You are not an admin of any surveys."
            />
            {isOrganizationAdmin && (
              <div className="d-flex justify-content-center mt-3 border-top pt-3 border-dark">
                <Button
                  variant="primary"
                  onClick={() => showModal("newSurvey")}
                >
                  New Survey
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
      <NewSurveyModal
        show={modalToShow === "newSurvey"}
        projects={projects.map((project) => project.name.toLowerCase())}
        onClose={() => showModal(null)}
      />
      <ConfirmationModal
        show={modalToShow === "deleteSurvey"}
        onClose={() => {
          showModal(null);
          setSelectedProject(null);
        }}
        onConfirm={() => deleteProject(selectedProject!.id)}
        title="Delete Survey"
        body={
          <p className="mb-0">
            Are you sure you want to delete {selectedProject?.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
      <ConfirmationModal
        show={modalToShow === "deleteAnnotationSet"}
        onClose={() => {
          showModal(null);
          setSelectedProject(null);
          setSelectedAnnotationSet(null);
        }}
        onConfirm={() =>
          deleteAnnotationSet(selectedProject!.id, selectedAnnotationSet!.id)
        }
        title="Delete Annotation Set"
        body={
          <p className="mb-0">
            Are you sure you want to delete {selectedAnnotationSet?.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
      {selectedProject && (
        <FilesUploadComponent
          show={modalToShow === "addFiles"}
          handleClose={() => {
            showModal(null);
            setSelectedProject(null);
          }}
          project={{ id: selectedProject.id, name: selectedProject.name }}
        />
      )}
      {selectedProject && selectedAnnotationSet && (
        <AnnotationSetResults
          show={modalToShow === "annotationSetResults"}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          annotationSet={selectedAnnotationSet}
          surveyId={selectedProject.id}
        />
      )}
      {selectedAnnotationSet && (
        <AnnotationCountModal
          setId={selectedAnnotationSet.id}
          show={modalToShow === "annotationCount"}
          handleClose={() => {
            showModal(null);
            setSelectedAnnotationSet(null);
          }}
        />
      )}
      {selectedAnnotationSet && (
        <EditAnnotationSetModal
          show={modalToShow === "editAnnotationSet"}
          handleClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          project={selectedProject}
          annotationSet={selectedAnnotationSet}
          setAnnotationSet={(annotationSet) => {
            setProjects(
              projects.map((project) => {
                if (project.id === selectedProject?.id) {
                  return {
                    ...project,
                    annotationSets: project.annotationSets.map((set) =>
                      set.id === annotationSet.id ? annotationSet : set
                    ),
                  };
                }
                return project;
              })
            );
          }}
        />
      )}
    </>
  );
}
