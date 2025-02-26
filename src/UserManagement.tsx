import MyTable from './Table';
import Button from 'react-bootstrap/Button';
import { Row, Col } from 'react-bootstrap';
import {
  ProjectContext,
  ManagementContext,
  GlobalContext,
} from './Context';
import { useContext } from 'react';
import { QueueDropdown } from './QueueDropDown';
import ConfigureUserTestModal from './ConfigureUserTestModal';
import { useState } from 'react';
import './UserManagement.css'; // Import the CSS file
import TestPresetsModal from './TestPresetsModal';
import ReviewTestsModal from './ReviewTestsModal';
import UserTestResultsModal from './UserTestResultsModal';
import ActionsDropdown from './ActionsDropdown';

export default function UserManagement() {
  const {
    allUsers,
    projectMembershipHook: {
      data: projectMemberships,
      update: updateProjectMembership,
    },
  } = useContext(ManagementContext)!;
  const { project } = useContext(ProjectContext)!;
  const { showModal, modalToShow } = useContext(GlobalContext)!;
  const [userId, setUserId] = useState<string>('');

  const tableData = allUsers
    ?.filter((user) =>
      projectMemberships?.some(
        (pm) => pm.userId == user.id && pm.projectId == project.id
      )
    )
    .map((user) => {
      const { id, name, email } = user;
      const belongsToCurrentProject = projectMemberships?.find(
        (pm) => pm.userId == user.id && pm.projectId == project.id
      );

      return {
        id,
        rowData: [
          name,
          email,
          belongsToCurrentProject ? (
            <QueueDropdown
              key={id + '2'}
              setQueue={(q) => {
                if (q === belongsToCurrentProject?.backupQueueId) {
                  // Swap the main and backup queues
                  updateProjectMembership({
                    id: belongsToCurrentProject?.id,
                    queueId: belongsToCurrentProject?.backupQueueId,
                    backupQueueId: belongsToCurrentProject?.queueId,
                  });
                } else {
                  updateProjectMembership({
                    id: belongsToCurrentProject?.id,
                    queueId: q,
                  });
                }
              }}
              currentQueue={belongsToCurrentProject?.queueId || null}
              allowNewOption={false}
            />
          ) : (
            <p>To select a queue, first add user to this project</p>
          ),
          belongsToCurrentProject ? (
            <QueueDropdown
              key={id + '2'}
              setQueue={(q) => {
                if (q === belongsToCurrentProject?.queueId) {
                  alert('Backup queue cannot be the same as the main queue.');
                  return;
                }
                updateProjectMembership({
                  id: belongsToCurrentProject?.id,
                  backupQueueId: q,
                });
              }}
              currentQueue={belongsToCurrentProject?.backupQueueId || null}
              allowNoneOption={true}
              allowNewOption={false}
            />
          ) : (
            <p>To select a backup queue, first add user to this project</p>
          ),
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
        ],
      };
    });

  const tableHeadings = [
    { content: "Name" },
    { content: "Email" },
    { content: "Queue", style: { width: "400px" } },
    { content: "Backup Queue", style: { width: "400px" } },
    { content: "Actions" },
  ];
  return (
    <>
      <Row className="justify-content-center mt-3 mb-3">
        <div>
          <h2>User Management</h2>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
          <Col className="text-center mt-3 d-flex justify-content-center gap-2">
            <Button
              variant="primary"
              onClick={() => showModal('testPresetsModal')}
            >
              Test presets
            </Button>
            <Button
              variant="primary"
              onClick={() => showModal('reviewTestsModal')}
            >
              Test locations
            </Button>
          </Col>
        </div>
        <ConfigureUserTestModal
          show={modalToShow === 'userTestModal'}
          onClose={() => showModal(null)}
          userId={userId}
        />
        <TestPresetsModal
          show={modalToShow === 'testPresetsModal'}
          onClose={() => showModal(null)}
        />
        <ReviewTestsModal
          show={modalToShow === 'reviewTestsModal'}
          onClose={() => showModal(null)}
        />
        <UserTestResultsModal
          show={modalToShow === 'userTestResultsModal'}
          onClose={() => showModal(null)}
          userId={userId}
        />
      </Row>
    </>
  );
}
