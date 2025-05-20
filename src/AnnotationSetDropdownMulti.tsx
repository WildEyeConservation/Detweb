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

import { Form } from 'react-bootstrap';
import { useContext } from 'react';
import { ManagementContext } from './Context';
import Select, { MultiValue, Options } from 'react-select';

interface OptionType {
  label: string;
  value: string;
}

interface AnnotationSetDropdownProps {
  selectedSets: string[] | undefined;
  setSelectedSets: (selected: string[]) => void;
}

export function AnnotationSetDropdown({
  selectedSets,
  setSelectedSets,
}: AnnotationSetDropdownProps) {
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;
  const options: Options<OptionType> | undefined = annotationSets
    ?.map((x) => ({
      label: x.name,
      value: x.id,
    }))
    .sort((a, b) => (a.label > b.label ? 1 : -1));
  const selectedOptions = options?.filter((o) =>
    selectedSets?.includes(o.value)
  );

  function handleChange(selectedOptions: MultiValue<OptionType>) {
    setSelectedSets(selectedOptions.map((o) => o.value));
  }

  console.log('annotationSets');
  console.log(options);

  return (
    <Form.Group>
      <Select
        value={selectedOptions}
        onChange={handleChange}
        isMulti
        name="Annotation sets"
        options={options}
        className="basic-multi-select text-black"
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
