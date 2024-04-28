import { Form } from "react-bootstrap";
import { useContext } from "react";
import { UserContext } from "./UserContext";
import { useQueues } from "./useGqlCached";
import React from "react";

export function QueueDropdown({ setQueue, currentQueue }) {
  const { currentProject } = useContext(UserContext);
  const { queues, createQueue } = useQueues(currentProject);
  console.log(`Queues: ${queues}`);

  const onNewQueue = async () => {
    const name = prompt("Please enter new queue name", "");
    if (name) {
      const url = await createQueue(name);
      setQueue(url);
    }
  };

  const onSelect = (e) => {
    if (e.target.value == "new") {
      onNewQueue();
    } else {
      setQueue(e.target.value);
    }
  };

  return (
    <Form.Select value={currentQueue || "none"} onChange={onSelect}>
      {currentQueue ? "" : <option value="none">Select a queue</option>}
      {queues?.map((q) => (
        <option key={q.url} value={q.url}>
          {q.name}
        </option>
      ))}
      <option value="new">Add new queue</option>
    </Form.Select>
  );
}
