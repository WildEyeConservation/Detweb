import { Form } from 'react-bootstrap';
import { useContext } from 'react';
import { ManagementContext } from './Context';
import React from 'react';
interface QueueDropdownProps {
  setQueue: (url: string | null) => void;
  currentQueue: string | null;
  allowNoneOption?: boolean;
  allowNewOption?: boolean;
}

export function QueueDropdown({
  setQueue,
  currentQueue,
  allowNoneOption = false,
  allowNewOption = true,
}: QueueDropdownProps) {
  const {
    queuesHook: { data: queues, create: createQueue },
  } = useContext(ManagementContext)!;
  console.log(`queue: ${JSON.stringify(queues)}`);

  const onNewQueue = async () => {
    const name = prompt('Please enter new queue name', '') || '';
    if (name) {
      const id = createQueue(name);
      if (id) {
        setQueue(id);
      }
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'new') {
      onNewQueue();
    } else if (e.target.value === 'none') {
      setQueue(null);
    } else {
      setQueue(e.target.value);
    }
  };

  return (
    <Form.Select value={currentQueue || 'none'} onChange={onSelect}>
      {currentQueue ? null : <option value="none">Select a job</option>}
      {queues?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
      {allowNoneOption && <option value="none">None</option>}
      {allowNewOption && <option value="new">Add new job</option>}
    </Form.Select>
  );
}
