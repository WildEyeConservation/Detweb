import React, { useState, useEffect, useContext } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';
import { fetchAllPaginatedResults } from './utils';
import { GlobalContext } from './Context';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import LabeledToggleSwitch from './LabeledToggleSwitch';

export default function DensityMap({
  annotationSetId,
  surveyId,
  categoryIds = [],
}: {
  annotationSetId: string;
  surveyId: string;
  categoryIds?: string[];
}) {
  const { client } = useContext(GlobalContext)!;
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  // Add state for strata
  const [strata, setStrata] = useState<any[]>([]);
  // add zoom level state
  const [zoomLevel, setZoomLevel] = useState(2);
  // add map center state
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [anns, imgs, str] = await Promise.all([
        fetchAllPaginatedResults<any, any>(
          client.models.Annotation.annotationsByAnnotationSetId as any,
          {
            setId: annotationSetId,
            limit: 1000,
            selectionSet: ['id', 'imageId', 'category.name', 'category.id', 'objectId'],
          } as any
        ),
        fetchAllPaginatedResults<any, any>(
          client.models.Image.imagesByProjectId as any,
          {
            projectId: surveyId,
            limit: 1000,
            selectionSet: ['id', 'latitude', 'longitude'],
          } as any
        ),
        fetchAllPaginatedResults<any, any>(
          client.models.Stratum.strataByProjectId as any,
          {
            projectId: surveyId,
            limit: 1000,
            selectionSet: ['id', 'name', 'coordinates'],
          } as any
        ),
      ]);
      // keep only primary annotations
      const primary = anns.filter((a) => a.id === a.objectId);
      // add a name to each annotation
      primary.forEach((a) => {
        a.name = uniqueNamesGenerator({
          dictionaries: [adjectives, names],
          seed: a.id,
          style: 'capital',
          separator: ' ',
        });
      });
      setAnnotations(primary);
      setImages(imgs);
      // Add setting strata state
      setStrata(str);
      setLoading(false);
    }
    loadData();
  }, [client, annotationSetId, surveyId]);

  // imperatively add clustered markers to the map
  const ClusteredMarkers: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      const group = (L as any).markerClusterGroup();
      annotations
        .filter((a) => categoryIds.length === 0 || categoryIds.includes(a.category.id))
        .forEach((a) => {
        const img = images.find((img) => img.id === a.imageId);
        if (!img || img.latitude == null || img.longitude == null) return;
        const marker = L.circleMarker([img.latitude, img.longitude], {
          color: 'orange',
          radius: 5,
        });
        marker.bindPopup(
          `<div><strong>Name:</strong> ${a.name}</div><div><strong>Label:</strong> ${a.category.name}</div>`
        );
        group.addLayer(marker);
      });
      map.addLayer(group);
      return () => {
        map.removeLayer(group);
      };
    }, [map, annotations, images, categoryIds]);
    return null;
  };

  const HeatmapLayer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      const latlngs = annotations
        .filter((a) => categoryIds.length === 0 || categoryIds.includes(a.category.id))
        .map((a) => {
          const img = images.find((img) => img.id === a.imageId);
          if (!img || img.latitude == null || img.longitude == null)
            return null;
          return [img.latitude, img.longitude] as [number, number];
        })
        .filter((x): x is [number, number] => x !== null);
      const heat = (L as any).heatLayer(latlngs, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
      });
      map.addLayer(heat);
      return () => {
        map.removeLayer(heat);
      };
    }, [map, annotations, images, categoryIds]);
    return null;
  };

  // Add StrataLayer to render stratum boundaries
  const StrataLayer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      // define a color palette for strata boundaries
      const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A8', '#33FFF8'];
      const group = L.layerGroup();
      strata.forEach((s, idx) => {
        const coords = s.coordinates;
        if (!coords || coords.length < 4) return;
        const latlngs: [number, number][] = [];
        for (let i = 0; i < coords.length; i += 2) {
          latlngs.push([coords[i], coords[i + 1]]);
        }
        // pick color based on stratum index
        const color = colors[idx % colors.length];
        const polygon = L.polygon(latlngs, { color, fillOpacity: 0 });
        polygon.bindPopup(`<div><strong>Stratum:</strong> ${s.name}</div>`);
        // finish building the strata layer group
        group.addLayer(polygon);
      });
      map.addLayer(group);
      return () => {
        map.removeLayer(group);
      };
    }, [map, strata]);
    return null;
  };

  // handle loading and render main map
  if (loading) {
    return <div>Loading...</div>;
  }

  // Add mapKey to force remount on category change without refetching data
  const mapKey = categoryIds.length > 0 ? categoryIds.join(',') : 'all';

  // Add MapEvents to capture zoom and move changes
  const MapEvents: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      const onZoomEnd = () => setZoomLevel(map.getZoom());
      const onMoveEnd = () => {
        const center = map.getCenter();
        setMapCenter([center.lat, center.lng]);
      };
      map.on('zoomend', onZoomEnd);
      map.on('moveend', onMoveEnd);
      // call invalidateSize immediately and on container resize to avoid cutoff
      map.invalidateSize();
      const container = map.getContainer();
      const resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(container);
      return () => {
        map.off('zoomend', onZoomEnd);
        map.off('moveend', onMoveEnd);
        resizeObserver.disconnect();
      };
    }, [map]);
    return null;
  };

  return (
    <div className='d-flex flex-column flex-grow-1 w-100 h-100'>
      <LabeledToggleSwitch
        leftLabel='Markers'
        rightLabel='Heatmap'
        checked={showHeatmap}
        onChange={setShowHeatmap}
      />
      <div className='w-100 flex-grow-1'>
        <MapContainer key={mapKey}
          style={{ height: '100%', width: '100%', position: 'relative' }}
          center={mapCenter}
          zoom={zoomLevel}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          <MapEvents />
          <StrataLayer />
          {showHeatmap ? <HeatmapLayer /> : <ClusteredMarkers />}
        </MapContainer>
      </div>
    </div>
  );
}