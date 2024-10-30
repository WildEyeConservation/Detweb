import { withPreloading2 } from "./withPriorityQueue";
import { Row } from "react-bootstrap";
import { JobsRemaining } from './JobsRemaining';
import { TaskSelector } from "./TaskSelector";
import { LivenessIndicator } from "./LivenessIndicator";

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));

export function ScratchPad() {
  let TestImage = withPreloading2(TaskSelector);
  
  let scratch = function () {
    return (
      <div style={{ 
        display: 'flex', 
        marginTop: '1rem',
        flexDirection: 'column', 
        alignItems: 'center',
        width: '100%',
        gap: '1rem'  // Adds vertical spacing between components
      }}>
        <TestImage />
        <JobsRemaining />
      </div>
    );
  };
  return scratch;
}

export default ScratchPad;
