import { Form } from "react-bootstrap";
import { useContext, ChangeEvent  } from "react";
import { ProjectContext, ManagementContext } from "./Context";

interface AnnotationSetDropdownProps{
  setAnnotationSet: (arg0:string) => void;
  selectedSet: string | undefined;
  canCreate?: boolean;
}

export function AnnotationSetDropdown({
  setAnnotationSet,
  selectedSet,
  canCreate = true,
}: AnnotationSetDropdownProps) {
  // Look into this, UserContext is not passing through items within it
  const { project } = useContext(ProjectContext)!;
  const { annotationSetsHook: {data: annotationSets, create: createAnnotationSet } } = useContext(ManagementContext)!;
  const onNewAnnotationSet = async () => {
    const name = prompt("Please enter new AnnotationSet name", "");
    if (name) {
      setAnnotationSet(createAnnotationSet({ name, projectId: project.id }))
    }
  };

  const onSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value == "new") {
      onNewAnnotationSet();
    } else {
      setAnnotationSet(e.target.value);
    }
  };

  return (
    <Form.Select 
      value={selectedSet || "none"} 
      onChange={onSelect}
      aria-label="Select annotation set"
    >
      {!selectedSet && <option value="none">Select an annotation set</option>}
      {annotationSets?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
      {canCreate && <option value="new">Add a new annotation set</option>}
    </Form.Select>
  );
}
