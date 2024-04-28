import { ProgressContext } from "./ProgressContext";
import React, { useContext, useState, useEffect } from "react";
import { DateTime } from "luxon";
import humanizeDuration from "humanize-duration";

export function useUpdateProgress({
  taskId,
  indeterminateTaskName,
  determinateTaskName,
  stepName,
}) {
  const [, setProgress] = useContext(ProgressContext);
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [startTime, setStartTime] = useState(0);

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
      setProgress((progress) => {
        // React only does shallow comparisons. Therefore we need to treat the dict as immutable.
        // Make a copy so that react can pick up the change
        progress = { ...progress };
        if (totalSteps) {
          const millis = startTime ? DateTime.now() - startTime : 0;
          const remaining = (totalSteps * millis) / stepsCompleted - millis;
          progress[taskId] = {
            value: (stepsCompleted / totalSteps) * 100,
            detail: (
              <p>
                {determinateTaskName}
                <br />
                {`Done with ${stepsCompleted}/${totalSteps} ${stepName}`}
                <br />
                {`Elapsed time: ${humanizeDuration(millis, { units: ["d", "h", "m", "s"], round: true, largest: 2 })}`}
                <br />
                {`Estimated remaining time: ${humanizeDuration(remaining, { units: ["d", "h", "m", "s"], round: true, largest: 1 })}`}
                <br />
              </p>
            ),
          };
        } else {
          progress[taskId] = {
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
        if (stepsCompleted == totalSteps) {
          setTimeout(
            () =>
              setProgress((progress) => {
                progress = { ...progress };
                delete progress[taskId];
                return progress;
              }),
            2000,
          );
        }
        return progress;
      });
    }
  }, [stepsCompleted, totalSteps]);

  return [setStepsCompleted, setTotalSteps];
}
