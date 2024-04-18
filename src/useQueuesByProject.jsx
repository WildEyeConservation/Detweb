import { useState,useEffect,useContext } from 'react';
import { getQueuesInProject } from './gqlQueries';
import { UserContext } from './UserContext';
import { gqlClient,graphqlOperation } from './App';

export function useQueuesByProject(projectName){
const [queues,setQueues]=useState([])
const {createQueue,gqlGetMany}=useContext(UserContext)

useEffect(()=>{
    if (projectName){
        gqlGetMany(getQueuesInProject,{name:projectName}).then(qs=>setQueues(qs))
    }
    }
    ,[projectName])

async function createQueueAndPushToDb(name){
    const {QueueUrl:url}= await createQueue({ 
        QueueName: name+".fifo", // required
          Attributes:{
          FifoQueue : "true"
          }
        })
    const res=await gqlClient.graphql(graphqlOperation(createQueue,{input: {name,url,projectId:projectName}}))
    await gqlGetMany(getQueuesInProject,{name:projectName}).then(qs=>setQueues(qs))
    return res
}


    return {queues,createQueue:createQueueAndPushToDb}
}