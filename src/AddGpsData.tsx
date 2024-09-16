import { useContext, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { UserContext } from "./Context";
import { createImageSetMembershipMinimal } from "./gqlQueries";
import Papa from "papaparse";
import { createImageSet, updateImage } from "./graphql/mutations";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import PropTypes from "prop-types";


interface AddGpsDataProps {
  show: boolean;
  handleClose: () => void;
}


function AddGpsData({ show, handleClose }: AddGpsDataProps) {
  const { currentProject, gqlSend, gqlGetMany } = useContext(UserContext)!;
  const [selectedImageSets, setImageSets] = useState<string[] | undefined>(undefined);
  const [file, setFile] = useState<File | undefined>();
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Add GPS data`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Updating images",
    stepName: "images",
  });

  const getImagesInSet = `query getImagesInSet ($name: String!,$nextToken:String){
    result1:getImageSet(name: $name) {
        result2:images(nextToken: $nextToken){
        items {
          image{
            key
            timestamp
          }
        }
        nextToken
      }
    }
  }
  `;

  async function handleSubmit() {
    handleClose();
    if (!selectedImageSets) return;
    for (const selectedSet of selectedImageSets) {
      setTotalSteps(0);
      var images = await gqlGetMany(
        getImagesInSet,
        { name: selectedSet },
        setStepsCompleted,
      );
      images = images.sort((a, b) => a.image.timestamp - b.image.timestamp);
      setStepsCompleted(0);
      setTotalSteps(images.length);
      let prevData: any;
      var imageIndex = 0;
      var targetTime = images[0].image.timestamp;
      let lookup: Record<string, any[]> = {};
      let format: number | undefined = undefined;
      if (!file) {
        console.error("No file provided");
        return;
      }
      Papa.parse(file, {
        step: async function (row: { data: string | any[]; }, parser: { abort: () => void; }) {
          if (row.data.length > 1) {
            console.log("Next line from log file.");
            if (row.data.length < 6 && row.data.length > 1) {
              // Rob Wooding's GPS format as per mail on 1/12/2023
              format = 1;
              const [name, lat, lon, height, transect] = row.data;
              lookup[name] = [lat, lon, height, transect];
            } else {
              //IVX GPS format
              format = 2;
              // eslint-disable-next-line no-unused-vars
              const [gpsStatus, timestamp, , lat, , lon, , alt] =
                row.data;
              if (Number(gpsStatus)) {
                const data = {
                  timestamp: Number(timestamp) + 3600 * 2,
                  lat: Number(lat),
                  lon: Number(lon),
                  alt: Number(alt),
                };
                while (data.timestamp > targetTime) {
                  if (prevData) {
                    const gap = data.timestamp - prevData.timestamp;
                    const pos = (targetTime - prevData.timestamp) / gap;
                    const latitude = prevData.lat * (1 - pos) + data.lat * pos;
                    const longitude = prevData.lon * (1 - pos) + data.lon * pos;
                    const altitude_msl =
                      prevData.alt * (1 - pos) + data.alt * pos;
                    const key = images[imageIndex].image.key;
                    console.log("update image.");
                    gqlSend(updateImage, {
                      input: { key, latitude, longitude, altitude_msl },
                    }).then(() => setStepsCompleted((s) => s + 1));
                    imageIndex += 1;
                    if (imageIndex < images.length) {
                      console.log("move one image fwd.");
                      targetTime = images[imageIndex].image.timestamp;
                    } else {
                      // We have reached the last of the images in the imageset, so no need to keep reading the csv
                      console.log("All done.");
                      parser.abort();
                      break;
                    }
                  } else {
                    //TODO: generate an appropriate warning to the user. Coming in here typically means that some of our images were taken prior to the starting point of the GPS data
                    do {
                      console.log("ffwd one image.");
                      imageIndex += 1;
                      setTotalSteps((s) => s - 1);
                      if (imageIndex < images.length) {
                        targetTime = images[imageIndex].image.timestamp;
                      }
                    } while (data.timestamp > targetTime);
                    console.log(
                      "images caught up to starting point of gps TrackEvent.",
                    );
                  }
                }
                prevData = data;
              }
            }
          }
        },
        complete: async function () {
          const imageSets = new Set();
          if (format == 1) {
            for (const {
              image: { key },
            } of images) {
              try {
                const [lat, lon, height, transect] =
                  lookup[key.split("/").pop()];
                imageSets.add(transect);
                await gqlSend(updateImage, {
                  input: {
                    key,
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lon),
                    altitude_agl: parseFloat(height),
                  },
                })
                  await gqlSend(createImageSetMembershipMinimal, {
                      input: {
                        imageKey: key,
                        imageSetName: `${selectedSet}_t${transect}`,
                      },
                    });
                  () => setStepsCompleted((sc) => sc + 1);
              } catch (error) {
                console.log(`Could not add GPS coordinates for ${key}`);
                setTotalSteps((ts) => ts - 1);
              }
            }
            for (const transect of imageSets) {
              await gqlSend(createImageSet, {
                input: {
                  name: `${selectedSet}_t${transect}`,
                  projectName: currentProject,
                },
              });
            }
          }
          console.log("All done!");
        },
      });
    }
  }

  function handleChange(event: any) {
    setFile(event.target.files[0]);
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Add GPS Data</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <input type="file" accept=".csv" onChange={handleChange} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Apply to Imageset</Form.Label>
            <ImageSetDropdown
              selectedSets={selectedImageSets}
              setImageSets={setImageSets}
            />
            {/*  <Form.Select onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>  
      
       {!selectedSet && <option value="none">Select an image set to apply the processing to:</option>}
       {imageSets?.map( q => <option key={q.name} value={q.name}>{q.name}</option>)} 
       </Form.Select>   */}
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!file || !selectedImageSets}
        >
          Submit
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

AddGpsData.propTypes = {
  show: PropTypes.bool,
  handleClose: PropTypes.func,
};

export default AddGpsData;
