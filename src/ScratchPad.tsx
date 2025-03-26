import { useState, useEffect, useMemo } from "react";
import { JobsRemaining } from "./JobsRemaining";
import SqsPreloader from "./SqsPreloader";
import TestPreloader from "./TestPreloader";
import { useContext } from "react";
import { UserContext } from "./Context";

//const image = { name: "rwa_gamecounting_2023-09-06_0955 2/008B.jpg"};

/* create a todo */
//await gqlClient.graphql(graphqlOperation(createImage, {input: image}));

export function ScratchPad() {
  const Scratch = function () {
    const { isTesting } = useContext(UserContext)!;
    const [currentPreloader, setCurrentPreloader] = useState<string | null>(
      null
    );

    const preloaders = useMemo(
      () => [
        {
          id: "test",
          component: <TestPreloader visible={currentPreloader === "test"} />,
          predicate: isTesting,
          priority: 1,
        },
        {
          id: "sqs",
          component: <SqsPreloader visible={currentPreloader === "sqs"} />,
          priority: 2,
        },
      ],
      [isTesting, currentPreloader]
    );

    // Ensures that the current preloader is hidden before the other is shown
    useEffect(() => {
      const newPreloaderId = preloaders
        .filter((preloader) =>
          preloader.predicate !== undefined ? preloader.predicate : true
        )
        .sort((a, b) => a.priority - b.priority)
        .map((preloader) => preloader.id)[0];

      if (newPreloaderId !== currentPreloader) {
        setCurrentPreloader(null);

        const timeout = setTimeout(() => {
          setCurrentPreloader(newPreloaderId);
        }, 50);

        return () => clearTimeout(timeout);
      }
    }, [currentPreloader, preloaders]);

    return (
      <div
        style={{
          display: "flex",
          marginTop: "1rem",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          gap: "4px",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "840px" }}>
          {preloaders.map((Preloader, index) => (
            <div
              key={index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                zIndex: currentPreloader === Preloader.id ? 20 : 10,
                opacity: currentPreloader === Preloader.id ? 1 : 0,
              }}
            >
              {Preloader.component}
            </div>
          ))}
        </div>
        <JobsRemaining />
      </div>
    );
  };
  return Scratch;
}

export default ScratchPad;
