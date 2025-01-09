import { JobsRemaining } from './JobsRemaining';
import { TaskSelector } from "./TaskSelector";
// import { LivenessIndicator } from "./LivenessIndicator";
import useSQS from "./SqsSource";
import { PreloaderFactory } from "./Preloader";
import { useMemo, useState, useContext } from "react";
import { GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));

interface Message {
  location: {
    id: string;
    annotationSetId: string;
  };
  allowOutside: boolean;
  zoom: string;
  taskTag: string;
  secondaryQueueUrl: string;
  message_id: string;
  skipLocationWithAnnotations: boolean;
}

export function ScratchPad() {
  const Scratch = function () {
    const [index, setIndex] = useState(0);
    const { client } = useContext(GlobalContext)!;

    const filter = async(message: Message) => {
      if (!message.skipLocationWithAnnotations) {
        return true;
      }
      
      const {data: location} = await client.models.Location.get({
        id: message.location.id,
      }, {
        selectionSet: ['x', 'y', 'width', 'height', 'imageId'] as const,
      });

      const annotations = await fetchAllPaginatedResults(client.models.Annotation.annotationsByImageIdAndSetId, {
        imageId: location.imageId,
        setId: { eq: message.location.annotationSetId },
        selectionSet: ['x', 'y'] as const,
      });

      // Using the x, y, width, height, check if any of the annotations fall within the location
      const isWithin = annotations.some(annotation => {
        const boundsxy: [number, number][] = [
          [location.x - location.width / 2, location.y - location.height / 2],
          [location.x + location.width / 2, location.y + location.height / 2],
        ];

        return (
          annotation.x >= boundsxy[0][0] && 
          annotation.y >= boundsxy[0][1] && 
          annotation.x <= boundsxy[1][0] && 
          annotation.y <= boundsxy[1][1]
        );
      });

      // return false if any annotation is within the location
      return !isWithin;
    }
    // const { fetcher } = useSQS(filter); Untested
    const { fetcher } = useSQS();

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
