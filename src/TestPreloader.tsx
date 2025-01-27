import { useContext, useState, useMemo, useEffect } from 'react';
import { GlobalContext, ProjectContext, UserContext } from './Context';
import useTesting from './TestSource';
import { PreloaderFactory } from './Preloader';
import { TaskSelector } from './TaskSelector';
import TestOutcomeModal from './TestOutcomeModal';

type ConfigType = {
    userId: string;
    testType: string | null;
    random: number | null;
    deadzone: number | null;
    interval: number | null;
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  
  export default function TestPreloader({visible = true}: {visible: boolean}) {
    const [config, setConfig] = useState<ConfigType | undefined>(undefined);
    const [index, setIndex] = useState(1);
    const [maxJobsCompleted, setMaxJobsCompleted] = useState(0);
  
    const { modalToShow, showModal, client } = useContext(GlobalContext)!;
    const { currentPM } = useContext(ProjectContext)!;
    //testing
    const { jobsCompleted, setJobsCompleted, currentAnnoCount, setCurrentAnnoCount, unannotatedJobs, setUnannotatedJobs, isTesting, setIsTesting, isRegistering } = useContext(UserContext)!;
  
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
        setJobsCompleted(j => j - 1); //tests are not counted as jobs
        setUnannotatedJobs(0);
        setCurrentAnnoCount(0);    
  
        return;
      }
  
      // This only counts unannotated jobs when continuing to the next job from the 'newest' (maxJobsCompleted) job.
      // If a user went back to a previous job, and annotated it, it would have no effect on the unannotatedJobs count.
      if (jobsCompleted > maxJobsCompleted) {
        setMaxJobsCompleted(jobsCompleted);

        if (currentAnnoCount > 0) {
          setUnannotatedJobs(0);
        } else {
          setUnannotatedJobs(j => j + 1);
        }
      }

      setCurrentAnnoCount(0);
      
    }, [jobsCompleted]);
  
    useEffect(() => {
      if (isRegistering ||
        !fetcher ||
        !config ||
        config.testType === 'none' || 
        config.testType === 'interval' && unannotatedJobs < config.interval! || 
        config.testType === 'random' && Math.random() >= (config.random! / 100) || 
        config.testType === 'random' && jobsCompleted <= config.deadzone!) {
          setIsTesting(false);
          return;
      }
  
      setIsTesting(true);
    }, [unannotatedJobs]);
  
    return (
      <>
      {fetcher &&
        <Preloader 
          index={index} 
          setIndex={setIndex} 
          fetcher={fetcher}
          visible={visible}
          preloadN={2} 
          historyN={1} 
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