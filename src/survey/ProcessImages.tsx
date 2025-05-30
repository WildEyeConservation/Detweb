import { Form } from "react-bootstrap";
import { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext, UserContext } from "../Context";
import Select from "react-select";
import { fetchAllPaginatedResults } from "../utils";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

export default function ProcessImages({
  projectId,
  onClose,
  setPreppingImages,
  setTotalPreppingImages,
  setHandleSubmit,
  setSubmitDisabled,
}: {
  projectId: string;
  onClose: () => void;
  setPreppingImages: (preppingImages: number) => void;
  setTotalPreppingImages: (totalPreppingImages: number) => void;
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
  setSubmitDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [model, setModel] = useState<{ label: string; value: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [unprocessedImages, setUnprocessedImages] = useState<
    {
      id: string;
      originalPath: string;
    }[]
  >([]);
  const [imagesLoaded, setImagesLoaded] = useState<number | null>(null);
  const [locationsLoaded, setLocationsLoaded] = useState<number | null>(null);

  useEffect(() => {
    async function scanImages() {
      setLoading(true);

      const images = await fetchAllPaginatedResults(
        client.models.Image.list,
        {
          selectionSet: ["id", "originalPath"],
          filter: {
            projectId: {
              eq: projectId,
            },
          },
        },
        setImagesLoaded
      );

      const locations = await fetchAllPaginatedResults(
        client.models.Location.list,
        {
          selectionSet: ["id", "imageId", "source"],
          filter: {
            projectId: {
              eq: projectId,
            },
          },
        },
        setLocationsLoaded
      );

      // Get all images that don't have a location with source "scoutbot"
      const unprocessedImages = images.filter((image) => {
        return !locations.some(
          (location) =>
            location.imageId === image.id &&
            location.source.includes("scoutbot")
        );
      });

      setUnprocessedImages(unprocessedImages);
      setLoading(false);
    }
    scanImages();
  }, [projectId]);

  const processImages = useCallback(async () => {
    if (!model) {
      return;
    }

    setLoading(true);

    const { data: locationSet } = await client.models.LocationSet.create({
      name: projectId + `_${model.value}`,
      projectId: projectId,
    });

    if (!locationSet) {
      console.error("Failed to create location set");
      alert("Something went wrong, please try again.");
      return;
    }

    await client.models.Project.update({
      id: projectId,
      status: "processing",
    });

    client.mutations.updateProjectMemberships({
      projectId: projectId,
    });

    onClose();

    let totalTasks = 0;

    switch (model.value) {
      case "scoutbot":
        const chunkSize = 4;
        for (let i = 0; i < unprocessedImages.length; i += chunkSize) {
          const chunk = unprocessedImages.slice(i, i + chunkSize);
          const sqsClient = await getSqsClient();
          await sqsClient.send(
            new SendMessageCommand({
              QueueUrl: backend.custom.scoutbotTaskQueueUrl,
              MessageBody: JSON.stringify({
                images: chunk.map((image) => ({
                  imageId: image.id,
                  key: "images/" + image.originalPath,
                })),
                projectId: projectId,
                bucket: backend.storage.buckets[1].bucket_name,
                setId: locationSet.id,
              }),
            })
          );
          totalTasks += chunkSize;
          setPreppingImages(totalTasks);
        }
        setTotalPreppingImages(totalTasks);
        break;
    }

    setLoading(false);
  }, [
    model,
    projectId,
    unprocessedImages,
    client,
    backend,
    getSqsClient,
    setPreppingImages,
    setTotalPreppingImages,
  ]);

  useEffect(() => {
    setHandleSubmit(() => processImages);
  }, [processImages, setHandleSubmit]);

  useEffect(() => {
    setSubmitDisabled(loading || !model || !unprocessedImages.length);
  }, [loading, model, unprocessedImages.length, setSubmitDisabled]);

  return (
    <Form>
      <Form.Group>
        {loading ? (
          <div>
            <p className="mb-0">Determining images to process...</p>
            <p className="mb-1">Found {imagesLoaded ?? 0} images</p>
            {locationsLoaded !== null && (
              <>
                <p className="mb-0">Searching for detections on images...</p>
                <p className="mb-0">Found {locationsLoaded} detections</p>
              </>
            )}
          </div>
        ) : unprocessedImages.length > 0 ? (
          <>
            <Form.Label className="mb-0">Model</Form.Label>
            <Select
              value={model}
              onChange={(m) => setModel(m)}
              options={[{ label: "ScoutBot", value: "scoutbot" }]}
              placeholder="Select a model"
              className="text-black"
            />
          </>
        ) : (
          <p className="mb-0 mt-2">All images have been processed</p>
        )}
      </Form.Group>
    </Form>
  );
}
