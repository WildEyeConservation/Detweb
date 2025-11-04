import { useParams } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { GlobalContext } from "./Context";
import AnnotationImage from "./AnnotationImage";

export function LocationLoader() {
  const { locationId, annotationSetId } = useParams();
  const [element, setElement] = useState<JSX.Element | null>(null);
  const { client } = useContext(GlobalContext)!;

  useEffect(() => {
    client.models.Location.get(
      { id: locationId! },
      {
        selectionSet: [
          "id",
          "x",
          "y",
          "width",
          "height",
          "confidence",
          "image.id",
          "image.width",
          "image.height",
          "image.latitude",
          "image.longitude",
          "image.altitude_wgs84",
          "image.altitude_egm96",
          "image.altitude_agl",
        ],
      }
    ).then(({ data }) => {
      setElement(
        <AnnotationImage
          visible={true}
          location={{ ...data, annotationSetId }}
          hideNavButtons
        />
      );
    });
  }, [locationId, annotationSetId]);

  return (
    <div
      className="d-flex flex-column align-items-center w-100 h-100"
      style={{ paddingTop: "12px", paddingBottom: "12px" }}
    >
      {element}
    </div>
  );
}
