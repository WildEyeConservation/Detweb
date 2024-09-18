import { useContext, useEffect,useState } from "react";
import Form from "react-bootstrap/Form";
import { GlobalContext,UserContext } from "./Context";
import { Schema } from "../amplify/data/resource";

interface ProjectSelectorProps {
  currentPM: Schema['UserProjectMembership']['type'] | undefined,
  setCurrentPM: React.Dispatch<React.SetStateAction<Schema['UserProjectMembership']['type'] | undefined>>
}

function ProjectSelector({ currentPM, setCurrentPM }: ProjectSelectorProps) {
  const { client } = useContext(GlobalContext)!;
  const { myMembershipHook:{ data: myMemberships, create: createProjectMembership}, user } = useContext(UserContext)!;
  const createProject = client.models.Project.create
  const [projects, setProjects] = useState<Schema['Project']['type'][]>([])
  
  useEffect(() => {
    console.log("myMemberships", myMemberships)
    Promise.all(myMemberships?.map(async (membership) => (await client.models.Project.get({ id: membership.projectId })).data))
      .then((projects) => {
        setProjects(projects.filter(project => project !== null));
      });
  }, [myMemberships.length])
  
  const onNewProject = async () => {
    const name = prompt("Please enter Project name", "");
    if (name) {
      const {data:project} = await createProject({
        name,
      });
      if (project) {
        await createProjectMembership({
          projectId: project.id!, userId: user.username, isAdmin: 1
        });
        return project.id
      }
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
                    if (value) {
                      setCurrentPM(myMemberships.find(membership => membership.projectId === value));
                    }
                  });
                } else {
                  setCurrentPM(myMemberships.find(membership => membership.projectId === e.target.value))
                }
              }}
              value={currentPM?.projectId}
            >
              {!currentPM && <option>Select a Project to work on:</option>}
              {projects?.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
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
