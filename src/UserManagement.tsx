import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import { Row,Col } from "react-bootstrap";
import { UserContext , ProjectContext, ManagementContext, GlobalContext} from "./Context";
import { useContext } from "react";
import { QueueDropdown } from "./QueueDropDown";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import ConfigureUserTestModal from "./ConfigureUserTestModal";
import { useState } from "react";
import "./UserManagement.css"; // Import the CSS file
import TestPresetsModal from "./TestPresetsModal";
import ReviewTestsModal from "./ReviewTestsModal";
import UserTestResultsModal from "./UserTestResultsModal";
import ActionsDropdown from './ActionsDropdown';

const adminTooltip = (
  <Tooltip>
    User needs to be added to project first to be able to make them admin.
  </Tooltip>
);
const selfTooltip = (
  <Tooltip>
    You cannot remove yourself from the project. If you really want to leave the project, ask another admin to do this for you
  </Tooltip>
);
const selfAdminTooltip = (
  <Tooltip>
    You cannot remove your own admin rigths. If you really want to resign as admin, ask another admin to do this for you.
  </Tooltip>
);

export default function UserManagement() {
  const {allUsers,projectMembershipHook: {data: projectMemberships, create: createProjectMembership, delete: deleteProjectMembership, update: updateProjectMembership}} = useContext(ManagementContext)!;
  const {project} = useContext(ProjectContext)!
  const {showModal, modalToShow} = useContext(GlobalContext)!;
  const {
    user: currentUser,
  } = useContext(UserContext)!;
  const [userId, setUserId] = useState<string>('');
  // const {
  //   projectMemberships,
  //   createProjectMembership,
  //   deleteProjectMembership,
  //   updateProjectMembership,
  // } = useProjectMemberships();

  
  // const changeAdminStatus = async (user, enable) => {
  //   console.log(
  //     enable
  //       ? `Grant ${user?.name} admin rights`
  //       : `Revoke ${user?.name}'s admin rights`,
  //   );
  //   if (enable) {
  //     await addUserToGroup({
  //       UserPoolId: backend["detweb-stack-develop"].UserPoolId,
  //       Username: user.id,
  //       GroupName: "admin",
  //     });
  //     updateUser({ id: user.id, isAdmin: true });
  //   } else {
  //     await removeUserFromGroup({
  //       // AdminAddUserToGroupRequest
  //       UserPoolId: backend["detweb-stack-develop"].UserPoolId,
  //       Username: user.id, // required
  //       GroupName: "admin", // required
  //     });
  //     updateUser({ id: user.id, isAdmin: false });
  //   }
  // };

  const tableData = allUsers?.map((user) => {
    const { id, name, email } = user;
    const belongsToCurrentProject =  projectMemberships?.find(
      (pm) => pm.userId == user.id && pm.projectId == project.id,
    );
    return {
      id,
      rowData: [
        name,
        email,
        belongsToCurrentProject ? (
          <QueueDropdown
            key={id + "2"}
            setQueue={(q) => {
              if (q === belongsToCurrentProject?.backupQueueId) {
                // Swap the main and backup queues
                updateProjectMembership({
                  id: belongsToCurrentProject?.id,
                  queueId: belongsToCurrentProject?.backupQueueId,
                  backupQueueId: belongsToCurrentProject?.queueId,
                });
              } else {
                updateProjectMembership({ id: belongsToCurrentProject?.id, queueId: q });
              }
            }}
            currentQueue={belongsToCurrentProject?.queueId || null}
            allowNewOption={false}
          />
        ) : (
          <p>To select a queue, first add user to this project</p>
        )
        ,
        belongsToCurrentProject ? (
          <QueueDropdown
            key={id + "2"}
            setQueue={(q) => {
              if (q === belongsToCurrentProject?.queueId) {
                alert("Backup queue cannot be the same as the main queue.");
                return;
              }
              updateProjectMembership({ id: belongsToCurrentProject?.id, backupQueueId: q });
            }}
            currentQueue={belongsToCurrentProject?.backupQueueId || null}
            allowNoneOption={true}
            allowNewOption={false}
          />
        ) : (
          <p>To select a backup queue, first add user to this project</p>
        ),
        <span>
          <ActionsDropdown actions={[
            {label: "Configure testing", onClick: () => {
              setUserId(user.id);
              showModal("userTestModal");
            }},
            {label: "Test results", onClick: () => {
              setUserId(user.id);
              showModal("userTestResultsModal");
            }},
        ]} />
        <OverlayTrigger
          placement="top"
          overlay={belongsToCurrentProject ? selfAdminTooltip: adminTooltip }
          trigger={['hover', 'focus']}
          show={belongsToCurrentProject && currentUser?.username !== id ? false : undefined}>
          <span>
          {belongsToCurrentProject?.isAdmin ?
            <Button variant="danger"
              className="me-2"
              disabled={currentUser?.username === id}
              onClick={() => () => updateProjectMembership({ id: belongsToCurrentProject.id, isAdmin: 0 })}>
              Remove admin
            </Button > :
            <Button variant="info"
                  className="me-2"
                  onClick={() => updateProjectMembership({ id: belongsToCurrentProject!.id, isAdmin: 1 })}
                  disabled={!belongsToCurrentProject}>
              Make admin
              </Button>}
              </span>
        </OverlayTrigger>
        <OverlayTrigger
          placement="top"
          overlay={selfTooltip}
          trigger={['hover', 'focus']}
          show={currentUser?.username === id ? undefined : false}>
          <span>
            {belongsToCurrentProject?.id ?
              <Button variant="danger"
                className="me-2 fixed-width-button"
                disabled={currentUser.username === user.id}
                onClick={() => { deleteProjectMembership({ id: belongsToCurrentProject?.id }) }} >
                Remove from project
              </Button > :
                <Button variant="info"
                  className="me-2 fixed-width-button"
                  onClick={() => createProjectMembership({
                  userId: user.id,
                  projectId: project.id
                })}>
                Add to project
              </Button>}
          </span>
        </OverlayTrigger></span>

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

  const tableHeadings = [
    { content: "Name" },
    { content: "Email" },
    { content: "Queue", style: { width: "300px" } },
    { content: "Backup Queue", style: { width: "300px" } },
    { content: "Actions" },
    
  ];
  return (
    <>
      <Row className="justify-content-center mt-3">
      <div>
        <h2>User Management</h2>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
        <Col className="text-center mt-3 d-flex justify-content-center gap-2">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>Coming soon. For now please invite users manually.</Tooltip>}
          >
            <span>
              <Button disabled variant="primary" onClick={() => console.log('invite user')}>
                Invite new user
              </Button>
            </span>
          </OverlayTrigger>
            <Button variant="primary" onClick={() => showModal("testPresetsModal")}>
              Test presets
            </Button>
            <Button variant="primary" onClick={() => showModal("reviewTestsModal")}>
              Test locations
            </Button>
        </Col>
        </div>
        <ConfigureUserTestModal show={modalToShow === "userTestModal"} onClose={() => showModal(null)} userId={userId} />
        <TestPresetsModal show={modalToShow === "testPresetsModal"} onClose={() => showModal(null)} />
        <ReviewTestsModal show={modalToShow === "reviewTestsModal"} onClose={() => showModal(null)} />
        <UserTestResultsModal show={modalToShow === "userTestResultsModal"} onClose={() => showModal(null)} userId={userId}/>
      </Row>
    </>
  );
}

