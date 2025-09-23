import { useContext, useEffect,useState, useMemo } from "react";
import Form from "react-bootstrap/Form";
import { GlobalContext,UserContext } from "./Context";
import { Schema } from "../amplify/client-schema";
import { useNavigate,useParams } from "react-router-dom";
import NavDropdown from 'react-bootstrap/NavDropdown';
interface ProjectSelectorProps {
  currentPM: Schema['UserProjectMembership']['type'] | undefined;
  setCurrentPM: React.Dispatch<
    React.SetStateAction<Schema['UserProjectMembership']['type'] | undefined>
  >;
}

function ProjectSelector({ currentPM, setCurrentPM }: ProjectSelectorProps) {
  const { client } = useContext(GlobalContext)!;
  const {
    myMembershipHook: { data: myMemberships, create: createProjectMembership },
    user,
  } = useContext(UserContext)!;
  const createProject = client.models.Project.create;
  const [projects, setProjects] = useState<Schema['Project']['type'][]>([]);
  const { projectId, organizationId } = useParams();

  const navigate = useNavigate();
  // useEffect(() => {
  //   console.log("myMemberships", myMemberships)
  //   Promise.all(myMemberships?.map(async (membership) => (await client.models.Project.get({ id: membership.projectId })).data))
  //     .then((projects) => {
  //       setProjects(projects.filter(project => project !== null));
  //       if (projectId) {
  //         setCurrentPM(myMemberships.find(membership => membership.projectId === projectId));
  //       }
  //     });
  // }, [myMemberships.length])

  const projectsQueries = useQueries({
    queries: myMemberships.map(membership => ({
      queryKey: ["project", membership.id],
      queryFn: () => client.models.Project.get({ id: membership.projectId })
    }))
  })

  const projects = useMemo(() => projectsQueries.filter(query=>query.isSuccess).map(query=>query.data?.data), [projectsQueries])

  useEffect(() => {
    console.log('myMemberships', myMemberships);
    Promise.all(
      myMemberships?.map(
        async (membership) =>
          (await client.models.Project.get({ id: membership.projectId })).data
      )
    ).then((projects) => {
      setProjects(
        projects.filter(
          (project) =>
            project !== null && project.organizationId === organizationId
        )
      );
      if (projectId) {
        setCurrentPM(
          myMemberships.find((membership) => membership.projectId === projectId)
        );
      }
    });
  }, [myMemberships.length, organizationId]);

  const onNewProject = async () => {
    const name = prompt('Please enter Project name', '');
    if (name) {
      const { data: project } = await createProject({
        name,
        organizationId: organizationId!,
        createdBy: user.username,
      });
      if (project) {
        await createProjectMembership({
          projectId: project.id!,
          userId: user.username,
          isAdmin: true,
        });
        return project.id;
      }
    }
  };

  return organizationId ? (
    <NavDropdown
      title={
        currentPM
          ? projects.find((p) => p.id === currentPM.projectId)?.name
          : 'Select a Project'
      }
      id="project-nav-dropdown"
      onSelect={(projectId) => {
        if (projectId === 'new') {
          onNewProject().then((value) => {
            if (value) {
              setCurrentPM(
                myMemberships.find(
                  (membership) => membership.projectId === value
                )
              );
              navigate(`/${organizationId}/${value}`);
            }
          });
        } else if (projectId) {
          setCurrentPM(
            myMemberships.find(
              (membership) => membership.projectId === projectId
            )
          );
          navigate(`/${organizationId}/${projectId}`);
        }
      }}
    >
      {!currentPM && (
        <NavDropdown.Item key="none" disabled>
          Select a Project to work on
        </NavDropdown.Item>
      )}
      {projects?.map((project) => (
        <NavDropdown.Item
          key={project.id}
          eventKey={project.id}
          active={currentPM?.projectId === project.id}
        >
          {project.name}
        </NavDropdown.Item>
      ))}
      <NavDropdown.Item eventKey="new">Create a new Project</NavDropdown.Item>
    </NavDropdown>
  ) : null;
}

export default ProjectSelector;
