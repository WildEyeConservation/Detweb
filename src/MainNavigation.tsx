import { useContext, useEffect } from "react";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ProgressIndicators } from "./ProgressIndicators.jsx";
import { Outlet } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Notifications from "./user/Notifications.tsx";
import { UserContext } from "./Context.tsx";
import Settings from "./user/Settings.tsx";
import { Card, Button } from "react-bootstrap";
import UploadProgress from "./upload/UploadProgress.tsx";
import UploadManager from "./upload/UploadManager.tsx";

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const {
    cognitoGroups,
    myOrganizationHook,
    isOrganizationAdmin,
    myMembershipHook: myProjectsHook,
  } = useContext(UserContext)!;

  const location = useLocation();
  const navigate = useNavigate();

  const myAdminProjects = myProjectsHook.data?.filter(
    (project) => project.isAdmin
  );

  const belongsToOrganization = myOrganizationHook.data.length > 0;

  useEffect(() => {
    if (
      belongsToOrganization &&
      (location.pathname === "" ||
        location.pathname === "/" ||
        location.pathname === "/SSRegisterOrganization" ||
        location.pathname === "/surveys" ||
        location.pathname === "/jobs")
    ) {
      navigate(
        myAdminProjects?.length > 0 || isOrganizationAdmin
          ? "/surveys"
          : "/jobs"
      );
    }
  }, [isOrganizationAdmin, myAdminProjects.length, belongsToOrganization]);

  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === "/jobs") {
      navigate("/surveys");
    }
  }, [isOrganizationAdmin]);

  const expand = "lg";
  return (
    <div
      className="App d-flex flex-column"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <Navbar
        bg="secondary"
        className="px-3"
        variant="dark"
        sticky="top"
        key={expand}
        expand={expand}
        collapseOnSelect
      >
        <Navbar.Brand
          className="d-flex flex-row align-items-center flex-nowrap me-2"
          onClick={() =>
            navigate(
              isOrganizationAdmin
                ? "/surveys"
                : belongsToOrganization
                ? "/jobs"
                : "/"
            )
          }
          style={{ cursor: "pointer" }}
        >
          <img
            src="/Logo.png"
            alt="Logo"
            style={{ height: "32px", marginRight: "4px" }}
          />
          <h1 style={{ marginBottom: "0px", fontSize: "24px" }}>SurveyScope</h1>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav fill activeKey={location.pathname}>
            {belongsToOrganization && (
              <>
                {(myAdminProjects?.length > 0 || isOrganizationAdmin) && (
                  <Nav.Link
                    as={NavLink}
                    eventKey={`surveys`}
                    to={`surveys`}
                    className="px-2"
                  >
                    Surveys
                  </Nav.Link>
                )}
                <Nav.Link
                  as={NavLink}
                  eventKey={`jobs`}
                  to={`jobs`}
                  className="px-2"
                >
                  Jobs
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  eventKey={`annotation-statistics`}
                  to={`annotation-statistics`}
                  className="px-2"
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
                  className="px-2"
                >
                  Permissions
                </Nav.Link>
                {/* Testing has a few issues that need to be fixed before it can be used again */}
                {/* <Nav.Link
                  as={NavLink}
                  eventKey={`testing`}
                  to={`testing`}
                  className="px-2"
                >
                  User Testing
                </Nav.Link> */}
              </>
            )}
            {cognitoGroups.includes("sysadmin") && (
              <Nav.Link
                as={NavLink}
                eventKey={`SSAdmin`}
                to={`SSAdmin`}
                className="px-2"
              >
                Admin
              </Nav.Link>
            )}
          </Nav>
          <div className="d-flex flex-column flex-lg-row flex-grow-1 align-items-center justify-content-end gap-3 gap-lg-0 mt-2 mt-lg-0">
            <UploadProgress />
            <ProgressIndicators />
            <Settings signOut={signOut} />
            <Notifications />
          </div>
        </Navbar.Collapse>
      </Navbar>
      <Container
        fluid
        className="d-flex justify-content-center h-100 overflow-y-auto"
      >
        {(!belongsToOrganization &&
          location.pathname === "/SSRegisterOrganization") ||
        belongsToOrganization ||
        (cognitoGroups.includes("sysadmin") &&
          location.pathname === "/SSAdmin") ? (
          <Outlet />
        ) : (
          <Card
            className="w-100"
            style={{
              maxWidth: "960px",
              marginTop: "12px",
              marginBottom: "12px",
              height: "fit-content",
            }}
          >
            <Card.Header>
              <Card.Title className="mb-0">
                <h4 className="mb-0">Welcome</h4>
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <Card.Text>
                You are not currently a member of any organization. If your
                organization is already registered, please contact your
                administrator to be invited to their organization. You will
                receive the invite in your notifications drawer. Click the bell
                icon in the top right corner of the screen to view your
                notifications.
              </Card.Text>
              <Card.Text>
                If your organization is not registered, please register an
                organization below.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/SSRegisterOrganization")}
              >
                Register Organization
              </Button>
            </Card.Body>
          </Card>
        )}
      </Container>
    </div>
  );
}
