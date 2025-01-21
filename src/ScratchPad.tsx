import { JobsRemaining } from './JobsRemaining';
import { TaskSelector } from "./TaskSelector";
// import { LivenessIndicator } from "./LivenessIndicator";
import useSQS from "./SqsSource";
import useTesting from './TestSource';
import { PreloaderFactory } from "./Preloader";
import { useMemo, useState, useContext, useEffect } from "react";
import { GlobalContext, UserContext, ProjectContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import TestOutcomeModal from './TestOutcomeModal';

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
    const { isTesting } = useContext(UserContext)!;

    const preloaders = [
      { id: 'test', component: TestPreloader, predicate: isTesting, priority: 1 },
      { id: 'sqs', component: SqsPreloader, predicate: true, priority: 2 },
    ];

    const visiblePreloaderId = preloaders
      .filter(preloader => preloader.predicate)
      .sort((a, b) => a.priority - b.priority)
      .map(preloader => preloader.id)[0]; 

    return (
      <div style={{ 
        display: 'flex', 
        marginTop: '1rem',
        flexDirection: 'column', 
        alignItems: 'center',
        width: '100%',
        gap: '1rem'
      }}>
        {preloaders.map((Preloader, index) => (
          <div 
            key={index} 
            style={{ display: Preloader.id === visiblePreloaderId ? 'block' : 'none', width: '100%' }}
          >
            <Preloader.component />
          </div>
        ))}
        <JobsRemaining />
      </div>
    );
  };
  return Scratch;
}

export default ScratchPad;

//todo: move to new files

function SqsPreloader() {
    const [index, setIndex] = useState(0);
    const { client} = useContext(GlobalContext)!;

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

    const { fetcher } = useSQS(filter);

    const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []); 

    return (
      <>
        {fetcher && 
          <Preloader 
            index={index} 
            setIndex={setIndex} 
            fetcher={fetcher}
            preloadN={3} 
            historyN={2} 
          />
        }
      </>
    )
}

type ConfigType = {
  userId: string;
  testType: string | null;
  randomVar: number | null;
  intervalVar: number | null;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function TestPreloader() {
  const [config, setConfig] = useState<ConfigType | undefined>(undefined);
  const [index, setIndex] = useState(0);

  const { modalToShow, showModal, client } = useContext(GlobalContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  //testing
  const { jobsCompleted, currentAnnoCount, setCurrentAnnoCount, unannotatedJobs, setUnannotatedJobs, isTesting, setIsTesting } = useContext(UserContext)!;

  const { fetcher } = useTesting();

  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

  useEffect(() => {
    async function setup() {
        const {data: [config]} = await client.models.UserTestConfig.testConfigByUserId({ userId: currentPM.userId });
        
        if (config && config.testType) {
            setConfig(config);
        }
    }
    
    setup();
}, []);

  useEffect(() => {
    if (isTesting) {
      if (currentAnnoCount > 0) {
        showModal('testPassedModal');
      } else {
        showModal('testFailedModal');
      }

      setIsTesting(false);
      setUnannotatedJobs(0);
      setCurrentAnnoCount(0);    

      return;
    }

    if(jobsCompleted > 0 && currentAnnoCount === 0) {
      setUnannotatedJobs(j => j + 1);
    } else {
      setUnannotatedJobs(0);
      setCurrentAnnoCount(0);
    }
  }, [jobsCompleted]);

  useEffect(() => {
    if (!config ||
      config.testType === 'none' || 
      config.testType === 'interval' && unannotatedJobs < config.intervalVar! || 
      config.testType === 'random' && Math.random() >= (config.randomVar! / 100) || 
      config.testType === 'random' && jobsCompleted <= 10) {
        setIsTesting(false);
        return;
    }

    alert('upcoming test');
    setIsTesting(true);
  }, [unannotatedJobs]);

  return (
    <>
    {fetcher &&
      <Preloader 
        index={index} 
        setIndex={setIndex} 
        fetcher={fetcher}
        preloadN={1} 
        historyN={0} 
      />
      }
      <TestOutcomeModal 
        show={
          modalToShow === 'testFailedModal' || 
          modalToShow === 'testPassedModal'
        } 
        onClose={() => {showModal(null)}} 
      />
    </>
  )
}
