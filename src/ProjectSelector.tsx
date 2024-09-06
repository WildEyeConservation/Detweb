import { useContext, useEffect } from "react";
import Form from "react-bootstrap/Form";
import { useProjects, useProjectMemberships } from "./useGqlCached";
import { UserContext, UserContextType } from "./UserContext";
import { GQL_Client } from "./App";

function ProjectSelector() {
  const { user, setCurrentProject, projects, currentProject } = useContext(UserContext) as UserContextType;
  const { createProject } = useProjects();
  const { createProjectMembership } = useProjectMemberships();

  useEffect(() => {
    if (projects?.length === 0) {
      alert(
        "You have not been added to any projects yet. You won't be able to participate until an admin adds you to one of their projects and assigns you to a work queue.",
      );
    }
    if (projects?.length === 1) {
      setCurrentProject(projects[0]);
    }
  }, [user, projects, setCurrentProject]);

  const onNewProject = async () => {
    const name = prompt("Please enter Project name", "");
    if (name) {
      const project = await createProject({
        name,
      });
      createProjectMembership({
        projectId: project.id, userId: user!.id
      });
      setCurrentProject(project);
      await GQL_Client.mutations.addUserToGroup({
        userId: user!.id,
        groupName: project.id+'-admin',
      });
      return name;
    }
  };

  return (
    <>
      {(
        <Form>
          <Form.Select
            onChange={(e) => {
              if (e.target.value === "new") {
                onNewProject().then((value) => {
                  if (value) setCurrentProject(value);
                });
              } else {
                setCurrentProject(e.target.value);
              }
            }}
            value={currentProject || ""}
          >
            {!currentProject && <option>Select a Project to work on:</option>}
            {projects?.map((project) => (
              <option value={project} key={project}>
                {project}
              </option>
            ))}
            {<option value="new">Create a new Project</option>}
          </Form.Select>
        </Form>
      )}
    </>
  );
}

export default ProjectSelector;
