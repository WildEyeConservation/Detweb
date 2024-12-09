import { JobsRemaining } from './JobsRemaining';
import { TaskSelector } from "./TaskSelector";
// import { LivenessIndicator } from "./LivenessIndicator";
import useSQS from "./SqsSource";
import { PreloaderFactory } from "./Preloader";
import { useMemo, useState } from "react";

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));

export function ScratchPad() {

  const Scratch = function () {
    const { fetcher } = useSQS();
    console.log(fetcher);
    const [index, setIndex] = useState(0);

    const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

    return (
      <div style={{ 
        display: 'flex', 
        marginTop: '1rem',
        flexDirection: 'column', 
        alignItems: 'center',
        width: '100%',
        gap: '1rem'  // Adds vertical spacing between components
      }}>
        {fetcher && <Preloader index={index} setIndex={setIndex} fetcher={fetcher} preloadN={3} historyN={2} />}
        <JobsRemaining />
      </div>
    );
  };
  return Scratch;
}

export default ScratchPad;
