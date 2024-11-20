import { useParams } from 'react-router-dom';
import { useEffect, useState, useMemo, useContext } from 'react';
import { PreloaderFactory } from './Preloader';
import { client } from './optimisticExperiment';
import BufferSource from './BufferSource';
import AnnotationImage from './AnnotationImage';
import { AnnotationSetDropdown } from './AnnotationSetDropdown';
import Select, { MultiValue, Options  } from "react-select";
import { ProjectContext } from './Context';
import { Form } from 'react-bootstrap';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import './Review.css';

export function Review() {
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedAnnotationSet, setSelectedAnnotationSet] = useState<string>('');
    const [imageBased, setImageBased] = useState(true);
    const [chronological, setChronological] = useState(false);
    const [annotations, setAnnotations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { categoriesHook: { data: categories } } = useContext(ProjectContext)!;
    const [locationsLoaded, setLocationsLoaded] = useState(0);

    useEffect(() => {
        async function fetchAnnotations() {
            let nextNextToken: string | null | undefined = undefined;
            do {
                const result = await client.models.Annotation.annotationsByCategoryId(
                    { categoryId: categoryId ?? "" },
                    { selectionSet: ['x', 'y', 'image.id', 'image.width', 'image.height', 'image.timestamp'], filter: { setId: { eq: annotationSetId } }, nextToken: nextNextToken });
                const { data, nextToken } = result;
                setAnnotations(prev=>[...prev,...(
                    data.map(({ x, y, image: { id: imageId, width: imageWidth, height: imageHeight } }) =>
                        ({ location: { x, y, width: 100, height: 100, image: { id: imageId, width: imageWidth, height: imageHeight }, annotationSetId },id: crypto.randomUUID() })
                    ))]);
                nextNextToken = nextToken;
            } while (nextNextToken);
            setIsLoading(false);
        }

        async function fetchImages() {
            if (selectedCategories.length && selectedAnnotationSet) {
                setIsLoading(true);
                let imagesFound: Set<string> = new Set();
                const locations=[]
                for (const { value: categoryId } of selectedCategories) {
                let nextNextToken: string | null | undefined = undefined;
                do {
                    const result = await client.models.Annotation.annotationsByCategoryId(
                        { categoryId: categoryId ?? "" },
                        { selectionSet: ['image.id', 'image.width', 'image.height', 'image.timestamp'], filter: { setId: { eq: selectedAnnotationSet } }, nextToken: nextNextToken });
                    const { data, nextToken } = result;
                    data.forEach(({ image: { id: imageId, width: imageWidth, height: imageHeight,timestamp } }) => {
                        if (!imagesFound.has(imageId)) {
                            imagesFound.add(imageId);
                            locations.push({location: {
                                        x: imageWidth / 2,
                                        y: imageHeight / 2,
                                        width: imageWidth,
                                        height: imageHeight,
                                        image: { id: imageId, width: imageWidth, height: imageHeight,timestamp: timestamp },
                                        annotationSetId: selectedAnnotationSet
                                },
                                taskTag: 'review',
                                    id: crypto.randomUUID()
                            })
                            setLocationsLoaded(prev=>prev+1);
                        }
                    });
                    nextNextToken = nextToken;
                    } while (nextNextToken);
                }
                setAnnotations(locations.sort((a,b)=>a.location.image.timestamp-b.location.image.timestamp));
            }
            setIsLoading(false);
        }

        if (selectedCategories.length && selectedAnnotationSet) {
            if (imageBased) {
                fetchImages();
            } else {
                fetchAnnotations();
            }
        }
        return () => {
            setAnnotations([]);
            setIsLoading(false);
            setLocationsLoaded(0);
        };
}, [selectedCategories, selectedAnnotationSet, imageBased]);
    
    const fetcher = BufferSource(annotations);
    const Preloader = useMemo(() => PreloaderFactory(AnnotationImage), []);
    return (
        <div style={{ 
            display: 'flex', 
            marginTop: '1rem',
            flexDirection: 'column', 
            alignItems: 'center',
            width: '100%',
            gap: '1rem'  // Adds vertical spacing between components
          }}>    
            <div className="controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px' }}>
                <Select
                    value={selectedCategories}
                    onChange={setSelectedCategories}
                    isMulti
                    name="Categories to review"
                    options={categories?.map(q => ({ label: q.name, value: q.id }))}
                    className="basic-multi-select category-select"
                    classNamePrefix="select"
                    closeMenuOnSelect={false}
                    styles={{
                        valueContainer: (base) => ({
                            ...base,
                            maxHeight: '100px',
                            overflowY: 'auto',
                        }),
                    }}
                />
                <AnnotationSetDropdown
                    selectedSet={selectedAnnotationSet}
                    setAnnotationSet={setSelectedAnnotationSet}
                    canCreate={false}
                />
            </div>

            {!annotations.length && isLoading ? (
                <div>Loading... Please be patient. {locationsLoaded} locations loaded so far...</div>
            ) : (
                <Preloader key={selectedAnnotationSet+selectedCategories.join(',')} fetcher={fetcher} preloadN={2} historyN={2} />
            )}
        </div>
    );
}