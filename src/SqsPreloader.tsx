import { useContext, useState } from 'react';
import { GlobalContext } from './Context';
import { fetchAllPaginatedResults, isWithinLocationBounds } from './utils';
import useSQS from './useSQS';
import { Preloader } from './Preloader';
import { TaskSelector } from './TaskSelector';

interface Message {
  location: {
    id: string;
    annotationSetId: string;
  };
  allowOutside: boolean;
  zoom: string;
  queueId: string;
  taskTag: string;
  message_id: string;
  skipLocationWithAnnotations: boolean;
}

export default function SqsPreloader({
  visible = true,
}: {
  visible?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const { client } = useContext(GlobalContext)!;

  const filter = async (message: Message) => {
    if (!message.skipLocationWithAnnotations) {
      console.log(`Filter: skipLocationWithAnnotations=false for ${message.location.id}, passing`);
      return true;
    }

    const { data: location } = await client.models.Location.get(
      {
        id: message.location.id,
      },
      {
        selectionSet: ['x', 'y', 'width', 'height', 'imageId'] as const,
      }
    );

    if (!location) {
      console.log(`Filter: Location ${message.location.id} not found in database, rejecting`);
      return false;
    }

    const allAnnotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location.imageId,
        setId: { eq: message.location.annotationSetId },
        selectionSet: ['x', 'y', 'source'] as const,
        limit: 10000,
      }
    );

    // Only consider normal (non-FN) annotations for the skip check
    const annotations = allAnnotations.filter(
      (a: any) =>
        !a.source || !String(a.source).includes('false-negative')
    );

    // Using the x, y, width, height, check if any of the annotations fall within the location
    const annotationsWithin = annotations.filter((annotation) =>
      isWithinLocationBounds(annotation, location)
    );

    const isWithin = annotationsWithin.length > 0;

    if (isWithin) {
      console.log(
        `Filter: Rejecting location ${message.location.id} - found ${annotationsWithin.length} annotation(s) within bounds`,
        {
          location,
          imageId: location.imageId,
          annotationSetId: message.location.annotationSetId,
          totalAnnotationsOnImage: annotations.length,
          annotationsWithinBounds: annotationsWithin,
        }
      );
    } else {
      console.log(
        `Filter: Passing location ${message.location.id} - no annotations within bounds (${annotations.length} total on image)`
      );
    }

    // return false if any annotation is within the location
    return !isWithin;
  };

  const { fetcher } = useSQS(filter, true);

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
          renderTask={(task) => <TaskSelector {...task} />}
        />
      )}
    </>
  );
}
