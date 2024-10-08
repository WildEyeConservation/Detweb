import React, { useEffect, useState, useContext } from 'react';
import { ProgressBar, Toast } from 'react-bootstrap';
import { GlobalContext } from './Context';
import { receive } from './graphql/subscriptions';

interface TaskProgress {
  [taskName: string]: {
    total: number;
    completed: number;
  };
}

export function TaskProgressHandler() {
  const [taskProgress, setTaskProgress] = useState<TaskProgress>({});
  const [errors, setErrors] = useState([]);
  const { client } = useContext(GlobalContext)!;

  useEffect(() => {
    const subscription = client.graphql({
      query: receive,
      variables: { channelName: 'taskProgress/#' }
    }).subscribe({
      next: ({ value }: any) => {
        const { channelName, content } = value.data.receive;
        const data = JSON.parse(content);

        if (data.type === 'progress') {
          setTaskProgress(prev => ({
            ...prev,
            [data.taskName]: {
              total: data.total,
              completed: data.completed
            }
          }));
        } else if (data.type === 'completion') {
          setTaskProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[data.taskName];
            return newProgress;
          });
        } else if (data.type === 'error') {
          setErrors(prev => [...prev, { message: data.message, time: new Date() }]);
        }
      },
      error: (error) => console.error('Error in task progress subscription:', error),
    });

    return () => subscription.unsubscribe();
  }, [client]);

  return (
    <div>
      {Object.entries(taskProgress).map(([taskName, progress]) => (
        <div key={taskName}>
          <h5>{taskName}</h5>
          <ProgressBar 
            now={(progress.completed / progress.total) * 100} 
            label={`${progress.completed}/${progress.total}`} 
          />
        </div>
      ))}

      {/* Render error toasts */}
      {errors.map((error, index) => (
        <Toast key={index} onClose={() => setErrors(prev => prev.filter((_, i) => i !== index))} show={true} delay={5000} autohide>
          <Toast.Header>
            <strong className="mr-auto">Error</strong>
            <small>{error.time.toLocaleTimeString()}</small>
          </Toast.Header>
          <Toast.Body>{error.message}</Toast.Body>
        </Toast>
      ))}
    </div>
  );
}