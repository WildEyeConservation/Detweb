import React,{useState,useEffect } from 'react'
export const AnnotationsContext = React.createContext()

const Annotations = ({ children, annotationsHook }) => {
    const [counter, setCounter] = useState(0);

    /* I have had a significant amount of trouble with issues that manifest as a laggy interface when many annotations are present. This took a long time to resolve 
    but was ultimately traced to be due to needless rerenders being ttriggered on the MapContainer component every time the annotations changed. 

    Passing the annotations to components that need them (such as ShowMarkers) by using this context rather than prop-drilling turned out to be a big part of the 
    solution. However, there are many subtle ways to mess this up despite using the AnnotationsContext (you need to use useMemo in components like AnnotationImage 
    and registerPair). 
    
    A part of what made this problem difficult to trace was that it was difficult to reproduce and once you had reproduced it, the debugger would be basically 
    unresponsive.

    The following snippet causes a rerender (of any component that uses AnnotationsContext) every 100ms. It is helps me reproduce the problem quickly and easily 
    and thus helps me know when it is fixed.

    I believe that the problem is now fixed, but am still worried about possible regression, so I will comment the snippet but leave it in place in case I need it again.
    
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCounter((counter) => counter + 1), 100);
    return () => clearInterval(timer);
  }, []);*/


    // useEffect(() => {
    //     const timer = setInterval(() => setCounter((counter) => counter + 1), 1000);
    //     return () => clearInterval(timer);
    // }, []);
      

  return (
      <AnnotationsContext.Provider value={annotationsHook}>
        {children}      
    </AnnotationsContext.Provider>
  )
}

export default Annotations