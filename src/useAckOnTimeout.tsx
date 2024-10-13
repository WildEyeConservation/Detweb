import React, { useEffect, useState, useCallback } from "react";
import { WithCreateObservationProps } from "./useCreateObservation"; // Import the interface
import { BaseImageProps } from "./BaseImage";

export interface UseAckOnTimeoutProps {
  next?: () => void;
  visible: boolean;
  ack: () => void;
}

/* This hook implements the following functionality:
- It will wait until the image has been paged past
- It will then start a configurable timeout and monitor the visibility of the component it is attached to 
  (the component is expected to be invisible at this point as it has been paged past)
- If the component becomes visible again before the timeout expires (typically because the user has paged back to it), the timer is canceled and we 
  wait to be paged past again
- If the timer expires, the ack function is called

Obviously, the hook needs access to an attribute indicating whether the component is visible and to a handle to the ack function (so it can call it).
We also need to hook into the onNext function, we do this by taking onNext as an input and yielding an instrumented version of onNext as output
*/

export default function useAckOnTimeout({ next, visible, ack }: UseAckOnTimeoutProps) {
  const [timer, setTimer] = useState<number | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [wasHidden, setWasHidden] = useState<boolean>(false);
  const [id,setId]=useState<string>(crypto.randomUUID());

  const onNext = useCallback(() => {
    console.log(`timer set for ${id}`);
    setWasHidden(false);
    setTimer(window.setTimeout(ack, 2000));
    if (next) {
      next();
    } else {
      alert(
        "You seem to have reached the end of the current Task queue. Thanks for your contribution. Please check back later to see if more work has been loaded. Alternatively you can close the notification, but leave the window open and you will get notified via another popup when new work has been loaded.",
      );
      setDone(true);
    }
  }, [next, ack]);

  useEffect(() => {
    // If the component was hidden but is now visible and there is a timer running, cancel the timer.
    // This is intended to cancel timers in the event where the user paged back to the item after initially paging past it.
    // However, just checking for visible && timer is vulnerable to race conditions (where we have paged past, and set the timer, but
    // the rest of the system hasn't updated the visibility state yet). So we need to check for a rising edge on visible, thus wasHidden && visible && timer && next.
    
    if (wasHidden && visible && timer && next) {
      // Read the number of milliseconds left on the timer
      console.log(`timer cleared for ${id}`);
      clearTimeout(timer); // Cancel the timer
      setTimer(undefined);
      setWasHidden(false);
    } else if (!wasHidden && !visible) { 
      setWasHidden(true);
      console.log(`wasHidden set for ${id}`);
    }
  }, [visible, timer, next, wasHidden]);

  useEffect(() => {
    // If the provided onNext has changed, new work may have been loaded to the queue. In this case we need to clear the done flag again
    if (next && done) {
      setDone(false);
      alert("New work has been loaded to the queue.");
    }
  }, [next, done]);

  return done ? undefined : onNext;
}

// interface WithAckOnTimeoutProps extends UseAckOnTimeoutProps {
//   [key: string]: any; // To allow any other props to be passed
// }
interface CombinedProps extends WithCreateObservationProps, UseAckOnTimeoutProps, BaseImageProps {}

export function withAckOnTimeout<T extends CombinedProps>(
  WrappedComponent: React.ComponentType<T>
) {
  const WithAckOnTimeout: React.FC<T> = (props) => {
    const { next, visible, location} = props;
    const {ack = () => {}} = location;
    const newNext = useAckOnTimeout({ next, visible, ack });
    return <WrappedComponent {...props} next={newNext} />;
  };
  return WithAckOnTimeout;
}

