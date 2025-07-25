import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext, GlobalContext } from "./Context";
import { useUpdateProgress } from "./useUpdateProgress";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { fetchAllPaginatedResults } from "./utils";
import LabeledToggleSwitch from "./LabeledToggleSwitch";
import Papa from "papaparse";
import { makeTransform, array2Matrix } from "./utils";
import { inv } from "mathjs";
import { MultiValue } from "react-select";
import { Schema } from "../amplify/data/resource";
const thresholdRange = {
  ivx: { min: 1, max: 10, step: 1 },
  scoutbot: { min: 0, max: 1, step: 0.01 },
  scoutbotV3: { min: 0, max: 1, step: 0.01 },
};

type Nullable<T> = T | null;

type TaskType = "tiled" | "model" | "annotation";

interface CreateTaskProps {
  imageSets: string[];
  taskType: TaskType;
  name: string;
  projectId: string;
  labels: Schema["Category"]["type"][];
  setHandleCreateTask?: React.Dispatch<
    React.SetStateAction<(() => Promise<string>) | null>
  >;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function CreateTask({
  imageSets,
  name,
  taskType,
  projectId,
  labels,
  setHandleCreateTask,
}: CreateTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [specifyTileDimensions, setSpecifyTileDimensions] =
    useState<boolean>(false);
  const [specifyBorderPercentage, setSpecifyBorderPercentage] =
    useState<boolean>(false);
  const [specifyBorders, setSpecifyBorders] = useState<boolean>(false);
  const [imageWidth, setImageWidth] = useState<number | undefined>(undefined);
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [specifyOverlapInPercentage, setSpecifyOverlapInPercentage] =
    useState<boolean>(false);
  const [minOverlap, setMinOverlap] = useState<number>(0);
  const [minSidelap, setMinSidelap] = useState<number>(0);
  const [minOverlapPercentage, setMinOverlapPercentage] = useState<number>(0);
  const [minSidelapPercentage, setMinSidelapPercentage] = useState<number>(0);
  const [allImages, setAllImages] = useState<
    {
      timestamp: Nullable<number>;
      width: number;
      height: number;
      id: string;
      originalPath: string;
    }[]
  >([]);
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);
  const [horizontalTiles, setHorizontalTiles] = useState<number>(3);
  const [verticalTiles, setVerticalTiles] = useState<number>(5);
  const [modelId, setModelId] = useState<string>("ivx");
  const [scoutbotFile, setScoutbotFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveImageWidth = maxX - minX;
  const effectiveImageHeight = maxY - minY;
  const [selectedCategories, setSelectedCategories] = useState<
    MultiValue<CategoryOption> | SingleValue<CategoryOption>
  >([]);

  const getImageId = useMemo(() => {
    const cache: { [path: string]: string } = {};

    return async function (path: string): Promise<string> {
      if (cache[path]) {
        return cache[path];
      }

      const { data } = await client.models.ImageFile.imagesByPath(
        { path },
        { selectionSet: ["imageId"] }
      );

      if (data && data.length > 0 && data[0].imageId) {
        const id = data[0].imageId;
        cache[path] = id;
        return id;
      }

      throw new Error(`No image found for path: ${path}`);
    };
  }, [client.models.ImageFile]);

  function calculateTileSizeAbsoluteOverlap(
    effectiveSize: number,
    tileCount: number,
    overlap: number
  ) {
    return Math.ceil((effectiveSize + (tileCount - 1) * overlap) / tileCount);
  }

  function calculateTileSizePercentageOverlap(
    effectiveSize: number,
    tileCount: number,
    overlap: number
  ) {
    return Math.ceil(
      effectiveSize / (tileCount - (overlap / 100) * (tileCount - 1))
    );
  }

  function calculateTileCountAbsoluteOverlap(
    effectiveSize: number,
    tileSize: number,
    overlap: number
  ) {
    return Math.ceil((effectiveSize - tileSize) / (tileSize - overlap)) + 1;
  }

  function calculateTileCountPercentageOverlap(
    effectiveSize: number,
    tileSize: number,
    overlap: number
  ) {
    return Math.ceil(
      (effectiveSize - tileSize) / (tileSize * (1 - overlap / 100)) + 1
    );
  }

  function getSidelapPixels() {
    return Math.floor(
      (horizontalTiles * width - effectiveImageWidth) / (horizontalTiles - 1)
    );
  }

  function getOverlapPixels() {
    return Math.floor(
      (verticalTiles * height - effectiveImageHeight) / (verticalTiles - 1)
    );
  }

  function getSidelapPercent() {
    return (getSidelapPixels() / width) * 100;
  }

  function getOverlapPercent() {
    return (getOverlapPixels() / height) * 100;
  }

  // Ensure that the minsidelap constraint is met
  useEffect(() => {
    if (!specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setWidth(
          calculateTileSizeAbsoluteOverlap(
            effectiveImageWidth,
            horizontalTiles,
            minSidelap
          )
        );
      } else {
        setHorizontalTiles(
          calculateTileCountAbsoluteOverlap(
            effectiveImageWidth,
            width,
            minSidelap
          )
        );
      }
      setMinSidelapPercentage((minSidelap / width) * 100);
    }
  }, [
    minSidelap,
    specifyTileDimensions,
    horizontalTiles,
    effectiveImageWidth,
    width,
  ]);

