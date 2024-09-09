import { ImageOverlay, ImageOverlayProps } from "react-leaflet";
import { useState, useContext, useEffect } from "react";
import { UserContext } from "./UserContext";
import backend from "../amplify_outputs.json";

interface S3ImageOverlayProps extends ImageOverlayProps {
  bounds: [[number, number], [number, number]];
  source: string;
}
export function S3ImageOverlay({ bounds, source }: S3ImageOverlayProps) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const { getObject } = useContext(UserContext)!;

  useEffect(() => {
    getObject({
      Bucket: backend.custom.outputBucket,
      Key: `public/images/${source}`,
    })
      .then((response) => {
        // Check if response.Body is already a Blob
        if (response.Body instanceof Blob) {
          return response.Body;
        }
        // If it's a ReadableStream (Web Streams API)
        else if (response.Body.getReader) {
          return new Response(response.Body).blob();
        }
        // Add other conditions if needed
        else {
          throw new Error("Unexpected response body type");
        }
      })
      .then((blob) => URL.createObjectURL(blob))
      .then((url) => setUrl(url));
  }, [source, getObject]);

  return url ? <ImageOverlay bounds={bounds} url={url} /> : null;
}
