import React, { useContext, useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from './Modal';
import { GlobalContext } from './Context';
import { Tab, Tabs } from './Tabs';
import { Schema } from '../amplify/data/resource';
import LabelEditor from './survey/LabelEditor';

interface EditAnnotationSetModalProps {
  show: boolean;
  handleClose: () => void;
  annotationSet: { id: string; name: string };
  setAnnotationSet?: (annotationSet: { id: string; name: string }) => void;
  setSelectedSets?: (sets: string[]) => void;
  project: Schema['Project']['type'];
  categories: { name: string }[];
  setEditSurveyTab: (tab: number) => void;
}

const EditAnnotationSetModal: React.FC<EditAnnotationSetModalProps> = ({
  show,
  handleClose,
  annotationSet,
  setSelectedSets,
  setAnnotationSet,
  project,
}) => {
  const { client } = useContext(GlobalContext)!;
  const [newName, setNewName] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [tab, setTab] = useState<number>(0);
  const [handleMove, setHandleMove] = useState<() => Promise<void>>(() =>
    Promise.resolve()
  );
  const [saveLabels, setSaveLabels] = useState<
    ((annotationSetId: string, projectId: string) => Promise<void>) | null
  >(null);

  const handleSave = async () => {
    if (annotationSet && newName.trim() !== '') {
      setBusy(true);

      const { data: result } = await client.models.AnnotationSet.update({
        id: annotationSet.id,
        name: newName,
      });

      if (setAnnotationSet && result) {
        setAnnotationSet({ id: result.id, name: result.name });
        if (saveLabels) {
          await saveLabels(annotationSet.id, project.id);
        }
      }

      handleClose();

      if (setSelectedSets) {
        setSelectedSets([]);
      }

      setBusy(false);
    }
  };

  useEffect(() => {
    setNewName(annotationSet.name);
  }, [annotationSet.name]);

  return (
    <Modal show={show} onHide={handleClose} disabled={busy} strict={true}>
      <Header>
        <Title>Edit Annotation Set</Title>
      </Header>
      <Body>
        <Tabs
          onTabChange={(tab) => {
            setTab(tab);
          }}
        >
          <Tab label='Basic'>
            <Form className='d-flex flex-column gap-2 p-3'>
              <Form.Group controlId='annotationSetName'>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type='text'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='Enter new name'
                />
              </Form.Group>
              <LabelEditor
                defaultLabels={project.annotationSets
                  .find((set) => set.id === annotationSet.id)
                  ?.categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                    shortcutKey: category.shortcutKey,
                    color: category.color,
                  }))}
                isEditing
                setHandleSave={setSaveLabels}
              />
            </Form>
          </Tab>
        </Tabs>
        <Footer>
          <Button
            variant='primary'
            disabled={busy}
            onClick={() => {
              switch (tab) {
                case 0:
                  handleSave();
                  break;
                case 1:
                  handleMove();
                  break;
              }
            }}
          >
            {busy
              ? 'Saving...'
              : tab === 1
              ? 'Move Observations'
              : 'Save Changes'}
          </Button>
          <Button
            variant='dark'
            disabled={busy}
            onClick={() => {
              handleClose();
              if (setSelectedSets) {
                setSelectedSets([]);
              }
            }}
          >
            Cancel
          </Button>
        </Footer>
      </Body>
    </Modal>
  );
};

export default EditAnnotationSetModal;
