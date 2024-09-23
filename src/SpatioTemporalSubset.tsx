import React, { useContext, useEffect, useState, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { GlobalContext } from './Context';
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    LayerGroup,
    LayersControl,
    FeatureGroup,
    useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { DateTime } from 'luxon';
import * as turf from '@turf/turf';
import L from 'leaflet';
import { getUrl } from 'aws-amplify/storage';
import Spinner from 'react-bootstrap/Spinner';

interface CreateSubsetModalProps {
    show: boolean;
    handleClose: () => void;
    selectedImageSets: string[];
}

interface ImageData {
    id: string;
    timestamp: string;
    latitude: number;
    longitude: number;
}

interface ImageSetData {
    id: string;
    name: string;
    images: ImageData[];
}

interface Subset {
    id: string;
    name: string;
    polygon: L.LatLngExpression[];
    imageIds: string[];
}

const FitBoundsToImages: React.FC<{ imageSetsData: ImageSetData[] }> = ({ imageSetsData }) => {
    const map = useMap();

    useEffect(() => {
        if (imageSetsData.length > 0) {
            const bounds = L.latLngBounds(imageSetsData.flatMap(imageSet => 
                imageSet.images.map(image => [image.latitude, image.longitude] as [number, number])
            ));
            map.fitBounds(bounds);
        }
    }, [imageSetsData, map]);

    return null;
};

const SpatiotemporalSubset: React.FC<CreateSubsetModalProps> = ({ show, handleClose, selectedImageSets }) => {
    const { client } = useContext(GlobalContext)!;
    const [imageSetsData, setImageSetsData] = useState<ImageSetData[]>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [newSubsetName, setNewSubsetName] = useState('');
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const [subsets, setSubsets] = useState<Subset[]>([]);
    const [currentPolygon, setCurrentPolygon] = useState<L.LatLngExpression[] | null>(null);
    const [imageFilenames, setImageFilenames] = useState<string[]>([]);
    const [imageURL, setImageURL] = useState<string|undefined>(undefined);
    const [loading, setLoading] = useState(true);

    const fetchFilenames = async (imageId: string) => {
        const { data: images } = await client.models.ImageFile.imagesByimageId({imageId})
        setImageFilenames(images.map(image => image.key));
        const path=images.find(image=>image.type=='image/jpeg')?.path
        if (path) {
            const { url } = await getUrl({ path: 'slippymaps/Add2024Sample/DSC00008.jpg/0/0/0.png', options: { bucket: 'outputs' } })
            setImageURL(url.toString())
        }
    };

    useEffect(() => {
        const fetchImagesData = async () => {
            if (selectedImageSets.length === 0) {
                setLoading(false);
                return;
            }

            const fetchedImageSets = await Promise.all(selectedImageSets.map(async (selectedSetId) => {
                let prevNextToken: string | null | undefined = undefined;
                let allImages: any[] = [];
                do {
                    const { data: images, nextToken } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
                        imageSetId: selectedImageSets[0],
                        selectionSet: ['image.timestamp', 'image.id','image.latitude','image.longitude'],
                        nextToken: prevNextToken
                    })
                  prevNextToken = nextToken
                  allImages = allImages.concat(images)
                } while (prevNextToken)            
                const {data:imageSet} = await client.models.ImageSet.get({ id: selectedSetId },
                    { selectionSet: ["id", "name"] }
                );
                return {
                    id: imageSet.id,
                    name: imageSet.name,
                    images: allImages.map(({ image }) => ({
                        id: image.id,
                        timestamp: image.timestamp || "",
                        latitude: image.latitude || 0,
                        longitude: image.longitude || 0,
                    }))
                };
            }));
            setImageSetsData(fetchedImageSets);
            setLoading(false);
        };
        setLoading(true);
        fetchImagesData();
    }, [selectedImageSets, client.models.ImageSet]);

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

    const handleCreated = (e: any) => {
        const { layer } = e;
        const drawnPolygon = layer.toGeoJSON();
        
        const selectedIds: string[] = [];
        imageSetsData.forEach(imageSet => {
            imageSet.images.forEach(image => {
                const point = turf.point([image.longitude ?? 0, image.latitude ?? 0]);
                if (turf.booleanPointInPolygon(point, drawnPolygon)) {
                    selectedIds.push(image.id);
                }
            });
        });
        
        setSelectedImageIds(selectedIds);
        setCurrentPolygon(layer.getLatLngs()[0]);
        setShowNamePrompt(true);

        // Remove the drawn layer
        featureGroupRef.current?.removeLayer(layer);
    };

    const handleEdited = (e: any) => {
        const { layers } = e;
        layers.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Polygon) {
                const editedPolygon = layer.getLatLngs()[0] as L.LatLngExpression[];
                const subsetId = (layer as any).subsetId;
                setSubsets(prevSubsets => 
                    prevSubsets.map(subset => 
                        subset.id === subsetId 
                            ? { ...subset, polygon: editedPolygon } 
                            : subset
                    )
                );
            }
        });
    };

    const handleDeleted = (e: any) => {
        const { layers } = e;
        layers.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Polygon) {
                const subsetId = (layer as any).subsetId;
                setSubsets(prevSubsets => prevSubsets.filter(subset => subset.id !== subsetId));
            }
        });
    };

    const handleNameSubmit = () => {
        if (newSubsetName && currentPolygon) {
            const newSubset: Subset = {
                id: Date.now().toString(), // Generate a unique ID
                name: newSubsetName,
                polygon: currentPolygon,
                imageIds: selectedImageIds,
            };
            setSubsets([...subsets, newSubset]);
            setNewSubsetName('');
            setShowNamePrompt(false);
            setSelectedImageIds([]);
            setCurrentPolygon(null);

            // Add the new subset polygon to the FeatureGroup
            if (featureGroupRef.current) {
                const layer = L.polygon(newSubset.polygon);
                (layer as any).subsetId = newSubset.id;
                layer.bindTooltip(newSubset.name, { permanent: true });
                featureGroupRef.current.addLayer(layer);
            }
        }
    };

    const createNewImageSet = (name: string, imageIds: string[]) => {
        // This function will be implemented to create a new ImageSet
        console.log(`Creating new ImageSet "${name}" with ${imageIds.length} images`);
        // Implement the actual creation logic here
    };

    const handleCreateSubsets = () => {
        subsets.forEach(subset => {
            createNewImageSet(subset.name, subset.imageIds);
        });
        // Clear subsets after creation
        setSubsets([]);
        // You might want to show a success message or close the modal here
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleNameSubmit();
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Define spatiotemporal subsets</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div style={{ height: '500px', width: '100%', position: 'relative' }}>
                    {loading && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            zIndex: 1000
                        }}>
                            <Spinner animation="border" role="status">
                                <span className="sr-only">Loading...</span>
                            </Spinner>
                            <span style={{ marginLeft: '10px' }}>Please be patient while geodata is loaded</span>
                        </div>
                    )}
                    <MapContainer
                        style={{ height: '100%', width: '100%' }}
                        center={[0, 0]}
                        zoom={2}
                        scrollWheelZoom={true}
                    >
                        <FitBoundsToImages imageSetsData={imageSetsData} />
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
                                        drawError: {
                                            color: '#e1e100',
                                            message: '<strong>Oh snap!<strong> you can\'t draw that!'
                                        },
                                        shapeOptions: {
                                            color: '#97009c'
                                        }
                                    },
                                    rectangle: false,
                                    circle: false,
                                    circlemarker: false,
                                    marker: false,
                                    polyline: false,
                                }}
                                edit={{
                                    edit: {
                                        selectedPathOptions: {
                                            maintainColor: true,
                                            opacity: 0.3
                                        }
                                    },
                                    remove: {
                                        selectedPathOptions: {
                                            maintainColor: true,
                                            opacity: 0.3
                                        }
                                    },
                                    featureGroup: featureGroupRef.current,
                                }}
                            />
                        </FeatureGroup>
                        <LayersControl position="topright">
                            {imageSetsData.map((imageSet, index) => (
                                <LayersControl.Overlay key={imageSet.id} name={imageSet.name} checked>
                                    <LayerGroup>
                                        {imageSet.images.map((image) => (
                                            <CircleMarker
                                                key={image.id}
                                                center={[image.latitude, image.longitude]}
                                                radius={3}
                                                pathOptions={{ fillColor: selectedImageIds.includes(image.id) ? '#000000' : colors[index % colors.length] }}
                                                color="#000"
                                                weight={1}
                                                opacity={1}
                                                fillOpacity={0.8}
                                            >
                                                <Popup
                                                    eventHandlers={{
                                                        add: () => fetchFilenames(image.id),
                                                    }}
                                                >
                                                    ImageSet: {imageSet.name}<br />
                                                    ID: {image.id}<br />
                                                    Timestamp: {DateTime.fromSeconds(image.timestamp).toFormat("yyyy-MM-dd HH:mm:ss")}<br />
                                                    Associated Filenames: {imageFilenames.length > 0 ? imageFilenames.join('\n').replace(/\n/g, '<br />') : 'Loading...'}
                                                    {imageURL && <img src={imageURL} alt={image.id} style={{ width: '256px', height: 'auto', objectFit: 'none', objectPosition: '0 0', width: '149px', height: '99px' }} />}
                                                </Popup>
                                            </CircleMarker>
                                        ))}
                                    </LayerGroup>
                                </LayersControl.Overlay>
                            ))}
                        </LayersControl>
                    </MapContainer>
                </div>
                <div>
                    {imageSetsData.map((imageSet, index) => (
                        <div key={imageSet.id} style={{ display: 'inline-block', marginRight: '10px' }}>
                            <span style={{ 
                                display: 'inline-block', 
                                width: '10px', 
                                height: '10px', 
                                backgroundColor: colors[index % colors.length], 
                                marginRight: '5px' 
                            }}></span>
                            {imageSet.name}
                        </div>
                    ))}
                </div>
                <p>Selected images: {selectedImageIds.length}</p>
                <p>Defined subsets: {subsets.length}</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <Button 
                        variant="primary" 
                        onClick={handleCreateSubsets} 
                        disabled={subsets.length === 0}
                    >
                        Create subsets
                    </Button>
                </div>
            </Modal.Body>
            <Modal show={showNamePrompt} onHide={() => setShowNamePrompt(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Name Your New Subset</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Subset Name</Form.Label>
                        <Form.Control 
                            type="text" 
                            value={newSubsetName}
                            onChange={(e) => setNewSubsetName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter a name for your new subset"
                            autoFocus
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowNamePrompt(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleNameSubmit}>
                        Create Subset
                    </Button>
                </Modal.Footer>
            </Modal>
        </Modal>
    );
};

export default SpatiotemporalSubset;