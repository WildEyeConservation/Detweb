import { useContext, useEffect, useState } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import { Outlet } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Notifications from './user/Notifications.tsx';
import { UserContext, GlobalContext } from './Context.tsx';
import Settings from './user/Settings.tsx';
import { Card, Button } from 'react-bootstrap';
import UploadProgress from './upload/UploadProgress.tsx';
import { verifyToken } from './utils/jwt.ts';
import { useQueryClient } from '@tanstack/react-query';

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const {
    cognitoGroups,
    myOrganizationHook,
    isOrganizationAdmin,
    myMembershipHook: myProjectsHook,
    isAnnotatePath,
    setIsAnnotatePath,
    user,
  } = useContext(UserContext)!;
  const queryClient = useQueryClient();

  const { client } = useContext(GlobalContext)!;
  const [checkingToken, setCheckingToken] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const myAdminProjects = myProjectsHook.data?.filter(
    (project) => project.isAdmin
  );

  const belongsToOrganization = myOrganizationHook.data.length > 0;

  useEffect(() => {
    setIsAnnotatePath(/^\/surveys\/[^/]+\/annotate$/.test(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (
      belongsToOrganization &&
      (location.pathname === '' ||
        location.pathname === '/' ||
        location.pathname === '/SSRegisterOrganization' ||
        location.pathname === '/surveys' ||
        location.pathname === '/jobs')
    ) {
      navigate(
        myAdminProjects?.length > 0 || isOrganizationAdmin
          ? '/surveys'
          : '/jobs'
      );
    }
  }, [isOrganizationAdmin, myAdminProjects.length, belongsToOrganization]);

  useEffect(() => {
    async function checkToken() {
      setCheckingToken(true);
      try {
        const token = localStorage.getItem('jwt');
        if (token) {
          localStorage.removeItem('jwt');

          const { data: secret } = await client.mutations.getJwtSecret();
          if (!secret) {
            console.error('Error getting JWT secret');
            return;
          }

          const payload = (await verifyToken(token, secret)) as {
            type: string;
            surveyId: string;
            annotationSetId: string;
            exp: number;
          };

          if (payload.exp < Date.now() / 1000) {
            alert('Results link expired');
            return;
          }

          if (payload.type === 'jolly') {
            const { data: jollyResultsMembership } =
              await client.models.JollyResultsMembership.get({
                surveyId: payload.surveyId,
                annotationSetId: payload.annotationSetId,
                userId: user.userId,
              });

            if (!jollyResultsMembership) {
              await client.models.JollyResultsMembership.create({
                surveyId: payload.surveyId,
                annotationSetId: payload.annotationSetId,
                userId: user.userId,
              });
            }

            queryClient.invalidateQueries({
              queryKey: ['JollyResultsMembership'],
            });

            navigate(`/jolly/${payload.surveyId}/${payload.annotationSetId}`);
          }
        }
      } catch (error) {
        console.error(error);
        localStorage.removeItem('jwt');
      } finally {
        setCheckingToken(false);
      }
    }

    checkToken();
  }, []);

  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === '/jobs') {
      navigate('/surveys');
    }
  }, [isOrganizationAdmin]);

  const expand = 'lg';
  return (
    <div
      className='App d-flex flex-column'
      style={{ height: '100dvh', overflow: 'hidden' }}
    >
      <Navbar
        bg='secondary'
        className='px-3'
        variant='dark'
        sticky='top'
        key={expand}
        expand={expand}
        collapseOnSelect
      >
        <Navbar.Brand
          className='d-flex flex-row align-items-center flex-nowrap me-2'
          onClick={() =>
            navigate(
              isOrganizationAdmin
                ? '/surveys'
                : belongsToOrganization
                ? '/jobs'
                : '/'
            )
          }
          style={{ cursor: 'pointer' }}
        >
          <img
            src='/Logo.png'
            alt='Logo'
            style={{ height: '32px', marginRight: '4px' }}
          />
          <h1 style={{ marginBottom: '0px', fontSize: '24px' }}>SurveyScope</h1>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls='responsive-navbar-nav' />
        <Navbar.Collapse id='responsive-navbar-nav'>
          {!isAnnotatePath && (
            <Nav fill activeKey={location.pathname}>
              {belongsToOrganization && (
                <>
                  {(myAdminProjects?.length > 0 || isOrganizationAdmin) && (
                    <Nav.Link
                      as={NavLink}
                      eventKey={`surveys`}
                      to={`surveys`}
                      className='px-2'
                    >
                      Surveys
                    </Nav.Link>
                  )}
                  <Nav.Link
                    as={NavLink}
                    eventKey={`jobs`}
                    to={`jobs`}
                    className='px-2'
                  >
                    Jobs
                  </Nav.Link>
                  <Nav.Link
                    as={NavLink}
                    eventKey={`annotation-statistics`}
                    to={`annotation-statistics`}
                    className='px-2'
                  >
                    Annotation Statistics
                  </Nav.Link>
                </>
              )}
              {isOrganizationAdmin && (
                <>
                  <Nav.Link
                    as={NavLink}
                    eventKey={`permissions`}
                    to={`permissions`}
                    className='px-2'
                  >
                    Permissions
                  </Nav.Link>
                  <Nav.Link
                    as={NavLink}
                    eventKey={`testing`}
                    to={`testing`}
                    className='px-2'
                  >
                    User Testing
                  </Nav.Link>
                </>
              )}
              {cognitoGroups.includes('sysadmin') && (
                <>
                  <Nav.Link
                    as={NavLink}
                    eventKey={`SSAdmin`}
                    to={`SSAdmin`}
                    className='px-2'
                  >
                    Admin
                  </Nav.Link>
                  {process.env.NODE_ENV === 'development' && (
                    <Nav.Link
                      as={NavLink}
                      eventKey={`dev-actions`}
                      to={`dev-actions`}
                      className='px-2'
                    >
                      Dev Actions
                    </Nav.Link>
                  )}
                </>
              )}
              <Nav.Link
                as={NavLink}
                eventKey={`shared-results`}
                to={`shared-results`}
                className='px-2'
              >
                Shared Results
              </Nav.Link>
            </Nav>
          )}
          <div className='d-flex flex-column flex-lg-row flex-grow-1 align-items-center justify-content-end gap-3 gap-lg-0 mt-2 mt-lg-0'>
            <UploadProgress />
            <ProgressIndicators />
            <Settings signOut={signOut} />
            <Notifications />
          </div>
        </Navbar.Collapse>
      </Navbar>
      <Container
        fluid
        className='d-flex justify-content-center h-100 overflow-y-auto'
      >
        {(!belongsToOrganization &&
          location.pathname === '/SSRegisterOrganization') ||
        belongsToOrganization ||
        location.pathname.startsWith('/jolly') ||
        location.pathname.startsWith('/shared-results') ||
        (cognitoGroups.includes('sysadmin') &&
          location.pathname === '/SSAdmin') ? (
          <Outlet />
        ) : (
          <Card
            className='w-100'
            style={{
              maxWidth: '960px',
              marginTop: '12px',
              marginBottom: '12px',
              height: 'fit-content',
            }}
          >
            <Card.Header>
              <Card.Title className='mb-0'>
                <h4 className='mb-0'>Welcome</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <Card.Text>
                You are not currently a member of any organisation.
              </Card.Text>
              <Card.Text>
                Please take note of the following:
                <ul>
                  <li>
                    If you are trying to join an organisation, please contact
                    your administrator to be invited to their organisation.
                    <br />
                    You will receive the invite in your notifications drawer.
                  </li>
                  <li>
                    If you have requested for an organisation to be created you
                    will automatically gain access to the rest of SurveyScope
                    once we've approved your request.
                    <br />
                    If your request is denied, you will receive an email from
                    us.
                  </li>
                </ul>
              </Card.Text>
              <Card.Text>
                If your organisation is not registered, please register an
                organisation below.
              </Card.Text>
              <Button
                variant='primary'
                disabled={checkingToken}
                onClick={() => navigate('/SSRegisterOrganization')}
              >
                Register Organisation
              </Button>
            </Card.Body>
          </Card>
        )}
      </Container>
    </div>
  );
}
