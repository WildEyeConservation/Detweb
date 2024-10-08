import React, { useState, useEffect, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { ManagementContext, GlobalContext, ProjectContext } from './Context';

interface CreateSubsetModalProps {
    show: boolean;
    handleClose: () => void;
    selectedImageSets: string[];
}

interface FileNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileNode[];
    loaded?: boolean;
    expanded?: boolean;
}

interface Subset {
    id: string;
    name: string;
    filePaths: string[];
}

const INITIAL_ITEMS_PER_PAGE = 10;
const LOAD_MORE_ITEMS = 20;

const FileStructureSubset: React.FC<CreateSubsetModalProps> = ({ show, handleClose, selectedImageSets }) => {
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!;
    const { imageSetsHook: { data: imageSets } } = useContext(ManagementContext)!;
    const [fileStructure, setFileStructure] = useState<FileNode[]>([]);
    const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [newSubsetName, setNewSubsetName] = useState('');
    const [subsets, setSubsets] = useState<Subset[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null); // State for selected file
    const [nextTokens, setNextTokens] = useState<{ [key: string]: string | null }>({});
    const [loadingAllItems, setLoadingAllItems] = useState<{ [key: string]: boolean }>({});
    const [loadingImageSetName, setLoadingImageSetName] = useState<string | null>(null);

    useEffect(() => {
        if (show && selectedImageSets.length > 0) {
            setLoading(true);
            const fetchInitialStructure = async () => {
                const allFileNodes: { [key: string]: FileNode[] } = {};
                const newNextTokens: { [key: string]: string | null } = {};
                for (const imageSetId of selectedImageSets) {
                    const { data: imageSetMemberships, nextToken }: { data: any[], nextToken?: string | null } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
                        imageSetId,
                        selectionSet: ['image.id', 'image.files.id', 'image.files.path'],
                        limit: INITIAL_ITEMS_PER_PAGE,
                    });

                    const fileNodes = imageSetMemberships.flatMap((membership: any) => {
                        if (membership.image && membership.image.files) {
                            return membership.image.files.map((file: any) => ({
                                id: file.id,
                                name: file.path.split('/').pop(),
                                path: file.path,
                                type: 'file',
                            }));
                        }
                        return [];
                    });
                    allFileNodes[imageSetId] = fileNodes;
                    newNextTokens[imageSetId] = nextToken;
                }
                const selectedImageSetNames = imageSets
                    .filter(({ id }) => selectedImageSets.includes(id))
                    .map(({ name }) => name);

                setFileStructure(selectedImageSets.map((imageSetId, index) => ({
                    id: imageSetId,
                    name: selectedImageSetNames[index],
                    path: `/root/${imageSetId}`,
                    type: 'directory',
                    children: allFileNodes[imageSetId],
                    loaded: true,
                    expanded: false
                })));
                setNextTokens(newNextTokens);
                setLoading(false);
            };
            fetchInitialStructure();
        }
    }, [show, selectedImageSets, client.models.ImageSetMembership, imageSets]);

    const handleNodeSelect = async (node: FileNode, isChecked: boolean) => {
        if (node.type === 'file') {
            setSelectedFilePaths(prev => isChecked ? [...prev, node.path] : prev.filter(path => path !== node.path));
            setSelectedFile(node); // Set the selected file
        } else if (node.type === 'directory') {
            if (isChecked && nextTokens[node.id]) {
                // Load all remaining items
                const allFileNodes = await loadAllItems(node.id, node.name);
                const allFilePaths = allFileNodes.map(file => file.path);
                setSelectedFilePaths(prev => [...new Set([...prev, ...allFilePaths])]);
            } else {
                const allFilePaths = node.children?.flatMap(child => child.type === 'file' ? [child.path] : []) || [];
                setSelectedFilePaths(prev => {
                    if (isChecked) {
                        return [...new Set([...prev, ...allFilePaths])];
                    } else {
                        return prev.filter(path => !allFilePaths.includes(path));
                    }
                });
            }
        }
    };

    const handleNodeExpand = (node: FileNode) => {
        if (node.type === 'directory') {
            const updatedFileStructure = fileStructure.map(rootNode => {
                if (rootNode.id === node.id) {
                    return { ...rootNode, expanded: !rootNode.expanded };
                }
                return rootNode;
            });
            setFileStructure(updatedFileStructure);
        }
    };

    const loadMoreItems = async (imageSetId: string) => {
        const nextToken = nextTokens[imageSetId];

        if (nextToken) {
            const { data: imageSetMemberships, nextToken: newNextToken }: { data: any[], nextToken?: string | null } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
                imageSetId,
                selectionSet: ['image.id', 'image.files.id', 'image.files.path'],
                nextToken,
                limit: LOAD_MORE_ITEMS,
            });

            const newFileNodes = imageSetMemberships.flatMap((membership: any) =>
                membership.image.files.map((file: any) => ({
                    id: file.id,
                    name: file.path.split('/').pop(),
                    path: file.path,
                    type: 'file',
                }))
            );

            setFileStructure(prev => prev.map(rootNode => {
                if (rootNode.id === imageSetId) {
                    return {
                        ...rootNode,
                        children: [...(rootNode.children || []), ...newFileNodes]
                    };
                }
                return rootNode;
            }));

            setNextTokens(prev => ({
                ...prev,
                [imageSetId]: newNextToken
            }));
        }
    };

    const handleNameSubmit = () => {
        if (newSubsetName && selectedFilePaths.length > 0) {
            const newSubset: Subset = {
                id: Date.now().toString(), // Generate a unique ID
                name: newSubsetName,
                filePaths: selectedFilePaths,
            };
            setSubsets([...subsets, newSubset]);
            setNewSubsetName('');
            setShowNamePrompt(false);
            setSelectedFilePaths([]);
        }
    };

    const createNewImageSet = async (name: string, filePaths: string[]) => {
        console.log(`Creating new ImageSet "${name}" with ${filePaths.length} files`);
        const subsetId = crypto.randomUUID();
        await Promise.all(filePaths.map(filePath =>
            client.models.ImageSetMembership.create({
                imageSetId: subsetId,
                imageId: filePath,
            })
        ));
        await client.models.ImageSet.create({
            id: subsetId,
            name: name,
            projectId: project.id 
        });
        console.log(`Created new ImageSet "${name}" with ${filePaths.length} files`);
    };

    const handleCreateSubsets = async () => {
        setShowNamePrompt(true);
    };

    const confirmCreateSubsets = async () => {
        for (const subset of subsets) {
            await createNewImageSet(subset.name, subset.filePaths);
        }
        setSubsets([]);
    };

    const loadAllItems = async (imageSetId: string, imageSetName: string) => {
        setLoadingAllItems(prev => ({ ...prev, [imageSetId]: true }));
        setLoadingImageSetName(imageSetName);
        let allFileNodes: FileNode[] = [];
        let nextToken = nextTokens[imageSetId];

        while (nextToken) {
            const { data: imageSetMemberships, nextToken: newNextToken }: { data: any[], nextToken?: string | null } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
                imageSetId,
                selectionSet: ['image.id', 'image.files.id', 'image.files.path'],
                nextToken,
                limit: LOAD_MORE_ITEMS,
            });

            const newFileNodes = imageSetMemberships.flatMap((membership: any) =>
                membership.image.files.map((file: any) => ({
                    id: file.id,
                    name: file.path.split('/').pop(),
                    path: file.path,
                    type: 'file',
                }))
            );

            allFileNodes = [...allFileNodes, ...newFileNodes];
            nextToken = newNextToken;
        }

        setFileStructure(prev => prev.map(rootNode => {
            if (rootNode.id === imageSetId) {
                return {
                    ...rootNode,
                    children: [...(rootNode.children || []), ...allFileNodes]
                };
            }
            return rootNode;
        }));

        setNextTokens(prev => ({
            ...prev,
            [imageSetId]: null
        }));

        setLoadingAllItems(prev => ({ ...prev, [imageSetId]: false }));
        setLoadingImageSetName(null);
        return allFileNodes;
    };

    const renderTreeNodes = (nodes: FileNode[]) => {
        return nodes.map(node => {
            const hasMoreItems = !!nextTokens[node.id];
            const isLoading = loadingAllItems[node.id];

            return (
                <div key={node.id} style={{ marginLeft: node.type === 'directory' ? '20px' : '40px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            marginBottom: '5px'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={node.type === 'file' ? selectedFilePaths.includes(node.path) : node.children?.every(child => selectedFilePaths.includes(child.path))}
                            onChange={(e) => handleNodeSelect(node, e.target.checked)}
                            style={{ marginRight: '5px' }}
                        />
                        {node.type === 'directory' ? (
                            <span onClick={() => handleNodeExpand(node)} style={{ marginRight: '5px' }}>
                                {node.expanded ? '-' : '+'}
                            </span>
                        ) : (
                            <img
                                src={node.path}
                                alt={node.name}
                                style={{ width: '50px', height: 'auto', marginRight: '5px' }}
                            />
                        )}
                        <span>{node.name}</span>
                    </div>
                    {node.children && node.expanded && (
                        <div style={{ marginLeft: '20px' }}>
                            {renderTreeNodes(node.children)}
                            {hasMoreItems && !isLoading && (
                                <div>
                                    <button onClick={() => loadMoreItems(node.id)}>Load more</button>
                                </div>
                            )}
                            {isLoading && <div>Loading all items...</div>}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <>
            <Modal show={show} onHide={handleClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Define file structure subsets</Modal.Title>
                </Modal.Header>
                <Modal.Body>
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
                            <span style={{ marginLeft: '10px' }}>Please be patient while file structure is loaded</span>
                        </div>
                    )}
                    {loadingImageSetName && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            zIndex: 1000
                        }}>
                            <Spinner animation="border" role="status">
                                <span className="sr-only">Loading...</span>
                            </Spinner>
                            <span style={{ marginTop: '10px' }}>Loading all items for {loadingImageSetName}</span>
                            <span>This may take a while for large image sets</span>
                        </div>
                    )}
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {renderTreeNodes(fileStructure)}
                    </div>
                    <p>Selected files: {selectedFilePaths.length}</p>
                    <p>Defined subsets: {subsets.length}</p>
                    <div>
                        {subsets.map((subset, index) => (
                            <div key={subset.id}>
                                <strong>{subset.name}</strong>: {subset.filePaths.length} files selected
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <Button
                            variant="primary"
                            onClick={handleCreateSubsets}
                            disabled={selectedFilePaths.length === 0}
                        >
                            Create subsets
                        </Button>
                        <Button
                            variant="success"
                            onClick={confirmCreateSubsets}
                            disabled={subsets.length === 0}
                            style={{ marginLeft: '10px' }}
                        >
                            Confirm Subsets
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

            <Modal show={!!selectedFile} onHide={() => setSelectedFile(null)} style={{ border: '2px solid #000' }}>
                <Modal.Header closeButton>
                    <Modal.Title>File Metadata</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedFile && (
                        <div>
                            <p><strong>ID:</strong> {selectedFile.id}</p>
                            <p><strong>Name:</strong> {selectedFile.name}</p>
                            <p><strong>Path:</strong> {selectedFile.path}</p>
                            <img
                                src={selectedFile.path}
                                alt={selectedFile.name}
                                style={{ width: '100%', height: 'auto', border: '1px solid #000', padding: '5px' }}
                            />
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setSelectedFile(null)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default FileStructureSubset;