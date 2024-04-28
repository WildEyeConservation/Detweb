import React, { useContext, useEffect } from "react";
import Form from "react-bootstrap/Form";
import { useProjects, useProjectMemberships } from "./useGqlCached";
import { UserContext } from "./UserContext";

function ProjectSelector() {
  const { user, setCurrentProject, projects, currentProject } =
    useContext(UserContext);
  const { createProject } = useProjects();
  const { createProjectMembership } = useProjectMemberships();

  useEffect(() => {
    if (projects?.length == 0) {
      alert(
        "You have not been added to any projects yet. You won't be able to participate until an admin adds you to one of their projects and assigns you to a work queue. ",
      );
    }
    if (projects?.length == 1) {
      setCurrentProject(projects[0]);
    }
  }, [user, projects]);

  const onNewProject = async () => {
    const name = prompt("Please enter Project name", "");
    createProject({ name });
    createProjectMembership({ projectId: name, userId: user.id });
    return name;
  };

  //Only show form if user is admin or has more than one project to select from
  return (
    <>
      {(user?.isAdmin || projects?.length > 1) && (
        <Form>
          <Form.Select
            onChange={(e) => {
              if (e.target.value == "new") {
                onNewProject().then((value) => setCurrentProject(value));
              } else setCurrentProject(e.target.value);
            }}
            value={currentProject}
          >
            {!currentProject && <option>Select a Project to work on:</option>}
            {projects?.map((project) => (
              <option value={project} key={project}>
                {project}
              </option>
            ))}
            {user?.isAdmin && <option value="new">Create a new Project</option>}
          </Form.Select>
        </Form>
      )}
    </>
  );
}

export default ProjectSelector;
