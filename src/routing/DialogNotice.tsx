import { Button } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../Modal';

export default function DialogNotice({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal show onHide={onClose}>
      <Header>
        <Title>SurveyScope</Title>
      </Header>
      <Body>
        <p role='status' className='p-3 mb-0'>
          {message}
        </p>
      </Body>
      <Footer>
        <Button onClick={onClose} variant='dark'>
          Close
        </Button>
      </Footer>
    </Modal>
  );
}
