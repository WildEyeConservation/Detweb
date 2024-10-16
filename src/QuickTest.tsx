import React from 'react';
import { TaskSelector } from './TaskSelector';
import { LivenessIndicator } from "./LivenessIndicator";
import { Row } from 'react-bootstrap';

const QuickTest: React.FC = () => {
    //const entry = {"selectedSet":"c83a7d13-20e3-464a-a133-0089f8e16b8f","images":["e8fcc019-3279-428f-8c74-2081d1a5e4bd","d38078de-e21c-44c5-aadc-f283ea4afd7a"],"message_id":"4e141b9d-bc7f-4561-b5ec-857be5bcb942"}
    const entry = {"selectedSet":"c83a7d13-20e3-464a-a133-0089f8e16b8f","images":["a29b7b64-6172-41da-a6e5-2fc2831415fd","0aa5a829-51bd-47d5-b8fd-2e3084174759"],"message_id":"37cdacec-c4ec-4a67-9613-1a6cd3bf795b"}
  return (
    <Row className="align-items-center h-100">
      <TaskSelector {...entry}/>
    <LivenessIndicator />
  </Row>

  );
};

export default QuickTest;
