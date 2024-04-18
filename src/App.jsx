import { generateClient } from 'aws-amplify/api';
export const gqlClient=generateClient()
export function graphqlOperation(query,variables){
  return {query,variables}
}
import pLimit from 'p-limit';
export const limitConnections=pLimit(30) 
import React, {useContext, useEffect, useState} from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css'

import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import NavDropdown from 'react-bootstrap/NavDropdown';
// import Verification from "./Verification";
// import HerdDetection from "./HerdDetection";
//import Import from "./Import";
import DefineCategories from "./DefineCategories.jsx"
import FilesUploadComponent from "./FilesUploadComponent.jsx";
import {BrowserRouter as Router, Routes,Route,NavLink,useLocation} from "react-router-dom";
// import PrivateRoute from './PrivateRoute';
import {configure} from 'react-hotkeys';
import ScratchPad from "./ScratchPad.jsx";
import DefineTransect from './DefineTransect.jsx'
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import CreateTask from './CreateTask.jsx';
import LaunchTask from './LaunchTask.jsx';
import backendInfo from './cdk-exports.json';
import Categories from './Categories.jsx';
import UserManagement from './UserManagement.jsx';
import UserStats from './UserStats.jsx';
import User, { UserContext } from './UserContext.jsx'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools' 
import 'bootswatch/dist/slate/bootstrap.min.css';
import IfAdmin from './IfAdmin.jsx';
import ProjectSelector from './ProjectSelector.jsx';
import ProcessImages from './ProcessImages.jsx';
import AddGpsData from './AddGpsData.jsx';
//import Registration from './Registration.jsx';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import Progress from './ProgressContext.jsx';
import DeleteImageSet from './DeleteImageSet.jsx';
//import Rescan from './Rescan.jsx'
import { Amplify} from 'aws-amplify'
import { fetchAuthSession } from 'aws-amplify/auth';
//import { MessageHandler } from './SqsMessageHandler.jsx';
import Review from './Review2'
export const client = generateClient();
import { BrowserView, MobileView } from 'react-device-detect';
import ExportData from './ExportData.jsx';
import Retile from './Retile.jsx';
import LaunchRegistration from './LaunchRegistration.jsx';
// import Results from './Results'

const cognito=backendInfo['detweb-cognitostack-develop']
const backend=backendInfo['detweb-stack-develop']
const config={
  aws_project_region: backend.ProjectRegion,
  aws_appsync_graphqlEndpoint: backend.awsAppsyncApiEndpoint,
  aws_appsync_region: backend.awsAppsyncRegion,
  aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
  aws_cognito_identity_pool_id: cognito.IdentityPoolId,
  aws_cognito_region: cognito.Cognitoregion,
  aws_user_pools_id: cognito.UserPoolId,   
  aws_user_pools_web_client_id: cognito.UserPoolClientId,    
  oauth: {}, 
  aws_cognito_username_attributes: [], 
  aws_cognito_social_providers: [],
  aws_cognito_signup_attributes: [ 
      "EMAIL",   
      "NAME"
  ],
  aws_cognito_mfa_configuration: "OFF",
  aws_cognito_mfa_types: [
      "SMS"
  ],
  aws_cognito_password_protection_settings: {
      passwordPolicyMinLength: 8,
      passwordPolicyCharacters: []
  },
  aws_cognito_verification_mechanisms: [
      "EMAIL"
  ],
  aws_user_files_s3_bucket: backend.imagesBucketOut,
  aws_user_files_s3_bucket_region: backend.imagesBucketRegion

}
Amplify.configure(config);
configure({ignoreRepeatedEventsWhenKeyHeldDown:false})
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})
/**
 *
 * The root component for the ESS frontend map. Renders the Navbar and the router that selects which of the other pages
 * to render based on th current URL.
 * @component
 *
 */

