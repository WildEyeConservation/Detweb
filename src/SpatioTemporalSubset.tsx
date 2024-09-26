import React, { useContext, useEffect, useState, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { ProjectContext, GlobalContext } from './Context';
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
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface CreateSubsetModalProps {
    show: boolean;
    handleClose: () => void;
    selectedImageSets: string[];
}

interface ImageData {
    id: string;
    timestamp: string | number;
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
    const { project } = useContext(ProjectContext)!;
    const [imageSetsData, setImageSetsData] = useState<ImageSetData[]>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [newSubsetName, setNewSubsetName] = useState('');
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const [subsets, setSubsets] = useState<Subset[]>([]);
    const [currentPolygon, setCurrentPolygon] = useState<L.LatLngExpression[] | null>(null);
    const [imageFilenames, setImageFilenames] = useState<string[]>([]);
    const [imageURL, setImageURL] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [sliderRange, setSliderRange] = useState<[number, number]>([0, 24]);
    const [timeRanges, setTimeRanges] = useState<[number, number][]>([[0, 24]]);
    const [filteredImages, setFilteredImages] = useState<ImageData[]>([]);
    const [isMultipleRange, setIsMultipleRange] = useState(false);
    const [showNameEditPrompt, setShowNameEditPrompt] = useState(false);
    const [editedSubsets, setEditedSubsets] = useState<Subset[]>([]);

    const fetchFilenames = async (imageId: string) => {
        const { data: images } = await client.models.ImageFile.imagesByimageId({ imageId });
        setImageFilenames(images.map(image => image.key));
        const path = images.find(image => image.type == 'image/jpeg')?.path;
        if (path) {
            const { url } = await getUrl({ path: 'slippymaps/' + path + '/0/0/0.png', options: { bucket: 'outputs' } });
            setImageURL(url.toString());
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
                        imageSetId: selectedSetId,
                        selectionSet: ['image.timestamp', 'image.id', 'image.latitude', 'image.longitude'],
                        nextToken: prevNextToken
                    });
                    prevNextToken = nextToken;
                    allImages = allImages.concat(images);
                } while (prevNextToken);
                const { data: imageSet } = await client.models.ImageSet.get({ id: selectedSetId },
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

            // Calculate the min and max time from the fetched images
            const allTimestamps = fetchedImageSets.flatMap(imageSet =>
                imageSet.images.map(image => {
                    if (typeof image.timestamp === 'string') {
                        return DateTime.fromFormat(image.timestamp, "yyyy-MM-dd HH:mm:ss").toMillis();
                    } else if (typeof image.timestamp === 'number') {
                        return DateTime.fromMillis(image.timestamp * 1000).toMillis(); // Assuming the number is in seconds
                    } else {
                        console.error("Invalid timestamp format:", image.timestamp);
                        return 0;
                    }
                })
            );
            const minTime = Math.min(...allTimestamps);
            const maxTime = Math.max(...allTimestamps);

            setSliderRange([minTime, maxTime]);
            setTimeRanges([[minTime, maxTime]]);

            setLoading(false);
        };
        setLoading(true);
        fetchImagesData();
    }, [selectedImageSets, client.models.ImageSet]);

    useEffect(() => {
        const filteredImages = imageSetsData.flatMap(imageSet =>
            imageSet.images.filter(image => {
                let imageTime;
                if (typeof image.timestamp === 'string') {
                    imageTime = DateTime.fromFormat(image.timestamp, "yyyy-MM-dd HH:mm:ss").toMillis();
                } else if (typeof image.timestamp === 'number') {
                    imageTime = DateTime.fromMillis(image.timestamp * 1000).toMillis(); // Assuming the number is in seconds
                } else {
                    console.error("Invalid timestamp format:", image.timestamp);
                    return false;
                }
                return timeRanges.some(range => imageTime >= range[0] && imageTime <= range[1]);
            })
        );
        setFilteredImages(filteredImages);

        // Automatically create subsets based on the time ranges
        const newSubsets = timeRanges.map((range, index) => {
            const subsetImages = filteredImages.filter(image => {
                let imageTime;
                if (typeof image.timestamp === 'string') {
                    imageTime = DateTime.fromFormat(image.timestamp, "yyyy-MM-dd HH:mm:ss").toMillis();
                } else if (typeof image.timestamp === 'number') {
                    imageTime = DateTime.fromMillis(image.timestamp * 1000).toMillis(); // Assuming the number is in seconds
                } else {
                    console.error("Invalid timestamp format:", image.timestamp);
                    return false;
                }
                return imageTime >= range[0] && imageTime <= range[1];
            });

            return {
                id: Date.now().toString() + index, // Generate a unique ID
                name: `Subset ${index + 1}`,
                polygon: [], // No polygon needed
                imageIds: subsetImages.map(image => image.id),
            };
        });


        setSubsets(newSubsets);
    }, [imageSetsData, timeRanges]);

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

    const createNewImageSet = async (name: string, imageIds: string[]) => {
        // This function will be implemented to create a new ImageSet
        console.log(`Creating new ImageSet "${name}" with ${imageIds.length} images`);
        // Implement the actual creation logic here
        const subsetId = crypto.randomUUID();
        await Promise.all(imageIds.map(imageId =>
            client.models.ImageSetMembership.create({
                imageSetId: subsetId,
                imageId: imageId,
            })
        ));
        await client.models.ImageSet.create({
            id: subsetId,
            name: name,
            projectId: project.id
        });
        console.log(`Created new ImageSet "${name}" with ${imageIds.length} images`);
    };

    const handleCreateSubsets = () => {
        setEditedSubsets(subsets);
        setShowNameEditPrompt(true);
    };

    const handleNameEditChange = (index: number, newName: string) => {
        const updatedSubsets = [...editedSubsets];
        updatedSubsets[index].name = newName;
        setEditedSubsets(updatedSubsets);
    };

    const handleConfirmSubsets = () => {
        editedSubsets.forEach(subset => {
            createNewImageSet(subset.name, subset.imageIds);
        });
        // Clear subsets after creation
        setSubsets([]);
        setShowNameEditPrompt(false);
        // Reset time ranges to the initial one
        setTimeRanges([sliderRange]);
        setIsMultipleRange(false);
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleNameSubmit();
        }
    };

    const handleSliderChange = (range: [number, number], index: number) => {
        const newTimeRanges = [...timeRanges];
        newTimeRanges[index] = range;
        setTimeRanges(newTimeRanges);
    };

    const addRange = () => {
        setTimeRanges([...timeRanges, sliderRange]);
    };

    const removeRange = (index: number) => {
        const newTimeRanges = timeRanges.filter((_, i) => i !== index);
        setTimeRanges(newTimeRanges);
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
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="OpenStreetMap">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                />
                            </LayersControl.BaseLayer>
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
                            {imageSetsData.map((imageSet, index) => (
                                <LayersControl.Overlay key={imageSet.id} name={imageSet.name} checked>
                                    <LayerGroup>
                                        {filteredImages.map((image) => (
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
                                                    <div style={{ textAlign: 'center' }}>
                                                        ImageSet: {imageSet.name}<br />
                                                        Timestamp: {typeof image.timestamp === 'string' ? DateTime.fromFormat(image.timestamp, "yyyy-MM-dd HH:mm:ss").toFormat("yyyy-MM-dd HH:mm:ss") : DateTime.fromMillis(image.timestamp * 1000).toFormat("yyyy-MM-dd HH:mm:ss")}<br />
                                                        {imageURL && (
                                                            <>
                                                                <img
                                                                    src={imageURL}
                                                                    alt={image.id}
                                                                    style={{
                                                                        width: '149px',
                                                                        height: '99px',
                                                                        objectFit: 'none',
                                                                        objectPosition: '0 0',
                                                                        display: 'inline-block'
                                                                    }}
                                                                /><br /></>
                                                        )}
                                                        Associated Filenames: {imageFilenames.length > 0 ? imageFilenames.join('\n').replace(/\n/g, '<br />') : 'Loading...'}
                                                    </div>
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
                <div style={{ margin: '20px 0' }}>
                    {timeRanges.map((range, index) => (
                        <div key={index} style={{ marginBottom: '10px' }}>
                            <Slider
                                range
                                min={sliderRange[0]}
                                max={sliderRange[1]}
                                value={range}
                                onChange={(value) => handleSliderChange(value as [number, number], index)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{DateTime.fromMillis(range[0]).toFormat('yyyy-MM-dd HH:mm:ss')}</span>
                                <span>{DateTime.fromMillis(range[1]).toFormat('yyyy-MM-dd HH:mm:ss')}</span>
                            </div>
                            <Button variant="danger" size="sm" onClick={() => removeRange(index)}>Remove</Button>
                        </div>
                    ))}
                    <Button variant="primary" onClick={addRange}>Add Range</Button>
                </div>
                <p>Defined subsets: {subsets.length}</p>
                <div>
                    {subsets.map((subset, index) => (
                        <div key={subset.id}>
                            <strong>{subset.name}</strong>: {subset.imageIds.length} images selected
                        </div>
                    ))}
                </div>
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
            <Modal show={showNameEditPrompt} onHide={() => setShowNameEditPrompt(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Subset Names</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editedSubsets.map((subset, index) => (
                        <Form.Group key={index}>
                            <Form.Label>Subset {index + 1} Name</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={subset.name}
                                onChange={(e) => handleNameEditChange(index, e.target.value)}
                                placeholder={`Enter a name for Subset ${index + 1}`}
                            />
                        </Form.Group>
                    ))}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowNameEditPrompt(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleConfirmSubsets}>
                        Confirm Subsets
                    </Button>
                </Modal.Footer>
            </Modal>
        </Modal>
    );
};

export default SpatiotemporalSubset;