export function graphqlOperation(query: string, variables: any) {
  return { query, variables };
}
import { fetchUserAttributes } from "@aws-amplify/auth";
import { useEffect, useState, useContext } from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import UserStats from "./UserStats";
import NavDropdown from "react-bootstrap/NavDropdown";
import ProjectManagement from "./ProjectManagement.tsx";  
import DefineCategories from "./DefineCategories.js";
import QuickTest from "./QuickTest";
import { Management } from "./UserContext.tsx";
import {
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import SubscriptionComponent from './SubscriptionComponent';
import { configure } from "react-hotkeys";
import ScratchPad from "./ScratchPad.jsx";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { User, Project } from "./UserContext.js";
import "bootswatch/dist/slate/bootstrap.min.css";
import IfProjectAdmin from "./IfProjectAdmin.jsx";
import ProjectSelector from "./ProjectSelector.jsx";
import { ProgressIndicators } from "./ProgressIndicators.jsx";
import { fetchAuthSession } from "aws-amplify/auth";
import Review from "./Review2.jsx";
import { BrowserView, MobileView } from "react-device-detect";
import { GlobalContext } from "./Context";
import { Schema } from "../amplify/data/resource";
import Test from "./Test";
import {Outlet} from "react-router-dom";
import { StorageImage } from '@aws-amplify/ui-react-storage';
import Button from "react-bootstrap/Button";
//import { ErrorHandler } from './ErrorHandler';
//import {TaskProgressHandler} from './TaskProgressHandler';

configure({ ignoreRepeatedEventsWhenKeyHeldDown: false });

/**
 *
 * The root component for the ESS frontend map. Renders the Navbar and the router that selects which of the other pages
 * to render based on th current URL.
 * @component
 *
 */
interface AppProps {
  signOut?: () => void;
  user?: any;
}

function App({ signOut = () => {}, user }: AppProps) {
  const [session, setSession] = useState<any>();
  const [currentPM, setCurrentPM] = useState<Schema['UserProjectMembership']['type'] | undefined>(undefined);
  const { showModal } = useContext(GlobalContext)!
  const [userAttributes, setUserAttributes] = useState<any>(null);
  const [showNotice, setShowNotice] = useState(true);
  const location = useLocation();
  const [browserUrl, setBrowserUrl] = useState("");

  useEffect(() => {
    //fetchAuthSession().then((sess) => setSession(sess));
    fetchUserAttributes().then(attributes => setUserAttributes(attributes));
  }, [user]);

  
  // let handleSelect = async function (key: string | null) {
  //   if (key == "addFiles") {
  //     setDirHandle(await (window as any).showDirectoryPicker());
  //   }
  //   setModalToShow(key);
  // };

  useEffect(() => {
    const url = window.location.href;
    setBrowserUrl(url);
  }, []);
  
  useEffect(() => {
    window.addEventListener("beforeunload", alertUser);
    return () => {
      window.removeEventListener("beforeunload", alertUser);
    };
  }, []);
  const alertUser = (e: BeforeUnloadEvent) => {
    alert(
      "If you use refresh to load new data it may result in some of your work being lost.",
    );
    e.preventDefault();
    e.returnValue = "";
  };
  useEffect(() => {
    fetchAuthSession().then((sess) => setSession(sess));
  }, [user]);
  
  return (
    session && (
      <>
        <BrowserView>
            <User user={user}>
                  <div
                    className="App d-flex flex-column"
                    style={{position: "relative", height: "100vh", overflow: "hidden" }} // Changed overflow to hidden
                  >
                  {process.env.NODE_ENV !== 'development' && !browserUrl.includes("legacy") && showNotice && (
                    <div 
                      className="alert alert-warning w-100 d-flex flex-row align-items-center justify-content-center gap-3"
                      style={{ zIndex: 2000, position: "absolute", top: 0, left: 0, right: 0, margin: "0 auto", textAlign: "center" }}>
                      <p className="m-0">This application is now available at <a href="https://legacy.surveyscope.org">https://legacy.surveyscope.org</a></p>
                      <Button variant="secondary" size="sm" onClick={() => {
                        setShowNotice(false);
                      }}>
                        Close Notice
                      </Button>
                    </div>
                  )}

              <Navbar bg="primary" variant="dark" fixed="top">
                
      <Container fluid>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav fill activeKey={location.pathname}>
            <Nav.Link
              as={NavLink}
              eventKey="/annotate"
              to="annotate"
            >
              Annotate
            </Nav.Link>
            <IfProjectAdmin currentPM={currentPM}>
              <Nav.Link
                as={NavLink}
                eventKey="/projectManagement"
                to="projectManagement"
              >
                Project Management
              </Nav.Link>
            </IfProjectAdmin>
            <Nav.Link
              as={NavLink}
              eventKey="/userStats"
              to="leaderboard"
            >
              Leaderboard
            </Nav.Link>
            <IfProjectAdmin currentPM={currentPM}>
                      <Nav.Link as={NavLink} eventKey="/review" to="review">
              Review
            </Nav.Link>
            <Nav.Link as={NavLink} eventKey="/registration" to="registration">
              Registration
                        </Nav.Link>
            </IfProjectAdmin>
        </Nav>
        </Navbar.Collapse>
        <Nav className="navbar-right">
          <ProgressIndicators />
          <ProjectSelector currentPM={currentPM} setCurrentPM={setCurrentPM}/>
          <Nav.Link onClick={signOut}>Log out {userAttributes?.preferred_username}</Nav.Link>
        </Nav>
      </Container>
              </Navbar>
              {currentPM && <Project currentPM={currentPM}><Management>
                <Container
                  fluid
                  className="d-flex justify-content-center h-100"
                  style={{ marginTop: "56px", overflowY: "auto" }} // Added marginTop and overflowY
                >
                  <Outlet />
                </Container>
                </Management>
                </Project>}
                  </div>
            </User>
        </BrowserView>
        <MobileView>
          <p>
            {" "}
            This application is not supported on mobile devices. Please open on
            a laptop or desktop device.
          </p>
        </MobileView>
      </>
    )
  );
}

export default withAuthenticator(App);
