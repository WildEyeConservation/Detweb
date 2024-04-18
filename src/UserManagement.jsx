import MyTable from './Table'
// import { onCreateCategory, onUpdateCategory, onDeleteCategory } from './graphql/subscriptions'
// import { listCategories } from './graphql/queries';
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { Row } from 'react-bootstrap';

import {useUsers, useProjectMemberships } from './useGqlCached';
import { UserContext } from './UserContext';
import React,{ useContext} from 'react';
import { QueueDropdown } from './QueueDropDown';

export default function UserManagement(){
  const {users,updateUser}=useUsers()
  const {user:currentUser,currentProject,backend,addUserToGroup,removeUserFromGroup}=useContext(UserContext)
  const {projectMemberships,createProjectMembership,deleteProjectMembership,updateProjectMembership}=useProjectMemberships()

  async function setUserQueue (pm,queueUrl){
    console.log(`Setting user ${pm.userId} to use queue ${queueUrl}`)
    updateProjectMembership({id:pm.id,queueUrl})
  }

  const changeAdminStatus= async (user,enable)=>{
    console.log(enable ? `Grant ${user?.name} admin rights` : `Revoke ${user?.name}'s admin rights`)
    if (enable){
      await addUserToGroup({ 
        UserPoolId: backend['detweb-cognitostack-develop'].UserPoolId,
        Username: user.id, 
        GroupName: "admin", 
      })
      updateUser({id:user.id,isAdmin:true})
    }else{
      await removeUserFromGroup({ // AdminAddUserToGroupRequest
        UserPoolId: backend['detweb-cognitostack-develop'].UserPoolId,
        Username: user.id, // required
        GroupName: "admin", // required
      })
      updateUser({id:user.id,isAdmin:false})
    }
  }


  const tableData=users?.map((user)=>{
    const {id, name,isAdmin}=user
    const belongsToCurrentProject=projectMemberships?.find((pm)=>pm.userId==user.id && pm.projectId==currentProject)
    return  {id ,'rowData':[name, 
    <Form.Check id="custom-switch" disabled={currentUser?.id===id} key={id+'0'} checked={isAdmin} onChange={(e)=>changeAdminStatus(user,e.target.checked)}/>,
    <Form.Check id="custom-switch" disabled={currentUser?.id===id} key={id+'1'} checked={belongsToCurrentProject?.id || false} onChange={(e)=>e.target.checked ? createProjectMembership({userId:user.id,projectId:currentProject}) : deleteProjectMembership({id:belongsToCurrentProject?.id})}/>,
    belongsToCurrentProject ? <QueueDropdown key={id+'2'} setQueue={(q)=>setUserQueue(belongsToCurrentProject,q)} currentQueue={belongsToCurrentProject?.queueUrl || ""}/> : <p>To select a queue, first add user to this project</p>
,<Button variant="primary" key={id+'3'} onClick={()=>{
  }}>
Delete 
</Button>]}})

  const tableHeadings=[{content:'Name'},{content:'Admin'},{content:`Belongs to ${currentProject}`},{content:'Queue',style:{width:"500px"}},{content:''}]
  return <><Row className='justify-content-center mt-3'><div><MyTable key ="hannes" tableHeadings={tableHeadings}   tableData={tableData}/></div></Row></>
  }

