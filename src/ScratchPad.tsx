import { JobsRemaining } from './JobsRemaining';
import SqsPreloader from './SqsPreloader';
import TestPreloader from './TestPreloader';
import { useContext } from 'react';
import { UserContext } from './Context';

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));


export function ScratchPad() {
  const Scratch = function () {
    const { isTesting } = useContext(UserContext)!;

    const preloaders = [
      { 
        id: 'test', 
        component: <TestPreloader visible={isTesting}/>, 
        predicate: isTesting, 
        priority: 1 
      },
      { 
        id: 'sqs', 
        component: <SqsPreloader visible={!isTesting} />, 
        predicate: true, 
        priority: 2 
      },
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
        gap: '4px'
      }}>
        <div style={{position: 'relative', width: '100%', height: '840px'}}>
          {preloaders.map((Preloader, index) => (
            <div 
              key={index} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: Preloader.id === visiblePreloaderId ? 20 : 10 }}
            >
              {Preloader.component}
            </div>
          ))}
        </div>
        <JobsRemaining />
      </div>
    );
  };
  return Scratch;
}

export default ScratchPad;