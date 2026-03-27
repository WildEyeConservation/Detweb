import { useState, useContext } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../Modal';
import { GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';

type Collection = Schema['Collection']['type'];

export default function CreateCollectionModal({
  show,
  organizationId,
  onClose,
  onCreate,
}: {
  show: boolean;
  organizationId: string;
  onClose: () => void;
  onCreate: (collection: Collection) => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await client.models.Collection.create({
        name: name.trim(),
        description: description.trim() || undefined,
        organizationId,
        group: organizationId,
      });
      if (data) onCreate(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setName('');
    setDescription('');
    onClose();
  }

  return (
    <Modal show={show} onHide={handleClose} size='lg'>
      <Header>
        <Title>New Collection</Title>
      </Header>
      <Body>
        <Form id='create-collection-form' onSubmit={handleSubmit} className='p-3'>
          <Form.Group className='mb-3'>
            <Form.Label>Name</Form.Label>
            <Form.Control
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Collection name'
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as='textarea'
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Optional description'
            />
          </Form.Group>
        </Form>
      </Body>
      <Footer>
        <Button variant='dark' onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button type='submit' form='create-collection-form' disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </Footer>
    </Modal>
  );
}
