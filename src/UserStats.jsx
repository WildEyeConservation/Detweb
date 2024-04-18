import MyTable from './Table'
// import { onCreateCategory, onUpdateCategory, onDeleteCategory } from './graphql/subscriptions'
// import { listCategories } from './graphql/queries';
import { Row } from 'react-bootstrap';
import { UserContext } from './UserContext';
import React,{ useContext, useEffect,useState} from 'react';
import { annotationsByAnnotationSetId} from './graphql/queries';
import humanizeDuration from 'humanize-duration';
import { gqlClient,graphqlOperation } from './App';
import {DefaultDict} from './defaultDict'


export default function UserStats(){
  const [stats,setStats]=useState([])
  const {currentProject}=useContext(UserContext)

  const listObservations=`
  query MyQuery($nextToken: String) {
    listObservations(nextToken: $nextToken) {
      items {
        annotationSetId
        createdAt
        owner
      }
      nextToken
    }
  }`

  const getUsersOnProject=`
  query MyQuery($projectId: String = "", $nextToken: String) {
    userProjectMembershipsByProjectId(projectId: $projectId, nextToken: $nextToken) {
      items {
        user {
          name
          id
        }
      }
      nextToken
    }
  }
  `

  async function getObservations(){
    var items,nextToken;
    var observationsByUser = new DefaultDict(Array)
    var numBySet = new DefaultDict(Number)
    const stats=[]
    const users=[]
    
    do{
      ({data:{userProjectMembershipsByProjectId:{items,nextToken}}}=await gqlClient.graphql(graphqlOperation(getUsersOnProject,{projectId:currentProject,nextToken})))
      for (const user of items){
        users.push(user.user.id)
      }
    } while (nextToken)
    do{
      ({data:{listObservations:{items,nextToken}}}=await gqlClient.graphql(graphqlOperation(listObservations,{nextToken})))
      for (const item of items){
        observationsByUser[item.owner].push({annotationSetId:item.annotationSetId,createdAt:Date.parse(item.createdAt)})
        numBySet[item.annotationSetId]+=1
      }
    } while (nextToken)
    for (const user of users){

      let prev=0,totalTime=0,tests=0,passes=0
      for (const obs of observationsByUser[user].sort((a,b)=>a.createdAt-b.createdAt)){
        const delta=obs.createdAt-prev
        if (delta<60000){
          totalTime+=delta
        }
        prev=obs.createdAt
        if (numBySet[obs.annotationSetId]==1){//test case detected
          tests+=1
          const {data:{annotationsByAnnotationSetId:{items}}}=await gqlClient.graphql(graphqlOperation(annotationsByAnnotationSetId,{annotationSetId:obs.annotationSetId}))
          if (items.length>0){
            passes+=1
          }
        }
      }
    const userStats={user,totalTime,totalJobs:observationsByUser[user].length,tests,passes}
     console.log(`Annotator ${user} spent ${totalTime/1000}s to annotate ${userStats.totalJobs} images. (S)he was tested ${tests} times and passed ${passes} times`)
     console.log(`Speed ${user} ${(totalTime/1000)/userStats.totalJobs}s/image. Accuracy: ${passes/tests}`)
     stats.push(userStats)
    }
    setStats(stats)
  } 

  useEffect(()=>{
    if (currentProject){
      getObservations().then(x=>console.log(x))
    }
  },[currentProject])

  const tableData=stats?.map((stats)=>{
    return  {id:crypto.randomUUID() ,'rowData':[stats.user, 
    humanizeDuration(stats.totalTime,{units:["d","h","m"],round:true,largest:2}),
    stats.totalJobs,
    `${(stats.totalTime/stats.totalJobs/1000).toFixed(1)}s`,
    stats.tests,
    stats.passes,
    stats.tests ? (stats.passes/stats.tests*100).toFixed(2)+'%' : 'N/A']}})

  const tableHeadings=[{content:'Username'},{content:'Time spent'},{content:`Jobs completed`},{content:'Average time (s/job)'},{content:'Tests'},{content:'Passes'},{content:'Accuracy'}]
  return <><Row className='justify-content-center mt-3'><div><MyTable key ="hannes" tableHeadings={tableHeadings}   tableData={tableData}/></div></Row></>
  }

