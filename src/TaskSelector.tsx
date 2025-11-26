import { useContext, useState, useEffect, useRef } from 'react';
import AnnotationImage from './AnnotationImage';
import { RegisterPair } from './RegisterPair';
import { GlobalContext, UserContext } from './Context';
import { array2Matrix, makeTransform } from './utils';
import { inv } from 'mathjs';

/* 
  In the current implementation, we can push both registration and annotation tasks to the same queue.
  The task of the TaskSelector component is to identify based on the props that were passed whether we
  are dealing with an annotation or registration task and instantiate the correct component to display the task
*/

interface TaskSelectorProps {
  width?: number;
  [key: string]: any;
}

export function TaskSelector(props: TaskSelectorProps) {
  const { client } = useContext(GlobalContext)!;
  const [element, setElement] = useState<JSX.Element | null>(null);
  const hasRevalidated = useRef(false);

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
    if (props.location) {
      if (props.location.id) {
        client.models.Location.get(
          { id: props.location.id },
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
          setElement(
            <AnnotationImage
              {...props}
              location={{
                ...data,
                annotationSetId: props.location.annotationSetId,
              }}
            />
          );
        });
      } else {
        setElement(<AnnotationImage {...props} />);
      }
    } else {
      client.models.ImageNeighbour.get(
        { image1Id: props.images[0], image2Id: props.images[1] },
        { selectionSet: ['homography', 'image1.*', 'image2.*'] }
      ).then(({ data: { homography, image1, image2 } }) => {
        const H = array2Matrix(homography);
        const transforms = H
          ? [makeTransform(H), makeTransform(inv(H))]
          : undefined;
        setElement(
          <RegisterPair
            {...props}
            transforms={transforms}
            images={[image1, image2]}
          />
        );
      });
    }
  }, [props]);

  // const { location, ...restProps } = props;
  // const annotationProps = {
  //   ...restProps,
  //   height: 100,
  //   x: 0,
  //   y: 0,
  //   image: { key: 'default.png', width: 100, height: 100 },
  //   width: width || 100,
  //   next: () => {},
  //   prev: () => {},
  //   fullImage: true,
  //   visible: true,
  //   id: 'defaultId',
  //   ack: () => {},
  //   setId: 'defaultSetId',
  //   locationId: '',
  //   annotationSetId: '',
  // };

  // const registerPairProps = {
  //   ...restProps,
  //   images: [],
  //   selectedSet: '',
  //   next: () => {},
  //   prev: () => {},
  //   visible: true,
  //   ack: () => {},
  // };

  return element;
}
