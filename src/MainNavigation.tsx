import { useContext, useEffect, useState } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import { NavLink, useLocation, useParams, useNavigate } from 'react-router-dom';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import { Schema } from '../amplify/data/resource';
import { Outlet } from 'react-router-dom';
import OrganizationSelector from './OrganizationSelector.tsx';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Container from 'react-bootstrap/Container';
import Notifications from './user/Notifications.tsx';
import { UserContext } from './Context.tsx';

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const { cognitoGroups, isOrganizationAdmin } = useContext(UserContext)!;

  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [currentPM, setCurrentPM] = useState<
    Schema['UserProjectMembership']['type'] | undefined
  >(undefined);

  const location = useLocation();
  const navigate = useNavigate();
  const { organizationId, projectId } = useParams();

  const projectPath = `${organizationId ? `${organizationId}/` : ''}${
    organizationId && projectId ? `${projectId}/` : ''
  }`;
  const organizationPath = `manage-organization/${
    organizationId ? `${organizationId}/` : ''
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
            {location.pathname.includes('manage-organization') && (
              <OrganizationSelector />
            )}
            <Nav
              fill
              activeKey={location.pathname}
              className="d-flex flex-row me-2"
            >
              {location.pathname.includes('manage-organization') ? (
                organizationId && (
                  <>
                    <Nav.Link
                      as={NavLink}
                      eventKey={`${organizationPath}users`}
                      to={`${organizationPath}users`}
                    >
                      Users
                    </Nav.Link>
                    <Nav.Link
                      as={NavLink}
                      eventKey={`${organizationPath}info`}
                      to={`${organizationPath}info`}
                    >
                      Organization Info
                    </Nav.Link>
                  </>
                )
              ) : (
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
                </>
              )}
            </Nav>
          </div>
          {(isOrganizationAdmin || cognitoGroups.includes('sysadmin')) && (
            <Navbar.Offcanvas
              id={`offcanvasNavbar-expand-${expand}`}
              aria-labelledby={`offcanvasNavbarLabel-expand-${expand}`}
              placement="end"
              show={showOffcanvas}
              onHide={() => setShowOffcanvas(false)}
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title id={`offcanvasNavbarLabel-expand-${expand}`}>
                  WildEye ESS
                </Offcanvas.Title>
              </Offcanvas.Header>
              <Offcanvas.Body>
                <Nav className="justify-content-end flex-grow-1 pe-3">
                  <Nav.Link
                    as={NavLink}
                    eventKey="/"
                    to="/"
                    onClick={() => {
                      // setCurrentPM(undefined);
                      setShowOffcanvas(false);
                    }}
                  >
                    Home
                  </Nav.Link>
                  <Nav.Link
                    as={NavLink}
                    eventKey="/manage-organization"
                    to="/manage-organization"
                    onClick={() => {
                      // setCurrentPM(undefined);
                      setShowOffcanvas(false);
                    }}
                  >
                    Manage Organizations
                  </Nav.Link>
                  {cognitoGroups.includes('sysadmin') && (
                    <Nav.Link
                      as={NavLink}
                      eventKey="/create-organization"
                      to="/create-organization"
                      onClick={() => {
                        // setCurrentPM(undefined);
                        setShowOffcanvas(false);
                      }}
                    >
                      Create Organization
                    </Nav.Link>
                  )}
                  <Nav.Link onClick={signOut}>Logout</Nav.Link>
                </Nav>
              </Offcanvas.Body>
            </Navbar.Offcanvas>
          )}
          <div className="d-flex flex-row flex-grow-1 justify-content-end">
            <ProgressIndicators />
            <Notifications />
          </div>
          {isOrganizationAdmin || cognitoGroups.includes('sysadmin') ? (
            <Navbar.Toggle
              aria-controls={`offcanvasNavbar-expand-${expand}`}
              onClick={() => setShowOffcanvas(true)}
            />
          ) : (
            <Nav.Link onClick={signOut}>Logout</Nav.Link>
          )}
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