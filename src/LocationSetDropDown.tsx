import { Form } from 'react-bootstrap';
import React, { useContext } from 'react';
import { ProjectContext, ManagementContext } from './Context';
import Select, { MultiValue, Options } from 'react-select';

interface LocationSetDropdownProps<IsMulti extends boolean = true> {
  selectedTasks: IsMulti extends true
    ? string[] | undefined
    : string | undefined;
  setTasks: IsMulti extends true
    ? (selected: string[]) => void
    : (selected: string) => void;
  isMulti?: IsMulti;
}

interface OptionType {
  label: string;
  value: string;
}

export function LocationSetDropdown<IsMulti extends boolean = true>({
  selectedTasks,
  setTasks,
  isMulti = true as IsMulti,
}: LocationSetDropdownProps<IsMulti>) {
  const { project } = useContext(ProjectContext)!;
  const {
    locationSetsHook: { data: tasks },
  } = useContext(ManagementContext)!;
  const options: Options<OptionType> | undefined = tasks
    ?.map((x) => ({
      label: x.name,
      value: x.id,
    }))
    .sort((a, b) => (a.label > b.label ? 1 : -1));

  const selectedOptions = isMulti
    ? options?.filter((o) => (selectedTasks as string[])?.includes(o.value))
    : options?.find((o) => o.value === selectedTasks);

  function handleChange(
    selectedOptions: MultiValue<OptionType> | OptionType | null
  ) {
    if (isMulti) {
      (setTasks as (selected: string[]) => void)(
        (selectedOptions as MultiValue<OptionType>).map((o) => o.value)
      );
    } else {
      (setTasks as (selected: string) => void)(
        selectedOptions ? (selectedOptions as OptionType).value : ''
      );
    }
  }

  return (
    <Form.Group>
      <Select
        value={selectedOptions}
        onChange={handleChange}
        isMulti={isMulti}
        name="Image sets"
        options={options}
        className="basic-multi-select text-black"
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
