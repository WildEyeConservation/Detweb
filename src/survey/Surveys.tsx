import { useContext, useEffect, useState } from "react";
import { UserContext, GlobalContext } from "../Context.tsx";
import { Schema } from "../../amplify/data/resource.ts";
import { Card, Button, Form } from "react-bootstrap";
import MyTable from "../Table.tsx";
import NewSurveyModal from "./NewSurveyModal.tsx";
import { useNavigate } from "react-router-dom";
import FilesUploadComponent from "../FilesUploadComponent.tsx";
import ConfirmationModal from "../ConfirmationModal.tsx";
import AnnotationSetResults from "../AnnotationSetResults.tsx";
import AnnotationCountModal from "../AnnotationCountModal.tsx";
import EditAnnotationSetModal from "../EditAnnotationSet.tsx";
import AddAnnotationSetModal from "./AddAnnotationSetModal.tsx";
import LaunchAnnotationSetModal from "./LaunchAnnotationSetModal.tsx";
import EditSurveyModal from "./editSurveyModal.tsx";
import SpatioTemporalSubset from "../SpatioTemporalSubset.tsx";
import SubsampleModal from "../Subsample.tsx";
import FileStructureSubset from "../filestructuresubset.tsx";

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { myMembershipHook: myProjectsHook, isOrganizationAdmin } =
    useContext(UserContext)!;
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState<Schema["Project"]["type"][]>([]);
  const [selectedProject, setSelectedProject] = useState<
    Schema["Project"]["type"] | null
  >(null);
  const [selectedAnnotationSet, setSelectedAnnotationSet] = useState<
    Schema["AnnotationSet"]["type"] | null
  >(null);
  const [search, setSearch] = useState("");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);

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
                    "annotationSets.categories.id",
                    "annotationSets.categories.name",
                    "annotationSets.categories.shortcutKey",
                    "annotationSets.categories.color",
                    "imageSets.id",
                    "imageSets.name",
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

  const tableData = projects
    .filter(
      (project) =>
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.organization.name.toLowerCase().includes(search.toLowerCase())
    )
    .map((project) => ({
      id: project.id,
      rowData: [
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div>
            <h5 className="mb-0">{project.name}</h5>
            <i style={{ fontSize: "14px" }}>{project.organization.name}</i>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={(e) => {
                if (e.ctrlKey) {
                  navigate(`/surveys/${project.id}/manage`);
                } else {
                  setSelectedProject(project);
                  showModal("editSurvey");
                }
              }}
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
              variant="primary"
              onClick={() => {
                setSelectedProject(project);
                showModal("addAnnotationSet");
              }}
            >
              Add Annotation Set
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
                className={`d-flex justify-content-between align-items-center gap-2 ${
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
                      showModal("launchAnnotationSet");
                    }}
                  >
                    Launch
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
          <Card.Header className="d-flex justify-content-between align-items-center">
            <Card.Title className="mb-0">
              <h4 className="mb-0">Your Surveys</h4>
            </Card.Title>
            <Form.Control
              type="text"
              className="w-25"
              placeholder="Search by survey or organization"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Card.Header>
          <Card.Body>
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
          </Card.Body>
          {isOrganizationAdmin && (
            <Card.Footer className="d-flex justify-content-center">
              <Button variant="primary" onClick={() => showModal("newSurvey")}>
                New Survey
              </Button>
            </Card.Footer>
          )}
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
      {selectedAnnotationSet && selectedProject && (
        <EditAnnotationSetModal
          show={modalToShow === "editAnnotationSet"}
          handleClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          project={selectedProject}
          categories={selectedProject.categories}
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
          setEditSurveyTab={setTab}
        />
      )}
      {selectedProject && (
        <AddAnnotationSetModal
          show={modalToShow === "addAnnotationSet"}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
          }}
          project={selectedProject}
          allProjects={projects}
          addAnnotationSet={(annotationSet) => {
            setProjects(
              projects.map((project) =>
                project.id === selectedProject?.id
                  ? {
                      ...project,
                      annotationSets: [
                        ...project.annotationSets,
                        {
                          id: annotationSet.id,
                          name: annotationSet.name,
                        },
                      ],
                    }
                  : project
              )
            );
          }}
          categories={selectedProject.categories}
          setTab={setTab}
        />
      )}
      {selectedProject && selectedAnnotationSet && (
        <LaunchAnnotationSetModal
          show={modalToShow === "launchAnnotationSet"}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          imageSets={selectedProject.imageSets}
          annotationSet={selectedAnnotationSet}
          projectId={selectedProject.id}
        />
      )}
      {selectedProject && (
        <EditSurveyModal
          show={modalToShow === "editSurvey"}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedSets([]);
          }}
          project={selectedProject}
          openTab={tab}
          setSelectedSets={setSelectedSets}
        />
      )}
      {selectedProject && (
        <>
          <SpatioTemporalSubset
            show={modalToShow == "SpatiotemporalSubset"}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            project={selectedProject}
          />
          <SubsampleModal
            show={modalToShow == "Subsample"}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            setSelectedImageSets={setSelectedSets}
            project={selectedProject}
          />
          <FileStructureSubset
            show={modalToShow == "FileStructureSubset"}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            imageSets={selectedProject.imageSets}
            project={selectedProject}
          />
        </>
      )}
    </>
  );
}
