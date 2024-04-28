import { useEffect, useState } from "react";

//This hook takes an ack function as input and makes a setHasBeenSeen function available. The component using it can call hasBeenSeen() at any point to arm the
//ack function. If after this point, the component is unloaded, the ack function will be called.

export default function useAckOnUnloadIfSeen(ack) {
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  useEffect(() => {
    if (hasBeenSeen) {
      return ack;
    }
  }, [hasBeenSeen, ack]);
  return setHasBeenSeen;
}
