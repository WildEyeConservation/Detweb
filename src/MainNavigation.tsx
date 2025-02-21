import { useContext, useEffect, useState } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import { NavLink, useLocation, useParams, useNavigate } from 'react-router-dom';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import { Schema } from '../amplify/data/resource';
import { Outlet } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Notifications from './user/Notifications.tsx';
import { UserContext } from './Context.tsx';

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const { cognitoGroups, isOrganizationAdmin } = useContext(UserContext)!;

  const [currentPM, setCurrentPM] = useState<
    Schema['UserProjectMembership']['type'] | undefined
  >(undefined);

  const location = useLocation();
  const navigate = useNavigate();
  const { organizationId, projectId } = useParams();

  const projectPath = `${organizationId ? `${organizationId}/` : ''}${
    organizationId && projectId ? `${projectId}/` : ''
  }`;

  useEffect(() => {
    if (location.pathname === '' || location.pathname === '/') {
      navigate(isOrganizationAdmin ? '/surveys' : '/jobs');
    }
  }, [location.pathname, isOrganizationAdmin]);

  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === '/jobs') {
      navigate('/surveys');
    }
  }, [isOrganizationAdmin]);

  const expand = false;
  return (
    <div
      className="App d-flex flex-column"
      style={{ height: '100vh', overflow: 'hidden' }} // Changed overflow to hidden
    >
      <Navbar
        bg="primary"
        variant="dark"
        fixed="top"
        key={expand}
        expand={expand}
      >
        <div className="w-100 d-flex flex-row">
          <div className="d-flex flex-row">
            <Nav
              fill
              activeKey={location.pathname}
              className="d-flex flex-row me-2"
            >
              <>
                {isOrganizationAdmin && (
                  <Nav.Link as={NavLink} eventKey={`surveys`} to={`surveys`}>
                    Surveys
                  </Nav.Link>
                )}
                <Nav.Link as={NavLink} eventKey={`jobs`} to={`jobs`}>
                  Jobs
                </Nav.Link>
                {/* <Nav.Link
                    as={NavLink}
                    eventKey={`${projectPath}annotate`}
                    to={`${projectPath}annotate`}
                  >
                    Annotate
                  </Nav.Link> */}
                {/* <IfProjectAdmin currentPM={currentPM}>
                            <Nav.Link
                              as={NavLink}
                              eventKey={`${projectPath}projectManagement`}
                              to={`${projectPath}projectManagement`}
                            >
                              Project Management
                            </Nav.Link>
                          </IfProjectAdmin> */}
                <Nav.Link
                  as={NavLink}
                  eventKey={`${projectPath}leaderboard`}
                  to={`${projectPath}leaderboard`}
                >
                  Leaderboard
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  eventKey={`${projectPath}review`}
                  to={`${projectPath}review`}
                >
                  Review
                </Nav.Link>
                {isOrganizationAdmin && (
                  <Nav.Link
                    as={NavLink}
                    eventKey={`permissions`}
                    to={`permissions`}
                  >
                    Permissions
                  </Nav.Link>
                )}
                {cognitoGroups.includes('sysadmin') && (
                  <Nav.Link
                    as={NavLink}
                    eventKey={`onboarding`}
                    to={`onboarding`}
                  >
                    Onboarding
                  </Nav.Link>
                )}
              </>
            </Nav>
          </div>
          <div className="d-flex flex-row flex-grow-1 justify-content-end">
            <ProgressIndicators />
            <Notifications />
            <Nav.Link onClick={signOut}>Logout</Nav.Link>
          </div>
        </div>
      </Navbar>
      <Container
        fluid
        className="d-flex justify-content-center h-100"
        style={{ marginTop: '56px', overflowY: 'auto' }}
      >
        <Outlet context={{ currentPM }} />
      </Container>
    </div>
  );
}
