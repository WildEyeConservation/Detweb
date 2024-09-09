import { generateClient } from "aws-amplify/api";
export const gqlClient = generateClient();
export function graphqlOperation(query: string, variables: any) {
  return { query, variables };
}
import { fetchUserAttributes } from "@aws-amplify/auth";
import pLimit from "p-limit";
export const limitConnections = pLimit(30);
import { useEffect, useState } from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";
import QuickTest from "./QuickTest.tsx";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import NavDropdown from "react-bootstrap/NavDropdown";
import DefineCategories from "./DefineCategories.js";
import FilesUploadComponent from "./FilesUploadComponent.jsx";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import { configure } from "react-hotkeys";
import ScratchPad from "./ScratchPad.jsx";
import DefineTransect from "./DefineTransect.jsx";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import CreateTask from "./CreateTask.jsx";
import LaunchTask from "./LaunchTask.jsx";
import UserManagement from "./UserManagement.jsx";
import User from "./UserContext.js";
import "bootswatch/dist/slate/bootstrap.min.css";
import IfAdmin from "./IfAdmin.jsx";
import ProjectSelector from "./ProjectSelector.jsx";
import ProcessImages from "./ProcessImages.jsx";
import AddGpsData from "./AddGpsData.jsx";
import { ProgressIndicators } from "./ProgressIndicators.jsx";
import Progress from "./ProgressContext.jsx";
import DeleteImageSet from "./DeleteImageSet.jsx";
import { fetchAuthSession } from "aws-amplify/auth";
import Review from "./Review2.jsx";
import { BrowserView, MobileView } from "react-device-detect";
import ExportData from "./ExportData.jsx";
configure({ ignoreRepeatedEventsWhenKeyHeldDown: false });

/**
 *
 * The root component for the ESS frontend map. Renders the Navbar and the router that selects which of the other pages
 * to render based on th current URL.
 * @component
 *
 */

interface HeaderProps {
  signOut: () => void;
  session: any;
  user: any;
}

interface AppProps {
  signOut?: () => void;
  user?: any;
}

