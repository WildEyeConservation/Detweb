import { useContext, useEffect, useState } from "react";
import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Popover from "react-bootstrap/Popover";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import { GlobalContext, ProjectContext } from "./Context.tsx";
import { Schema } from "../amplify/data/resource.ts";
import { useRecordHotkeys } from "react-hotkeys-hook";


export default function DefineCategories() {
  const { client } = useContext(GlobalContext)!;
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("create");
  const {project,categoriesHook: {data: categories, create: createCategory, delete: deleteCategory, update: updateCategory }} = useContext(ProjectContext)!;
  const [keys, { start, stop, isRecording }] = useRecordHotkeys()

  const initialCategoryState = {
    name: "Object",
    color: "#563d7c",
    shortcutKey: "o",
    projectId: project.id,
    id: ""
  }

  const [category, setCategory] = useState<any>(initialCategoryState);

  const setName = (newname: string) => {
    setCategory((prevCategory: any) => {
      return { ...prevCategory, name: newname };
    });
  };

  const setColor = (newColor: string) => {
    setCategory((prevCategory: any) => {
      return { ...prevCategory, color: newColor };
    });
  };

  const setShortcutKey = (newKey: string) => {
    setCategory((prevCategory: any) => {
      return { ...prevCategory, shortcutKey: newKey };
    });
  };

  const handleSubmit = () => {
    setShowModal(false);
    if (category?.id) {
      updateCategory(category);
    } else {
      createCategory(category);
    }
  };

  const editCategory = (category : any) => {
    setCategory(category);
    setModalType("edit");
    setShowModal(true);
  };

  const tableData = categories
    ?.sort((a, b) => ((a.createdAt|| 0) > (b.createdAt || 0) ? 1 : -1))
    ?.map((item) => {
      const { id, name, color, shortcutKey, annotationCount } = item;
      return {
        id,
        rowData: [
          name,
          shortcutKey,
          <Form.Control
            key={0}
            disabled
            type="color"
            id="exampleColorInput"
            size="lg"
            value={color || "red"}
            title="Category color"
          />,
          annotationCount || 0,
          <>
            <Button
              variant="info"
              className="me-2 fixed-width-button"
              onClick={() => {
                editCategory(item);
              }}
            >
              Edit
            </Button>
              <span>
                <Button
                  variant="danger"
                  className="me-2 fixed-width-button"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete category ${name}?`)) {
                      deleteCategory(item);
                    }
                  }}
                >
                  Delete
                </Button>
              </span>
          </>
        ],
      };
    });

  return (
    <>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{`${modalType === "create" ? "Create New" : "Edit"} Category`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Category Name</Form.Label>
              <Form.Control
                type="text"
                value={category.name}
                onChange={(x) => setName(x.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Shortcut key</Form.Label>
              <Form.Control
                type="text"
                disabled={false}
                value={isRecording ? Array.from(keys).join("+") : category.shortcutKey}
                onFocus={start}
                onBlur={() => {
                  stop();
                  setShortcutKey(Array.from(keys).join("+"));
                }}
                onChange={() => {}} //suppress React warning
              />             
            </Form.Group>
            <Form.Group>
              <Form.Label>Category color</Form.Label>
              <Form.Control
                type="color"
                id="exampleColorInput"
                size="sm"
                value={category.color}
                title="Category color"
                onChange={(event) => {
                  setColor(event.currentTarget.value);
                }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleSubmit}>
            Submit
          </Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
      <Row className="justify-content-center mt-3">
      <div>
        <h2>Categories</h2>
        {tableData && (
          <MyTable
            tableHeadings={[{content:"Name", style: { width: "500px" } }, {content:"Shortcut"}, {content:"Color"}, {content:"Raw annotations"}, {content:"Actions"}]}
            tableData={tableData}
          />
          )}
          </div>
      </Row>
      <Col className="text-center mt-3">
          <Button variant="primary"         onClick={() => {
          setCategory(initialCategoryState);
          setModalType("create");
          setShowModal(true);
        }}>
            Add new category
          </Button>
      </Col>
    </>
  );
}
