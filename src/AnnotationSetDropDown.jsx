import {Form} from "react-bootstrap"
import React,{ useContext} from "react"
import { UserContext } from "./UserContext"
import { useAnnotationSets } from "./useGqlCached"


export function AnnotationSetDropdown({setAnnotationSet,selectedSet,canCreate=true}){
    const {currentProject}=useContext(UserContext)
    const {annotationSets,createAnnotationSet}=useAnnotationSets(currentProject)

    const onNewAnnotationSet = async () => {
        const name = prompt("Please enter new AnnotationSet name", "");
        if (name){
          //const {data:{createAnnotationSet:{id}}}=await createAnnotationSet(name)
          const id=await createAnnotationSet(name)
          setAnnotationSet(id)
        }
      }

    const onSelect = (e)=>{
        if (e.target.value=="new"){
            onNewAnnotationSet()
        }else{
            setAnnotationSet(e.target.value)
        }
    }

    return  <Form.Select value={selectedSet || "none"} onChange={onSelect}>
                {!selectedSet && <option value="none">Select an annotation set</option>} 
                {annotationSets?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}
                {canCreate && <option value="new">Add a new annotation set</option>}
            </Form.Select>
}