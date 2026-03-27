import { useState, useContext, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../Modal';
import { GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';

type Collection = Schema['Collection']['type'];

export default function EditCollectionModal({
  show,
  collection,
  onClose,
  onSave,
}: {
  show: boolean;
  collection: Collection;
  onClose: () => void;
  onSave: (updated: Collection) => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(collection.name);
    setDescription(collection.description ?? '');
  }, [collection]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await client.models.Collection.update({
        id: collection.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (data) onSave(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} size='lg'>
      <Header>
        <Title>Edit Collection</Title>
      </Header>
      <Body>
        <Form id='edit-collection-form' onSubmit={handleSubmit} className='p-3'>
          <Form.Group className='mb-3'>
            <Form.Label>Name</Form.Label>
            <Form.Control
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as='textarea'
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Group>
        </Form>
      </Body>
      <Footer>
        <Button variant='dark' onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type='submit' form='edit-collection-form' disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Footer>
    </Modal>
  );
}
