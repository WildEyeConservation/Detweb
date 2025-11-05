/* Debugging a weird state that my code gets into (possibly after a fixed delay) where everything seems to hang. I've used the debugger extensively and 
after switching off multiple things that happen on a fixed schedule (css animations, websocket keepalives, the Jobsremaining update, the change visibility callback etc)
I seem to have reached a point where I can hit pause in the debugger and the step out and the debugger waits a long time before reacting.

I take this as indication that the main thread has no more work todo and is simply sleeping until there is a task on the worrk queue. Further
proof of this is the fact that I break out of the wait immediately if I trigger an event (for example pointerover, by simply mousing over the page)

So at this point I have to assume that the rendering hang is not as a consequence of one or more long running tasks on the main thread.
To debug this further I am creating this component which creates a observable consequence every second, both in the console with a console log 
and on the screen by changing a message. This will hopefully confirm that the main loop is running to schedule just fine and tell me whether the
rendering hang is global or only confined to my leaflet maps.*/

import { useEffect, useState } from 'react';

export function LivenessIndicator() {
  const [time, setTime] = useState(0);
  const addTime = () => setTime((t) => t + 1);
  useEffect(() => {
    const interval = setInterval(addTime, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);
  //console.log(`Running for : ${time}s`);
  return <p style={{ textAlign: 'center' }}> {`Running for : ${time}s`}</p>;
}
