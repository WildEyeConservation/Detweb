import React, { createContext, useState } from "react";

export const ProgressContext = createContext([]);

export default function Progress({ children }) {
  const [progress, setProgress] = useState({});

  return (
    <ProgressContext.Provider value={[progress, setProgress]}>
      {children}
    </ProgressContext.Provider>
  );
}
