import React, { useContext, useState } from "react";
import { Form, Button } from "react-bootstrap";
import { GlobalContext } from "./Context";
import ImageSetDropdown from "./survey/ImageSetDropdown";
import { Schema } from "../amplify/data/resource";

interface CreateSubsetModalProps {
  imageSets: Schema["ImageSet"]["type"][];
  setSelectedSets: (sets: string[]) => void;
}

const CreateSubset: React.FC<CreateSubsetModalProps> = ({
  imageSets,
  setSelectedSets,
}) => {
  const { showModal } = useContext(GlobalContext)!;
  const [selectedImageSets, setSelectedImageSets] = useState<string[]>([]);

  return (
    <Form>
      <ImageSetDropdown
        imageSets={imageSets}
        selectedSets={selectedImageSets}
        setImageSets={(sets: string[]) => {
          setSelectedImageSets(sets);
          setSelectedSets(sets);
        }}
        hideIfOneImageSet
      />
      <p className="text-center mt-3">
        Choose the type of subset you want to create
        <br />
        {imageSets
          .filter(({ id }) => selectedImageSets.includes(id))
          .map(({ name }) => name)
          .join(", ")}
      </p>
      <div className="d-flex flex-column align-items-center">
        <Button
          variant="primary"
          className="mb-2 w-75"
          onClick={() => showModal("SpatiotemporalSubset")}
        >
          Spatiotemporal subset
        </Button>
        <Button
          variant="primary"
          className="mb-2 w-75"
          onClick={() => showModal("Subsample")}
        >
          Subsampled subset
        </Button>
        <Button
          variant="primary"
          className="mb-2 w-75"
          onClick={() => showModal("FileStructureSubset")}
        >
          File structure subset
        </Button>
      </div>
    </Form>
  );
};

export default CreateSubset;
