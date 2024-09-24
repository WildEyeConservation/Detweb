import { Form } from "react-bootstrap";
import React, { useContext } from "react";
import { ProjectContext, ManagementContext } from "./Context";
import Select, { MultiValue, Options  } from "react-select";

interface LocationSetDropdownProps {
  selectedTasks: string[] | undefined;
  setTasks: (selected: string[]) => void;
}

interface OptionType {
  label: string;
  value: string;
}

export function LocationSetDropdown({
  selectedTasks,
  setTasks 
}: LocationSetDropdownProps) {
  const { project } = useContext(ProjectContext)!;
  const {locationSetsHook:{data:tasks}} = useContext(ManagementContext)!;
  const options: Options<OptionType> | undefined = tasks?.map((x) => ({
      label: x.name,
      value: x.id,
    }))
    .sort((a, b) => (a.label > b.label ? 1 : -1));
  const selectedOptions=options?.filter(o=>selectedTasks?.includes(o.value))

  function handleChange(selectedOptions: MultiValue<OptionType>) {
    setTasks(selectedOptions.map(o => o.value));
  }

  return (
    <Form.Group>
    <Select
      value={selectedOptions}
      onChange={handleChange}
      isMulti
      name="Image sets"
      options={options}
      className="basic-multi-select"
      classNamePrefix="select"
      closeMenuOnSelect={false}
    />
  </Form.Group>
    // <Form.Select value={selectedSet || "none"} onChange={onSelect}>
    //   {!selectedSet && <option value="none">Select a LocationSet</option>}
    //   {locationSets?.map((q) => (
    //     <option key={q.id} value={q.id}>
    //       {q.name}
    //     </option>
    //   ))}
    //   {hasCreateOption && <option value="new">Add a new Location set</option>}
    // </Form.Select>
  );
}