function Header({ signOut, session, user }: HeaderProps) {
  //const { currentProject } = useContext(UserContext) ?? {};
  const [modalToShow, setModalToShow] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  let location = useLocation();
  const [userAttributes, setUserAttributes] = useState<any>(null);
  useEffect(() => {
    //fetchAuthSession().then((sess) => setSession(sess));
    fetchUserAttributes().then(attributes => setUserAttributes(attributes));
  }, [user]);

  let handleSelect = async function (key: string | null) {
    if (key == "addFiles") {
      setDirHandle(await (window as any).showDirectoryPicker());
    }
    setModalToShow(key);
  };

  return (
    <Navbar bg="primary" variant="dark">
      <Container fluid>
        <CreateTask
          show={modalToShow == "createTask"}
          handleClose={() => setModalToShow(null)}
        />
        <LaunchTask
          show={modalToShow == "launchTask"}
          handleClose={() => setModalToShow(null)}
        />
        {/* <Rescan show={modalToShow=="rescan"} handleClose={()=>setModalToShow(null)}/> */}
        <ProcessImages
          show={modalToShow == "processImages"}
          handleClose={() => setModalToShow(null)}
        />
        <AddGpsData
          show={modalToShow == "addGps"}
          handleClose={() => setModalToShow(null)}
        />
        <DeleteImageSet
          show={modalToShow == "deleteImageSet"}
          handleClose={() => setModalToShow(null)}
        />
        <FilesUploadComponent
          show={modalToShow == "addFiles"}
          dirHandle={dirHandle}
          handleClose={() => setModalToShow(null)}
        />
        <ExportData
          show={modalToShow == "exportData"}
          //dirHandle={dirHandle}
          handleClose={() => setModalToShow(null)}
        />
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
          <Nav fill activeKey={location.pathname} onSelect={handleSelect}>
            <Nav.Link
              as={NavLink}
              eventKey="/annotate"
              to="/annotate"
              key="/annotate"
            >
              Annotate
            </Nav.Link>
            <IfAdmin session={session}>
              <NavDropdown title="Actions" id="collapsible-nav-dropdown">
                <NavDropdown.Item as={NavLink} eventKey="addFiles" to="/addFiles">
                  Add Files
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="addGps" to="/addGps">
                  Add GPS data{" "}
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="processImages" to="/processImages">
                  Process Imagery
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="createTask" to="/createTask">
                  Create annotation task
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="launchTask" to="/launchTask">
                  Launch annotation task
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="launchRegistration" to="/launchRegistration">
                  Launch registration task
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="exportData" to="/exportData">
                  Export Data
                </NavDropdown.Item>
                <NavDropdown.Item as={NavLink} eventKey="retile" to="/retile">
                  Retile images
                </NavDropdown.Item>

                {/* <NavDropdown.Item as={NavLink} eventKey='rescan'>Rescan storage</NavDropdown.Item> */}
                {/* <NavDropdown.Item as={NavLink} eventKey='executeQuery'>Execute Query</NavDropdown.Item> */}
              </NavDropdown>
              <NavDropdown title="Delete" id="collapsible-nav-dropdown">
                <NavDropdown.Item as={NavLink} eventKey="deleteImageSet" to="/deleteImageSet">
                  Image Set
                </NavDropdown.Item>
              </NavDropdown>
              {/* <CheckPermission permission='dashboard'>
    <Nav.Link as={Link} eventKey='dashboard' to="/dashboard">
      Dashboard</Nav.Link>
    </CheckPermission> */}
              <NavDropdown title="Define" id="collapsible-nav-dropdown">
                {/* <NavDropdown.Item as={Link} eventKey="defineTransect" to="/defineTransect">Transect</NavDropdown.Item>
        <NavDropdown.Item as={Link} eventKey="defineSurvey" to="/defineSurvey">Survey</NavDropdown.Item> */}
                <NavDropdown.Item
                  as={NavLink}
                  eventKey="/defineCategories"
                  to="/defineCategories"
                >
                  Categories
                </NavDropdown.Item>
                <NavDropdown.Item
                  as={NavLink}
                  eventKey="/defineTransect"
                  to="/defineTransect"
                >
                  Transect
                </NavDropdown.Item>
              </NavDropdown>
              {/* <CheckPermission permission='process'>
      <Nav.Link as={Link} eventKey='process' to="/process">Process Subsets</Nav.Link>
      </CheckPermission> */}
              {/* <CheckPermission permission='registration'>
      <Nav.Link as={Link} eventKey='registration' to="/registration">Registration</Nav.Link>
      </CheckPermission>
      <CheckPermission permission='View'>
        <NavDropdown title="View" id="collapsible-nav-dropdown">
        <NavDropdown.Item href="/view/detections">Detections</NavDropdown.Item>
        <NavDropdown.Item href="/view/clusters">Clusters</NavDropdown.Item>
        <NavDropdown.Item href="/view/images">Images</NavDropdown.Item>
        <NavDropdown.Item href="/view/locations">Locations</NavDropdown.Item>
      </NavDropdown>
      </CheckPermission> */}
              <Nav.Link
                as={NavLink}
                eventKey="/userManagement"
                to="/userManagement"
              >
                User Management
              </Nav.Link>
              {/* <Nav.Link as={NavLink} eventKey='/registration' to="/registration">Registration</Nav.Link> */}
              <Nav.Link as={NavLink} eventKey="/userStats" to="/userStats">
                User Stats
              </Nav.Link>
            </IfAdmin>
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
          <ProjectSelector />
          <Nav.Link onClick={signOut}>Log out {userAttributes?.preferred_username}</Nav.Link>
        </Nav>
      </Container>
    </Navbar>
  );
}

function App({ signOut = () => {}, user }: AppProps) {
  const [session, setSession] = useState<any>();
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
            <User loggedInUser={user}>
                <Progress>
                  <div
                    className="App d-flex flex-column"
                    style={{ height: "100vh", overflow: "scroll" }}
                  >
                    <Router>
                      <Header signOut={signOut} session={session} user={user} />
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
                            path="/DefineTransect"
                            element={<DefineTransect />}
                          />
                          <Route path="/annotate" element={<Test />} />
                          {/* <Route exact path="/registration" element={<Registration/>}/>  */}
                          <Route path="/review" element={<Review />} />
                          <Route path="/quickTest" element={<QuickTest />} />
                          {/* <Route
                            path="/userStats"
                            element={<UserStats />}
                          /> */}
                          {/* <Route exact path='/results' element={<Results/>}/>  */}
                          {/* <Route exact path="dashboard" element={<Dashboard/>}/>
            <Route exact path="registration" element={<Registration/>}/>
            <Route exact path="import" element={<FilesUploadComponent/>}/>
            <Route exact path="process" element={<Process/>}/>
            <Route exact path="launch" element={<LaunchTask/>}/>
            <Route exact path="defineTransect" element={<DefineTransect/>}/>
            <Route exact path="defineSurvey" element={<DefineSurvey/>}/>
            <Route exact path="results" element={<Results/>}/> */}
                          {session &&
                            session.tokens.accessToken.payload &&
                            session.tokens.accessToken.payload["cognito:groups"] &&
                            session.tokens.accessToken.payload["cognito:groups"].includes("admin")
                            ? [
                                <Route
                                  key="1"
                                  path="defineCategories"
                                  element={<DefineCategories />}
                                />,
                                <Route
                                  key="2"
                                  path="userManagement"
                                  element={<UserManagement />}
                                />,
                              ]
                            : ""}
                        </Routes>
                      </Container>
                    </Router>
                  </div>
                </Progress>
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
