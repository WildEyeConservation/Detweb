import { Form } from "react-bootstrap";
import { useContext } from "react";
import { UserContext } from "./UserContext";
import { useCategory } from "./useGqlCached";
import Select, { MultiValue, SingleValue, OptionsOrGroups } from "react-select";

interface CategoryOption {
  label: string;
  value: string;
}

interface CategoriesDropdownProps {
  setSelectedCategories: (categories: MultiValue<CategoryOption> | SingleValue<CategoryOption>) => void;
}

export function CategoriesDropdown({ setSelectedCategories }: CategoriesDropdownProps) {
  const { currentProject } = useContext(UserContext)!;
  const { categories } = useCategory(currentProject);

  const options: OptionsOrGroups<CategoryOption, any> = categories?.map((x) => {
    return { label: x.name, value: x.id };
  }) || [];

  function handleChange(selectedOptions: MultiValue<CategoryOption> | SingleValue<CategoryOption>) {
    setSelectedCategories(selectedOptions);
  }

  return (
    <Form.Group>
      <Form.Label>Select categories to review</Form.Label>
      <Select
        defaultValue={[]}
        onChange={handleChange}
        isMulti
        name="Categories"
        options={options}
        className="basic-multi-select"
        classNamePrefix="select"
        closeMenuOnSelect={false}
      />
    </Form.Group>
  );
}
