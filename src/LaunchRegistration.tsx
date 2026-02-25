import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import { UserContext, GlobalContext } from './Context';
import { fetchAllPaginatedResults, makeTransform, array2Matrix } from './utils';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import ImageSetDropdown from './survey/ImageSetDropdown';
import * as math from 'mathjs';
import { inv } from 'mathjs';
import { useUpdateProgress } from './useUpdateProgress';
import { Schema } from './amplify/client-schema';

interface LaunchRegistrationProps {
  project: Schema['Project']['type'];
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<((url: string) => Promise<void>) | null>
  >;
  selectedSets: string[];
}

const LaunchRegistration: React.FC<LaunchRegistrationProps> = ({
  project,
  setHandleSubmit,
  selectedSets,
}) => {
  const { client } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [selectedImageSets, setSelectedImageSets] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<boolean>(false);
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Launch registration task`,
    indeterminateTaskName: `Finding images with annotations`,
    determinateTaskName: 'Enqueueing pairs',
    stepFormatter: (step: number) => `${step} images`,
  });

  async function findPath(
    image1: { id: string; timestamp: number },
    image2: { id: string; timestamp: number }
  ) {
    const homographies: number[][] = [];
    let currentId = image1.id;
    do {
      const { data: neighbour } =
        await client.models.ImageNeighbour.imageNeighboursByImage1key(
          { image1Id: currentId },
          { selectionSet: ['image2.id', 'image2.timestamp', 'homography'] }
        );
      homographies.push(neighbour[0].homography);
      if (neighbour[0].image2.id == image2.id) break;
      currentId = neighbour[0].image2.id;
    } while (true);

    // Convert homographies to mathjs matrices
    const matrices = homographies.map((h) => math.reshape(h, [3, 3]));

    // Multiply all matrices together
    const totalTransform = matrices.reduce((acc, matrix) =>
      math.multiply(acc, matrix)
    );

    return math.reshape(totalTransform, [9]);
    // Normalize the homography
    const normalizedTransform = normalizeHomography(totalTransform);

    // Convert the result back to a 2D array
    const finalHomography = normalizedTransform.toArray() as number[][];

    return finalHomography;
  }

  function normalizeHomography(homography: math.Matrix): math.Matrix {
    // Get the bottom-right element
    const scale = homography.get([8]);

    // If scale is zero or very close to zero, return the original matrix to avoid division by zero
    if (Math.abs(scale) < 1e-10) {
      console.warn(
        'Warning: Homography scale is very close to zero. Normalization skipped.'
      );
      return homography;
    }

    // Divide all elements by the scale
    return math.divide(homography, scale) as math.Matrix;
  }

  const handleSubmit = useCallback(
    async (url: string) => {
      if (!(selectedSets.length && url)) return;

      /* What we want to do is get a list of images that have annotations in them in the designated 
    annotationSets and then get all the imageneighbours entries for each image. we deduplicate this list 
    and push the imageNeighbourIds into the queue sorted by the timestamp of the first image in the pair.
    Pushing to the queue in sorted order is not strictly required, but it makes the registration process 
    a little easier if pairs are processed in order.*/
      if (!selectedType) {
        setTotalSteps(0);
        for (const annotationSetId of selectedSets) {
          const annotations: { image: { id: string; timestamp: number } }[] =
            await fetchAllPaginatedResults(
              client.models.Annotation.annotationsByAnnotationSetId,
              {
                setId: annotationSetId,
                selectionSet: ['image.id', 'image.timestamp', 'x', 'y'],
              },
              () => setStepsCompleted((x) => x + 1)
            );

          const images: Record<number, string> = annotations.reduce(
            (acc, annotation) => {
              const current = acc[annotation.image.timestamp];
              if (current) {
                current.annotations.push([annotation.x, annotation.y]);
              } else {
                acc[annotation.image.timestamp] = {
                  id: annotation.image.id,
                  annotations: [[annotation.x, annotation.y]],
                };
              }
              return acc;
            },
            {} as Record<number, { id: string; annotations: number[][] }>
          );
          setTotalSteps(Object.keys(images).length);
          setStepsCompleted(0);
          for (const timestamp of Object.keys(images)) {
            const image = images[timestamp];
            setStepsCompleted((x) => x + 1);
            const { data: prevneighbours } =
              await client.models.ImageNeighbour.imageNeighboursByImage2key(
                { image2Id: image.id },
                {
                  selectionSet: [
                    'image1Id',
                    'image1.timestamp',
                    'homography',
                    'image1.width',
                    'image1.height',
                  ],
                }
              );
            for (const neighbour of prevneighbours) {
              if (images[neighbour.image1.timestamp] || !neighbour.homography) {
                continue;
              } else {
                const transform = makeTransform(
                  inv(array2Matrix(neighbour.homography))
                );
                const tfAnnotations = image.annotations.map(transform);
                const tfAnnotationsInside = tfAnnotations.filter(
                  (annotation) =>
                    annotation[0] >= 0 &&
                    annotation[0] <= neighbour.image1.width &&
                    annotation[1] >= 0 &&
                    annotation[1] <= neighbour.image1.height
                );
                if (tfAnnotationsInside.length > 0) {
                  images[neighbour.image1.timestamp] = {
                    id: neighbour.image1Id,
                    annotations: [],
                  };
                }
              }
            }
            const { data: nextneighbours } =
              await client.models.ImageNeighbour.imageNeighboursByImage1key(
                { image1Id: image.id },
                {
                  selectionSet: [
                    'image2Id',
                    'image2.timestamp',
                    'homography',
                    'image2.width',
                    'image2.height',
                  ],
                }
              );
            for (const neighbour of nextneighbours) {
              if (images[neighbour.image2.timestamp] || !neighbour.homography) {
                continue;
              } else {
                const transform = makeTransform(
                  array2Matrix(neighbour.homography)
                );
                const tfAnnotations = image.annotations.map(transform);
                const tfAnnotationsInside = tfAnnotations.filter(
                  (annotation) =>
                    annotation[0] >= 0 &&
                    annotation[0] <= neighbour.image2.width &&
                    annotation[1] >= 0 &&
                    annotation[1] <= neighbour.image2.height
                );
                if (tfAnnotationsInside.length > 0) {
                  images[neighbour.image2.timestamp] = {
                    id: neighbour.image2Id,
                    annotations: [],
                  };
                }
              }
            }
          }
          const sortedTimestamps = Object.keys(images).sort();
          for (let i = 0; i < sortedTimestamps.length - 1; i++) {
            const image1 = images[sortedTimestamps[i]].id;
            const image2 = images[sortedTimestamps[i + 1]].id;
            const { data } = await client.models.ImageNeighbour.get(
              { image1Id: image1, image2Id: image2 },
              { selectionSet: ['homography'] }
            );
            if (data?.homography) {
              await getSqsClient().then((sqsClient) =>
                sqsClient.send(
                  new SendMessageCommand({
                    QueueUrl: url,
                    MessageGroupId: crypto.randomUUID(),
                    MessageDeduplicationId: crypto.randomUUID(),
                    MessageBody: JSON.stringify({
                      selectedSet: annotationSetId,
                      images: [image1, image2],
                    }),
                  })
                )
              );
            }
          }
        }
      } else {
        for (const imageSetId of selectedImageSets) {
          const images: {
            image: {
              id: string;
              timestamp: number;
              annotations: { setId: string }[];
            };
          }[] = [];
          //Paginate through the image set memberships
          let nextToken: string | undefined;
          do {
            const { data: imageBatch, nextToken: nextTokenBatch } =
              await client.models.ImageSetMembership.imageSetMembershipsByImageSetId(
                { imageSetId },
                {
                  selectionSet: [
                    'image.id',
                    'image.timestamp',
                    'image.annotations.setId',
                  ],
                  nextToken,
                }
              );
            //Filter out images that don't have annotations in the selected annotation sets
            images.push(...imageBatch);
            nextToken = nextTokenBatch;
          } while (nextToken);
          //Sort the images by timestamp
          images.sort((a, b) => a.image.timestamp - b.image.timestamp);
          // Iterate through the images in chronological order, keep a record of the previous image
          let previousImage:
            | {
                id: string;
                timestamp: number;
                annotations: { setId: string }[];
              }
            | undefined = undefined;
          for (const image of images) {
            //Check if the image or the previous image has any annotations in the selected annotation sets
            if (
              image.image.annotations?.some((annotation) =>
                selectedSets.includes(annotation.setId)
              ) ||
              (previousImage &&
                previousImage.image.annotations.some((annotation) =>
                  selectedSets.includes(annotation.setId)
                ))
            ) {
              const homography = await findPath(
                previousImage.image,
                image.image
              );
              const { data: imageNeighbour } =
                await client.models.ImageNeighbour.create({
                  image1Id: previousImage.image.id,
                  image2Id: image.image.id,
                  homography,
                  group: project.organizationId,
                });
              await getSqsClient().then((sqsClient) =>
                sqsClient.send(
                  new SendMessageCommand({
                    QueueUrl: url,
                    MessageBody: JSON.stringify({
                      selectedSet: selectedSets[0],
                      images: [previousImage.image.id, image.image.id],
                    }),
                  })
                )
              );
            }
            previousImage = image;
          }
          console.log(imageSetMemberships);
        }
      }
    },
    [selectedType, selectedImageSets, client]
  );

  useEffect(() => {
    setHandleSubmit(() => handleSubmit);
  }, [handleSubmit]);

  return (
    <div>
      <div className='mt-3 d-flex flex-column gap-2'>
        <Form.Group>
          <Form.Check
            type='switch'
            label='Filter by Image Sets'
            checked={selectedType}
            onChange={(e) => setSelectedType(e.target.checked)}
          />
          {selectedType && (
            <ImageSetDropdown
              imageSets={project.imageSets}
              selectedImageSets={selectedImageSets}
              setSelectedImageSets={setSelectedImageSets}
            />
          )}
        </Form.Group>
      </div>
    </div>
  );
};

export default LaunchRegistration;
