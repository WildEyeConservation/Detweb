import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from './Context';

interface Identifiable {
    id: string;
    [key: string]: any;
  }
  
export type FetcherType = () => Promise<Identifiable>;

interface PreloaderProps {
    fetcher: FetcherType;
    historyN: number;
    preloadN: number;
    visible: boolean;
    prefetch: number;
    index: number;
    setIndex: (index: number | ((prevState: number) => number)) => void;
    [key: string]: any;
  }

export function PreloaderFactory(WrappedComponent: React.ComponentType<any>) {
    const PreloadingComponent = ({ historyN = 2, preloadN = 3, fetcher, visible = true, index, setIndex,prefetch = 0, ...rest  }: PreloaderProps) => {
      const [buffer, setBuffer] = useState<any[]>([]);
      const [waitingCount, setWaitingCount] = useState<number>(0);
      const { setJobsCompleted } = useContext(UserContext)!;

      useEffect(() => {
        console.log('Preloader mounted', { 
          bufferLength: buffer.length, 
          index, 
          waitingCount 
        });
        return () => console.log('Preloader unmounted');
      }, []);
  
      useEffect(() => {
        console.log(`index: ${index}, buffer.length: ${buffer.length}, waitingCount: ${waitingCount}`);
        if (index > buffer.length + Math.max(waitingCount, 0) - preloadN - 1 - prefetch) {
          console.log(`fetching ${index} of ${buffer.length + waitingCount}`);
          console.log('INCREMENT: waitingCount will become:', waitingCount + 1);
          setWaitingCount(wc => {
            console.log('INCREMENT actually happening with current wc:', wc);
            return wc + 1;
          });
          fetcher().then((props: any) => {
            console.log('DECREMENT: waitingCount will become:', waitingCount - 1);
            setWaitingCount(wc => {
              console.log('DECREMENT actually happening with current wc:', wc);
              return wc - 1;
            });
            if (props) {
              setBuffer(b => [...b, { ...props, id: crypto.randomUUID() }]);
            }
          });
          }
          return () => {
            console.log('useEffect cleanup code');
          };
      }, [buffer.length, index]);
  
      const subsetStart = Math.max(index - historyN, 0); // Keep at the least the last historyN entries in memory
      const subset = buffer.slice(subsetStart, index + preloadN);
      if (subset?.length) {
        return (
          <div style={{ 
            position: 'relative',  // Add this container
            width: '100%',
            minHeight: '820px'     // Adjust this value based on your needs
          }}>
            {subset.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  visibility: i === index - subsetStart ? "visible" : "hidden",
                  position: "absolute",
                  justifyContent: "center",
                  display: "flex",
                  width: "80%",
                  left: '50%',                    // Add these positioning properties
                  transform: 'translateX(-50%)',   // to maintain horizontal centering
                  top: 0
                }}
              >
                <WrappedComponent
                  {...rest}
                  {...entry}
                  setIsReady={()=>{}}
                  visible={i === index - subsetStart}
                  next={i<subset.length-1 ? ()=>{
                    setIndex(index=>index+1)
                    setJobsCompleted(x => x + 1);
                  } : undefined}
                  prev={i>0 ? ()=>{
                    setIndex(index=>index-1)
                    setJobsCompleted(x => x - 1);
                  } : undefined} 
                />
                <div></div>
              </div>
            ))}
          </div>
        );
      } else {
        return <></>;
      }
    };
  
    PreloadingComponent.displayName = `WithPreloading(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return PreloadingComponent;
  }
  