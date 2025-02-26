import { useContext, useEffect } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import { Outlet } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Notifications from './user/Notifications.tsx';
import { UserContext } from './Context.tsx';

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const {
    cognitoGroups,
    isOrganizationAdmin,
    myMembershipHook: myProjectsHook,
  } = useContext(UserContext)!;

  const location = useLocation();
  const navigate = useNavigate();

  const myAdminProjects = myProjectsHook.data?.filter(
    (project) => project.isAdmin
  );

  useEffect(() => {
    if (
      location.pathname === '' ||
      location.pathname === '/' ||
      location.pathname === '/surveys' ||
      location.pathname === '/jobs'
    ) {
      navigate(
        myAdminProjects?.length > 0 || isOrganizationAdmin
          ? '/surveys'
          : '/jobs'
      );
    }
  }, [isOrganizationAdmin, myAdminProjects.length]);

  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === '/jobs') {
      navigate('/surveys');
    }
  }, [isOrganizationAdmin]);

  const expand = false;
  return (
    <div
      className="App d-flex flex-column"
      style={{ height: '100vh', overflow: 'hidden' }}
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
                {(myAdminProjects?.length > 0 || isOrganizationAdmin) && (
                  <Nav.Link as={NavLink} eventKey={`surveys`} to={`surveys`}>
                    Surveys
                  </Nav.Link>
                )}
                <Nav.Link as={NavLink} eventKey={`jobs`} to={`jobs`}>
                  Jobs
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
                <Nav.Link
                  as={NavLink}
                  eventKey={`annotation-statistics`}
                  to={`annotation-statistics`}
                >
                  Annotation Statistics
                </Nav.Link>
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
        <Outlet />
      </Container>
    </div>
  );
}
