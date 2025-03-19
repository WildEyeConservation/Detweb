import { Form } from "react-bootstrap";
import Select from "react-select";
import { useEffect } from "react";

export default function ImageSetDropdown({
    imageSets,
    selectedImageSets,
    setSelectedImageSets,
  }: {
    imageSets: { id: string; name: string }[];
    selectedImageSets: string[];
    setSelectedImageSets: (imageSets: string[]) => void;
  }) {

    useEffect(() => {
        if (imageSets.length === 1 && selectedImageSets) {
          const singleId = imageSets[0].id;
          if (!selectedImageSets.includes(singleId)) {
            setSelectedImageSets([singleId]);
          }
        }
      }, [imageSets, selectedImageSets, setSelectedImageSets]);

    return (
      <Form.Group>
        <Form.Label className="mb-0">Image Sets</Form.Label>
        <span className="text-muted d-block mb-1" style={{ fontSize: "12px" }}>
          Select the image sets you want to use.
        </span>
        <Select
          className="text-black"
          options={imageSets.map((imageSet) => ({
            label: imageSet.name,
            value: imageSet.id,
          }))}
          onChange={(selectedOptions) => {
            setSelectedImageSets(selectedOptions.map((option) => option.value));
          }}
          value={
            imageSets.length === 1
              ? {
                  label: imageSets[0].name,
                  value: imageSets[0].id,
                }
              : selectedImageSets.map((id) => ({
                  label:
                    imageSets.find((imageSet) => imageSet.id === id)?.name || "",
                  value: id,
                }))
          }
          isMulti
        />
      </Form.Group>
    );
  }