// import {Form} from "react-bootstrap"
// import { useContext } from "react"
// import { UserContext } from "./UserContext"
// import { useImageSets } from "./useGqlCached"

// export function ImageSetDropdown({setImageSet,selectedSet}){
//     const {currentProject}=useContext(UserContext)
//     const {imageSets}=useImageSets(currentProject)

//     const onSelect = (e)=>{
//         setImageSet(e.target.value)
//     }

//     return  <Form.Select value={selectedSet || "none"} onChange={onSelect}>
//                 {!selectedSet && <option value="none">Select an image set</option>}
//                 {imageSets?.map(q=><option key={q.name} value={q.name}>{q.name}</option>)}
//             </Form.Select>
// }

import { Form } from "react-bootstrap";
import React, { useContext } from "react";
import { UserContext } from "./UserContext";
import { useImageSets } from "./useGqlCached";
import Select from "react-select";

export function ImageSetDropdown({ setImageSets }) {
  const { currentProject } = useContext(UserContext);
  const { imageSets } = useImageSets(currentProject);
  const options = imageSets
    ?.map((x) => {
      return { label: x.name, value: x.name };
    })
    ?.sort((a, b) => {
      return a.label > b.label ? 1 : -1;
    });

  function handleChange(x) {
    setImageSets(x?.map((y) => y.label));
  }

  console.log("imageSets");
  console.log(options);

  return (
    <Form.Group>
      <Select
        defaultValue={[]}
        onChange={handleChange}
        isMulti
        name="Image sets"
        options={options}
        className="basic-multi-select"
        classNamePrefix="select"
        closeMenuOnSelect={false}
      />
    </Form.Group>
  );
  // <Form.Select value={selectedSet || "none"} onChange={onSelect}>
  //             {!selectedSet && <option value="none">Select an annotation set</option>}
  //             {categories?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}
  //         </Form.Select>
}
