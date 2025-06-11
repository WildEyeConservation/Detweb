import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  MapContainer,
  ImageOverlay,
  FeatureGroup,
} from "react-leaflet";
import { CRS } from "leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw.css";
import FileInput from "./FileInput";
import { Form } from "react-bootstrap";

interface ImageMaskEditorProps {
  setMasks: (masks: number[][][]) => void;
}

const ImageMaskEditor: React.FC<ImageMaskEditorProps> = ({
  setMasks,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const mapRef = useRef<L.Map | null>(null) as React.MutableRefObject<L.Map | null>;

  // Handle file input change
  const handleFileChange = (file: File[]) => {
    if (file && file[0]) {
      const url = URL.createObjectURL(file[0]);
      setImageUrl(url);
      // Load image to get its dimensions
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = url;
    }
  };

  // Update parent's masks state by extracting polygons from the FeatureGroup
  const updateMasks = useCallback(() => {
    if (!featureGroupRef.current || !imageDimensions) return;
    const newMasks: number[][][] = [];
    featureGroupRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        // Clamp each point to be within image boundaries
        const clampedLatLngs = latlngs.map((coord) => {
          const clampedLng = Math.min(
            Math.max(coord.lng, 0),
            imageDimensions.width
          );
          const clampedLat = Math.min(
            Math.max(coord.lat, 0),
            imageDimensions.height
          );
          return L.latLng(clampedLat, clampedLng);
        });
        // If any point was adjusted, update the polygon's geometry
        const hasChanged = latlngs.some((coord, index) => {
          return (
            coord.lat !== clampedLatLngs[index].lat ||
            coord.lng !== clampedLatLngs[index].lng
          );
        });
        if (hasChanged) {
          layer.setLatLngs([clampedLatLngs]);
          const polyAny = layer as any;
          // Attempt to force a visual update
          if (typeof polyAny.redraw === "function") {
            polyAny.redraw();
          }
          if (typeof polyAny._updatePath === "function") {
            polyAny._updatePath();
          }
          if (
            polyAny._renderer &&
            typeof polyAny._renderer._updatePath === "function"
          ) {
            polyAny._renderer._updatePath(layer);
          }
          if (polyAny.editing) {
            if (typeof polyAny.editing.updateMarkers === "function") {
              polyAny.editing.updateMarkers();
            } else if (
              typeof polyAny.editing._updateMarkerPositions === "function"
            ) {
              polyAny.editing._updateMarkerPositions();
            }
          }
        }
        // Create mask state array in [lng, lat] format
        const mask = clampedLatLngs.map((coord) => [coord.lng, coord.lat]);
        newMasks.push(mask);
      }
    });

    setMasks(newMasks);
  }, [setMasks, imageDimensions]);

  // Update handleCreated to replace out-of-bound polygons
  const handleCreated = (e: any) => {
    if (!imageDimensions || !featureGroupRef.current) return;
    const layer = e.layer;
    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const clampedLatLngs = latlngs.map((coord) => {
        const clampedLng = Math.min(
          Math.max(coord.lng, 0),
          imageDimensions.width
        );
        const clampedLat = Math.min(
          Math.max(coord.lat, 0),
          imageDimensions.height
        );
        return L.latLng(clampedLat, clampedLng);
      });
      const hasChanged = latlngs.some((coord, index) => {
        return (
          coord.lat !== clampedLatLngs[index].lat ||
          coord.lng !== clampedLatLngs[index].lng
        );
      });
      if (hasChanged) {
        featureGroupRef.current!.removeLayer(layer);
        const newPoly = L.polygon(clampedLatLngs, { color: "#97009c" });
        featureGroupRef.current!.addLayer(newPoly);
      }
    }
    updateMasks();
  };

  // Update handleEdited to replace out-of-bound polygons after editing
  const handleEdited = (e: any) => {
    if (!imageDimensions || !featureGroupRef.current) return;
    e.layers.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        const clampedLatLngs = latlngs.map((coord) => {
          const clampedLng = Math.min(
            Math.max(coord.lng, 0),
            imageDimensions.width
          );
          const clampedLat = Math.min(
            Math.max(coord.lat, 0),
            imageDimensions.height
          );
          return L.latLng(clampedLat, clampedLng);
        });
        const hasChanged = latlngs.some((coord, index) => {
          return (
            coord.lat !== clampedLatLngs[index].lat ||
            coord.lng !== clampedLatLngs[index].lng
          );
        });
        if (hasChanged) {
          featureGroupRef.current!.removeLayer(layer);
          const newPoly = L.polygon(clampedLatLngs, { color: "#97009c" });
          featureGroupRef.current!.addLayer(newPoly);
        }
      }
    });
    updateMasks();
  };

  const handleDeleted = (e: any) => {
    updateMasks();
  };

  // When image dimensions are available, fit the map to show the whole image
  useEffect(() => {
    if (imageDimensions && mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds([
        [0, 0],
        [imageDimensions.height, imageDimensions.width]
      ]);
    }
  }, [imageDimensions, mapRef]);

  return (
    <Form.Group className="mt-3">
      <Form.Label className="d-block mb-0">
        Create Image Masks (optional)
      </Form.Label>
      <Form.Text
        className="d-block text-muted m-0 mb-2"
        style={{ fontSize: "12px" }}
      >
        Use this tool to create masks for your images. Masks are used to remove
        static objects such as a wheel from your images when processing. Use the
        drawing tool in the top-right corner of the map to draw a polygon.
      </Form.Text>
      {imageUrl && imageDimensions && (
        <div
          style={{
            height: "600px",
            width: "100%",
            position: "relative",
            marginTop: "8px",
            marginBottom: "12px",
          }}
        >
          <MapContainer
            key={imageUrl}
            ref={mapRef}
            style={{ height: "100%", width: "100%" }}
            crs={CRS.Simple}
            center={[imageDimensions.height / 2, imageDimensions.width / 2]}
            zoom={-4}
            minZoom={-5}
          >
            <ImageOverlay
              url={imageUrl}
              bounds={[
                [0, 0],
                [imageDimensions.height, imageDimensions.width],
              ]}
            />
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position="topright"
                onCreated={handleCreated}
                onEdited={handleEdited}
                onDeleted={handleDeleted}
                draw={{
                  polygon: {
                    allowIntersection: false,
                    shapeOptions: { color: "#97009c" },
                  },
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                }}
              />
            </FeatureGroup>
          </MapContainer>
        </div>
      )}
      <FileInput
        id="mask-image-input"
        onFileChange={handleFileChange}
        accept="image/*"
      >
        <p className="mb-0">
          {imageUrl ? "Change Image" : "Select Sample Image"}
        </p>
      </FileInput>
    </Form.Group>
  );
};

export default ImageMaskEditor;
