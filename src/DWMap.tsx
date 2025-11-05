import L, { LatLngBoundsExpression } from 'leaflet';
import './FileAdder';
import 'leaflet-kml';
import Papa from 'papaparse';
import { ParseResult } from 'papaparse';
import 'leaflet.markercluster';

const latKeywords = new Set(['latitude', 'lat', 'y']);
const longKeywords = new Set(['longitude', 'lng', 'lon', 'x']);
const countKeywords = new Set(['count', 'herdsize', 'n']);
import 'leaflet.gridlayer.googlemutant';

interface DWMapOptions extends L.MapOptions {
  fullscreenControl: boolean;
}

declare module 'leaflet' {
  namespace Control {
    class FileAdder extends L.Control {
      constructor(options?: any);
    }
  }
  namespace control {
    function fileAdder(options?: any): Control.FileAdder;
  }
}

class DWMap extends L.Map {
  fitBounds(
    bounds: LatLngBoundsExpression,
    options?: L.FitBoundsOptions
  ): this {
    return super.fitBounds(bounds, options);
  }
  layercontrol: L.Control.Layers;

  constructor(mapId: string) {
    super(mapId, { fullscreenControl: true } as DWMapOptions);
    this.setView([0, 0], 3);

    L.control.fileAdder({ position: 'topleft' }).addTo(this);
    this.layercontrol = L.control.layers({}, {});

    this.layercontrol.addBaseLayer(
      (L as any).gridLayer.googleMutant({
        type: 'satellite',
      }),
      'Google Satellite'
    );
    this.layercontrol.addBaseLayer(
      (L as any).gridLayer.googleMutant({
        type: 'roadmap',
      }),
      'Google Roadmap'
    );
    this.layercontrol.addBaseLayer(
      (L as any).gridLayer.googleMutant({
        type: 'terrain',
      }),
      'Google Terrain'
    );
    this.layercontrol.addBaseLayer(
      (L as any).gridLayer.googleMutant({
        type: 'hybrid',
      }),
      'Google Hybrid'
    );

    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      }
    );
    this.layercontrol.addBaseLayer(osm, 'OpenStreetMaps');

    const mapbox = L.tileLayer(
      'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?' +
        'access_token=pk.eyJ1IjoiaW5ub3ZlbnRpeCIsImEiOiJja2NyeXRqbzIxam4wMnJsdTdsYzUzNXZqIn0.2OgCsToWkg_T4Ynzc72Ipw',
      {
        attribution:
          '&copy; <a href="http://osm.org/copyright">Mapbox</a> contributors',
      }
    );
    this.layercontrol.addBaseLayer(mapbox, 'Mapbox');

    osm.addTo(this);

    window.addEventListener('resize', () => {
      setTimeout(() => {
        this.invalidateSize();
      }, 500);
    });

    setTimeout(() => {
      this.invalidateSize();
    }, 500);

    this.layercontrol.addTo(this);
  }

  setView(
    center: L.LatLngExpression,
    zoom?: number,
    options?: L.ZoomPanOptions
  ): this {
    return super.setView(center, zoom, options);
  }

  invalidateSize(options?: L.ZoomPanOptions): this {
    return super.invalidateSize(options);
  }

  loadFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        const parser = new DOMParser();
        const result = reader.result as string;

        if (file.name.endsWith('.kml')) {
          const kml = parser.parseFromString(result, 'text/xml');
          const track = new (L as any).KML(kml); // Assuming leaflet-kml has types defined
          this.layercontrol.addOverlay(track, file.name);
          track.addTo(this);
          const bounds: LatLngBoundsExpression = track.getBounds();
          this.fitBounds(bounds);
        } else if (file.name.endsWith('.csv')) {
          const csv: ParseResult<any> = Papa.parse(result);
          const headers = csv.data[0];
          let latIndex = -1;
          let longIndex = -1;
          let countIndex = -1;

          for (let i = 0; i < headers.length; i++) {
            const header = headers[i].toLowerCase();
            if (latKeywords.has(header)) latIndex = i;
            if (longKeywords.has(header)) longIndex = i;
            if (countKeywords.has(header)) countIndex = i;
          }

          if (latIndex >= 0 && longIndex >= 0 && countIndex >= 0) {
            const markers = L.markerClusterGroup();
            csv.data.slice(1).forEach((row: any[]) => {
              const coord = {
                lat: parseFloat(row[latIndex]),
                lng: parseFloat(row[longIndex]),
              };
              for (let i = 0; i < parseInt(row[countIndex], 10); i++) {
                const marker = L.marker(coord, {
                  draggable: false,
                  icon: L.divIcon({
                    className: 'my-custom-pin',
                    iconAnchor: [0, 24],
                    //labelAnchor: [-6, 0],
                    popupAnchor: [0, -36],
                    html: '<span class="marker" style="background-color:#3cb44b; border-color: #ffffff"/>',
                  }),
                });
                markers.addLayer(marker);
              }
            });
            this.layercontrol.addOverlay(markers, file.name);
            markers.addTo(this);
            const bounds = markers.getBounds();
            this.fitBounds(bounds);
          }
        }
      };

      reader.readAsText(file);
    });
  };
}

export default DWMap;
