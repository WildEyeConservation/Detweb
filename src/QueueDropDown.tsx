import { Form } from "react-bootstrap";
import { useContext } from "react";
import { ManagementContext } from "./Context";
import React from "react";
interface QueueDropdownProps {
  setQueue: (url: string) => void;
  currentQueue: string | null;
}

export function QueueDropdown({ setQueue, currentQueue }: QueueDropdownProps) {
  const { queuesHook: { data: queues, create: createQueue } } = useContext(ManagementContext)!;
  console.log(`queue: ${JSON.stringify(queues)}`)
  

  const onNewQueue = async () => {
    const name = prompt("Please enter new queue name", "") || "";
    if (name) {
      const id = createQueue(name);
      if (id) {
        setQueue(id);
      }
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "new") {
      onNewQueue();
    } else {
      setQueue(e.target.value);
    }
  };

  return (
    <Form.Select value={currentQueue || "none"} onChange={onSelect}>
      {currentQueue ? null : <option value="none">Select a queue</option>}
      {queues?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
      <option value="new">Add new queue</option>
    </Form.Select>
  );
}
