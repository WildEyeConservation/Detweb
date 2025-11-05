import { useEffect, useContext } from 'react';
import { GlobalContext } from './Context';
import toast, { Toaster } from 'react-hot-toast';

function SubscriptionComponent() {
  const { client } = useContext(GlobalContext)!;
  useEffect(() => {
    const subscription = client.subscriptions.receive().subscribe({
      next: (message) => {
        // Show toast with message content
        toast(message.content, {
          duration: 10000,
          position: 'top-right',
        });
      },
      error: (error) => {
        console.error('Subscription error:', error);
      },
    });

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  return <Toaster />;
}

export default SubscriptionComponent;
