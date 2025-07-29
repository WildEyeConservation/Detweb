import React, { useState, useEffect, useContext } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { fetchAllPaginatedResults } from './utils';
import { GlobalContext } from './Context';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';

export default function DensityMap({
  annotationSetId,
  surveyId,
}: {
  annotationSetId: string;
  surveyId: string;
}) {
  const { client } = useContext(GlobalContext)!;
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [anns, imgs] = await Promise.all([
        fetchAllPaginatedResults<any, any>(
          client.models.Annotation.annotationsByAnnotationSetId as any,
          {
            setId: annotationSetId,
            limit: 1000,
            selectionSet: ['id', 'imageId', 'category.name', 'objectId'],
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
      annotations.forEach((a) => {
        const img = images.find((img) => img.id === a.imageId);
        if (!img || img.latitude == null || img.longitude == null) return;
        const marker = L.circleMarker([img.latitude, img.longitude], {
          color: 'orange',
          radius: 5,
        });
        marker.bindPopup(
          `<div><strong>Name:</strong> ${a.name}</div><div><strong>Category:</strong> ${a.category.name}</div>`
        );
        group.addLayer(marker);
      });
      map.addLayer(group);
      return () => {
        map.removeLayer(group);
      };
    }, [map, annotations, images]);
    return null;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className='flex-grow-1 w-100 h-100'>
      <MapContainer
        style={{ height: '100%', width: '100%', position: 'relative' }}
        center={[0, 0]}
        zoom={2}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <ClusteredMarkers />
      </MapContainer>
    </div>
  );
}
