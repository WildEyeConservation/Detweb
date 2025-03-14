import { useContext, useEffect, useState } from "react";
import { UserContext, GlobalContext } from "../Context.tsx";
import { Schema } from "../../amplify/data/resource.ts";
import { Card, Button } from "react-bootstrap";
import MyTable from "../Table.tsx";
import NewSurveyModal from "./NewSurveyModal.tsx";
import { useNavigate } from "react-router-dom";
import FilesUploadComponent from "../FilesUploadComponent.tsx";
import ConfirmationModal from "../ConfirmationModal.tsx";

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const { myMembershipHook: myProjectsHook, isOrganizationAdmin } =
    useContext(UserContext)!;
  const [projects, setProjects] = useState<Schema["Project"]["type"][]>([]);
  const [selectedProject, setSelectedProject] = useState<
    Schema["Project"]["type"] | null
  >(null);

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

  const tableData = projects.map((project) => ({
    id: project.id,
    rowData: [
      <div className="d-flex justify-content-between align-items-center p-2">
        <div>
          <h5 className="mb-0">{project.name}</h5>
          <i style={{ fontSize: "14px" }}>{project.organization.name}</i>
        </div>
        <div className="d-flex gap-2">
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
            variant="primary"
            onClick={() => navigate(`/surveys/${project.id}/review`)}
          >
            Explore
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/surveys/${project.id}/registration`)}
          >
            Register
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/surveys/${project.id}/manage`)}
          >
            Manage
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
        body="Are you sure you want to delete this survey?"
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
    </>
  );
}
