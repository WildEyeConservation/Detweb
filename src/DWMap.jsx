import L from "leaflet";
import "./FileAdder";
import "leaflet-kml";
import Papa from "papaparse";

const latKeywords = new Set(["latitude", "lat", "y"]);
const longKeywords = new Set(["longitude", "lng", "lon", "x"]);
const countKeywords = new Set(["count", "herdsize", "n"]);

class DWMap extends L.map {
  loadFiles = (files) => {
    for (let file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const parser = new DOMParser();
        if (reader.filename.endsWith(".kml")) {
          const kml = parser.parseFromString(reader.result, "text/xml");
          const track = new L.KML(kml);
          this.layercontrol.addOverlay(track, reader.filename);
          track.addTo(this);
          // Adjust map to show the kml
          const bounds = track.getBounds();
          this.fitBounds(bounds);
        }
        if (reader.filename.endsWith(".csv")) {
          let latIndex = -1;
          let longIndex = -1;
          let countIndex = -1;
          const csv = Papa.parse(reader.result);
          let headers = csv.data[0];
          for (let i = 0; i < headers.length; i++) {
            let header = headers[i].toLowerCase();
            if (latKeywords.has(header)) {
              latIndex = i;
            }
            if (longKeywords.has(header)) {
              longIndex = i;
            }
            if (countKeywords.has(header)) {
              countIndex = i;
            }
          }
          if (latIndex >= 0 && longIndex >= 0 && countIndex >= 0) {
            let markers = L.markerClusterGroup();
            for (let row of csv.data.slice(1)) {
              let coord = { lat: row[latIndex], lng: row[longIndex] };
              for (let i = 0; i < row[countIndex]; i++) {
                let marker = L.marker(coord, {
                  draggable: false,
                  icon: L.divIcon({
                    className: "my-custom-pin",
                    iconAnchor: [0, 24],
                    labelAnchor: [-6, 0],
                    popupAnchor: [0, -36],
                    html: '<span class ="marker" style="background-color:#3cb44b; border-color: #ffffff"/>',
                  }),
                });
                markers.addLayer(marker);
              }
            }
            this.layercontrol.addOverlay(markers, reader.filename);
            markers.addTo(this);
            const bounds = markers.getBounds();
            this.fitBounds(bounds);
          }
        }
      };
      reader.filename = file.name;
      reader.readAsText(file);
    }
  };

  constructor(mapId) {
    super(mapId, { fullscreenControl: true }).setView([0, 0], 3);
    L.control.fileAdder({ position: "topleft" }).addTo(this);
    this.layercontrol = L.control.layers(null, null);
    this.layercontrol.addBaseLayer(
      L.gridLayer.googleMutant({
        type: "satellite",
      }),
      "Google Satellite",
    );
    this.layercontrol.addBaseLayer(
      L.gridLayer.googleMutant({
        type: "roadmap",
      }),
      "Google Roadmap",
    );
    this.layercontrol.addBaseLayer(
      L.gridLayer.googleMutant({
        type: "terrain",
      }),
      "Google Terrain",
    );
    this.layercontrol.addBaseLayer(
      L.gridLayer.googleMutant({
        type: "hybrid", // valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
      }),
      "Google Hybrid",
    );
    let osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      },
    );
    this.layercontrol.addBaseLayer(osm, "OpenStreetMaps");
    let mapbox = L.tileLayer(
      "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?" +
        "access_token=pk.eyJ1IjoiaW5ub3ZlbnRpeCIsImEiOiJja2NyeXRqbzIxam4wMnJsdTdsYzUzNXZqIn0.2OgCsToWkg_T4Ynzc72Ipw",
      {
        attribution:
          '&copy; <a href="http://osm.org/copyright">Mapbox</a> contributors',
      },
    );
    this.layercontrol.addBaseLayer(mapbox, "Mapbox");
    osm.addTo(this);
    window.addEventListener("resize", () => {
      setTimeout(() => {
        this.invalidateSize();
      }, 500);
    });
    // TODO : Previously this was done by attaching to the shown event. That would be better
    setTimeout(() => {
      this.invalidateSize();
    }, 500);
    this.layercontrol.addTo(this);
  }
}

export default DWMap;
