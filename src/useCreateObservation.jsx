
import React,{useCallback, useContext } from "react"
import { UserContext } from "./UserContext"
import { createObservationMinimal } from "./gqlQueries"
import { gqlClient, graphqlOperation } from "./App"
/* This hook will take an ack callback as input and create a new ack callback that:
- Uses the graphQL API to create an Observation entry for the current user.
- Calls the old callback
*/

export default function useCreateObservation({ack,locationId,annotationSetId}){

    const {user,setJobsCompleted}=useContext(UserContext)
    const newAck=useCallback(()=>{
            gqlClient.graphql(graphqlOperation(createObservationMinimal,{input:{annotationSetId,locationId,owner:user.id }}))
            ack?.()
            setJobsCompleted?.(x=>x+1)
        },[ack,setJobsCompleted,user])
    return newAck
}

export function withCreateObservation(WrappedComponent){
    let WithCreateObservation= function(props){
        const {ack,id,setId,incrementJobs}=props
        const newAck = useCreateObservation({ack,locationId:id,annotationSetId:setId,incrementJobs})
        return <WrappedComponent {...props} ack={newAck}/>
    }
    return WithCreateObservation
}
