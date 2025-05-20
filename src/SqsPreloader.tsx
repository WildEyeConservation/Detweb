import { useContext, useState, useMemo } from "react";
import { GlobalContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import useSQS from "./SqsSource";
import { PreloaderFactory } from "./Preloader";
import { TaskSelector } from "./TaskSelector";

interface Message {
  location: {
    id: string;
    annotationSetId: string;
  };
  allowOutside: boolean;
  zoom: string;
  taskTag: string;
  secondaryQueueUrl: string;
  message_id: string;
  skipLocationWithAnnotations: boolean;
}

export default function SqsPreloader({ visible = true }: { visible: boolean }) {
  const [index, setIndex] = useState(0);
  const { client } = useContext(GlobalContext)!;

  const filter = async (message: Message) => {
    if (!message.skipLocationWithAnnotations) {
      return true;
    }

    const { data: location } = await client.models.Location.get(
      {
        id: message.location.id,
      },
      {
        selectionSet: ["x", "y", "width", "height", "imageId"] as const,
      }
    );

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location.imageId,
        setId: { eq: message.location.annotationSetId },
        selectionSet: ["x", "y"] as const,
      }
    );

    // Using the x, y, width, height, check if any of the annotations fall within the location
    const isWithin = annotations.some((annotation) => {
      const boundsxy: [number, number][] = [
        [location.x - location.width / 2, location.y - location.height / 2],
        [location.x + location.width / 2, location.y + location.height / 2],
      ];

      return (
        annotation.x >= boundsxy[0][0] &&
        annotation.y >= boundsxy[0][1] &&
        annotation.x <= boundsxy[1][0] &&
        annotation.y <= boundsxy[1][1]
      );
    });

    // return false if any annotation is within the location
    return !isWithin;
  };

  const { fetcher } = useSQS(filter);

  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

  return (
    <>
      {fetcher && (
        <Preloader
          index={index}
          setIndex={setIndex}
          fetcher={fetcher}
          visible={visible}
          preloadN={3}
          historyN={2}
        />
      )}
    </>
  );
}
