import { useContext, useState, useEffect, useRef } from "react";
import { UploadContext } from "../Context";

export default function UploadProgress() {
  const {
    task: { projectId, retryDelay },
    progress: { isComplete, error, processed, total },
  } = useContext(UploadContext)!;

  const startTimeRef = useRef<number | null>(null);
  const currentUploadIdRef = useRef<string | null>(null);

  const [averageSpeed, setAverageSpeed] = useState<number>(0); // items/sec
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<
    number | null
  >(null); // seconds

  useEffect(() => {
    if (projectId && !isComplete && !error) {
      if (
        currentUploadIdRef.current !== projectId ||
        startTimeRef.current === null
      ) {
        startTimeRef.current = Date.now();
        currentUploadIdRef.current = projectId;
        setAverageSpeed(0);
        setEstimatedTimeRemaining(total > 0 ? null : 0);
      }
    } else {
      startTimeRef.current = null;
      currentUploadIdRef.current = null;
      if (!isComplete) {
        setAverageSpeed(0);
      }
      setEstimatedTimeRemaining(isComplete ? 0 : null);
    }
  }, [projectId, isComplete, error, total]);

  useEffect(() => {
    if (
      startTimeRef.current &&
      projectId &&
      !isComplete &&
      !error &&
      total > 0
    ) {
      const elapsedMs = Date.now() - startTimeRef.current;

      if (processed > 0 && elapsedMs > 0) {
        const currentSpeed = processed / (elapsedMs / 1000);
        setAverageSpeed(currentSpeed);
        const remainingItems = total - processed;
        if (currentSpeed > 0) {
          setEstimatedTimeRemaining(remainingItems / currentSpeed);
        } else {
          setEstimatedTimeRemaining(remainingItems > 0 ? null : 0);
        }
      } else if (processed === 0) {
        setAverageSpeed(0);
        setEstimatedTimeRemaining(total > 0 ? null : 0);
      }
    } else if (isComplete) {
      setEstimatedTimeRemaining(0);
    } else if (error || !projectId) {
      setAverageSpeed(0);
      setEstimatedTimeRemaining(null);
    }
  }, [projectId, processed, total, isComplete, error]);

  useEffect(() => {
    if (
      estimatedTimeRemaining === null ||
      estimatedTimeRemaining <= 0 ||
      isComplete ||
      error ||
      (averageSpeed === 0 && processed < total)
    ) {
      if (isComplete && estimatedTimeRemaining !== 0) {
        setEstimatedTimeRemaining(0);
      } else if (
        (error || (averageSpeed === 0 && processed < total)) &&
        estimatedTimeRemaining !== null
      ) {
        setEstimatedTimeRemaining(null);
      }
      return;
    }

    const intervalId = setInterval(() => {
      setEstimatedTimeRemaining((prevEtr) => {
        if (prevEtr === null || prevEtr <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prevEtr - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [
    estimatedTimeRemaining,
    isComplete,
    error,
    averageSpeed,
    processed,
    total,
  ]);

  if (!projectId) return null;

  const percent = Math.round((processed / total) * 100) || 0;

  return (
    <div className="px-2">
      <div className="d-flex flex-row align-items-center gap-2">
        <div
          style={{
            width: 10,
            height: 10,
            backgroundColor: error ? "red" : retryDelay > 0 ? "yellow" : "lime",
            borderRadius: 5,
          }}
        />
        {error ? (
          <p className="m-0">Error</p>
        ) : !isComplete ? (
          <div className="d-flex flex-column">
            <p className="m-0">{`${processed}/${total} (${percent}%) images`}</p>
            {estimatedTimeRemaining && (
              <p className="m-0">{`${(estimatedTimeRemaining / 3600).toFixed(
                2
              )} hours remaining`}</p>
            )}
          </div>
        ) : (
          <p className="m-0">Finished</p>
        )}
      </div>
    </div>
  );
}
