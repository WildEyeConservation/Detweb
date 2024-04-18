import {Form} from "react-bootstrap"
import React,{ useContext} from "react"
import { UserContext } from "./UserContext"
import { useLocationSets } from "./useGqlCached"


export function LocationSetDropdown({selectedSet,setLocationSet,hasCreateOption}){
    const {currentProject}=useContext(UserContext)
    const {locationSets,createLocationSet}=useLocationSets(currentProject)

    const onNewLocationSet = async () => {
        const name = prompt("Please enter new LocationSet name", "");
        if (name){
          const {data:{createLocationSet:{id}}}=await createLocationSet(name)
          setLocationSet(id)
        }
      }

    const onSelect = (e)=>{
        if (e.target.value=="new"){
            onNewLocationSet()
        }else{
            setLocationSet(e.target.value)
        }
    }

    return  <Form.Select value={selectedSet || "none"} onChange={onSelect}>
                {!selectedSet && <option value="none">Select a LocationSet</option>} 
                {locationSets?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}
                {hasCreateOption && <option value="new">Add a new Location set</option>}
            </Form.Select>
}