export function graphqlOperation(query: string, variables: any) {
  return { query, variables };
}
import { fetchUserAttributes } from "@aws-amplify/auth";
import pLimit from "p-limit";
export const limitConnections = pLimit(30);
import { useEffect, useState, useContext } from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import NavDropdown from "react-bootstrap/NavDropdown";
import ProjectManagement from "./ProjectManagement.tsx";  
import DefineCategories from "./DefineCategories.js";
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
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { ErrorHandler } from './ErrorHandler';
import {TaskProgressHandler} from './TaskProgressHandler';

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
  const location = useLocation();
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
  let Test = ScratchPad();
  return (
    session && (
      <>
        <BrowserView>
            <User user={user}>
                  <div
                    className="App d-flex flex-column"
                    style={{ height: "100vh", overflow: "scroll" }}
                  >
                    
              <Navbar bg="primary" variant="dark">
                
      <Container fluid>
        {/* <LaunchRegistration
          show={modalToShow == "launchRegistration"}
          handleClose={() => setModalToShow(null)}
        /> */}
        {/* <Retile
          show={modalToShow == "retile"}
          //dirHandle={dirHandle}
          handleClose={() => setModalToShow(null)}
        /> */}
        {/* <MessageHandler/>  */}
        {/* <Navbar.Brand href="#home">Detweb</Navbar.Brand> */}
        {/* <Messages/> */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav fill activeKey={location.pathname}>
            <Nav.Link
              as={NavLink}
              eventKey="/annotate"
              to="/annotate"
              key="/annotate"
            >
              Annotate
            </Nav.Link>
            <IfProjectAdmin currentPM={currentPM}>
              <NavDropdown title="Actions" id="collapsible-nav-dropdown">
                {/* <NavDropdown.Item  onClick={()=>showModal("processImages")}>
                  Process Imagery
                </NavDropdown.Item> */}
                {/* <NavDropdown.Item onClick={()=>showModal("createTask")}>
                  Create annotation task
                </NavDropdown.Item> */}
                <NavDropdown.Item onClick={()=>showModal("launchTask")}>
                  Launch annotation task
                </NavDropdown.Item>
                <NavDropdown.Item onClick={()=>showModal("launchTask")}>
                  Launch registration task
                </NavDropdown.Item>
                <NavDropdown.Item onClick={()=>showModal("exportData")}>
                  Export Data
                </NavDropdown.Item>
                <NavDropdown.Item onClick={()=>showModal("retileImages")}>
                  Retile images
                </NavDropdown.Item>
              </NavDropdown>
              <Nav.Link
                as={NavLink}
                eventKey="/projectManagement"
                to="/projectManagement"
              >
                Project Management
              </Nav.Link>
              {/* <Nav.Link as={NavLink} eventKey='/registration' to="/registration">Registration</Nav.Link> */}
              <Nav.Link as={NavLink} eventKey="/userStats" to="/userStats">
                User Stats
              </Nav.Link>
            </IfProjectAdmin>
            {(session?.tokens?.accessToken?.payload?.["cognito:groups"]?.includes("admin")) && (
              <Nav.Link as={NavLink} eventKey="/review" to="/review">
                Review
              </Nav.Link>
            )}
            {/* <CheckPermission permission='results'>
      <Nav.Link as={Link} eventKey='results' to="/results">Results</Nav.Link>
      </CheckPermission> */}
          </Nav>
        </Navbar.Collapse>
        <Nav className="navbar-right">
          <ProgressIndicators />
          <ProjectSelector currentPM={currentPM} setCurrentPM={setCurrentPM}/>
          <Nav.Link onClick={signOut}>Log out {userAttributes?.preferred_username}</Nav.Link>
        </Nav>
      </Container>
    </Navbar><SubscriptionComponent/>
              {currentPM && <Project currentPM={currentPM}>
                <Container
                  fluid
                  className="d-flex justify-content-center h-100"
                >
                  {/* <DebugDetails/> */}
                  <Routes>
                    {/* <Route exact path="register" element={<Register/>}/>
              <Route path="image/:im_id" render={({match}) => (<BaseImage im_id={match.params.im_id} height="100%"/>)}/>
              <Route path="location/:loc_id" render={({match}) => (<BaseImage loc_id={match.params.loc_id} height="100%"/>)}/>
              <Route path="detection/:det_id" render={({match}) => (<BaseImage det_id={match.params.det_id} height="100%"/>)}/>
              <Route path="cluster/:cluster_id" render={({match}) => (<BaseImage cluster_id={match.params.cluster_id} height="100%"/>)}/> */}
                    <Route
                      path="/"
                      element={null}
                    />

                    <Route path="/annotate" element={<Test />} />
                    {/* <Route exact path="/registration" element={<Registration/>}/>  */}
                    <Route path="/review" element={<Review />} />
                    <Route
                      key="1"
                      path="/defineCategories"
                      element={<DefineCategories />}
                    />,
                    <Route
                      key="2"
                      path="/projectManagement"
                      element={<ProjectManagement />}
                    />,
                  </Routes>
                </Container>
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
        <ErrorHandler />
        <TaskProgressHandler />
      </>
    )
  );
}

export default withAuthenticator(App);
