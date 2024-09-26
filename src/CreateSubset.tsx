import React,{useContext} from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { ManagementContext,GlobalContext } from './Context';

interface CreateSubsetModalProps {
  show: boolean;
  handleClose: () => void;
  selectedImageSets: string[];
}

const CreateSubsetModal: React.FC<CreateSubsetModalProps> = ({ show, handleClose, selectedImageSets }) => {
    const { imageSetsHook: { data: imageSets } } = useContext(ManagementContext)!;
    const {showModal} = useContext(GlobalContext)!;

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Create Subset</Modal.Title>
      </Modal.Header>
      <Modal.Body>
              <p className="text-center">Choose the type of subset you want to create for imagesets<br/> 
                  {imageSets.filter(({id}) => selectedImageSets.includes(id)).map(({name}) => name).join(", ")}</p>
        <div className="d-flex flex-column align-items-center">
          <Button variant="primary" className="mb-2 w-75" onClick={() => showModal('SpatiotemporalSubset')}>
            Spatial subset
          </Button>
          <Button variant="primary" className="mb-2 w-75" onClick={() => showModal('temporalSubset')}>
            Temporal subset
          </Button>
          <Button variant="primary" className="mb-2 w-75" onClick={() => showModal('Subsample')}>
            Subsampled subset
          </Button>
          <Button variant="primary" disabled className="mb-2 w-75" onClick={() => showModal('FileStructure')}>
            File structure subset
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default CreateSubsetModal;