import React, { useEffect, useState, useCallback } from "react";

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

export default function useAckOnTimeout({ next, visible, ack }) {
  const [timer, setTimer] = useState(undefined);
  const [done, setDone] = useState(false);

  const onNext = useCallback(() => {
    console.log("timer set");
    setTimer(setTimeout(ack, 2000));
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
    //If there is currently a countdown timer running on the ack, but the item is visible again
    if (visible && timer && next) {
      console.log("timer cleared");
      clearTimeout(timer); //Cancel the timer
      setTimer(undefined);
    }
  }, [visible, timer, next]);

  useEffect(() => {
    //If the provided onNext has changed, new work may have been loaded to the queue. In this case we need to clear the done flag again
    if (next && done) {
      setDone(false);
      alert("New work has been loaded to the queue.");
    }
  }, [next, done]);

  return done ? undefined : onNext;
}

export function withAckOnTimeout(WrappedComponent) {
  let WithAckOnTimeout = function (props) {
    const { next, visible, ack } = props;
    const newNext = useAckOnTimeout({ next, visible, ack });
    return <WrappedComponent {...props} next={newNext} />;
  };
  return WithAckOnTimeout;
}
