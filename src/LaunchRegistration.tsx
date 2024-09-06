import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { UserContext } from "./UserContext";
import { QueueDropdown } from "./QueueDropDown";
import { useUpdateProgress } from "./useUpdateProgress";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import {
  getImage,
  imageNeighboursByImage1key,
  imageNeighboursByImage2key,
} from "./graphql/queries";

interface LaunchRegistrationProps {
  show: boolean;
  handleClose: () => void;
}


interface NeighbourData {
  id: string;
  image1key: string;
  image2key: string;
  homography: number[] | null;
}

const LaunchRegistration: React.FC<LaunchRegistrationProps> = ({ show, handleClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const { sendToQueue, gqlSend } = useContext(UserContext)!;
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Launch registration task`,
    indeterminateTaskName: `Finding images with annotations`,
    determinateTaskName: "Enqueueing pairs",
    stepName: "locations",
  });
  const pairsSubmitted = new Set<string>();

  const array2Matrix = (hc: number[] | null): number[][] | null => {
    if (hc) {
      const matrix = [];
      while (hc.length) matrix.push(hc.splice(0, 3));
      return matrix;
    } else {
      return null;
    }
  };

  const handlePair = async (neighbours: NeighbourData[]) => {
    for (const pair of neighbours) {
      if (!pairsSubmitted.has(pair.id)) {
        pairsSubmitted.add(pair.id);
        const homography = array2Matrix(pair.homography);
        // if (homography){
        //   const anno1=annos[pair.image1key]
        //   const anno2=annos[pair.image2key]
        //   console.log(anno1)
        // }
        if (homography) {
          await sendToQueue({
            QueueUrl: url,
            MessageGroupId: crypto.randomUUID(),
            MessageDeduplicationId: crypto.randomUUID(),
            MessageBody: JSON.stringify({
              key: pair.image1key + pair.image2key,
              selectedSet: annotationSet,
              images: await Promise.all(
                [pair.image1key, pair.image2key].map(
                  async (key) =>
                    await gqlSend(getImage, { key }).then(
                      (response) => (response as { data: { getImage: any } }).data.getImage,
                    ),
                ),
              ),
              homography: homography,
            }),
          });
        }
      }
    }
  };

  const handleSetAnnotationSet = (id: string) => setAnnotationSet(id);

  async function handleSubmit() {
    handleClose();
    const query = `query MyQuery($nextToken: String, $annotationSetId: ID!) {
      annotationsByAnnotationSetId(annotationSetId: $annotationSetId, nextToken: $nextToken) {
        items {
          obscured
          image {
            timestamp
            key
          }
        }
        nextToken
      }
    }`;

    interface AnnotationsResponse {
      data: {
        annotationsByAnnotationSetId: {
          items: {
            obscured: boolean;
            image: {
              timestamp: string;
              key: string;
            };
          }[];
          nextToken: string | null;
        };
      };
    }

    let nextToken: string | null = null;
    const images: Record<string, string> = {};
    do {
      const response = await gqlSend(query, { nextToken, annotationSetId: annotationSet }) as AnnotationsResponse;
      const { items: annotations, nextToken: newNextToken } = response.data.annotationsByAnnotationSetId;
      nextToken = newNextToken;
      setStepsCompleted((i: any) => i + annotations.length);
      for (const { obscured, image: { key, timestamp } } of annotations) {
        if (!obscured) {
          images[timestamp] = key;
        }
      }
    } while (nextToken);
    setStepsCompleted(0);
    setTotalSteps(Object.keys(images).length);

    const sortedTimestamps = Object.keys(images).sort();
    //const annos = {};
    // for (const timestamp of sortedTimestamps){
    //   nextToken=null
    //   do{
    //     const data=await gqlSend(annotationsByImageKey,{imageKey:images[timestamp],nextToken})
    //     annos[images[timestamp]]=data.data.annotationsByImageKey.items
    //   }while (nextToken)
    //   setStepsCompleted(i=>i+1)
    // }
    setTotalSteps(Object.keys(images).length);
    setStepsCompleted(0);
    for (const timestamp of sortedTimestamps) {
      const {
        data: {
          imageNeighboursByImage2key: { items: neighbours1 },
        },
      } = await gqlSend(imageNeighboursByImage2key, {
        image2key: images[timestamp],
      }) as { data: { imageNeighboursByImage2key: { items: NeighbourData[] } } };
      await handlePair(neighbours1);
      const {
        data: {
          imageNeighboursByImage1key: { items: neighbours2 },
        },
      } = await gqlSend(imageNeighboursByImage1key, {
        image1key: images[timestamp],
      }) as { data: { imageNeighboursByImage1key: { items: NeighbourData[] } } };
      await handlePair(neighbours2);
      setStepsCompleted((x: number) => x + 1);
    }

    // const tempBuffer= await Promise.all(Object.keys(pairs)?.map(
    //   async id=>{
    //     const pair=pairs[id];
    //     const homography=array2Matrix(pair.homography)
    //     return {key        : pair.image1key+pair.image2key,
    //             images     : await Promise.all([pair.image1key,pair.image2key].map(async key=>await gqlSend(getImage,{key}).then(({data:{getImage:image}})=>image))),
    //             transforms : [transform(homography),transform(inv(homography))]
    //             }}))
    //   tempBuffer.sort((a,b)=>a.key>b.key ? 1 : -1)
    // setBuffer(tempBuffer)
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Launch Registration Task</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                setAnnotationSet={handleSetAnnotationSet}
                selectedSet={annotationSet}
                canCreate={false}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Target Queue</Form.Label>
              <QueueDropdown setQueue={setUrl} currentQueue={url} />
            </Form.Group>
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!annotationSet || !url}
        >
          Submit
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LaunchRegistration;
