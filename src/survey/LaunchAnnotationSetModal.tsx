import { Modal, Button, Form } from "react-bootstrap";
import { useState } from "react";
import ImageSetDropdown from "./ImageSetDropdown";

export default function LaunchAnnotationSetModal({
  show,
  onClose,
  imageSets,
}: {
  show: boolean;
  onClose: () => void;
  imageSets: { id: string; name: string }[];
}) {
  const [selectedImageSets, setSelectedImageSets] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState<number>(200);
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [skipLocationsWithAnnotations, setSkipLocationsWithAnnotations] =
    useState<boolean>(false);
  const [
    allowAnnotationsOutsideLocationBoundaries,
    setAllowAnnotationsOutsideLocationBoundaries,
  ] = useState<boolean>(true);
  const [viewUnobservedLocationsOnly, setViewUnobservedLocationsOnly] =
    useState<boolean>(false);
  const [manuallyDefineTileDimensions, setManuallyDefineTileDimensions] =
    useState<boolean>(false);
  const [taskTag, setTaskTag] = useState<string>("Manual");
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [lowerLimit, setLowerLimit] = useState<number>(0);
  const [upperLimit, setUpperLimit] = useState<number>(1);
  const [hidden, setHidden] = useState<boolean>(false);

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Launch for Manual Annotation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column gap-3">
          <ImageSetDropdown
            imageSets={imageSets}
            selectedImageSets={selectedImageSets}
            setSelectedImageSets={setSelectedImageSets}
            hideIfOneImageSet
          />
          <Form.Group>
            <Form.Label className="mb-0">Batch Size</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: "12px" }}
            >
              The number of clusters in each unit of work collected by workers.
            </span>
            <Form.Control
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Switch
              label="Show Advanced Options"
              checked={showAdvancedOptions}
              onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}
            />
          </Form.Group>
          {showAdvancedOptions && (
            <div className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label className="mb-0">Task Tag</Form.Label>
                <span
                  className="text-muted d-block mb-1"
                  style={{ fontSize: "12px" }}
                >
                  This tag will be added to all locations in the task.
                </span>
                <Form.Control
                  type="text"
                  value={taskTag}
                  onChange={(e) => setTaskTag(e.target.value)}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="mb-0">Zoom Level</Form.Label>
                <span
                  className="text-muted d-block mb-1"
                  style={{ fontSize: "12px" }}
                >
                  Select the default zoom level for images.
                </span>
                <Form.Select
                  value={zoom}
                  onChange={(e) =>
                    setZoom(
                      e.target.value == "auto" ? undefined : e.target.value
                    )
                  }
                >
                  <option value="auto">Auto</option>
                  {[...Array(13)].map((_, i) => (
                    <option key={i} value={i}>
                      Level {i}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label className="mb-0">
                  Filter by confidence value:
                </Form.Label>
                <span
                  className="text-muted d-block mb-1"
                  style={{ fontSize: "12px" }}
                >
                  Filter images by confidence value.
                </span>
                <div className="d-flex align-items-center gap-2">
                  <Form.Control
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={lowerLimit}
                    onChange={(e) => setLowerLimit(Number(e.target.value))}
                    style={{ width: "80px" }}
                  />
                  <span>to</span>
                  <Form.Control
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={upperLimit}
                    onChange={(e) => setUpperLimit(Number(e.target.value))}
                    style={{ width: "80px" }}
                  />
                </div>
              </Form.Group>
              <Form.Group>
                <Form.Switch
                  label="Skip Locations With Annotations"
                  checked={skipLocationsWithAnnotations}
                  onChange={() =>
                    setSkipLocationsWithAnnotations(
                      !skipLocationsWithAnnotations
                    )
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Switch
                  label="Allow Annotations Outside Location Boundaries"
                  checked={allowAnnotationsOutsideLocationBoundaries}
                  onChange={() =>
                    setAllowAnnotationsOutsideLocationBoundaries(
                      !allowAnnotationsOutsideLocationBoundaries
                    )
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Switch
                  label="View Unobserved Locations Only"
                  checked={viewUnobservedLocationsOnly}
                  onChange={() =>
                    setViewUnobservedLocationsOnly(!viewUnobservedLocationsOnly)
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Switch
                  label="Hide Job From Non-Admin Workers"
                  checked={hidden}
                  onChange={() => setHidden(!hidden)}
                />
              </Form.Group>
              <Form.Group>
                <Form.Switch
                  label="Manually Define Tile Dimensions"
                  checked={manuallyDefineTileDimensions}
                  onChange={() =>
                    setManuallyDefineTileDimensions(
                      !manuallyDefineTileDimensions
                    )
                  }
                />
              </Form.Group>
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onClose}>
          Launch
        </Button>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
