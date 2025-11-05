import { useContext, ChangeEvent } from 'react';
import { ProjectContext, ManagementContext } from './Context';
import Select, { SingleValue } from 'react-select';

interface AnnotationSetDropdownProps {
  setAnnotationSet: (arg0: string) => void;
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
  const {
    annotationSetsHook: { data: annotationSets, create: createAnnotationSet },
  } = useContext(ManagementContext)!;
  const onNewAnnotationSet = async () => {
    const name = prompt('Please enter new AnnotationSet name', '');
    if (name) {
      setAnnotationSet(createAnnotationSet({ name, projectId: project.id }));
    }
  };
  const options = annotationSets?.map((q) => ({ label: q.name, value: q.id }));
  if (canCreate) {
    options.push({ label: 'Add a new annotation set', value: 'new' });
  }

  const onSelect = (e: SingleValue<OptionType>) => {
    if (e.value == 'new') {
      onNewAnnotationSet();
    } else {
      setAnnotationSet(e.value);
    }
  };

  return (
    <Select
      className='annotation-set-dropdown text-black'
      value={options.find((o) => o.value == selectedSet)}
      onChange={onSelect}
      name='Select annotation set'
      options={options}
    />
  );
}
