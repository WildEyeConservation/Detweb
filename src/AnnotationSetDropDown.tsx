import { Form } from "react-bootstrap";
import { useContext, ChangeEvent  } from "react";
import { UserContext } from "./UserContext";
import { useAnnotationSets } from "./useGqlCached";
import { AnnotationSetType } from "./schemaTypes";
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
  const { currentProject } = useContext(UserContext)!;
  const { annotationSets, createAnnotationSet } = useAnnotationSets({projectId: currentProject!.id})
  const onNewAnnotationSet = async () => {
    const name = prompt("Please enter new AnnotationSet name", "");
    if (name) {
      //const {data:{createAnnotationSet:{id}}}=await createAnnotationSet(name)
      const id = createAnnotationSet({ name, projectId: currentProject!.id } as Partial<AnnotationSetType>);
      setAnnotationSet(id);
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
    <Form.Select value={selectedSet || "none"} onChange={onSelect}>
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
