import React, { createContext, useState, ReactNode } from "react";

interface ProgressContextType {
  [key: string]: any;
}

interface ProgressProps {
  children: ReactNode;
}

export const ProgressContext = createContext<[ProgressContextType, React.Dispatch<React.SetStateAction<ProgressContextType>>] | undefined>(undefined);

export default function Progress({ children }: ProgressProps) {
  const [progress, setProgress] = useState<ProgressContextType>({});

  return (
    <ProgressContext.Provider value={[progress, setProgress]}>
      {children}
    </ProgressContext.Provider>
  );
}
