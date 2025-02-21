import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from './Context.tsx';
import { Schema } from '../amplify/data/resource';
import { Card, Button } from 'react-bootstrap';
import MyTable from './Table.tsx';
import NewSurvey from './NewSurvey.tsx';

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { myMembershipHook: myProjectsHook, isOrganizationAdmin } = useContext(UserContext)!;
  const [projects, setProjects] = useState<Schema['Project']['type'][]>([]);

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
                    'name',
                    'id',
                    'organizationId',
                    'organization.name',
                  ],
                }
              )
            ).data
        )
      ).then((projects) => {
        setProjects(projects.filter((project) => project !== null));
      });
    }

    getProjects();
  }, [myProjectsHook.data]);

  const tableData = projects.map((project) => ({
    id: project.id,
    rowData: [
      <div>
        <h5>{project.name}</h5>
        <i style={{ fontSize: '16px' }}>{project.organization.name}</i>
      </div>,
    ],
  }));

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  return (
    <>
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          marginTop: '16px',
          marginBottom: '16px',
        }}
      >
        <Card>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Card.Title className="mb-0">
                <h4 className="mb-0">Your Surveys</h4>
              </Card.Title>
              <Button variant="primary" onClick={() => showModal('newSurvey')}>
                New Survey
              </Button>
            </div>
            <MyTable
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage="You are not an admin of any surveys."
            />
          </Card.Body>
        </Card>
      </div>
      <NewSurvey
        show={modalToShow === 'newSurvey'}
        onClose={() => showModal(null)}
      />
    </>
  );
}
