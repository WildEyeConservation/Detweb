import React, { useState,useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ImageSetDropdown from './survey/ImageSetDropdown';
import { GlobalContext } from './Context';
import { Schema } from '../amplify/data/resource';
interface SubsampleModalProps {
    show: boolean;
    handleClose: () => void;
    selectedImageSets: string[];
    setSelectedImageSets: React.Dispatch<React.SetStateAction<string[]>>;
    project: Schema["Project"]["type"];
}

const SubsampleModal: React.FC<SubsampleModalProps> = ({ 
    show, 
    handleClose, 
    selectedImageSets, 
    setSelectedImageSets,
    project
}) => {
    const [subsampleInterval, setSubsampleInterval] = useState<number>(2);
    const { client } = useContext(GlobalContext)!;

    const  handleSubmit = async () => {
        // Implement the subsampling logic here
        console.log(`Subsampling with interval: ${subsampleInterval}`);
        console.log(`Selected Image Sets: ${selectedImageSets.join(', ')}`);
        for (const imageSet of selectedImageSets) {
            const allImages: { id: string, timestamp: number }[] = []
            const { data } = await client.models.ImageSet.get({ id: imageSet })
            const { name, images } = data
            let prevNextToken: String | undefined = undefined;
            do {
                const result = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({ imageSetId: imageSet }, { selectionSet: ['image.id', 'image.timestamp'], nextToken: prevNextToken })
                const { data, nextToken } = result
                prevNextToken = nextToken
                allImages.push(...data.map(({ image }) => image))
            } while (prevNextToken)
            //Sort images by timestamp
            allImages.sort((a, b) => a.timestamp - b.timestamp)
            //Subsample images
            const subsampledImages = allImages.filter((_, index) => index % subsampleInterval === 0)
            const newImageSetId = crypto.randomUUID()
            const promises=subsampledImages.map(image=>client.models.ImageSetMembership.create({
                imageSetId: newImageSetId,
                imageId: image.id,
            }))
            await Promise.all(promises)
            await client.models.ImageSet.create({
                id: newImageSetId,
                projectId: project.id,
                name: `${name}-sub-${subsampleInterval}`,
                imageCount: subsampledImages.length
            })
            console.log(allImages)
        }
        handleClose();
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>Subsample Images</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <ImageSetDropdown
                        imageSets={project.imageSets}
                        selectedImageSets={selectedImageSets}
                        setSelectedImageSets={setSelectedImageSets}
                    />
                    <Form.Group className="mb-3">
                        <Form.Label>Subsample Interval</Form.Label>
                        <Form.Control
                            type="number"
                            value={subsampleInterval}
                            onChange={(e) => setSubsampleInterval(Math.max(2, parseInt(e.target.value)))}
                            min={2}
                        />
                        <Form.Text className="text-muted">
                            Enter an integer greater than 1
                        </Form.Text>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
            <Button 
                    variant="primary" 
                    onClick={handleSubmit}
                    disabled={selectedImageSets.length === 0 || subsampleInterval < 2}
                >
                    Submit
                </Button>
                <Button variant="dark" onClick={handleClose}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SubsampleModal;