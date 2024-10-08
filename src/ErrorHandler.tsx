import { Toast } from 'react-bootstrap';
import { useState, useEffect, useContext } from 'react';
import { receive } from './graphql/subscriptions';
import { GlobalContext } from './Context';
interface ErrorMessage {
  id: string;
  topic: string;
  content: string;
  timestamp: number;
}

export function ErrorHandler() {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  const { client } = useContext(GlobalContext)!;

  useEffect(() => {
    const subscription = client.graphql({
      query: receive,
      variables: { channelName: 'debug/clientErrors' }
    }).subscribe({
      next: (response: any) => {
        console.log('Received subscription data:', response);
        const message = response?.data?.receive;
        if (message && message.channelName === 'debug/clientErrors') {
          setErrors(prev => [...prev, { 
            ...message, 
            id: Date.now().toString(),
            topic: message.channelName,
            content: message.content || 'Unknown error',
            timestamp: Date.now()
          }]);
        }
      },
      error: (error: Error) => console.error('Error in subscription:', error),
    });

    return () => subscription.unsubscribe();
  }, [client]);

  const removeError = (id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
      {errors.map(error => (
        <Toast key={error.id} onClose={() => removeError(error.id)} show={true} delay={5000} autohide>
          <Toast.Header>
            <strong className="mr-auto">Error</strong>
            <small>{new Date(error.timestamp).toLocaleTimeString()}</small>
          </Toast.Header>
          <Toast.Body>{error.content}</Toast.Body>
        </Toast>
      ))}
    </div>
  );
}

export function publishError(content: string) {
  const { client } = useContext(GlobalContext)!;
  client.graphql({
    query: `mutation Publish($channelName: String!, $content: String!) {
      publish(channelName: $channelName, content: $content) {
        channelName
        content
      }
    }`,
    variables: {
      channelName: 'debug/clientErrors',
      content: content
    }
  });
}
