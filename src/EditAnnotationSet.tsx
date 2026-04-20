import React, { useContext, useEffect, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from './Modal';
import { GlobalContext } from './Context';
import { Tab, Tabs } from './Tabs';
import { Schema } from './amplify/client-schema';
import LabelEditor from './survey/LabelEditor';
import { useQuery } from '@tanstack/react-query';

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
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<number>(0);
  const [handleMove, _setHandleMove] = useState<() => Promise<void>>(() =>
    Promise.resolve()
  );
  const [saveLabels, setSaveLabels] = useState<
    ((
      annotationSetId: string,
      projectId: string,
      group: string
    ) => Promise<void>) | null
  >(null);

  const { data: fetchedCategories, isFetching: categoriesLoading } = useQuery({
    queryKey: ['annotation-set-categories', annotationSet.id],
    enabled: show,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await client.models.Category.categoriesByAnnotationSetId(
        { annotationSetId: annotationSet.id }
      );
      return data ?? [];
    },
  });

  const handleSave = async () => {
    if (!annotationSet || newName.trim() === '') return;

    setErrorMessage('');
    setIsSaving(true);
    try {
      const { data: result } = await client.models.AnnotationSet.update({
        id: annotationSet.id,
        name: newName,
      });
      if (setAnnotationSet && result) {
        setAnnotationSet({ id: result.id, name: result.name });
      }
      if (saveLabels) {
        await saveLabels(
          annotationSet.id,
          project.id,
          project.group || project.organizationId
        );
      }
      setStatusMessage('');
      setSelectedSets?.([]);
      handleClose();
    } catch (err) {
      console.error('Failed to save annotation set edits', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save changes'
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setNewName(annotationSet.name);
  }, [annotationSet.name]);

  return (
    <Modal show={show} onHide={handleClose} strict={true}>
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
              {categoriesLoading || !fetchedCategories ? (
                <div className='d-flex align-items-center gap-2 py-3'>
                  <Spinner size='sm' />
                  <span>Loading labels...</span>
                </div>
              ) : (
                <LabelEditor
                  key={annotationSet.id}
                  defaultLabels={fetchedCategories.map((category) => ({
                    id: category.id,
                    name: category.name,
                    shortcutKey: category.shortcutKey ?? '',
                    color: category.color ?? '',
                  }))}
                  isEditing
                  setHandleSave={setSaveLabels}
                  onStatusChange={setStatusMessage}
                />
              )}
            </Form>
          </Tab>
        </Tabs>
        <Footer>
          {errorMessage ? (
            <span className='text-danger me-auto' style={{ fontSize: 12 }}>
              {errorMessage}
            </span>
          ) : statusMessage ? (
            <span className='text-muted me-auto d-flex align-items-center gap-2' style={{ fontSize: 12 }}>
              <Spinner size='sm' />
              {statusMessage}
            </span>
          ) : null}
          <Button
            variant='primary'
            disabled={isSaving}
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
            {isSaving ? (
              <span className='d-flex align-items-center gap-2'>
                <Spinner size='sm' />
                Saving...
              </span>
            ) : tab === 1 ? (
              'Move Observations'
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button
            variant='dark'
            disabled={isSaving}
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