  //Ensure that the minoverlap constraint is met
  useEffect(() => {
    if (!specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setHeight(
          calculateTileSizeAbsoluteOverlap(
            effectiveImageHeight,
            verticalTiles,
            minOverlap
          )
        );
      } else {
        setVerticalTiles(
          calculateTileCountAbsoluteOverlap(
            effectiveImageHeight,
            height,
            minOverlap
          )
        );
      }
      setMinOverlapPercentage((minOverlap / height) * 100);
    }
  }, [
    minOverlap,
    specifyTileDimensions,
    verticalTiles,
    effectiveImageHeight,
    height,
  ]);

  //Ensure that the minsidelapPercentage constraint is met
  useEffect(() => {
    if (specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setWidth(
          calculateTileSizePercentageOverlap(
            effectiveImageWidth,
            horizontalTiles,
            minSidelapPercentage
          )
        );
      } else {
        setHorizontalTiles(
          calculateTileCountPercentageOverlap(
            effectiveImageWidth,
            width,
            minSidelapPercentage
          )
        );
      }
      setMinSidelap(Math.ceil((minSidelapPercentage * width) / 100));
    }
  }, [
    minSidelapPercentage,
    specifyTileDimensions,
    horizontalTiles,
    effectiveImageWidth,
    width,
  ]);

  //Ensure that the minoverlapPercentage constraint is met
  useEffect(() => {
    if (specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setHeight(
          calculateTileSizePercentageOverlap(
            effectiveImageHeight,
            verticalTiles,
            minOverlapPercentage
          )
        );
      } else {
        setVerticalTiles(
          calculateTileCountPercentageOverlap(
            effectiveImageHeight,
            height,
            minOverlapPercentage
          )
        );
      }
      setMinOverlap(Math.ceil((minOverlapPercentage * height) / 100));
    }
  }, [
    minOverlapPercentage,
    specifyTileDimensions,
    verticalTiles,
    effectiveImageHeight,
    height,
  ]);

  useEffect(() => {
    async function getAllImages() {
      let nextToken: string | undefined = undefined;
      let acc = {
        minWidth: Infinity,
        maxWidth: -Infinity,
        minHeight: Infinity,
        maxHeight: -Infinity,
      };
      setAllImages([]);
      for (const imageSetId of imageSets) {
        do {
          const { data: images, nextToken: nextNextToken } =
            await client.models.ImageSetMembership.imageSetMembershipsByImageSetId(
              {
                imageSetId,
              },
              {
                selectionSet: [
                  "image.width",
                  "image.height",
                  "image.id",
                  "image.timestamp",
                  "image.originalPath",
                ],
                nextToken,
              }
            );
          nextToken = nextNextToken ?? undefined;
          setAllImages((x) => x.concat(images.map(({ image }) => image)));
          acc = images.reduce((acc, x) => {
            acc.minWidth = Math.min(acc.minWidth, x.image.width);
            acc.maxWidth = Math.max(acc.maxWidth, x.image.width);
            acc.minHeight = Math.min(acc.minHeight, x.image.height);
            acc.maxHeight = Math.max(acc.maxHeight, x.image.height);
            return acc;
          }, acc);
          if (acc.minWidth != acc.maxWidth || acc.minHeight != acc.maxHeight) {
            console.log(`Inconsistent image sizes in image set ${imageSetId}`);
            setImageWidth(undefined);
            setImageHeight(undefined);
            setMaxX(undefined);
            setMaxY(undefined);
          } else {
            setImageWidth(acc.maxWidth);
            setImageHeight(acc.maxHeight);
            setMaxX(acc.maxWidth);
            setMaxY(acc.maxHeight);
          }
        } while (nextToken);
      }
    }

    if (imageSets && imageSets.length > 0) {
      getAllImages();
    }
  }, [imageSets, client.models.ImageSetMembership]);

  const [setImagesCompleted, setTotalImages] = useUpdateProgress({
    taskId: `Create task (model guided)`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Processing images",
    stepFormatter: (x: number) => `${x} images`,
  });

  const [threshold, setThreshold] = useState(5); // New state variable for threshold

  const handleSubmit = useCallback(
    async ({
      setLocationsCompleted,
      setTotalLocations,
    }: {
      setLocationsCompleted: (steps: number) => void;
      setTotalLocations: (steps: number) => void;
    }) => {
      const {
        data: { id: locationSetId },
      } = await client.models.LocationSet.create({
        name,
        projectId: projectId,
        locationCount:
          taskType !== "model"
            ? allImages.length * horizontalTiles * verticalTiles
            : 0,
      });

      switch (taskType) {
        case "model":
          if (modelId === "ivx") {
            allImages.map(async (image) => {
              const key = image.originalPath.replace("images", "heatmaps");
              const sqsClient = await getSqsClient();
              await sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: backend.custom.pointFinderTaskQueueUrl,
                  MessageBody: JSON.stringify({
                    imageId: image.id,
                    projectId: projectId,
                    key: "heatmaps/" + key + ".h5",
                    width: 1024,
                    height: 1024,
                    threshold: 1 - Math.pow(10, -threshold),
                    bucket: backend.storage.buckets[0].bucket_name,
                    setId: locationSetId,
                  }),
                })
              );
              setImagesCompleted((s: number) => s + 1);
            });
          }
          if (modelId === "scoutbotV3") {
            // Chunk allImages into groups of 4
            const chunkSize = 4;
            for (let i = 0; i < allImages.length; i += chunkSize) {
              const chunk = allImages.slice(i, i + chunkSize);

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
                    setId: locationSetId,
                  }),
                })
              );

              // Update progress for the entire chunk
              setImagesCompleted((s: number) => s + chunk.length);
            }
          }
          if (modelId === "scoutbot") {
            Papa.parse(scoutbotFile!, {
              complete: (result: {
                data: {
                  "Label Confidence": string;
                  "Image Filename": string;
                  "Box X": string;
                  "Box Y": string;
                  "Box W": string;
                  "Box H": string;
                }[];
              }) => {
                // Handle the parsed data here
                console.log("Parsed CSV data:", result.data);
                for (const row of result.data) {
                  if (Number(row["Label Confidence"]) > threshold) {
                    getImageId(row["Image Filename"])
                      .then(async (id) => {
                        await client.models.Location.create({
                          x:
                            Math.round(Number(row["Box X"])) +
                            Math.round(Number(row["Box W"]) / 2),
                          y:
                            Math.round(Number(row["Box Y"])) +
                            Math.round(Number(row["Box H"]) / 2),
                          width: Math.round(Number(row["Box W"])),
                          height: Math.round(Number(row["Box H"])),
                          confidence: 1,
                          imageId: id,
                          projectId: projectId,
                          source: "manual",
                          setId: locationSetId,
                        });
                      })
                      .then(() => setLocationsCompleted((fc: any) => fc + 1));
                  }
                }
              },
              header: true, // Assumes the first row of the CSV is headers
              skipEmptyLines: true,
              error: (error) => {
                console.error("Error parsing CSV:", error);
              },
            });
          }
          break;
        case "tiled":
          setTotalLocations(allImages.length * horizontalTiles * verticalTiles);
          const promises: Promise<void>[] = [];
          for (const { id } of allImages) {
            const xStepSize =
              (effectiveImageWidth - width) / (horizontalTiles - 1);
            const yStepSize =
              (effectiveImageHeight - height) / (verticalTiles - 1);
            for (var xStep = 0; xStep < horizontalTiles; xStep++) {
              for (var yStep = 0; yStep < verticalTiles; yStep++) {
                const x = Math.round(
                  xStep * (xStepSize ? xStepSize : 0) + minX + width / 2
                );
                const y = Math.round(
                  yStep * (yStepSize ? yStepSize : 0) + minY + height / 2
                );
                promises.push(
                  client.models.Location.create({
                    x,
                    y,
                    width,
                    height,
                    imageId: id,
                    projectId: projectId,
                    confidence: 1,
                    source: "manual",
                    setId: locationSetId,
                  }).then(() => setLocationsCompleted((fc: any) => fc + 1))
                );
              }
            }
          }
          await Promise.all(promises);
          break;
        case "annotation":
          const newLocations = [];
          //Iterate over the selected categories
          for (const category of selectedCategories) {
            //Get all annotations of the selected category
            const annotations = await fetchAllPaginatedResults(
              client.models.Annotation.annotationsByCategoryId,
              {
                categoryId: category.value,
              }
            );
            // Now we create a dictionary with the imageId as the key and a list of annotation coordinates as the value
            let imageAnnotations = {};
            for (const annotation of annotations) {
              imageAnnotations[annotation.imageId] =
                imageAnnotations[annotation.imageId] || [];
              imageAnnotations[annotation.imageId].push({
                x: annotation.x,
                y: annotation.y,
              });
            }
            // Now we iterate through the imageAnnotations dictionary
            for (const imageId in imageAnnotations) {
              const { data: image } = await client.models.Image.get({
                id: imageId,
              });
              // Now we find all images that have a defined homography between themselves and the current image
              const { data: nextNeighbors } =
                await client.models.ImageNeighbour.imageNeighboursByImage1key({
                  image1Id: imageId,
                });
              const { data: previousNeighbors } =
                await client.models.ImageNeighbour.imageNeighboursByImage2key({
                  image2Id: imageId,
                });
              const neighbors = [
                ...nextNeighbors
                  .filter((n) => n.homography)
                  .map((n) => ({
                    transform: makeTransform(array2Matrix(n.homography)),
                    imageId: n.image2Id,
                  })),
                ...previousNeighbors
                  .filter((n) => n.homography)
                  .map((n) => ({
                    transform: makeTransform(inv(array2Matrix(n.homography))),
                    imageId: n.image1Id,
                  })),
              ];
              //Iterate over the neighbors
              for (const neighbor of neighbors) {
                //Iterate over the annotations of the current image
                for (const annotation of imageAnnotations[imageId]) {
                  const transformedAnnotation = neighbor.transform([
                    annotation.x,
                    annotation.y,
                  ]);
                  //Check if the transformed annotation is inside the image bounds
                  if (
                    transformedAnnotation[0] >= 0 &&
                    transformedAnnotation[0] <= image.width &&
                    transformedAnnotation[1] >= 0 &&
                    transformedAnnotation[1] <= image.height
                  ) {
                    newLocations.push({
                      x: Math.round(transformedAnnotation[0]),
                      y: Math.round(transformedAnnotation[1]),
                      imageId: neighbor.imageId,
                      width: 100,
                      height: 100,
                      projectId: projectId,
                      confidence: 1,
                      source: "other annotation",
                      setId: locationSetId,
                    });
                  }
                }
              }
            }
          }
          await Promise.all(
            newLocations.map((l) => client.models.Location.create(l))
          );
          break;
      }

      return locationSetId;
    },
    [
      // There should be a beter way to do this, but while prototyping, here is an endless list of dependencies
      allImages,
      backend,
      client,
      effectiveImageHeight,
      effectiveImageWidth,
      getImageId,
      getSqsClient,
      height,
      horizontalTiles,
      minX,
      minY,
      modelId,
      name,
      projectId,
      scoutbotFile,
      selectedCategories,
      setImagesCompleted,
      taskType,
      threshold,
      verticalTiles,
      width,
    ]
  );

  useEffect(() => {
    if (setHandleCreateTask) {
      setHandleCreateTask(() => handleSubmit);
    }
  }, [setHandleCreateTask, handleSubmit]);

  switch (taskType) {
    case "tiled":
      return (
        <>
          <Form.Group className="d-flex flex-column gap-3 mt-2"></Form.Group>
          <div className="border border-dark shadow-sm p-2">
            <Form.Label className="text-center" style={{ fontSize: "smaller" }}>
              Detected image dimensions : {imageWidth}x{imageHeight}
            </Form.Label>
            <Form.Group className="mb-3 mt-3">
              <LabeledToggleSwitch
                leftLabel="Specify number of tiles"
                rightLabel="Specify tile dimensions"
                checked={specifyTileDimensions}
                onChange={(checked) => {
                  setSpecifyTileDimensions(checked);
                }}
              />

              <div className="row">
                <InputBox
                  label="Horizontal Tiles"
                  enabled={!specifyTileDimensions}
                  getter={() => horizontalTiles}
                  setter={(x) => setHorizontalTiles(x)}
                />
                <InputBox
                  label="Vertical Tiles"
                  enabled={!specifyTileDimensions}
                  getter={() => verticalTiles}
                  setter={(x) => setVerticalTiles(x)}
                />
                <InputBox
                  label="Width"
                  enabled={specifyTileDimensions}
                  getter={() => width}
                  setter={(x) => setWidth(x)}
                />
                <InputBox
                  label="Height"
                  enabled={specifyTileDimensions}
                  getter={() => height}
                  setter={(x) => setHeight(x)}
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3 mt-3">
              <LabeledToggleSwitch
                leftLabel="Specify overlap (px)"
                rightLabel="Specify overlap (%)"
                checked={specifyOverlapInPercentage}
                onChange={(checked) => {
                  setSpecifyOverlapInPercentage(checked);
                }}
              />
              <div className="row">
                <InputBox
                  label="Minimum sidelap (px)"
                  enabled={!specifyOverlapInPercentage}
                  getter={() => minSidelap}
                  setter={(x) => setMinSidelap(x)}
                />
                <InputBox
                  label="Minimum overlap (px)"
                  enabled={!specifyOverlapInPercentage}
                  getter={() => minOverlap}
                  setter={(x) => setMinOverlap(x)}
                />
                <InputBox
                  label="Minimum sidelap (%)"
                  enabled={specifyOverlapInPercentage}
                  getter={() => minSidelapPercentage}
                  setter={(x) => setMinSidelapPercentage(x)}
                />
                <InputBox
                  label="Minimum overlap (%)"
                  enabled={specifyOverlapInPercentage}
                  getter={() => minOverlapPercentage}
                  setter={(x) => setMinOverlapPercentage(x)}
                />
              </div>
              <div className="row">
                <InputBox
                  label="Actual sidelap (px)"
                  enabled={false}
                  getter={() => getSidelapPixels()}
                />
                <InputBox
                  label="Actual overlap (px)"
                  enabled={false}
                  getter={() => getOverlapPixels()}
                />
                <InputBox
                  label="Actual sidelap (%)"
                  enabled={false}
                  getter={() => getSidelapPercent().toFixed(2)}
                />
                <InputBox
                  label="Actual overlap (%)"
                  enabled={false}
                  getter={() => getOverlapPercent().toFixed(2)}
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3 mt-3">
              <LabeledToggleSwitch
                leftLabel="Process Entire Image"
                rightLabel="Specify Processing Borders"
                checked={specifyBorders}
                onChange={(checked) => {
                  setSpecifyBorders(checked);
                  setMinX(0);
                  setMaxX(imageWidth!);
                  setMinY(0);
                  setMaxY(imageHeight!);
                }}
              />
              {specifyBorders && (
                <>
                  <LabeledToggleSwitch
                    leftLabel="Specify Borders (px)"
                    rightLabel="Specify Borders (%)"
                    checked={specifyBorderPercentage}
                    onChange={(checked) => {
                      setSpecifyBorderPercentage(checked);
                    }}
                  />
                  <div className="row">
                    <InputBox
                      label="Minimum X (px)"
                      enabled={!specifyBorderPercentage}
                      getter={() => minX}
                      setter={(x) => setMinX(x)}
                    />
                    <InputBox
                      label="Minimum Y (px)"
                      enabled={!specifyBorderPercentage}
                      getter={() => minY}
                      setter={(x) => setMinY(x)}
                    />
                    <InputBox
                      label="Minimum X (%)"
                      enabled={specifyBorderPercentage}
                      getter={() => Math.round((minX / imageWidth!) * 100)}
                      setter={(x) =>
                        setMinX(Math.round((imageWidth! * x) / 100))
                      }
                    />
                    <InputBox
                      label="Minimum Y (%)"
                      enabled={specifyBorderPercentage}
                      getter={() => Math.round((minY / imageHeight!) * 100)}
                      setter={(x) =>
                        setMinY(Math.round((imageHeight! * x) / 100))
                      }
                    />
                  </div>
                  <div className="row">
                    <InputBox
                      label="Maximum X (px)"
                      enabled={!specifyBorderPercentage}
                      getter={() => maxX}
                      setter={(x) => setMaxX(x)}
                    />
                    <InputBox
                      label="Maximum Y (px)"
                      enabled={!specifyBorderPercentage}
                      getter={() => maxY}
                      setter={(x) => setMaxY(x)}
                    />
                    <InputBox
                      label="Maximum X (%)"
                      enabled={specifyBorderPercentage}
                      getter={() => Math.round((maxX / imageWidth!) * 100)}
                      setter={(x) =>
                        setMaxX(Math.round((imageWidth! * x) / 100))
                      }
                    />
                    <InputBox
                      label="Maximum Y (%)"
                      enabled={specifyBorderPercentage}
                      getter={() => Math.round((maxY / imageHeight!) * 100)}
                      setter={(x) =>
                        setMaxY(Math.round((imageHeight! * x) / 100))
                      }
                    />
                  </div>
                </>
              )}
            </Form.Group>
          </div>
        </>
      );
    case "model":
      return (
        <div className="border border-dark shadow-sm p-2">
          <Form.Group>
            <Form.Label>Model</Form.Label>
            <Form.Select
              aria-label="Select AI model to use to guide annotation"
              onChange={(e) => {
                setModelId(e.target.value);
                if (e.target.value !== "scoutbot") {
                  setScoutbotFile(null);
                }
              }}
              value={modelId}
            >
              <option>Select AI model to use to guide annotation</option>
              <option value="ivx">Elephant detection (nadir)</option>
              <option value="scoutbotV3">ScoutBot v3</option>
              <option value="scoutbot">ScoutBot export file</option>
            </Form.Select>
          </Form.Group>
          {modelId === "scoutbot" && (
            <Form.Group className="mt-3">
              <Form.Label>ScoutBot Input File</Form.Label>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="text"
                  readOnly
                  value={scoutbotFile ? scoutbotFile.name : ""}
                  placeholder="Select a ScoutBot export file"
                  onClick={() => fileInputRef.current?.click()}
                />
                <Button
                  variant="outline-primary"
                  onClick={() => fileInputRef.current?.click()}
                  className="ms-2"
                >
                  Browse
                </Button>
              </div>
              <Form.Control
                type="file"
                ref={fileInputRef}
                className="d-none"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScoutbotFile(file);
                  }
                }}
                accept=".csv"
              />
            </Form.Group>
          )}
        </div>
      );
    case "annotation":
      return (
        <div className="border border-dark shadow-sm p-2">
          <Form.Group>
            <Form.Label>Categories</Form.Label>
            <Form.Select
              onChange={(e) => {
                setSelectedCategories(e.target.value);
              }}
            >
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      );
  }
}

export default CreateTask;

function InputBox({
  label,
  enabled,
  getter,
  setter,
}: {
  label: string;
  enabled: boolean;
  getter: () => number;
  setter?: (x: number) => void;
}) {
  return (
    <div className="col-md-3">
      <Form.Group>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          type="number"
          value={getter()}
          onChange={({ target: { value } }) => {
            if (enabled && setter) {
              setter(Number(value));
            }
          }}
          disabled={!enabled}
        />
      </Form.Group>
    </div>
  );
}