function Header(props){
  const {signOut,session,user}=props
  const {currentProject}=useContext(UserContext)
  const [modalToShow,setModalToShow]=useState(null)
  const [dirHandle,setDirHandle]=useState(null)  
  let location = useLocation();


  let handleSelect = async function (key){
    if (key=="addFiles"){
      setDirHandle(await window.showDirectoryPicker())
    }
    setModalToShow(key)
  }

  return <Navbar bg="primary" variant="dark">
  <Container fluid>
  <CreateTask show={modalToShow=="createTask"} handleClose={()=>setModalToShow(null)}/>
  <LaunchTask show={modalToShow=="launchTask"} handleClose={()=>setModalToShow(null)}/>
  {/* <Rescan show={modalToShow=="rescan"} handleClose={()=>setModalToShow(null)}/> */}
  <ProcessImages show={modalToShow=="processImages"} handleClose={()=>setModalToShow(null)}/>
  <AddGpsData show={modalToShow=="addGps"} handleClose={()=>setModalToShow(null)}/>
  <DeleteImageSet show={modalToShow=="deleteImageSet"} handleClose={()=>setModalToShow(null)}/>
  <FilesUploadComponent show={modalToShow=="addFiles"} dirHandle={dirHandle} handleClose={()=>setModalToShow(null)}/>
  <ExportData show={modalToShow=="exportData"} dirHandle={dirHandle} handleClose={()=>setModalToShow(null)}/>
  <LaunchRegistration show={modalToShow=="launchRegistration"} handleClose={()=>setModalToShow(null)}/>
  <Retile show={modalToShow=="retile"} dirHandle={dirHandle} handleClose={()=>setModalToShow(null)}/>
  {/* <MessageHandler/>  */}
  {/* <Navbar.Brand href="#home">Detweb</Navbar.Brand> */}
  {/* <Messages/> */}
  <Navbar.Toggle aria-controls="basic-navbar-nav" />
  <Navbar.Collapse id="basic-navbar-nav">
  <Nav fill activeKey={location.pathname} onSelect={handleSelect}>
  <Nav.Link as={NavLink} eventKey='/annotate' to="/annotate" key="/annotate">
      Annotate</Nav.Link>
    <IfAdmin session={session}>
    <NavDropdown title="Actions" id="collapsible-nav-dropdown">
      <NavDropdown.Item as={NavLink} eventKey='addFiles'>Add Files</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='addGps'>Add GPS data </NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='processImages'>Process Imagery</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='createTask'>Create annotation task</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='launchTask'>Launch annotation task</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='launchRegistration'>Launch registration task</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='exportData'>Export Data</NavDropdown.Item>
      <NavDropdown.Item as={NavLink} eventKey='retile'>Retile images</NavDropdown.Item>
      
      {/* <NavDropdown.Item as={NavLink} eventKey='rescan'>Rescan storage</NavDropdown.Item> */}
      {/* <NavDropdown.Item as={NavLink} eventKey='executeQuery'>Execute Query</NavDropdown.Item> */}
    </NavDropdown>
    <NavDropdown title="Delete" id="collapsible-nav-dropdown">
      <NavDropdown.Item as={NavLink} eventKey='deleteImageSet'>Image Set</NavDropdown.Item>
    </NavDropdown>
    {/* <CheckPermission permission='dashboard'>
    <Nav.Link as={Link} eventKey='dashboard' to="/dashboard">
      Dashboard</Nav.Link>
    </CheckPermission> */}
      <NavDropdown title="Define" id="collapsible-nav-dropdown">
        {/* <NavDropdown.Item as={Link} eventKey="defineTransect" to="/defineTransect">Transect</NavDropdown.Item>
        <NavDropdown.Item as={Link} eventKey="defineSurvey" to="/defineSurvey">Survey</NavDropdown.Item> */}
        <NavDropdown.Item as={NavLink} eventKey="/defineCategories" to="/defineCategories">Categories</NavDropdown.Item>
        <NavDropdown.Item as={NavLink} eventKey="/defineTransect" to="/defineTransect">Transect</NavDropdown.Item>
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
      <Nav.Link as={NavLink} eventKey='/userManagement' to="/userManagement">User Management</Nav.Link>
      {/* <Nav.Link as={NavLink} eventKey='/registration' to="/registration">Registration</Nav.Link> */}
      <Nav.Link as={NavLink} eventKey='/userStats' to="/userStats">User Stats</Nav.Link>
      </IfAdmin>
      {(session.tokens.accessToken.payload["cognito:groups"].includes('admin') || currentProject=='Sango') &&
      <Nav.Link as={NavLink} eventKey='/review' to="/review">Review</Nav.Link>}
      {/* <CheckPermission permission='results'>
      <Nav.Link as={Link} eventKey='results' to="/results">Results</Nav.Link>
      </CheckPermission> */}
  </Nav>
  </Navbar.Collapse>
  <Nav className="navbar-right">
    <ProgressIndicators/>
    <ProjectSelector/>
    <Nav.Link onClick={signOut}>Log out {user.username}
    </Nav.Link>
  </Nav>
  </Container>
</Navbar>
}

