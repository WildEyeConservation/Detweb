import React, { useContext, useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import RangeSlider from "react-bootstrap-range-slider";
import {
  LayersControl,
  MapContainer,
  TileLayer,
  Polyline,
  LayerGroup,
  useMap,
} from "react-leaflet";
import { UserContext } from "./UserContext";
import { getImageSetsInProject } from "./gqlQueries";
import { createImageSetMembershipMinimal } from "./gqlQueries";
import { createImageSet } from "./graphql/mutations";
import "./DefineTransect.css";
import "react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css";

function getBounds(input) {
  return input.reduce(
    (x, y) =>
      y[0]
        ? [
            [Math.max(x[0][0], y[0]), Math.max(x[0][1], y[1])],
            [Math.min(x[1][0], y[0]), Math.min(x[1][1], y[1])],
          ]
        : x,
    [
      [-Infinity, -Infinity],
      [Infinity, Infinity],
    ],
  );
}

function TransectSelector({ imageLocations, selectedRange }) {
  const positions = imageLocations
    .filter((loc) => loc.image.latitude)
    .map((loc) => [loc.image.latitude, loc.image.longitude]);
  const map = useMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const bounds = getBounds(positions);
    setReady(true);
    map.fitBounds(bounds);
  }, [imageLocations, map]);
  const startIndex = imageLocations.findIndex(
    (iml) => iml.image.timestamp >= selectedRange[0],
  );
  const endIndex = imageLocations.findIndex(
    (iml) => iml.image.timestamp >= selectedRange[1],
  );
  //useEffect(()=>{map.setView(props.coords[props.index],map.getZoom())},[props.coords,map,props.index]);
  return (
    <>
      {ready && (
        <LayerGroup>
          <Polyline
            pathOptions={{ color: "blue" }}
            positions={positions.slice(0, startIndex + 1)}
          />
          <Polyline
            pathOptions={{ color: "red" }}
            positions={positions.slice(startIndex, endIndex + 1)}
          />
          <Polyline
            pathOptions={{ color: "lightblue" }}
            positions={positions.slice(endIndex)}
          />
        </LayerGroup>
      )}
    </>
  );
}

