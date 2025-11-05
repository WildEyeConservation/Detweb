import React, { useState, useEffect, useContext, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';
import { fetchAllPaginatedResults } from './utils';
import { GlobalContext } from './Context';
import ImageViewerModal from './ImageViewerModal';
import AnnotationViewerModal from './AnnotationViewerModal';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import { Spinner } from 'react-bootstrap';

export default function DensityMap({
  annotationSetId,
  surveyId,
  categoryIds = [],
  primaryOnly = false,
  editable = false,
  dropFalseNegatives = false,
}: {
  annotationSetId: string;
  surveyId: string;
  categoryIds?: string[];
  primaryOnly?: boolean;
  editable?: boolean;
  dropFalseNegatives?: boolean;
}) {
  const { client } = useContext(GlobalContext)!;
  const [rawAnnotations, setRawAnnotations] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Layer visibility states
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  const [showImages, setShowImages] = useState(false);
  const [showStrata, setShowStrata] = useState(true);
  // Add state for strata
  const [strata, setStrata] = useState<any[]>([]);
  // Add state for shapefile exclusions
  const [shapefileExclusions, setShapefileExclusions] = useState<any[]>([]);
  // add zoom level state
  const [zoomLevel, setZoomLevel] = useState(2);
  // add map center state
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  // Add ref for map instance
  const mapRef = useRef<L.Map | null>(null);
  // Track if we've already fitted the map bounds
  const [hasFittedBounds, setHasFittedBounds] = useState(false);
  // Viewer modal state
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Jitter duplicate coordinates slightly so overlapping markers are visible
  const adjustedPositions = React.useMemo(() => {
    const byCoordKey: Record<string, any[]> = {};
    const adjusted: Record<string, { latitude: number; longitude: number }> =
      {};
    const keyFor = (lat: number, lng: number) => `${lat},${lng}`;

    images.forEach((img) => {
      if (img.latitude != null && img.longitude != null) {
        const key = keyFor(img.latitude, img.longitude);
        (byCoordKey[key] = byCoordKey[key] || []).push(img);
      }
    });

    Object.values(byCoordKey).forEach((group) => {
      if (group.length === 1) {
        const img = group[0];
        adjusted[img.id] = { latitude: img.latitude, longitude: img.longitude };
        return;
      }

      // Spread duplicates around a small circle (~5m radius)
      group.forEach((img, index) => {
        const latRad = (img.latitude * Math.PI) / 180;
        const radiusDeg = 0.00005; // ~5.5m in latitude
        const angle = (2 * Math.PI * index) / group.length;
        const dLat = radiusDeg * Math.sin(angle);
        const dLng =
          (radiusDeg * Math.cos(angle)) / Math.max(Math.cos(latRad), 1e-6);
        adjusted[img.id] = {
          latitude: img.latitude + dLat,
          longitude: img.longitude + dLng,
        };
      });
    });

    return adjusted;
  }, [images]);

  const openViewer = (imageId: string) => {
    // Exit fullscreen if currently active when opening image viewer
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    setViewerImageId(imageId);
    setViewerOpen(true);
  };

  // Fetch data only when core dependencies change
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [anns, imgs, str, exclusions] = await Promise.all([
        fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId,
          {
            setId: annotationSetId,
            limit: 1000,
            selectionSet: [
              'id',
              'imageId',
              'category.name',
              'category.id',
              'objectId',
              'source',
            ],
          } as any
        ),
        fetchAllPaginatedResults(client.models.Image.imagesByProjectId, {
          projectId: surveyId,
          limit: 1000,
          selectionSet: [
            'id',
            'latitude',
            'longitude',
            'transectId',
            'timestamp',
          ],
        }),
        fetchAllPaginatedResults(client.models.Stratum.strataByProjectId, {
          projectId: surveyId,
          limit: 1000,
          selectionSet: ['id', 'name', 'coordinates'],
        }),
        fetchAllPaginatedResults(
          client.models.ShapefileExclusions.shapefileExclusionsByProjectId,
          {
            projectId: surveyId,
            limit: 1000,
            selectionSet: ['id', 'coordinates'],
          }
        ),
      ]);

      // Store raw annotations without filtering
      setRawAnnotations(anns);
      setImages(imgs.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)));
      // Add setting strata state
      setStrata(str);
      // Add setting shapefile exclusions state
      setShapefileExclusions(exclusions);
      setLoading(false);
    }
    loadData();
  }, [client, annotationSetId, surveyId]);

  // Filter annotations when primaryOnly or rawAnnotations change
  useEffect(() => {
    const filteredAnnotations = primaryOnly
      ? rawAnnotations.filter(
          (a) =>
            a.id === a.objectId &&
            (!dropFalseNegatives || !a.source.includes('false-negative'))
        )
      : rawAnnotations;

    // add a name to each annotation
    filteredAnnotations.forEach((a) => {
      a.name = uniqueNamesGenerator({
        dictionaries: [adjectives, names],
        seed: a.id,
        style: 'capital',
        separator: ' ',
      });
    });

    setAnnotations(filteredAnnotations);
  }, [rawAnnotations, primaryOnly, dropFalseNegatives]);

  // Fit map to image points on initial load
  useEffect(() => {
    if (images.length > 0 && !hasFittedBounds) {
      // Use a timeout to ensure map is fully rendered
      const timeoutId = setTimeout(() => {
        if (mapRef.current) {
          try {
            const points = images
              .filter((img) => img.latitude != null && img.longitude != null)
              .map((img) => [img.latitude, img.longitude] as [number, number])
              .filter(([lat, lng]) => {
                // Filter out invalid coordinates
                return (
                  lat >= -90 &&
                  lat <= 90 &&
                  lng >= -180 &&
                  lng <= 180 &&
                  !isNaN(lat) &&
                  !isNaN(lng)
                );
              });

            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              console.log(
                'Fitting map bounds to',
                points.length,
                'points:',
                bounds
              );

              // Add some padding to the bounds
              mapRef.current.fitBounds(bounds, { padding: [20, 20] });
              setHasFittedBounds(true);
            } else {
              console.warn('No valid points found for fitting bounds');
            }
          } catch (error) {
            console.error('Error fitting map bounds:', error);
          }
        } else {
          console.warn('Map reference not available for fitting bounds');
        }
      }, 100); // Small delay to ensure map is rendered

      return () => clearTimeout(timeoutId);
    }
  }, [images, hasFittedBounds]);

  // Reset fit bounds flag when survey changes
  useEffect(() => {
    setHasFittedBounds(false);
  }, [surveyId]);

  // imperatively add clustered markers to the map
  const ClusteredMarkers: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      const group = (L as any).markerClusterGroup();
      annotations
        .filter(
          (a) => categoryIds.length === 0 || categoryIds.includes(a.category.id)
        )
        .forEach((a) => {
          const img = images.find((img) => img.id === a.imageId);
          if (!img || img.latitude == null || img.longitude == null) return;
          const pos = adjustedPositions[img.id] || {
            latitude: img.latitude,
            longitude: img.longitude,
          };
          const marker = L.circleMarker([pos.latitude, pos.longitude], {
            color: 'orange',
            radius: 5,
          });
          const popupHtml = `
            <div>
              <div><strong>Name:</strong> ${a.name}</div>
              <div><strong>Label:</strong> ${a.category.name}</div>
              <div style="margin-top:6px;"><button class="btn btn-sm btn-primary view-image-btn" data-imageid="${img.id}">View Image</button></div>
            </div>`;
          marker.bindPopup(popupHtml);
          marker.on('popupopen', () => {
            const popupEl = (marker as any).getPopup()?.getElement?.();
            const btn: HTMLElement | null =
              popupEl?.querySelector('.view-image-btn') ?? null;
            if (btn) {
              const handler = (ev: Event) => {
                ev.preventDefault();
                ev.stopPropagation();
                openViewer(img.id);
              };
              (btn as any).__detwebHandler = handler;
              btn.addEventListener('click', handler);
            }
          });
          marker.on('popupclose', () => {
            const popupEl = (marker as any).getPopup()?.getElement?.();
            const btn: HTMLElement | null =
              popupEl?.querySelector('.view-image-btn') ?? null;
            if (btn && (btn as any).__detwebHandler) {
              btn.removeEventListener('click', (btn as any).__detwebHandler);
              delete (btn as any).__detwebHandler;
            }
          });
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
        .filter(
          (a) => categoryIds.length === 0 || categoryIds.includes(a.category.id)
        )
        .map((a) => {
          const img = images.find((img) => img.id === a.imageId);
          if (!img || img.latitude == null || img.longitude == null)
            return null;
          const pos = adjustedPositions[img.id] || {
            latitude: img.latitude,
            longitude: img.longitude,
          };
          return [pos.latitude, pos.longitude] as [number, number];
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

  // Add ImagesLayer to render image markers color-coded by transect
  const ImagesLayer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;

      // Create a color palette for different transects
      const colors = [
        '#FF5733',
        '#33FF57',
        '#3357FF',
        '#F333FF',
        '#33FFF8',
        '#FFA833',
        '#8B33FF',
        '#FF3380',
        '#33FF8B',
      ];

      // Get unique transect IDs in order of first appearance in sorted images
      const uniqueTransectIds: string[] = [];
      const seenTransects = new Set<string>();

      images.forEach((img) => {
        const transectId = img.transectId || 'No Transect';
        if (!seenTransects.has(transectId)) {
          seenTransects.add(transectId);
          uniqueTransectIds.push(transectId);
        }
      });

      // Create mappings for colors and numbers
      const transectColors = new Map();
      const transectNumbers = new Map();

      uniqueTransectIds.forEach((transectId, index) => {
        const colorIndex = index % colors.length;
        transectColors.set(transectId, colors[colorIndex]);
        transectNumbers.set(transectId, index + 1); // 1-based numbering
      });

      // Group images by transect
      const transectMap = new Map();
      images.forEach((img) => {
        const transectId = img.transectId || 'No Transect';
        if (!transectMap.has(transectId)) {
          transectMap.set(transectId, []);
        }
        transectMap.get(transectId).push(img);
      });

      const group = L.layerGroup();

      images.forEach((img) => {
        if (!img || img.latitude == null || img.longitude == null) return;

        const transectId = img.transectId || 'No Transect';
        const color = transectColors.get(transectId) || '#999999';
        const pos = adjustedPositions[img.id] || {
          latitude: img.latitude,
          longitude: img.longitude,
        };

        const marker = L.circleMarker([pos.latitude, pos.longitude], {
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          radius: 6,
          weight: 2,
        });

        const transectNumber = transectNumbers.get(transectId) || 0;

        const popupHtml = `
          <div>
            <strong>Transect:</strong> ${transectNumber}<br/>
            <strong>Coordinates:</strong> ${pos.latitude.toFixed(
              4
            )}, ${pos.longitude.toFixed(4)}
            <div style="margin-top:6px;"><button class="btn btn-sm btn-primary view-image-btn" data-imageid="${
              img.id
            }">View Image</button></div>
          </div>`;
        marker.bindPopup(popupHtml);
        marker.on('popupopen', () => {
          const popupEl = (marker as any).getPopup()?.getElement?.();
          const btn: HTMLElement | null =
            popupEl?.querySelector('.view-image-btn') ?? null;
          if (btn) {
            const handler = (ev: Event) => {
              ev.preventDefault();
              ev.stopPropagation();
              openViewer(img.id);
            };
            (btn as any).__detwebHandler = handler;
            btn.addEventListener('click', handler);
          }
        });
        marker.on('popupclose', () => {
          const popupEl = (marker as any).getPopup()?.getElement?.();
          const btn: HTMLElement | null =
            popupEl?.querySelector('.view-image-btn') ?? null;
          if (btn && (btn as any).__detwebHandler) {
            btn.removeEventListener('click', (btn as any).__detwebHandler);
            delete (btn as any).__detwebHandler;
          }
        });

        group.addLayer(marker);
      });

      map.addLayer(group);
      return () => {
        map.removeLayer(group);
      };
    }, [map, images]);
    return null;
  };

  // Add StrataLayer to render stratum boundaries and shapefile exclusions
  const StrataLayer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      // define a color palette for strata boundaries
      const colors = [
        '#FF5733',
        '#33FF57',
        '#3357FF',
        '#F333FF',
        '#FF33A8',
        '#33FFF8',
      ];
      const group = L.layerGroup();

      // Render strata
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
        group.addLayer(polygon);
      });

      // Render shapefile exclusions
      shapefileExclusions.forEach((exclusion) => {
        const coords = exclusion.coordinates;
        if (!coords || coords.length < 4) return;
        const latlngs: [number, number][] = [];
        for (let i = 0; i < coords.length; i += 2) {
          latlngs.push([coords[i], coords[i + 1]]);
        }
        // Use red color for exclusions to distinguish from strata
        const polygon = L.polygon(latlngs, {
          color: '#FF0000',
          fillColor: '#FF0000',
          fillOpacity: 0.3,
          weight: 2,
        });
        polygon.bindPopup(`<div><strong>Exclusion Zone</strong></div>`);
        group.addLayer(polygon);
      });

      map.addLayer(group);
      return () => {
        map.removeLayer(group);
      };
    }, [map, strata, shapefileExclusions]);
    return null;
  };

  // handle loading and render main map
  if (loading) {
    return (
      <div className='d-flex flex-row align-items-center justify-content-center h-100 w-100'>
        <Spinner size='sm' />
        <span className='ms-2'>Loading...</span>
      </div>
    );
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

  // Add LayerControl to manage layer visibility
  const LayerControl: React.FC<{
    showClusters: boolean;
    setShowClusters: (show: boolean) => void;
    showHeatmap: boolean;
    setShowHeatmap: (show: boolean) => void;
    showImages: boolean;
    setShowImages: (show: boolean) => void;
    showStrata: boolean;
    setShowStrata: (show: boolean) => void;
  }> = ({
    showClusters,
    setShowClusters,
    showHeatmap,
    setShowHeatmap,
    showImages,
    setShowImages,
    showStrata,
    setShowStrata,
  }) => {
    const map = useMap();
    useEffect(() => {
      const control = (L as any).control({ position: 'topleft' });
      control.onAdd = () => {
        const container = L.DomUtil.create(
          'div',
          'leaflet-control-layers leaflet-control'
        );
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
        container.style.maxWidth = '200px';

        const title = L.DomUtil.create('div', '', container);
        title.innerHTML = '<strong>Layers</strong>';
        title.style.marginBottom = '8px';
        title.style.fontSize = '12px';
        title.style.color = 'black';

        const createCheckbox = (
          label: string,
          checked: boolean,
          onChange: (checked: boolean) => void
        ) => {
          const div = L.DomUtil.create('div', '', container);
          div.style.marginBottom = '5px';
          div.style.display = 'flex';
          div.style.alignItems = 'center';

          const checkbox = L.DomUtil.create(
            'input',
            '',
            div
          ) as HTMLInputElement;
          checkbox.type = 'checkbox';
          checkbox.checked = checked;
          checkbox.id = `layer-${label.toLowerCase()}`;
          checkbox.style.marginRight = '5px';

          const labelEl = L.DomUtil.create(
            'label',
            '',
            div
          ) as HTMLLabelElement;
          labelEl.htmlFor = checkbox.id;
          labelEl.innerHTML = label;
          labelEl.style.fontSize = '12px';
          labelEl.style.cursor = 'pointer';
          labelEl.style.color = 'black';
          labelEl.style.marginBottom = '0';

          L.DomEvent.on(checkbox, 'change', () => onChange(checkbox.checked));
        };

        createCheckbox('Clusters', showClusters, setShowClusters);
        createCheckbox('Heatmap', showHeatmap, setShowHeatmap);
        createCheckbox('Images', showImages, setShowImages);
        createCheckbox('Strata', showStrata, setShowStrata);

        return container;
      };
      control.addTo(map);
      return () => {
        control.remove();
      };
    }, [
      map,
      showClusters,
      showHeatmap,
      showImages,
      showStrata,
      setShowClusters,
      setShowHeatmap,
      setShowImages,
      setShowStrata,
    ]);
    return null;
  };

  // Add FullscreenControl to toggle map fullscreen
  const FullscreenControl: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      const control = (L as any).control({ position: 'topright' });
      control.onAdd = () => {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control leaflet-control-custom'
        );
        container.style.backgroundColor = 'white';
        const button = L.DomUtil.create(
          'button',
          'btn text-black',
          container
        ) as HTMLButtonElement;
        button.innerHTML = '⛶';
        button.style.cursor = 'pointer';
        button.style.color = 'black';
        L.DomEvent.on(button, 'click', () => {
          const mapContainer = map.getContainer();
          if (!document.fullscreenElement) {
            mapContainer.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
        });
        return container;
      };
      control.addTo(map);
      return () => {
        control.remove();
      };
    }, [map]);
    return null;
  };

  return (
    <div className='w-100 h-100'>
      <MapContainer
        ref={mapRef}
        key={mapKey}
        style={{ height: '100%', width: '100%', position: 'relative' }}
        center={mapCenter}
        zoom={zoomLevel}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          crossOrigin='anonymous'
        />
        <MapEvents />
        {showStrata && <StrataLayer />}
        {showClusters && <ClusteredMarkers />}
        {showHeatmap && <HeatmapLayer />}
        {showImages && <ImagesLayer />}
        <LayerControl
          showClusters={showClusters}
          setShowClusters={setShowClusters}
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          showImages={showImages}
          setShowImages={setShowImages}
          showStrata={showStrata}
          setShowStrata={setShowStrata}
        />
        <FullscreenControl />
      </MapContainer>
      {editable ? (
        <AnnotationViewerModal
          show={viewerOpen}
          onClose={() => setViewerOpen(false)}
          imageId={viewerImageId}
          imageIds={images.map((img) => img.id)}
          annotationSetId={annotationSetId}
          onNavigate={openViewer}
        />
      ) : (
        <ImageViewerModal
          show={viewerOpen}
          onClose={() => setViewerOpen(false)}
          imageId={viewerImageId}
          imageIds={images.map((img) => img.id)}
          annotationSetId={annotationSetId}
          onNavigate={openViewer}
          categoryIds={categoryIds}
        />
      )}
    </div>
  );
}
