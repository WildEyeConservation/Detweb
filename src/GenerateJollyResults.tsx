import { Modal, Button, Form } from 'react-bootstrap';
import { GlobalContext } from './Context.tsx';
import { useContext, useState, useEffect } from 'react';
import Select from 'react-select';
import { fetchAllPaginatedResults } from './utils.tsx';
import { useNavigate } from 'react-router-dom';

export default function GenerateJollyResults({
  surveyId,
  annotationSetId,
}: {
  surveyId: string;
  annotationSetId: string;
}) {
  const { client, modalToShow, showModal } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const [categoryOptions, setCategoryOptions] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);
  const [selectedCategories, setSelectedCategories] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const categories = await fetchAllPaginatedResults(
        client.models.Category.categoriesByAnnotationSetId,
        { annotationSetId }
      );
      setCategoryOptions(
        categories.map((c) => ({ label: c.name, value: c.id }))
      );
    };
    fetchCategories();
  }, [annotationSetId]);

  async function generateJollyResults() {
    if (selectedCategories.length === 0) {
      alert('Please select at least one label');
      return;
    }

    setLoading(true);

    const data = await client.mutations.generateSurveyResults({
      surveyId,
      annotationSetId,
      categoryIds: selectedCategories.map((c) => c.value),
    });

    const result = JSON.parse(data.data) as {
      statusCode: number;
      body: string;
    };

    if (result?.statusCode === 200) {
      showModal(null);
      navigate(`/jolly/${surveyId}/${annotationSetId}`);
    } else {
      const body = JSON.parse(result?.body) as {
        message: string;
        error: string;
      };
      alert(`${body.message}: ${body.error}`);
    }

    setLoading(false);
  }

  return (
    <Modal
      show={modalToShow === 'generateJollyResults'}
      onHide={() => showModal(null)}
      size='lg'
      backdrop='static'
    >
      <Modal.Header>
        <Modal.Title>Generate Jolly Results</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId='categories'>
            <Form.Label className='mb-1'>Labels</Form.Label>
            <span
              className='text-muted d-block mb-2'
              style={{ fontSize: '14px' }}
            >
              Select the labels to include in the Jolly results.
            </span>
            <Select
              isMulti
              options={categoryOptions}
              value={selectedCategories}
              onChange={setSelectedCategories}
              className='text-black'
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant='primary'
          disabled={loading}
          onClick={() => generateJollyResults()}
        >
          {loading ? 'Generating...' : 'Generate'}
        </Button>
        <Button
          variant='dark'
          disabled={loading}
          onClick={() => showModal(null)}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
