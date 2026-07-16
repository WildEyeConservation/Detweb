import { useContext, useState, useEffect, useRef } from 'react';
import AnnotationImage from './AnnotationImage';
import { GlobalContext } from './Context';

/*
  Resolves a queue message into an annotation task: fetches the referenced
  Location (when the message carries one) and renders the AnnotationImage for
  it. (Registration tasks used to arrive on the same queues; that workflow has
  been superseded by individual-id/ChainLinker.)
*/

interface TaskSelectorProps {
  width?: number;
  [key: string]: any;
}

export function TaskSelector(props: TaskSelectorProps) {
  const { client } = useContext(GlobalContext)!;
  const [locationData, setLocationData] = useState<any>(null);
  const hasRevalidated = useRef(false);
  const locationId = props.location?.id;

  // Last-resort revalidation when this item becomes visible
  // This catches cases where annotations were added after the initial filter passed
  useEffect(() => {
    if (props.visible && props.revalidate && !hasRevalidated.current) {
      hasRevalidated.current = true;
      props.revalidate().then((isValid: boolean) => {
        if (!isValid) {
          console.log('Revalidation failed - skipping location with new annotations');
          props.ack?.();
          props.next?.();
        }
      });
    }
  }, [props.visible, props.revalidate, props.ack, props.next]);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    client.models.Location.get(
      { id: locationId },
      {
        selectionSet: [
          'id',
          'x',
          'y',
          'width',
          'height',
          'confidence',
          'image.id',
          'image.width',
          'image.height',
          'image.latitude',
          'image.longitude',
          'image.altitude_wgs84',
          'image.altitude_egm96',
          'image.altitude_agl',
        ],
      }
    ).then(({ data }) => {
      if (!cancelled) setLocationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [client, locationId]);

  if (!props.location) return null;
  if (!props.location.id) {
    return <AnnotationImage {...props} />;
  }
  return locationData ? (
    <AnnotationImage
      {...props}
      location={{
        ...locationData,
        annotationSetId: props.location.annotationSetId,
      }}
    />
  ) : null;
}
