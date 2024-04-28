import React, { useContext, useState } from "react";
import MyTable from "./Table";
// import { onCreateCategory, onUpdateCategory, onDeleteCategory } from './graphql/subscriptions'
// import { listCategories } from './graphql/queries';
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Container from "react-bootstrap/Container";
import { useCategory } from "./useGqlCached";
import { UserContext } from "./UserContext";

/* Here I am rewriting the existing defineCategories page using TanStack as a risk reduction exercise before 
trying to port other parts of the application to this approach*/

export default function DefineCategories() {
  const { currentProject } = useContext(UserContext);
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState({
    name: "Object",
    color: "#563d7c",
    shortcutKey: "",
  });
  const setName = (newname) => {
    setCategory(() => {
      return { ...category, name: newname };
    });
  };
  const setColor = (newColor) => {
    setCategory(() => {
      return { ...category, color: newColor };
    });
  };
  const setShortcutKey = (newKey) => {
    setCategory(() => {
      return { ...category, shortcutKey: newKey };
    });
  };
  const { categories, createCategory, deleteCategory, updateCategory } =
    useCategory(currentProject);
  //const {data:items} = query

  const handleSubmit = () => {
    setShowModal(false);
    if (category.id) {
      updateCategory(category);
    } else {
      createCategory(category);
    }
  };

  const editCategory = (category) => {
    setCategory(category);
    setShowModal(true);
  };

  const tableData = categories
    ?.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    ?.map((item) => {
      const { id, name, color, shortcutKey } = item;
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
            value={color}
            title="Category color"
          />,
          <>
            <Button
              variant="primary"
              onClick={() => {
                editCategory(item);
              }}
            >
              Edit
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                deleteCategory(item);
              }}
            >
              Delete
            </Button>
          </>,
        ],
      };
    });

  return (
    <>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Category</Modal.Title>
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
                value={category.shortcutKey}
                onChange={(x) => setShortcutKey(x.target.value)}
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
      <Container>
        {tableData && (
          <MyTable
            tableHeadings={["Name", "Shortcut", "Color", "Actions"]}
            tableData={tableData}
          />
        )}
      </Container>
      <Button
        variant="primary"
        onClick={() => {
          setCategory({ ...category, id: false });
          setShowModal(true);
        }}
      >
        Add New Category
      </Button>
    </>
  );
}
