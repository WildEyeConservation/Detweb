import { Form } from "react-bootstrap";
import { useContext } from "react";
import { UserContext } from "./UserContext";
import { useQueues } from "./useGqlCached";
import React from "react";

interface QueueDropdownProps {
  setQueue: (url: string) => void;
  currentQueue: string | null;
}

export function QueueDropdown({ setQueue, currentQueue }: QueueDropdownProps) {
  const { currentProject } = useContext(UserContext)!;
  const { queues, createQueue } = useQueues(currentProject || "");

  console.log(`Queues: ${queues}`);

  const onNewQueue = async () => {
    const name = prompt("Please enter new queue name", "") || "";
    if (name) {
      const url = await createQueue(name);
      if (url) {
        setQueue(url);
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
        <option key={q.url} value={q.url}>
          {q.name}
        </option>
      ))}
      <option value="new">Add new queue</option>
    </Form.Select>
  );
}
