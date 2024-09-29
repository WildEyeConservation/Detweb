import { withPreloading2 } from "./withPriorityQueue";
import { Row } from "react-bootstrap";
import { JobsRemaining } from './JobsRemaining';
import { TaskSelector } from "./TaskSelector";
import { LivenessIndicator } from "./LivenessIndicator";

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));

export function ScratchPad() {
  //let DetWebImage=withEditableDetections(withDetectionSubscription(withMetaData(withCreateDetections(withUpdateDetections(withAckLocation(BaseImage)))),client))
  //let DetWebImage=withEditableDetections(withMetaData(withCreateDetections(withUpdateDetections(withAckLocation(BaseImage)))))
  // let DetWebArray=withTestFailureHandler(withReload(withWorkSource(withPreloading2(DetWebImage),client)))
  //let DetWebArray=withTestFailureHandler(withReload(withSimpleWorkSource(withPreloading2(DetWebImage),client)))
  let TestImage = withPreloading2(TaskSelector);
  // let TestImage=withPreloading2(DebugComponent)
  let scratch = function () {
    return (
      <Row className="align-items-center h-100">
        <TestImage />
        <JobsRemaining/>
        <LivenessIndicator />
      </Row>
    );
    //return <DetWebArray width="512px" height="512px"/>;
  };
  return scratch;
}

export default ScratchPad;
