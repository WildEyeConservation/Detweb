import { Form } from 'react-bootstrap';
import { useContext } from 'react';
import { ManagementContext } from './Context';
import Select, { MultiValue, Options } from 'react-select';

interface MultiAnnotationSetDropdownProps {
  setAnnotationSets: (selected: string[]) => void;
  selectedSets: string[] | undefined;
  canCreate?: boolean;
}

interface OptionType {
  label: string;
  value: string;
}

export function MultiAnnotationSetDropdown({
  setAnnotationSets,
  selectedSets,
}: MultiAnnotationSetDropdownProps) {
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
    const selectedValues = selectedOptions.map((o) => o.value);
    setAnnotationSets(selectedValues);
  }

  return (
    <Form.Group>
      <Select
        value={selectedOptions}
        onChange={handleChange}
        isMulti
        name='Annotation Sets'
        options={options}
        className='basic-multi-select text-black'
        classNamePrefix='select'
        closeMenuOnSelect={false}
        placeholder='Select annotation sets...'
      />
    </Form.Group>
  );
}
