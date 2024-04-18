import {Form} from "react-bootstrap"
import React,{ useContext} from "react"
import { UserContext } from "./UserContext"
import { useCategory } from "./useGqlCached"
import Select from "react-select"

export function CategoriesDropdown({setSelectedCategories}){
    const {currentProject}=useContext(UserContext)
    const {categories}=useCategory(currentProject);
    const options=categories?.map(x=>{return {label:x.name,value:x.id}})

    function handleChange(x){
        setSelectedCategories(x)
    }

    return  <Form.Group>
            <Form.Label>Select categories to review</Form.Label>
            <Select
                defaultValue={[]}
                onChange={handleChange}
                isMulti
                name="Categories"
                options={options}
                className="basic-multi-select"
                classNamePrefix="select"
                closeMenuOnSelect={false}
              />
            </Form.Group>
    // <Form.Select value={selectedSet || "none"} onChange={onSelect}>
    //             {!selectedSet && <option value="none">Select an annotation set</option>} 
    //             {categories?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}
    //         </Form.Select>
}