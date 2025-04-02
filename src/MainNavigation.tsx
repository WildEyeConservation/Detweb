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
      location.pathname === "" ||
      location.pathname === "/" ||
      location.pathname === "/surveys" ||
      location.pathname === "/jobs"
    ) {
      navigate(
        myAdminProjects?.length > 0 || isOrganizationAdmin
          ? "/surveys"
          : "/jobs"
      );
    }
  }, [isOrganizationAdmin, myAdminProjects.length]);

  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === "/jobs") {
      navigate("/surveys");
    }
  }, [isOrganizationAdmin]);

  const expand = false;
  return (
    <div
      className="App d-flex flex-column"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      <Navbar
        bg="secondary"
        variant="dark"
        sticky="top"
        key={expand}
        expand={expand}
      >
        <div className="w-100 d-flex flex-row align-items-center px-3">
          <div
            className="d-flex flex-row align-items-center flex-nowrap me-2"
            onClick={() => navigate(isOrganizationAdmin ? "/surveys" : "/jobs")}
            style={{ cursor: "pointer" }}
          >
            <img
              src="/Logo.png"
              alt="Logo"
              style={{ height: "32px", marginRight: "4px" }}
            />
            <h1 style={{ marginBottom: "0px", fontSize: "24px" }}>Detweb</h1>
          </div>
          <Nav fill activeKey={location.pathname} className="d-flex flex-row">
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
              {isOrganizationAdmin && (
                <Nav.Link
                  as={NavLink}
                  eventKey={`permissions`}
                  to={`permissions`}
                  className="px-2"
                >
                  Permissions
                </Nav.Link>
              )}
              <Nav.Link
                as={NavLink}
                eventKey={`annotation-statistics`}
                to={`annotation-statistics`}
                className="px-2"
              >
                Annotation Statistics
              </Nav.Link>
              {isOrganizationAdmin && (
                <Nav.Link
                  as={NavLink}
                  eventKey={`testing`}
                  to={`testing`}
                  className="px-2"
                >
                  User Testing
                </Nav.Link>
              )}
              {cognitoGroups.includes("sysadmin") && (
                <Nav.Link
                  as={NavLink}
                  eventKey={`onboarding`}
                  to={`onboarding`}
                  className="px-2"
                >
                  Onboarding
                </Nav.Link>
              )}
            </>
          </Nav>
          <div className="d-flex flex-row flex-grow-1 justify-content-end align-items-center">
            <ProgressIndicators />
            <Nav.Link className="mx-2" onClick={signOut}>
              Logout
            </Nav.Link>
            <Settings />
            <Notifications />
          </div>
        </div>
      </Navbar>
      <Container
        fluid
        className="d-flex justify-content-center h-100 overflow-y-auto"
        style={{
          backgroundColor: "#2B3E50",
        }}
      >
        <Outlet />
      </Container>
    </div>
  );
}
