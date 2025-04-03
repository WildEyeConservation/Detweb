import { useMemo, useContext, useCallback, useEffect, useState } from "react";
import BaseImage from "./BaseImage";
import { withAckOnTimeout } from "./useAckOnTimeout";
import { MapLegend, SideLegend } from "./Legend";
import Location from "./Location";
import { withCreateObservation } from "./useCreateObservation";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import { GlobalContext, ProjectContext, UserContext } from "./Context";
import { ShowMarkers } from "./ShowMarkers";
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import { ImageContextFromHook } from "./ImageContext";
import CreateAnnotationOnHotKey from "./CreateAnnotationOnHotKey";
import { Schema } from "../amplify/data/resource";
import useImageStats from "./useImageStats";
import { Badge } from "react-bootstrap";
const Image = withCreateObservation(withAckOnTimeout(BaseImage));

export default function AnnotationImage(props: any) {
  const { location, next, prev, visible, id, ack, allowOutside, zoom } = props;
  const { annotationSetId } = location;
  const { client } = useContext(GlobalContext)!;
  //testing
  const { currentTaskTag } = useContext(UserContext)!;
  const subscriptionFilter = useMemo(
    () => ({
      filter: {
        and: [
          { setId: { eq: location.annotationSetId } },
          { imageId: { eq: location.image.id } },
        ],
      },
    }),
    [annotationSetId, location.image.id]
  );
  const {
    categoriesHook: { data: categories },
    expandLegend,
    setExpandLegend
  } = useContext(ProjectContext)!;
  const annotationsHook = useOptimisticUpdates<
    Schema["Annotation"]["type"],
    "Annotation"
  >(
    "Annotation",
    async (nextToken) =>
      client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: location.image.id, setId: { eq: location.annotationSetId } },
        { nextToken }
      ),
    subscriptionFilter
  );
  const stats = useImageStats(annotationsHook);
  const memoizedChildren = useMemo(() => {
    console.log("memoizing");
    const source = props.taskTag ? `manual-${props.taskTag}` : "manual";
    return [
      <CreateAnnotationOnClick
        key="caok"
        allowOutside={allowOutside}
        location={location}
        annotationSet={annotationSetId}
        source={source}
      />,
      <ShowMarkers key="showMarkers" annotationSetId={annotationSetId}/>,
      <Location key="location" {...location} />,
      <MapLegend
        key="legend"
        position="bottomright"
        hideLegend={expandLegend}
        setHideLegend={() => setExpandLegend((e) => !e)}
        annotationSetId={annotationSetId}
      />,
    ].concat(
      categories?.map((category) => (
        <CreateAnnotationOnHotKey
          key={category.id}
          hotkey={category.shortcutKey}
          setId={location.annotationSetId}
          category={category}
          imageId={location.image.id}
          source={source}
        />
      ))
    );
  }, [props.taskTag, location.image.id, annotationSetId, expandLegend]);

  return (
    <ImageContextFromHook
      hook={annotationsHook}
      locationId={location.id}
      image={location.image}
      secondaryQueueUrl={props.secondaryQueueUrl}
      taskTag={props.taskTag}
    >
      <div className="d-flex flex-row justify-content-center w-100 h-100 gap-3 overflow-auto">
        <div
          className={`d-flex flex-column align-items-center w-100 h-100 gap-3`}
          style={{
            maxWidth: "1024px",
          }}
        >
          {visible && (props.taskTag || currentTaskTag) && (
            <Badge bg="secondary">
              Working on: {props.taskTag || currentTaskTag}
            </Badge>
          )}
          <Image
            stats={stats}
            visible={visible}
            location={location}
            taskTag={props.taskTag}
            zoom={zoom}
            id={id}
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}
          >
            {visible && memoizedChildren}
          </Image>
        </div>
        <SideLegend
          hideLegend={!expandLegend}
          setHideLegend={() => setExpandLegend((e) => !e)}
          annotationSetId={annotationSetId}
        />
      </div>
    </ImageContextFromHook>
  );
}
