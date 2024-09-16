import { Form } from "react-bootstrap";
import React, { useContext } from "react";
import { ProjectContext } from "./Context";
interface LocationSetDropdownProps {
  selectedSet: string | null;
  setLocationSet: (id: string | undefined) => void;
  hasCreateOption?: boolean;
}

export function LocationSetDropdown({
  selectedSet,
  setLocationSet ,
  hasCreateOption = false,
}: LocationSetDropdownProps) {
  const {project,locationSetsHook:{data:locationSets,create:createLocationSet}} = useContext(ProjectContext)!;
  
  const onNewLocationSet = async () => {
    const name = prompt("Please enter new LocationSet name", "");
    if (name) {
      setLocationSet(createLocationSet({name, projectId: project.id}));
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "new") {
      onNewLocationSet();
    } else {
      setLocationSet(e.target.value);
    }
  };

  return (
    <Form.Select value={selectedSet || "none"} onChange={onSelect}>
      {!selectedSet && <option value="none">Select a LocationSet</option>}
      {locationSets?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
      {hasCreateOption && <option value="new">Add a new Location set</option>}
    </Form.Select>
  );
}