function App({signOut,user}) {
  const [session,setSession]=useState()
  useEffect(() => {
    window.addEventListener("beforeunload", alertUser);
    return () => {
      window.removeEventListener("beforeunload", alertUser);
    };
  }, []);
  const alertUser = (e) => {
    alert("If you use refresh to load new data it may result in some of your work being lost.")
    e.preventDefault();
    e.returnValue = "";
  };
  useEffect(()=>{queryClient.invalidateQueries()},[user])
  useEffect(()=>{
    fetchAuthSession().then(sess=>setSession(sess))
  },[user])
  let Test=ScratchPad();
      return session && (<>
        <BrowserView>
        <QueryClientProvider client={queryClient}>
        <User loggedInUser={user}>
        <Categories>
          
          <Progress>
      <div className="App d-flex flex-column" style={{height:"100vh",overflow:'scroll'}}>
          <ReactQueryDevtools/>
          <Router>
            <Header signOut={signOut} session={session} user={user} />
          <Container fluid className="d-flex justify-content-center h-100">
          {/* <DebugDetails/> */}
            <Routes>
            {/* <Route exact path="register" element={<Register/>}/>
            <Route path="image/:im_id" render={({match}) => (<BaseImage im_id={match.params.im_id} height="100%"/>)}/>
            <Route path="location/:loc_id" render={({match}) => (<BaseImage loc_id={match.params.loc_id} height="100%"/>)}/>
            <Route path="detection/:det_id" render={({match}) => (<BaseImage det_id={match.params.det_id} height="100%"/>)}/>
            <Route path="cluster/:cluster_id" render={({match}) => (<BaseImage cluster_id={match.params.cluster_id} height="100%"/>)}/> */}
            <Route exact path="/DefineTransect" element={<DefineTransect/>}/>
            <Route exact path="/annotate" element={<Test/>}/>
            {/* <Route exact path="/registration" element={<Registration/>}/>  */}
            <Route exact path="/review" element={<Review/>}/> 
            <Route exact path='' element={<Test/>}/>
            <Route exact path='/userStats' element={<UserStats/>}/> 
            {/* <Route exact path='/results' element={<Results/>}/>  */}
            {/* <Route exact path="dashboard" element={<Dashboard/>}/>
            <Route exact path="registration" element={<Registration/>}/>
            <Route exact path="import" element={<FilesUploadComponent/>}/>
            <Route exact path="process" element={<Process/>}/>
            <Route exact path="launch" element={<LaunchTask/>}/>
            <Route exact path="defineTransect" element={<DefineTransect/>}/>
            <Route exact path="defineSurvey" element={<DefineSurvey/>}/>
            <Route exact path="results" element={<Results/>}/> */}
            {session.tokens.accessToken.payload["cognito:groups"].includes('admin') ? 
            [<Route key='1' exact path="defineCategories" element={<DefineCategories/>}/>,
            <Route key='2' exact path="userManagement" element={<UserManagement/>}/>] : ""}
            </Routes>
            </Container>
          </Router>
      </div>
      </Progress>
      </Categories>
      </User>
      </QueryClientProvider>
      </BrowserView>
      <MobileView>
        <p> This application is not supported on mobile devices. Please open on a laptop or desktop device.</p>
      </MobileView>
      </>
    );
}

export default withAuthenticator(App);