export default function DefineTransect() {
  const [imageSets, setImageSets] = useState([]);
  const [selectedSet, selectSet] = useState();
  const [sliderValue, setSliderValue] = useState(0);
  const [sliderRange, setSliderRange] = useState([]);
  const [selectStart, setSelectStart] = useState(0);
  const [markingState, setMarkingState] = useState("Start Transect");
  const [imageLocations, setImageLocations] = useState([]);
  const { currentProject, gqlSend, gqlGetMany } = useContext(UserContext);

  const getImagesInSet = `query getImagesInSet ($name: String!,$nextToken:String){
  result1:getImageSet(name: $name) {
      result2:images(nextToken: $nextToken){
      items {
        image{
          key
          timestamp
          latitude
          longitude
        }
      }
      nextToken
    }
  }
}
`;

  useEffect(() => {
    if (currentProject) {
      gqlGetMany(getImageSetsInProject, { name: currentProject }).then((sets) =>
        setImageSets(sets),
      );
    }
  }, [currentProject]);

  useEffect(() => {
    if (selectedSet) {
      const res1 = gqlGetMany(getImagesInSet, { name: selectedSet }).then(
        (iml) => iml.sort((a, b) => a.image.timestamp - b.image.timestamp),
      );
      res1.then((iml) => setImageLocations(iml));
      res1.then((iml) =>
        setSliderRange([
          iml[0].image.timestamp,
          iml[iml.length - 1].image.timestamp,
        ]),
      );
    }
  }, [selectedSet]);

  const createSubset = (imageLocations, start, end, name) => {
    const promises = [];
    const startIndex = imageLocations.findIndex(
      (iml) => iml.image.timestamp >= start,
    );
    const endIndex = imageLocations.findIndex(
      (iml) => iml.image.timestamp >= end,
    );
    for (const { image } of imageLocations.slice(startIndex, endIndex + 1)) {
      promises.push(
        gqlSend(createImageSetMembershipMinimal, {
          input: { imageKey: image.key, imageSetName: name },
        }),
      );
    }
    Promise.all(promises).then(() =>
      gqlSend(createImageSet, { input: { name, projectName: currentProject } }),
    );
  };

  const handleButton = () => {
    let name;
    switch (markingState) {
      case "Start Transect":
        setMarkingState("End Transect");
        setSelectStart(sliderValue);
        break;
      case "End Transect":
        name = prompt("Enter a name for the defined imageset :");
        //TODO: save transect here
        createSubset(imageLocations, selectStart, sliderValue, name);
        setMarkingState("Start Transect");
        break;
      default:
        setMarkingState("Start Transect");
        break;
    }
  };

  return (
    <Container fluid>
      {/* <GlobalHotKeys keyMap={this.keyMap} handlers={this.handlers}/> */}
      <Form
        onKeyPress={(event) => {
          if (event.keyCode == 20) {
            handleButton();
          }
        }}
      >
        <Row>
          <Form.Select
            onChange={(e) => {
              selectSet(e.target.value);
            }}
            value={selectedSet}
          >
            {!selectedSet && (
              <option value="none">
                Select an image set to apply the processing to:
              </option>
            )}
            {imageSets?.map((q) => (
              <option key={q.name} value={q.name}>
                {q.name}
              </option>
            ))}
          </Form.Select>
          {/* <DropdownButton title="Select an input imageset" onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>
            {imageSets?.map( q => <Dropdown.Item key={q.id}
                                        onClick={() => this.selectSortie(q.id, q.name)}>{q.name}</Dropdown.Item>)} 
            </DropdownButton> */}
        </Row>
        <Row className="min-vh-100">
          <Col>
            <MapContainer
              bounds={[
                [80, 180],
                [-80, 180],
              ]}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="OpenStreetMap">
                  <TileLayer
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Mapbox">
                  <TileLayer
                    attribution="© <a href='https://www.mapbox.com/about/maps/'>Mapbox</a>
              © <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a> <strong>
              <a href='https://www.mapbox.com/map-feedback/' target='_blank'>Improve this map</a></strong>"
                    url="https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=pk.eyJ1IjoiaW5ub3ZlbnRpeCIsImEiOiJja2NyeXRqbzIxam4wMnJsdTdsYzUzNXZqIn0.2OgCsToWkg_T4Ynzc72Ipw"
                  />
                </LayersControl.BaseLayer>
                {/*            <LayersControl.BaseLayer name='Google Maps Roads'>
              <GoogleLayer googlekey={key}  maptype='ROADMAP'/>
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer  name='Google Maps Terrain'>
              <GoogleLayer googlekey={key}  maptype='TERRAIN' />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name='Google Maps Satellite'>
              <GoogleLayer googlekey={key}  maptype='SATELLITE'/>
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer  name='Google Maps Hybrid'>
              <GoogleLayer googlekey={key}  maptype='HYBRID' />
          </LayersControl.BaseLayer>*/}
                {imageLocations.length && (
                  <LayersControl.Overlay checked name="Current sortie">
                    <TransectSelector
                      imageLocations={imageLocations}
                      selectedRange={[
                        selectStart ? selectStart : sliderValue,
                        sliderValue,
                      ]}
                    />
                  </LayersControl.Overlay>
                )}
                {/* { this.state.existingTransects &&
          <LayersControl.Overlay name={"Existing transects"}>
            <LayerGroup>
              {this.state.existingTransects.map((transect, idx) => (
                <Polyline 
                  key={idx} 
                  pathOptions={{color:colors[idx % colors.length]}} 
                  positions={transect.coords}>
                  <Tooltip>{transect.name}</Tooltip>
                </Polyline>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>}  */}
              </LayersControl>
            </MapContainer>
            <RangeSlider
              className="transectSlider"
              value={sliderValue}
              onChange={(e) => {
                //sliderCallback(e.target.value);
                setSliderValue(e.target.value);
                //this.setState({'sliderValue': e.target.value});
              }}
              min={sliderRange[0]}
              tooltipLabel={(val) => new Date(val * 1000).toLocaleString()}
              max={sliderRange[1]}
              size="lg"
            />
            <Button variant="primary" size="lg" onClick={handleButton}>
              {markingState}
            </Button>
          </Col>
        </Row>
      </Form>
    </Container>
  );
}
