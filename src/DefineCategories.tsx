import { useContext, useState } from "react";
import MyTable from "./Table";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Container from "react-bootstrap/Container";
import { UserContext } from "./UserContext";
import { useCategory } from "./useGqlCached";
import { type CategoryType } from "./schemaTypes";


/* Here I am rewriting the existing defineCategories page using TanStack as a risk reduction exercise before 
trying to port other parts of the application to this approach*/

const initialCategoryState: Partial<CategoryType> = {
  name: "Object",
  projectId: "",
  color: "#563d7c",
  shortcutKey: "",
};

export default function DefineCategories() {
  const { currentProject } = useContext(UserContext) ?? {};
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState<Partial<CategoryType>>({
    ...initialCategoryState,
    projectId: currentProject?.id,
  });

  const setName = (newname: string) => {
    setCategory((prevCategory) => {
      return { ...prevCategory, name: newname };
    });
  };
  const setColor = (newColor: string) => {
    setCategory((prevCategory) => {
      return { ...prevCategory, color: newColor };
    });
  };
  const setShortcutKey = (newKey: string) => {
    setCategory((prevCategory) => {
      return { ...prevCategory, shortcutKey: newKey };
    });
  };
  const { categories, createCategory, deleteCategory, updateCategory } =
    useCategory(currentProject);
  //const {data:items} = query

  const handleSubmit = () => {
    setShowModal(false);
    if (typeof category.id === 'string') {
      updateCategory(category as CategoryType & { id: string });
    } else {
      createCategory({ ...category, id: undefined });
    }
  };

  const editCategory = (category: CategoryType) => {
    setCategory(category);
    setShowModal(true);
  };

  const tableData = categories
    ?.sort((a: CategoryType, b: CategoryType) => (a.createdAt ?? "") > (b.createdAt ?? "") ? 1 : -1)
    ?.map((item: CategoryType) => {
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
            value={color!}
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
                if (typeof item.id === 'string') {
                  console.log("Deleting category with ID:", item.id);
                  deleteCategory(item as CategoryType & { id: string });
                }
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
                value={category.shortcutKey ?? ""}
                onChange={(x) => setShortcutKey(x.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Category color</Form.Label>
              <Form.Control
                type="color"
                id="exampleColorInput"
                size="sm"
                value={category.color ?? "#563d7c"}
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
            tableHeadings={[
              { content: "Name", style: undefined },
              { content: "Shortcut", style: undefined },
              { content: "Color", style: undefined },
              { content: "Actions", style: undefined },
            ]}
            tableData={tableData}
          />
        )}
      </Container>
      <Button
        variant="primary"
        onClick={() => {
          setCategory({ ...initialCategoryState, projectId: currentProject?.id});
          setShowModal(true);
        }}
      >
        Add New Category
      </Button>
    </>
  );
}