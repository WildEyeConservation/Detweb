import { Form } from "react-bootstrap";
import { useContext } from "react";
import { ManagementContext } from "./Context";
import Select, { MultiValue, Options } from "react-select";

interface MultiLocationSetDropdownProps {
  setLocationSets: (selected: string[]) => void;
  selectedSets: string[] | undefined;
  canCreate?: boolean;
}

interface OptionType {
  label: string;
  value: string;
}

export function MultiLocationSetDropdown({
  setLocationSets,
  selectedSets,
}: MultiLocationSetDropdownProps) {
  const {
    locationSetsHook: { data: locationSets },
  } = useContext(ManagementContext)!;

  const options: Options<OptionType> | undefined = locationSets
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
    setLocationSets(selectedValues);
  }

  return (
    <Form.Group>
      <Select
        value={selectedOptions}
        onChange={handleChange}
        isMulti
        name="Location Sets"
        options={options}
        className="basic-multi-select"
        classNamePrefix="select"
        closeMenuOnSelect={false}
        placeholder="Select location sets..."
      />
    </Form.Group>
  );
}
