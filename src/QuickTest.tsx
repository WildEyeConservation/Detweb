import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useSQS from './SqsSource';
import { TaskSelector } from './TaskSelector';
import { PreloaderFactory } from './Preloader';

interface TestComponentProps {
  label: string;
  next: () => void;
  visible: boolean;
  setIsReady: (ready: boolean) => void;
}



const TestComponent: React.FC<TestComponentProps> = ({ label, next, prev, visible, setIsReady=()=>{} }) => {
  const [ready, setReady] = useState<boolean>(false);
  console.log('TestComponent render:', { label, visible });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      setReady(true);
    }, 2000);

    return () => {clearTimeout(timer); setIsReady(false);};
  }, []);

  return visible && ready &&<div><button onClick={prev}>{`Prev ${label}`}</button><button onClick={next}>{`Next ${label}`}</button></div>
};

class CounterSource {
  private counter: number = 0;
  fetcher : FetcherType = async () => {
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.counter += 1;
    console.log('ComponentSource next:', { counter: this.counter });
    return ({ id: this.counter.toString(), label: `${this.counter}` });
  }
}

interface PreloadingTaskContainerProps {
  fetcher: FetcherType;
  visible: boolean;
  isReady: (ready: boolean) => void;
  displayIndex: number;
  componentFactory: React.FC<any>;
}

const PreloadingTaskContainer: React.FC<PreloadingTaskContainerProps> = ({
  source,
  visible,
  isReady,
  displayIndex,
  componentFactory
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  let buffer = location.state?.buffer || [];
  const [readyList, setReadyList] = useState<Set<string>>(new Set<string>());
  const [counter, setCounter] = useState<number>(0);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  
  useEffect(() => {
    isReady(readyList.has(buffer[displayIndex]?.id));
  }, [readyList, buffer, displayIndex]);

  useEffect(() => {
    console.log('Buffer effect running:', { bufferLength: buffer.length, counter, waitingCount});
    setCounter(c=>c + 1);
    if (buffer.length < 3 && waitingCount === 0) {
      setWaitingCount(
        wc => wc + 1);  
      source.next().then((props) => {
          setWaitingCount(wc=>wc - 1);
          navigate(location.pathname, {
            replace: true,
            state: {
              buffer: [...buffer, props]
            }
          });
        });
    }
  }, [buffer.length, location.pathname, navigate, waitingCount]);

  return buffer.map((props:any, index:number) => {
      console.log({
        index,
        displayIndex,
        visible,
        hasId: readyList.has(props.id),
        compVisible:index === displayIndex && visible && readyList.has(props.id),
        props
      });
      return React.cloneElement(componentFactory(props), {
        visible: index === displayIndex && visible && readyList.has(props.id),
        next: () => {
          navigate(location.pathname, {
            replace: false,
            state: {
              buffer: buffer.slice(1)
            }
          })
        },
        setIsReady: (ready: boolean) => {
          if (ready) {
            setReadyList(readyList => new Set(readyList).add(props.id))
          } else {
            setReadyList(readyList => {
              const newSet = new Set(readyList);
              newSet.delete(props.id);
              return newSet;
            });
          }
        }
      });
  })
}




const source = new CounterSource();

// const QuickTest: React.FC = () => {
//   const Preloader= withPreloading2(TestComponent);
//   return <Preloader fetcher={source.fetcher} preloadN={5} historyN={2 }/>;
// };

const QuickTest: React.FC = () => {
  const {fetcher} = useSQS();
  const Preloader = React.useMemo(() => PreloaderFactory(TaskSelector), []);
  if (!fetcher) {
    return <></>;
  }
  return <Preloader fetcher={fetcher} preloadN={5} historyN={5}/>;
};

export default QuickTest;
