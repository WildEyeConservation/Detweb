import { Button, Modal } from 'react-bootstrap';
import { useContext, useState, useEffect, useRef } from 'react';
import { GlobalContext } from './Context';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import { fetchAllPaginatedResults } from './utils';

export default function TestPresetsModal({
  show,
  onClose,
  isNewPreset,
  organizationId,
  preset,
}: {
  show: boolean;
  onClose: () => void;
  isNewPreset: boolean;
  organizationId: string;
  preset?: { name: string; id: string };
}) {
  const [editName, setEditName] = useState(false);
  const [presetName, setPresetName] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<
    { label: string; value: string }[]
  >([]);
  const [annotationAccuracy, setAnnotationAccuracy] = useState(0);
  const { client } = useContext(GlobalContext)!;
  const [categories, setCategories] = useState<{ name: string; id: string }[]>(
    []
  );

  const ogDetails = useRef<{ accuracy: number; categories: string[] } | null>(
    null
  );

  function resetState() {
    setSelectedCategories([]);
    setCategories([]);
    setAnnotationAccuracy(0);
    setPresetName(null);
    setEditName(false);
  }

  async function handleSubmit() {
    if (
      selectedCategories.length === 0 ||
      annotationAccuracy < 0 ||
      annotationAccuracy > 100 ||
      (isNewPreset && !presetName) ||
      (!isNewPreset && !preset) ||
      (!isNewPreset && editName && !presetName)
    ) {
      alert('Please fill in all fields');
      return;
    }

    onClose();

    if (isNewPreset) {
      const { data: newPreset } = await client.models.TestPreset.create({
        name: presetName!,
        organizationId: organizationId,
        accuracy: annotationAccuracy,
        group: organizationId,
      });

      for (const category of selectedCategories) {
        await client.models.TestPresetCategory.create({
          testPresetId: newPreset!.id,
          categoryId: category.value,
          group: organizationId,
        });
      }
    } else {
      await client.models.TestPreset.update({
        id: preset!.id,
        name: presetName || preset!.name,
        accuracy: annotationAccuracy,
      });

      // delete categories that are not in selectedCategories
      for (const categoryId of ogDetails.current!.categories) {
        if (!selectedCategories.some((c) => c.value === categoryId)) {
          await client.models.TestPresetCategory.delete({
            testPresetId: preset!.id,
            categoryId: categoryId,
          });
        }
      }

      // add new categories that are not in ogDetails
      for (const category of selectedCategories) {
        if (!ogDetails.current!.categories.includes(category.value)) {
          await client.models.TestPresetCategory.create({
            testPresetId: preset!.id,
            categoryId: category.value,
            group: organizationId,
          });
        }
      }
    }
  }

  useEffect(() => {
    async function getPresets() {
      resetState();

      setPresetName(preset?.name || '');

      const organizationProjects = await fetchAllPaginatedResults(
        client.models.Project.list,
        {
          filter: {
            organizationId: { eq: organizationId },
          },
          selectionSet: ['id', 'name'],
        }
      );

      const projectCategoriesPromises = organizationProjects.map((project) =>
        fetchAllPaginatedResults(client.models.Category.categoriesByProjectId, {
          projectId: project.id,
          selectionSet: ['id', 'name'],
        })
      );

      const allProjectCategories = await Promise.all(projectCategoriesPromises);

      const flattenedCategories = allProjectCategories.flat();
      const categories = flattenedCategories.map((c) => ({
        id: c.id,
        name: c.name,
      }));
      setCategories(categories);

      const allPresets = await fetchAllPaginatedResults(
        client.models.TestPreset.testPresetsByOrganizationId,
        {
          organizationId: organizationId,
          selectionSet: ['id', 'name', 'accuracy'],
        }
      );

      const presetDetails = allPresets.map((p) => ({
        id: p.id,
        name: p.name,
        accuracy: p.accuracy,
      }));

      if (preset) {
        const activeCategories = await fetchAllPaginatedResults(
          client.models.TestPresetCategory.categoriesByTestPresetId,
          {
            testPresetId: preset!.id,
            selectionSet: ['categoryId'],
          }
        );

        const annoAccuracy = presetDetails.find(
          (p) => p.id === preset!.id
        )!.accuracy;

        ogDetails.current = {
          accuracy: annoAccuracy,
          categories: activeCategories.map((c) => c.categoryId),
        };

        setAnnotationAccuracy(annoAccuracy);
        const allCategories = categories.map((c) => ({
          label: c.name,
          value: c.id,
        }));
        setSelectedCategories(
          activeCategories.map((c) => ({
            label: allCategories.find((cat) => cat.value === c.categoryId)!
              .label,
            value: c.categoryId,
          }))
        );
      }
    }

    if (show) {
      getPresets();
    }
  }, [show]);

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>
          {isNewPreset ? 'Create Location Pool' : 'Edit Location Pool'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label>Pool name</Form.Label>
          <Form.Control
            type='text'
            placeholder='Enter pool name'
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </Form.Group>
        <Form.Group className='mt-2'>
          <Form.Label>Labels</Form.Label>
          <Select
            className='text-black'
            value={selectedCategories}
            options={categories?.map((q) => ({ label: q.name, value: q.id }))}
            isMulti
            onChange={setSelectedCategories}
            styles={{
              valueContainer: (base) => ({
                ...base,
                overflowY: 'auto',
              }),
            }}
          />
        </Form.Group>
        <Form.Group className='mt-2'>
          <Form.Label>Annotation Accuracy (%)</Form.Label>
          <Form.Control
            type='number'
            value={annotationAccuracy}
            onChange={(e) => setAnnotationAccuracy(e.target.value)}
            min={0}
            max={100}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer className='d-flex justify-content-end'>
        <span className='d-flex gap-2'>
          <Button
            variant='primary'
            onClick={() => {
              handleSubmit();
            }}
          >
            {isNewPreset ? 'Create' : 'Save'}
          </Button>
          <Button variant='dark' onClick={onClose}>
            Cancel
          </Button>
        </span>
      </Modal.Footer>
    </Modal>
  );
}
