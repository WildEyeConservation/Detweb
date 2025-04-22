import React, { useState, useCallback, useRef, useEffect } from "react";
import Button from "react-bootstrap/Button";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { Form } from "react-bootstrap";

// Define the GPS data structure
export interface GPSData {
  timestamp?: number;
  filepath?: string;
  lat: number;
  lng: number;
  alt: number;
}

// Define a polygon subset structure
interface PolygonSubset {
  id: string;
  coords: L.LatLngExpression[];
}

// Props for the component
export interface GPSSubsetProps {
  gpsData: GPSData[];
  onFilter: (filteredData: GPSData[]) => void;
}

// A helper component to fit the map view to the given GPS points
const FitBoundsToPoints: React.FC<{ points: GPSData[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(
        validPoints.map((p) => [p.lat, p.lng] as [number, number])
      );
      map.fitBounds(bounds);
    }
  }, [points, map]);
  return null;
};

// The main component
const GPSSubset: React.FC<GPSSubsetProps> = ({ gpsData, onFilter }) => {
  const [polygons, setPolygons] = useState<PolygonSubset[]>([]);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const validGpsData = gpsData.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );

  const [currentFilteredPoints, setCurrentFilteredPoints] =
    useState<GPSData[]>(validGpsData);
  const [deletedPointsStack, setDeletedPointsStack] = useState<GPSData[][]>([]);

  // When a polygon is created
  const handleCreated = useCallback((e: any) => {
    const { layer } = e;
    let drawnCoords = layer.getLatLngs()[0] as L.LatLngExpression[];
    // Filter out invalid coordinates
    drawnCoords = drawnCoords.filter((coord) => {
      if (Array.isArray(coord)) {
        return Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
      } else if (
        coord &&
        typeof coord === "object" &&
        "lat" in coord &&
        "lng" in coord
      ) {
        return Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
      }
      return false;
    });
    if (drawnCoords.length === 0) return;
    const newPolygon: PolygonSubset = {
      id: Date.now().toString(),
      coords: drawnCoords,
    };
    setPolygons((prev) => [...prev, newPolygon]);

    // Remove the temporary drawn layer and add a new one with an identifier
    if (featureGroupRef.current) {
      featureGroupRef.current.removeLayer(layer);
      const newLayer = L.polygon(newPolygon.coords);
      (newLayer as any).polygonId = newPolygon.id;
      newLayer.bindTooltip("Polygon " + newPolygon.id, { permanent: false });
      featureGroupRef.current.addLayer(newLayer);
    }
  }, []);

  // When a polygon is edited
  const handleEdited = useCallback((e: any) => {
    e.layers.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon && (layer as any).polygonId) {
        let editedCoords = layer.getLatLngs()[0] as L.LatLngExpression[];
        // Filter out invalid coordinates
        editedCoords = editedCoords.filter((coord) => {
          if (Array.isArray(coord)) {
            return Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
          } else if (
            coord &&
            typeof coord === "object" &&
            "lat" in coord &&
            "lng" in coord
          ) {
            return Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
          }
          return false;
        });
        if (editedCoords.length === 0) return;
        const polygonId = (layer as any).polygonId;
        setPolygons((prev) =>
          prev.map((p) =>
            p.id === polygonId ? { ...p, coords: editedCoords } : p
          )
        );
      }
    });
  }, []);

  // When a polygon is deleted
  const handleDeleted = useCallback((e: any) => {
    e.layers.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon && (layer as any).polygonId) {
        const polygonId = (layer as any).polygonId;
        setPolygons((prev) => prev.filter((p) => p.id !== polygonId));
      }
    });
  }, []);

  // Function to filter points within any drawn polygon
  const handleFilterPoints = useCallback(() => {
    if (polygons.length === 0) {
      return;
    }
    const newVisiblePoints: GPSData[] = [];
    const removedPoints: GPSData[] = [];
    currentFilteredPoints.forEach((point) => {
      const pt = turf.point([point.lng, point.lat]);
      const inside = polygons.some((polygon) => {
        const polyCoords = polygon.coords.map((coord) => {
          if (Array.isArray(coord)) {
            return [coord[1], coord[0]];
          } else if (
            coord &&
            typeof coord === "object" &&
            "lat" in coord &&
            "lng" in coord
          ) {
            return [coord.lng, coord.lat];
          }
          return [0, 0];
        });
        if (
          JSON.stringify(polyCoords[0]) !==
          JSON.stringify(polyCoords[polyCoords.length - 1])
        ) {
          polyCoords.push(polyCoords[0]);
        }
        const turfPolygon = turf.polygon([polyCoords]);
        return turf.booleanPointInPolygon(pt, turfPolygon);
      });
      if (inside) {
        removedPoints.push(point);
      } else {
        newVisiblePoints.push(point);
      }
    });
    // Record the removed points (for undo) and update current visible points
    setDeletedPointsStack((prev) => [...prev, removedPoints]);
    setCurrentFilteredPoints(newVisiblePoints);
    onFilter(newVisiblePoints);
    // Clear polygon layers after filtering points
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    setPolygons([]);
  }, [currentFilteredPoints, polygons, onFilter]);

  const handleUndo = useCallback(() => {
    setDeletedPointsStack((oldStack) => {
      if (oldStack.length === 0) {
        return oldStack;
      }
      const newStack = oldStack.slice(0, oldStack.length - 1);
      const lastDeleted = oldStack[oldStack.length - 1];
      setCurrentFilteredPoints((curr) => {
        const newVisible = [...curr, ...lastDeleted];
        onFilter(newVisible);
        return newVisible;
      });
      return newStack;
    });
  }, [onFilter]);

  return (
    <Form.Group className="mt-3 d-flex flex-column gap-2">
      <div>
        <Form.Label className="d-block mb-0">Filter Data (Optional)</Form.Label>
        <Form.Text style={{ fontSize: "12px" }}>
          Use this tool to filter out points based on a polygon. Select the
          polygon function in the top-right corner of the map. Click to draw a
          polygon. Click "Remove Points" to filter points within the polygon.
          Click "Undo" to reverse the last action.
        </Form.Text>
      </div>
      <div style={{ height: "600px", width: "100%", position: "relative" }}>
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          center={[0, 0]}
          zoom={2}
        >
          <FitBoundsToPoints points={validGpsData} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              edit={
                featureGroupRef.current
                  ? { featureGroup: featureGroupRef.current }
                  : {}
              }
            />
          </FeatureGroup>
          {validGpsData.map((point, index) => (
            <CircleMarker
              key={index}
              center={[point.lat, point.lng]}
              radius={3}
              color="orange"
            >
              <Popup>
                <div>
                  {point.timestamp && (
                    <div>
                      <strong>Timestamp:</strong> {point.timestamp}
                    </div>
                  )}
                  {point.filepath && (
                    <div>
                      <strong>Filepath:</strong> {point.filepath}
                    </div>
                  )}
                  <div>
                    <strong>Lng:</strong> {point.lng}
                  </div>
                  <div>
                    <strong>Lat:</strong> {point.lat}
                  </div>
                  <div>
                    <strong>Alt:</strong> {point.alt}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="d-flex flex-row gap-2">
        <Button variant="primary" onClick={handleFilterPoints}>
          Remove Points
        </Button>
        <Button
          disabled={deletedPointsStack.length === 0}
          variant="outline-primary"
          onClick={handleUndo}
        >
          Undo
        </Button>
      </div>
    </Form.Group>
  );
};

export default React.memo(GPSSubset);
