import { Form } from 'react-bootstrap';
import { useContext } from 'react';
import { ManagementContext } from './Context';
import React from 'react';
interface QueueDropdownProps {
  setQueue: (url: string | null) => void;
  currentQueue: string | null;
  allowNoneOption?: boolean;
}

export function QueueDropdown({
  setQueue,
  currentQueue,
  allowNoneOption = false,
}: QueueDropdownProps) {
  const {
    queuesHook: { data: queues },
  } = useContext(ManagementContext)!;
  console.log(`queue: ${JSON.stringify(queues)}`);

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'none') {
      setQueue(null);
    } else {
      setQueue(e.target.value);
    }
  };

  return (
    <Form.Select value={currentQueue || 'none'} onChange={onSelect}>
      {currentQueue ? null : <option value='none'>Select a job</option>}
      {queues?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
      {allowNoneOption && <option value='none'>None</option>}
    </Form.Select>
  );
}
