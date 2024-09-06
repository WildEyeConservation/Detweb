import React, { useContext, useState, useEffect, Dispatch, SetStateAction } from "react";
import { DateTime } from "luxon";
import humanizeDuration from "humanize-duration";

interface UseUpdateProgressParams {
  taskId: string;
  indeterminateTaskName: string;
  determinateTaskName: string;
  stepName: string;
}

interface Progress {
  [key: string]: {
    value?: number;
    detail: JSX.Element;
  };
}

// Define the ProgressContext type
type ProgressContextType = [
  Progress,
  Dispatch<SetStateAction<Progress>>
];

export const ProgressContext = React.createContext<ProgressContextType>([{}, () => {}]);

export function useUpdateProgress({
  taskId,
  indeterminateTaskName,
  determinateTaskName,
  stepName,
}: UseUpdateProgressParams): [
  Dispatch<SetStateAction<number>>,
  Dispatch<SetStateAction<number>>
] {
  // Use context with type checking
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useUpdateProgress must be used within a ProgressProvider");
  }

  const [, setProgress] = context;
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Whenever the user adjusts totalSteps to a nonzero number, that means we are about to embark on a task with determinate progress.
  // We need to capture a timestamp when this process starts to enable calculation of ETA etc.
  useEffect(() => {
    if (totalSteps) {
      setStartTime(Date.now());
    }
  }, [totalSteps]);
  // Whenever the user adjusts stepsCompleted or totalSteps, we may need to adjust the output that goes to ProgressContext.
  // This effect handles that update
  useEffect(() => {
    if (totalSteps || stepsCompleted) {
      setProgress((progress: Progress) => {
        const newProgress = { ...progress };
        // React only does shallow comparisons. Therefore we need to treat the dict as immutable.
        // Make a copy so that react can pick up the change
        if (totalSteps) {
          const millis = startTime ? DateTime.now().toMillis() - startTime : 0;
          const remaining = (stepsCompleted > 0 ? (totalSteps * millis) / stepsCompleted : 0) - millis;

          newProgress[taskId] = {
            value: (stepsCompleted / totalSteps) * 100,
            detail: (
              <p>
                {determinateTaskName}
                <br />
                {`Done with ${stepsCompleted}/${totalSteps} ${stepName}`}
                <br />
                {`Elapsed time: ${humanizeDuration(millis, {
                  units: ["d", "h", "m", "s"],
                  round: true,
                  largest: 2,
                })}`}
                <br />
                {`Estimated remaining time: ${humanizeDuration(remaining, {
                  units: ["d", "h", "m", "s"],
                  round: true,
                  largest: 1,
                })}`}
                <br />
              </p>
            ),
          };
        } else {
          newProgress[taskId] = {
            detail: (
              <p>
                {indeterminateTaskName}
                <br />
                {`Loaded ${stepsCompleted} ${stepName} so far`}
              </p>
            ),
          };
        }
        // If the task has been completed we'll let the progress indicator hang around for 2 more seconds before removing it.
        if (stepsCompleted === totalSteps && totalSteps > 0) {
          setTimeout(() => {
            setProgress((progress) => {
              const updatedProgress = { ...progress };
              delete updatedProgress[taskId];
              return updatedProgress;
            });
          }, 2000);
        }

        return newProgress;
      });
    }
  }, [stepsCompleted, totalSteps, setProgress, taskId, determinateTaskName, indeterminateTaskName, stepName, startTime]);

  return [setStepsCompleted, setTotalSteps];
}

