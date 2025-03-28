import { useParams } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { GlobalContext } from "./Context";
import AnnotationImage from "./AnnotationImage";

export function ImageLoader() {
  const { imageId, annotationSetId } = useParams();
  const [element, setElement] = useState<JSX.Element | null>(null);
  const { client } = useContext(GlobalContext)!;

  useEffect(() => {
    client.models.Image.get(
      { id: imageId! },
      { selectionSet: ["id", "width", "height"] }
    ).then(({ data }) => {
      setElement(
        <AnnotationImage
          visible={true}
          location={{
            image: { ...data },
            annotationSetId,
            x: data.width / 2,
            y: data.height / 2,
            width: data.width,
            height: data.height,
          }}
        />
      );
    });
  }, [imageId, annotationSetId]);

  return (
    <div
      className="d-flex flex-column align-items-center w-100 h-100"
      style={{ paddingTop: "12px", paddingBottom: "12px" }}
    >
      {element}
    </div>
  );
}
