import { useContext, useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Papa from "papaparse";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import PropTypes from "prop-types";
import { GlobalContext } from "./Context";
import { DateTime } from 'luxon'
import pLimit from 'p-limit'


interface AddGpsDataProps {
  show: boolean;
  handleClose: () => void;
  selectedImageSets: string[];
  setSelectedImageSets: React.Dispatch<React.SetStateAction<string[]>>;
}


function AddGpsData({ show, handleClose, selectedImageSets, setSelectedImageSets }: AddGpsDataProps) {
  const plimit = pLimit(10);
  const {client} = useContext(GlobalContext)!;
  const [file, setFile] = useState<File | undefined>();
  const [csvData, setCsvData] = useState<any>(undefined);
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Add GPS data`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Updating images",
    stepFormatter: (step: number) => `${step} images`
  });


  useEffect(() => {
    if (file) {
      Papa.parse(file, {
        complete: function (results) {
          setCsvData({
            ...results, data:
              results.data.map((row: any) => {
                return {
                  timestamp: Number(row[1]),
                  lat: Number(row[3]),
                  lon: Number(row[5]),
                  alt: Number(row[7])
                }
              }).filter((row) => row.timestamp)
          });
        }
      });
    }
  }, [file]);
    
  const interpolateGpsData = (csvData: { timestamp: number; lat: number; lon: number; alt: number }[], queryTimestamp: number,) => {
    if (csvData.length === 0) {
      throw new Error("No GPS data available for interpolation.");
    }

    let low = 0;
    let high = csvData.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midData = csvData[mid];

      if (midData.timestamp === queryTimestamp) {
        return midData;
      } else if (midData.timestamp < queryTimestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // If we exit the loop without finding an exact match, interpolate
    if (low > 0 && csvData[low - 1].timestamp < queryTimestamp && csvData[low].timestamp > queryTimestamp) {
      const prevData = csvData[low - 1];
      const nextData = csvData[low];
      const gap = nextData.timestamp - prevData.timestamp;
      const pos = (queryTimestamp - prevData.timestamp) / gap;
      const latitude = prevData.lat * (1 - pos) + nextData.lat * pos;
      const longitude = prevData.lon * (1 - pos) + nextData.lon * pos;
      const altitude = prevData.alt * (1 - pos) + nextData.alt * pos;
      return {
        timestamp: queryTimestamp,
        lat: latitude,
        lon: longitude,
        alt: altitude,
      };
    } else {
      throw new Error("Extrapolation required for GPS data interpolation.");
    }
  };

  async function handleSubmit() {
    handleClose();
    if (!selectedImageSets) return;
    // const allImages = await selectedImageSets.reduce(async (acc, selectedSet) => {
    let prevNextToken: string | null | undefined = undefined;
    let allImages = [];
    do {
      const { data: images, nextToken } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({ imageSetId: selectedImageSets[0], selectionSet: ['image.timestamp', 'image.id'], nextToken: prevNextToken })
      prevNextToken = nextToken
      allImages = allImages.concat(images)
    } while (prevNextToken)
    setTotalSteps(allImages.length);
    let count=0
    await Promise.all(allImages.map(async ({ image:{timestamp,id} }) => {
      if (timestamp > csvData.data[0].timestamp && timestamp < csvData.data[csvData.data.length - 1].timestamp)  {
        const gpsData = interpolateGpsData(csvData.data, timestamp);
        plimit(() => client.models.Image.update({ id, latitude: gpsData.lat, longitude: gpsData.lon, altitude_agl: gpsData.alt }));
      } else {
        count++;
      }
      setStepsCompleted(s => s + 1);
      return
    }));
    if (count > 0) {
      if (count==1) {
        alert(`One image was not updated because it's timestamp was outside the range of the GPS data.`)
      } else {
        alert(`${count} images were not updated because their timestamps were outside the range of the GPS data.`)
      }
    }
  }


  //     images = images.sort((a, b) => a.image.timestamp - b.image.timestamp);
  //     for 
  //     setStepsCompleted(0);
  //     setTotalSteps(images.length);
  //     let prevData: any;
  //     var imageIndex = 0;
  //     var targetTime = images[0].image.timestamp;
  //     let lookup: Record<string, any[]> = {};
  //     let format: number | undefined = undefined;
  //     if (!file) {
  //       console.error("No file provided");
  //       return;
  //     }
  //     Papa.parse(file, {
  //       step: async function (row: { data: string | any[]; }, parser: { abort: () => void; }) {
  //         if (row.data.length > 1) {
  //           console.log("Next line from log file.");
  //           if (row.data.length < 6 && row.data.length > 1) {
  //             // Rob Wooding's GPS format as per mail on 1/12/2023
  //             format = 1;
  //             const [name, lat, lon, height, transect] = row.data;
  //             lookup[name] = [lat, lon, height, transect];
  //           } else {
  //             //IVX GPS format
  //             format = 2;
  //             // eslint-disable-next-line no-unused-vars
  //             const [gpsStatus, timestamp, , lat, , lon, , alt] =
  //               row.data;
  //             if (Number(gpsStatus)) {
  //               const data = {
  //                 timestamp: Number(timestamp) + 3600 * 2,
  //                 lat: Number(lat),
  //                 lon: Number(lon),
  //                 alt: Number(alt),
  //               };
  //               while (data.timestamp > targetTime) {
  //                 if (prevData) {
  //                   const gap = data.timestamp - prevData.timestamp;
  //                   const pos = (targetTime - prevData.timestamp) / gap;
  //                   const latitude = prevData.lat * (1 - pos) + data.lat * pos;
  //                   const longitude = prevData.lon * (1 - pos) + data.lon * pos;
  //                   const altitude_msl =
  //                     prevData.alt * (1 - pos) + data.alt * pos;
  //                   const key = images[imageIndex].image.key;
  //                   console.log("update image.");
  //                   gqlSend(updateImage, {
  //                     input: { key, latitude, longitude, altitude_msl },
  //                   }).then(() => setStepsCompleted((s) => s + 1));
  //                   imageIndex += 1;
  //                   if (imageIndex < images.length) {
  //                     console.log("move one image fwd.");
  //                     targetTime = images[imageIndex].image.timestamp;
  //                   } else {
  //                     // We have reached the last of the images in the imageset, so no need to keep reading the csv
  //                     console.log("All done.");
  //                     parser.abort();
  //                     break;
  //                   }
  //                 } else {
  //                   //TODO: generate an appropriate warning to the user. Coming in here typically means that some of our images were taken prior to the starting point of the GPS data
  //                   do {
  //                     console.log("ffwd one image.");
  //                     imageIndex += 1;
  //                     setTotalSteps((s) => s - 1);
  //                     if (imageIndex < images.length) {
  //                       targetTime = images[imageIndex].image.timestamp;
  //                     }
  //                   } while (data.timestamp > targetTime);
  //                   console.log(
  //                     "images caught up to starting point of gps TrackEvent.",
  //                   );
  //                 }
  //               }
  //               prevData = data;
  //             }
  //           }
  //         }
  //       },
  //       complete: async function () {
  //         const imageSets = new Set();
  //         if (format == 1) {
  //           for (const {
  //             image: { key },
  //           } of images) {
  //             try {
  //               const [lat, lon, height, transect] =
  //                 lookup[key.split("/").pop()];
  //               imageSets.add(transect);
  //               await gqlSend(updateImage, {
  //                 input: {
  //                   key,
  //                   latitude: parseFloat(lat),
  //                   longitude: parseFloat(lon),
  //                   altitude_agl: parseFloat(height),
  //                 },
  //               })
  //                 await gqlSend(createImageSetMembershipMinimal, {
  //                     input: {
  //                       imageKey: key,
  //                       imageSetName: `${selectedSet}_t${transect}`,
  //                     },
  //                   });
  //                 () => setStepsCompleted((sc) => sc + 1);
  //             } catch (error) {
  //               console.log(`Could not add GPS coordinates for ${key}`);
  //               setTotalSteps((ts) => ts - 1);
  //             }
  //           }
  //           for (const transect of imageSets) {
  //             await gqlSend(createImageSet, {
  //               input: {
  //                 name: `${selectedSet}_t${transect}`,
  //                 projectName: currentProject,
  //               },
  //             });
  //           }
  //         }
  //         console.log("All done!");
  //       },
  //     });
  //   }
  // }

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
          <Form.Group className="mb-3">
            <div className="d-grid">
              <Button as="label" htmlFor="file-upload">
                Select GPS metadata file
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleChange}
                  style={{ display: 'none' }}
                />
              </Button>
            </div>
            {file && <Form.Text className="text-muted">Selected file: {file.name}</Form.Text>}
          </Form.Group>
          <Form.Group>
            <Form.Label>Apply to Imageset</Form.Label>
            <ImageSetDropdown
              selectedSets={selectedImageSets}
              setImageSets={setSelectedImageSets}
            />
            {/*  <Form.Select onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>  
      
       {!selectedSet && <option value="none">Select an image set to apply the processing to:</option>}
       {imageSets?.map( q => <option key={q.name} value={q.name}>{q.name}</option>)} 
       </Form.Select>   */}
          </Form.Group>
        <Form.Group>
        {csvData && (
          <div className="text-center">
            <p>Number of rows parsed: {csvData.data.length}<br/>
                  {csvData.data.length && <span>
                  Starting at : {DateTime.fromSeconds(csvData.data[0].timestamp).toFormat("yyyy-MM-dd HH:mm:ss")}<br/>
                  Ending at : {DateTime.fromSeconds(csvData.data[csvData.data.length - 1].timestamp).toFormat("yyyy-MM-dd HH:mm:ss")}<br/>
                  </span>}
            Number of errors encountered: {csvData.errors.length}</p> 
          </div>
            )}
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
