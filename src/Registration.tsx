import { useState, useMemo, useContext, useCallback, useEffect } from "react";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import Select from "react-select";
import { ProjectContext } from "./Context";
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import { Schema } from "../amplify/data/resource";
import { useQueries } from "@tanstack/react-query";
import { makeTransform, array2Matrix } from "./utils";
import { inv } from "mathjs";
import { GlobalContext, ManagementContext } from "./Context";
import { RegisterPair } from "./RegisterPair";
import { Card, Button, Form } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { PanelBottom } from "lucide-react";

export function Registration({ showAnnotationSetDropdown = true }) {
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const { annotationSetId } = useParams();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>("");
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;
  const [activePair, setActivePair] = useState<{
    primary: string;
    secondary: string;
    annotations: Schema["Annotation"]["type"][];
  } | null>(null);
  const [numLoaded, setNumLoaded] = useState(0);
  const [showFilters, setShowFilters] = useState(true);
  const subscriptionFilter = useMemo(
    () => ({ filter: { setId: { eq: selectedAnnotationSet } } }),
    [selectedAnnotationSet]
  );
  // annotations contains an array of annotations in the selected annotation set, that is kept updated.
  const annotationHook = useOptimisticUpdates<
    Schema["Annotation"]["type"],
    "Annotation"
  >(
    "Annotation",
    async (nextToken) =>
      client.models.Annotation.annotationsByAnnotationSetId(
        { setId: selectedAnnotationSet },
        { nextToken }
      ),
    subscriptionFilter,
    setNumLoaded
  );

  const annotations = annotationHook.data;

  // selectedCategoryIDs contains the ids of the selected categories.
  const selectedCategoryIDs = useMemo(
    () => selectedCategories.map((c) => c.value),
    [selectedCategories]
  );

  // annotationsByImage contains a map of image ids to their annotations.
  const annotationsByImage = useMemo(() => {
    return annotations
      ?.filter((a) => selectedCategoryIDs.includes(a.categoryId))
      .reduce((acc, a) => {
        const acc2 = acc[a.imageId] || [];
        acc[a.imageId] = [...acc2, a];
        return acc;
      }, {} as Record<string, Annotation[]>);
  }, [annotations, selectedCategories]);

  // imageNeighboursQueries contains a list of queries that fetch the neighbours of each image represented in annotationsByImage.
  const imageNeighboursQueries = useQueries({
    queries: Object.keys(annotationsByImage || {}).map((imageId) => ({
      queryKey: ["imageNeighbours", imageId],
      queryFn: async () => {
        const { data: n1 } =
          await client.models.ImageNeighbour.imageNeighboursByImage1key({
            image1Id: imageId,
          });
        const { data: n2 } =
          await client.models.ImageNeighbour.imageNeighboursByImage2key({
            image2Id: imageId,
          });
        return [...n1, ...n2];
      },
      staleTime: Infinity, // Data will never become stale automatically
      cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })),
  });

  // imageNeighbours contains a two level map to easily find the transform from imageA to imageB
  // tf = imageNeighbours[imageA][imageB].tf
  // It contains each transform (and its inverse) represented in imageNeighboursQueries.
  const imageNeighbours = useMemo(() => {
    return imageNeighboursQueries
      .filter((query) => query.isSuccess)
      .reduce((acc, query) => {
        const neighbours = query.data;
        neighbours
          .filter((n) => n?.homography?.length)
          .forEach((n) => {
            const acc2 = acc[n.image1Id] || {};
            const M = array2Matrix(n.homography);
            acc[n.image1Id] = {
              ...acc2,
              [n.image2Id]: { tf: makeTransform(M) },
            };
            const acc3 = acc[n.image2Id] || {};
            acc[n.image2Id] = {
              ...acc3,
              [n.image1Id]: { tf: makeTransform(inv(M)) },
            };
          });
        return acc;
      }, {} as Record<string, Record<string, { tf: Transform }>>);
  }, [imageNeighboursQueries]);

  // imageMetaDataQueries contains a list of queries that fetch the metadata of each relevant image (contains annotations or has overlap with an image that has annotations).
  const imageMetaDataQueries = useQueries({
    queries: Object.keys(imageNeighbours || {})?.map((imageId) => ({
      queryKey: ["imageMetaData", imageId],
      queryFn: () => {
        return client.models.Image.get({ id: imageId });
      },
      staleTime: Infinity, // Data will never become stale automatically
      cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })),
  });

  // imageMetaData contains a map of image ids to their metadata.
  const imageMetaData = useMemo(() => {
    // First check if all queries are successfull
    if (imageMetaDataQueries.some((query) => !query.isSuccess)) {
      return {};
    }
    return imageMetaDataQueries
      .filter((query) => query.isSuccess)
      .reduce((acc, { data: { data } }) => {
        acc[data.id] = data;
        return acc;
      }, {} as Record<string, Image>);
  }, [imageMetaDataQueries]);

  // targetData contains a list of images sorted by timestamp, and for each image, a list of its neighbours sorted by timestamp.
  const targetData = useMemo(() => {
    return Object.keys(annotationsByImage || {})
      ?.sort((a, b) => {
        const aImage = imageMetaData[a];
        const bImage = imageMetaData[b];
        return (aImage?.timestamp ?? 0) - (bImage?.timestamp ?? 0);
      })
      ?.map((i) => {
        const neighbours = Object.keys(imageNeighbours?.[i] || {})?.sort(
          (a, b) => {
            const aImage = imageMetaData[a];
            const bImage = imageMetaData[b];
            return (aImage?.timestamp ?? 0) - (bImage?.timestamp ?? 0);
          }
        );
        return {
          id: i,
          neighbours: neighbours.map((n) => ({
            id: n,
          })),
        };
      });
  }, [imageMetaData, imageNeighbours, annotations]);

  const pairToRegister = useMemo(() => {
    for (const t of targetData) {
      const annotationsPrimary = annotationsByImage[t.id];
      for (const n of t.neighbours) {
        const tf = imageNeighbours[t.id][n.id].tf;
        const annotationsSecondary = annotationsByImage[n.id]?.map(
          (a) => a.objectId
        );
        const width = imageMetaData[n.id]?.width;
        const height = imageMetaData[n.id]?.height;
        const annotationsToLink = annotationsPrimary
          // Only keep annotations that are not allready matched to some object in the secondary image
          ?.filter((a) =>
            a.objectId ? !annotationsSecondary?.includes(a.objectId) : true
          )
          // And that map to some point inside the secondary image
          ?.filter((a) => {
            const transformed = tf([a.x, a.y]);
            return (
              transformed[0] >= 0 &&
              transformed[1] >= 0 &&
              transformed[0] < width &&
              transformed[1] < height
            );
          });
        if (annotationsToLink.length > 0) {
          return {
            primary: t.id,
            secondary: n.id,
            annotations: annotationsToLink,
          };
        }
      }
    }
  }, [targetData, annotationsByImage, imageNeighbours, imageMetaData]);

  const nextPair = useCallback(() => {
    setActivePair(pairToRegister ?? null);
  }, [pairToRegister]);

  useEffect(() => {
    if (!activePair && pairToRegister) {
      setActivePair(pairToRegister);
    }
  }, [activePair, pairToRegister]);
  // Clear activePair when no items left to register
  useEffect(() => {
    if (!pairToRegister) {
      setActivePair(null);
    }
  }, [pairToRegister]);

  // Move to next pair when current pair is no longer valid
  useEffect(() => {
    if (
      activePair &&
      pairToRegister &&
      (activePair.primary !== pairToRegister.primary ||
        activePair.secondary !== pairToRegister.secondary)
    ) {
      nextPair();
    }
  }, [activePair, pairToRegister, nextPair]);

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1555px",
        paddingTop: "16px",
        paddingBottom: "16px",
        height: "100%",
      }}
    >
      <div className="w-100 h-100 d-flex flex-column flex-md-row gap-3">
        <div
          className="d-flex flex-column gap-3 w-100"
          style={{ maxWidth: "300px" }}
        >
          <Card className="d-sm-block d-none w-100">
            <Card.Header>
              <Card.Title className="mb-0">Information</Card.Title>
            </Card.Header>
            <Card.Body className="d-flex flex-column gap-2">
              <InfoTag label="Survey" value={project.name} />
              <InfoTag
                label="Annotation Set"
                value={
                  annotationSets?.find(
                    (set) => set.id === selectedAnnotationSet
                  )?.name ?? "Unknown"
                }
              />
            </Card.Body>
          </Card>
          <Card className="w-100 flex-grow-1">
            <Card.Header>
              <Card.Title className="mb-0 d-flex align-items-center">
                <Button
                  className="p-0 mb-0"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <PanelBottom
                    className="d-sm-none"
                    style={{
                      transform: showFilters
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </Button>
                Filters
              </Card.Title>
            </Card.Header>
            {showFilters && (
              <Card.Body className="d-flex flex-column gap-2">
                <div className="w-100">
                  <Form.Label>Labels</Form.Label>
                  <Select
                    value={selectedCategories}
                    onChange={setSelectedCategories}
                    isMulti
                    name="Labels to register"
                    options={categories
                      ?.filter(
                        (c) => c.annotationSetId === selectedAnnotationSet
                      )
                      .map((q) => ({
                        label: q.name,
                        value: q.id,
                      }))}
                    className="text-black w-100"
                    closeMenuOnSelect={false}
                  />
                </div>

                {showAnnotationSetDropdown && (
                  <AnnotationSetDropdown
                    selectedSet={selectedAnnotationSet}
                    setAnnotationSet={setSelectedAnnotationSet}
                    canCreate={false}
                  />
                )}
              </Card.Body>
            )}
          </Card>
        </div>
        <div className="d-flex flex-column align-items-center h-100 w-100">
          {annotationHook.meta?.isLoading ? (
            <div>
              Phase 1/3: Loading annotations... {numLoaded} annotations loaded
              so far
            </div>
          ) : !imageNeighboursQueries.every((q) => q.isSuccess) ? (
            <div>
              Phase 2/3: Loading image neighbours...
              {imageNeighboursQueries.reduce(
                (acc, q) => acc + (q.isSuccess ? 1 : 0),
                0
              )}{" "}
              of {imageNeighboursQueries.length} neighbours loaded
            </div>
          ) : !imageMetaDataQueries.every((q) => q.isSuccess) ? (
            <div>
              Phase 3/3: Loading image metadata...
              {imageMetaDataQueries.reduce(
                (acc, q) => acc + (q.isSuccess ? 1 : 0),
                0
              )}{" "}
              of {imageMetaDataQueries.length} images loaded
            </div>
          ) : (
            selectedCategories.length === 0 ? (
              <div>No label selected</div>
            ) : activePair
              && imageNeighbours[activePair.primary]?.[activePair.secondary]
              && imageNeighbours[activePair.secondary]?.[activePair.primary] ? (
              <RegisterPair
                key={activePair.primary + activePair.secondary}
                images={[
                  imageMetaData[activePair.primary],
                  imageMetaData[activePair.secondary],
                ]}
                selectedCategoryIDs={selectedCategoryIDs}
                selectedSet={selectedAnnotationSet}
                transforms={[
                  imageNeighbours[activePair.primary]?.[activePair.secondary]?.tf,
                  imageNeighbours[activePair.secondary]?.[activePair.primary]?.tf,
                ]}
                next={nextPair}
                prev={() => {}}
                visible={true}
                ack={() => {}}
              />
            ) : (
              <div>No more items to register</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTag({ label, value }: { label: string; value: string }) {
  return (
    <p className="mb-0 d-flex flex-row gap-2 justify-content-between">
      <span>{label}:</span>
      <span>{value}</span>
    </p>
  );
}
