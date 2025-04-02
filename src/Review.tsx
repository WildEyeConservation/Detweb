import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useMemo, useContext } from "react";
import { PreloaderFactory } from "./Preloader";
import BufferSource from "./BufferSource";
import AnnotationImage from "./AnnotationImage";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import Select, { MultiValue, Options } from "react-select";
import { ProjectContext, GlobalContext, ManagementContext } from "./Context";
import { Form } from "react-bootstrap";
import LabeledToggleSwitch from "./LabeledToggleSwitch";
import "./Review.css";
import { Card } from "react-bootstrap";
import Button from "react-bootstrap/Button";

export function Review({ showAnnotationSetDropdown = true }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>("");
  const [imageBased, setImageBased] = useState(true);
  const [chronological, setChronological] = useState(false);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const [locationsLoaded, setLocationsLoaded] = useState(0);
  const [index, setIndex] = useState(0);
  const [bufferSource, setBufferSource] = useState<BufferSource | null>(null);
  const navigate = useNavigate();
  const { annotationSetId } = useParams();
  const { client } = useContext(GlobalContext)!;
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  useEffect(() => {
    async function fetchAnnotations() {
      let nextNextToken: string | null | undefined = undefined;
      do {
        const result = await client.models.Annotation.annotationsByCategoryId(
          { categoryId: categoryId ?? "" },
          {
            selectionSet: [
              "x",
              "y",
              "image.id",
              "image.width",
              "image.height",
              "image.timestamp",
            ],
            filter: { setId: { eq: annotationSetId } },
            nextToken: nextNextToken,
          }
        );
        const { data, nextToken } = result;
        setAnnotations((prev) => [
          ...prev,
          ...data.map(
            ({
              x,
              y,
              image: { id: imageId, width: imageWidth, height: imageHeight },
            }) => ({
              location: {
                x,
                y,
                width: 100,
                height: 100,
                image: { id: imageId, width: imageWidth, height: imageHeight },
                annotationSetId,
              },
              id: crypto.randomUUID(),
            })
          ),
        ]);
        nextNextToken = nextToken;
      } while (nextNextToken);
      setIsLoading(false);
    }

    async function fetchImages() {
      if (selectedCategories.length && selectedAnnotationSet) {
        setIsLoading(true);
        let imagesFound: Set<string> = new Set();
        const locations = [];
        for (const { value: categoryId } of selectedCategories) {
          let nextNextToken: string | null | undefined = undefined;
          do {
            const result =
              await client.models.Annotation.annotationsByCategoryId(
                { categoryId: categoryId ?? "" },
                {
                  selectionSet: [
                    "image.id",
                    "image.width",
                    "image.height",
                    "image.timestamp",
                  ],
                  filter: { setId: { eq: selectedAnnotationSet } },
                  nextToken: nextNextToken,
                }
              );
            const { data, nextToken } = result;
            data.forEach(
              ({
                image: {
                  id: imageId,
                  width: imageWidth,
                  height: imageHeight,
                  timestamp,
                },
              }) => {
                if (!imagesFound.has(imageId)) {
                  imagesFound.add(imageId);
                  locations.push({
                    location: {
                      x: imageWidth / 2,
                      y: imageHeight / 2,
                      width: imageWidth,
                      height: imageHeight,
                      image: {
                        id: imageId,
                        width: imageWidth,
                        height: imageHeight,
                        timestamp: timestamp,
                      },
                      annotationSetId: selectedAnnotationSet,
                    },
                    taskTag: "review",
                    id: crypto.randomUUID(),
                  });
                  setLocationsLoaded((prev) => prev + 1);
                }
              }
            );
            nextNextToken = nextToken;
          } while (nextNextToken);
        }
        setAnnotations(
          locations.sort(
            (a, b) => a.location.image.timestamp - b.location.image.timestamp
          )
        );
      }
      setIsLoading(false);
    }

    if (selectedCategories.length && selectedAnnotationSet) {
      if (imageBased) {
        fetchImages();
      } else {
        fetchAnnotations();
      }
    }
    return () => {
      setAnnotations([]);
      setIsLoading(false);
      setLocationsLoaded(0);
    };
  }, [selectedCategories, selectedAnnotationSet, imageBased]);

  useEffect(() => {
    if (annotations.length) {
      setBufferSource(new BufferSource(annotations));
    }
  }, [annotations]);

  const Preloader = useMemo(() => PreloaderFactory(AnnotationImage), []);
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1555px",
        marginTop: "16px",
        marginBottom: "16px",
      }}
    >
      <div className="w-100 h-100 d-flex flex-row gap-3">
        <div
          className="d-flex flex-column gap-3 w-100"
          style={{ maxWidth: "300px" }}
        >
          <Card className="w-100">
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
              <Card.Title className="mb-0">Filters</Card.Title>
            </Card.Header>
            <Card.Body className="d-flex flex-column gap-2 overflow-auto">
              <div className="w-100">
                <Form.Label>Labels</Form.Label>
                <Select
                  value={selectedCategories}
                  onChange={setSelectedCategories}
                  isMulti
                  name="Labels to review"
                  options={categories
                    ?.filter((c) => c.annotationSetId === selectedAnnotationSet)
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
          </Card>
        </div>
        {!annotations.length && isLoading ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 w-100">
            Loading... Please be patient. {locationsLoaded} locations loaded so
            far...
          </div>
        ) : (
          bufferSource && (
            <div className="d-flex flex-column align-items-center h-100 w-100">
              <Preloader
                key={selectedAnnotationSet + selectedCategories.join(",")}
                index={index}
                setIndex={setIndex}
                fetcher={() => bufferSource.fetch()}
                preloadN={2}
                historyN={2}
              />
              <div className="mt-2 w-100">
                <Form.Range
                  value={index}
                  onChange={(e) => setIndex(parseInt(e.target.value))}
                  min={0}
                  max={annotations.length - 1}
                />
                <div style={{ textAlign: "center" }}>
                  Done with {index} out of {annotations.length} locations
                </div>
              </div>
            </div>
          )
        )}
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
