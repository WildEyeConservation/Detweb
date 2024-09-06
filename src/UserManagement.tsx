import MyTable from "./Table";
// import { onCreateCategory, onUpdateCategory, onDeleteCategory } from './graphql/subscriptions'
// import { listCategories } from './graphql/queries';
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Row } from "react-bootstrap";

import { useUsers, useProjectMemberships, Identifiable } from "./useGqlCached";
import { UserContext } from "./UserContext";
import { useContext } from "react";
import { QueueDropdown } from "./QueueDropDown";
import { GQL_Client } from "./App";


interface User extends Identifiable {
  id: string;
  name: string;
  isAdmin: boolean;
}

interface ProjectMembership {
  id: string;
  userId: string;
  projectId: string;
  queueUrl?: string;
}

export default function UserManagement() {
  const { users } = useUsers(); 
  const {
    user: currentUser,
    currentProject,
  } = useContext(UserContext)!;
  const {
    projectMemberships,
    createProjectMembership,
    deleteProjectMembership,
    updateProjectMembership,
  } = useProjectMemberships();

  async function setUserQueue(pm: ProjectMembership, queueUrl: string) {
    console.log(`Setting user ${pm.userId} to use queue ${queueUrl}`);
    updateProjectMembership({ id: pm.id, userId: pm.userId, projectId: pm.projectId, queueUrl });
  }

  const changeAdminStatus = async (user: User, enable: boolean) => {
    console.log(
      enable
        ? `Grant ${user?.name} admin rights`
        : `Revoke ${user?.name}'s admin rights`,
    );
    if (enable) {
      GQL_Client.mutations.addUserToGroup({
        userId: user.id,
        groupName: currentProject+"-admin",
      });
    } else {
      GQL_Client.mutations.removeUserFromGroup({
        userId: user.id,
        groupName: currentProject+"-admin",

      });
    }
  };

  const tableData = (users as User[])?.map((user: User) => {
    const { id, name, isAdmin } = user;
    const belongsToCurrentProject = projectMemberships?.find(
      (pm: ProjectMembership) => pm.userId == user.id && pm.projectId == currentProject,
    );
    return {
      id,
      rowData: [
        name,
        <Form.Check
          id="custom-switch"
          disabled={currentUser?.id === id}
          key={id + "0"}
          checked={isAdmin}
          onChange={(e) => changeAdminStatus(user, e.target.checked)}
        />,
        <Form.Check
          id="custom-switch"
          disabled={currentUser?.id === id}
          key={id + "1"}
          checked={!!belongsToCurrentProject?.id || false}
          onChange={(e) =>
            e.target.checked
              ? createProjectMembership({
                  id: '',
                  userId: user.id,
                  projectId: currentProject!,
                })
              : deleteProjectMembership({ id: belongsToCurrentProject!.id })
          }
        />,
        belongsToCurrentProject ? (
          <QueueDropdown
            key={id + "2"}
            setQueue={(q: any) => setUserQueue(belongsToCurrentProject, q)}
            currentQueue={belongsToCurrentProject?.queueUrl || ""}
          />
        ) : (
          <p>To select a queue, first add user to this project</p>
        ),
        <Button variant="primary" key={id + "3"} onClick={() => {}}>
          Delete
        </Button>,
      ],
    };
  });

  const tableHeadings = [
    { content: "Name", style: undefined },
    { content: "Admin", style: undefined },
    { content: `Belongs to ${currentProject}`, style: undefined },
    { content: "Queue", style: { width: "500px" } },
    { content: "", style: undefined },
  ];
  return (
    <>
      <Row className="justify-content-center mt-3">
        <div>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
        </div>
      </Row>
    </>
  );
}
