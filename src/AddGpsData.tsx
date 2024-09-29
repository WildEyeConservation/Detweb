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
import {fetchAllPaginatedResults} from "./utils";


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
    const allImages : {image: {timestamp: number, id: string}}[]= await fetchAllPaginatedResults(
      client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
      { 
        imageSetId: selectedImageSets[0], 
        selectionSet: ['image.timestamp', 'image.id'] as const
      }
    );
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
