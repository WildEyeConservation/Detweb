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
    const [selectedImageIds, setselectedImageIds] = useState<string[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [newSubsetName, setNewSubsetName] = useState('');
    const [subsets, setSubsets] = useState<Subset[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [nextTokens, setNextTokens] = useState<{ [key: string]: string | null }>({});
    const [loadingAllItems, setLoadingAllItems] = useState<{ [key: string]: boolean }>({});
    const [loadingImageSetName, setLoadingImageSetName] = useState<string | null>(null);

    // Utility function to build a tree from file paths
    const buildFileTree = (fileNodes: FileNode[]): FileNode[] => {
        const root: FileNode = {
            id: 'root',
            name: 'Root',
            path: '/root',
            type: 'directory',
            children: [],
            loaded: true,
            expanded: true
        };

        fileNodes.forEach(file => {
            const parts = file.path.split('/').filter(part => part !== '');
            let current = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                const existingNode = current.children?.find(child => child.name === part && child.type === (isFile ? 'file' : 'directory'));

                if (isFile) {
                    // It's a file
                    if (!existingNode) {
                        current.children?.push({
                            id: file.id,
                            name: part,
                            path: file.path, // Keeping the path as is for file nodes
                            type: 'file'
                        });
                    }
                } else {
                    // It's a directory
                    if (!existingNode) {
                        const newDir: FileNode = {
                            id: crypto.randomUUID(),
                            name: part,
                            path: parts.slice(0, index + 1).join('/'),
                            type: 'directory',
                            children: [],
                            loaded: true,
                            expanded: false
                        };
                        current.children?.push(newDir);
                        current = newDir;
                    } else {
                        current = existingNode;
                    }
                }
            });
        });

        console.log("Built File Tree:", JSON.stringify(root, null, 2)); // Debugging Log

        return root.children || [];
    };

    useEffect(() => {
        if (show && selectedImageSets.length > 0) {
            console.log("Selected ImageSet IDs:", selectedImageSets);
            setLoading(true);
            const fetchInitialStructure = async () => {
                const allFileNodes: { [key: string]: FileNode[] } = {};
                const newNextTokens: { [key: string]: string | null } = {};

                for (const imageSetId of selectedImageSets) {
                    let nextToken: string | null = null;
                    let accumulatedFileNodes: FileNode[] = [];

                    do {
                        try {
                            //console.log(`Fetching files for ImageSet ID: ${imageSetId} with nextToken: ${nextToken}`);
                            const response = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
                                imageSetId,
                                selectionSet: ['image.id', 'image.files.path'],
                                nextToken: nextToken,
                            });

                            const { data: imageSetMemberships, nextToken: newNextToken } = response;

                            //console.log(`Received ${imageSetMemberships.length} memberships for ImageSet ID: ${imageSetId}`);

                            const fileNodes = imageSetMemberships.flatMap((membership: any) => {
                                if (membership.image && membership.image.files) {
                                    return membership.image.files.map((file: any) => ({
                                        id: membership.image.id,
                                        name: file.path.split('/').pop() || file.path,
                                        path: file.path.replace(`${imageSetId}/`, ''), // Ensure paths are relative
                                        type: 'file',
                                    }));
                                }
                                return [];
                            });

                            //console.log(`Extracted ${fileNodes.length} file nodes for ImageSet ID: ${imageSetId}`);

                            accumulatedFileNodes = accumulatedFileNodes.concat(fileNodes);
                            nextToken = newNextToken || null;
                        } catch (error) {
                            //console.error(`Error fetching files for ImageSet ID: ${imageSetId}`, error);
                            nextToken = null;
                        }
                    } while (nextToken);

                    allFileNodes[imageSetId] = accumulatedFileNodes;
                    newNextTokens[imageSetId] = nextToken;
                }

                const selectedImageSetNames = imageSets
                    ?.filter(({ id }) => selectedImageSets.includes(id))
                    .map(({ name }) => name) || [];

                const structuredFileNodes = selectedImageSets.map((imageSetId, index) => ({
                    id: imageSetId,
                    name: selectedImageSetNames[index],
                    path: selectedImageSetNames[index], // Remove the '/images/' prefix
                    type: 'directory',
                    children: buildFileTree(allFileNodes[imageSetId]),
                    loaded: true,
                    expanded: false
                }));

                //console.log("Structured File Nodes:", JSON.stringify(structuredFileNodes, null, 2));

                setFileStructure(structuredFileNodes);
                setNextTokens(newNextTokens);
                setLoading(false);
            };
            fetchInitialStructure();
        }
    }, [show, selectedImageSets, client.models.ImageSetMembership, imageSets]);

    const handleNodeSelect = async (node: FileNode, isChecked: boolean) => {
        if (node.type === 'file') {
            setselectedImageIds(prev => isChecked ? [...prev, node.id] : prev.filter(path => path !== node.id));
            setSelectedFile(node);
        } else if (node.type === 'directory') {
            if (isChecked) {
                // Select all child files
                const allIds = getAllImageIds(node);
                setselectedImageIds(prev => [...new Set([...prev, ...allIds])]);
            } else {
                // Deselect all child files
                const allIds = getAllImageIds(node);
                setselectedImageIds(prev => prev.filter(id => !allIds.includes(id)));
            }
        }
    };

    const getAllFilePaths = (node: FileNode): string[] => {
        let paths: string[] = [];
        if (node.type === 'file') {
            paths.push(node.path);
        } else if (node.children) {
            node.children.forEach(child => {
                paths = paths.concat(getAllFilePaths(child));
            });
        }
        return paths;
    };

    const getAllImageIds = (node: FileNode): string[] => {
        let ids: string[] = [];
        if (node.type === 'file') {
            ids.push(node.id);
        } else if (node.children) {
            node.children.forEach(child => {
                ids = ids.concat(getAllImageIds(child));
            });
        }
        return ids;
    };


    const toggleNodeExpansion = (nodes: FileNode[], targetId: string): FileNode[] => {
        return nodes.map(node => {
            if (node.id === targetId) {
                return { ...node, expanded: !node.expanded };
            }
            if (node.children) {
                return { ...node, children: toggleNodeExpansion(node.children, targetId) };
            }
            return node;
        });
    };

    const handleNodeExpand = (node: FileNode) => {
        if (node.type === 'directory') {
            setFileStructure(prev => toggleNodeExpansion(prev, node.id));
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
                    path: file.path.replace(`${imageSetId}/`, ''), // Ensure paths are relative
                    type: 'file',
                }))
            );

            const updatedStructuredFileNodes = buildFileTree(newFileNodes);

            setFileStructure(prev => prev.map(rootNode => {
                if (rootNode.id === imageSetId) {
                    return {
                        ...rootNode,
                        children: [...(rootNode.children || []), ...updatedStructuredFileNodes]
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
        if (newSubsetName && selectedImageIds.length > 0) {
            const newSubset: Subset = {
                id: Date.now().toString(),
                name: newSubsetName,
                ids: selectedImageIds,
            };
            setSubsets([...subsets, newSubset]);
            setNewSubsetName('');
            setShowNamePrompt(false);
            setselectedImageIds([]);
        }
    };

    const createNewImageSet = async (name: string, imageIds: string[]) => { 
        //console.log(`Creating new ImageSet "${name}" with ${imageIds.length} images`); // Updated log message
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
            projectId: project.id,
            imageCount: imageIds.length
        });
        //console.log(`Created new ImageSet "${name}" with ${filePaths.length} files`);
    };

    const handleCreateSubsets = async () => {
        setShowNamePrompt(true);
    };

    const confirmCreateSubsets = async () => {
        for (const subset of subsets) {
            await createNewImageSet(subset.name, subset.ids);
        }
        setSubsets([]);
    };

    const renderTreeNodes = (nodes: FileNode[], isRoot = true) => {
        return nodes.map(node => {
            const hasMoreItems = !!nextTokens[node.id];
            const isLoading = loadingAllItems[node.id];

            // Only skip rendering for non-root nodes if the name is empty or the same as its path
            if (!isRoot && (!node.name || (node.path === node.name))) {
                return node.children ? renderTreeNodes(node.children, false) : null;
            }

            return (
                <div key={node.id} style={{ marginLeft: isRoot ? '0' : '20px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: node.type === 'directory' ? 'pointer' : 'default',
                            marginBottom: '5px'
                        }}
                    >
                        {node.type === 'directory' && (
                            <>
                                <input
                                    type="checkbox"
                                    checked={node.children ? node.children.every(child => selectedImageIds.includes(child.id)) : false}
                                    onChange={(e) => handleNodeSelect(node, e.target.checked)}
                                    style={{ marginRight: '5px' }}
                                />
                                <span onClick={() => handleNodeExpand(node)} style={{ marginRight: '5px' }}>
                                    {node.expanded ? '-' : '+'}
                                </span>
                                <span>{node.name}</span>
                            </>
                        )}
                        {node.type === 'file' && (
                            <>
                                <input
                                    type="checkbox"
                                    checked={selectedImageIds.includes(node.id)}
                                    onChange={(e) => handleNodeSelect(node, e.target.checked)}
                                    style={{ marginRight: '5px' }}
                                />
                                <img
                                    src={node.path}
                                    alt={node.name}
                                    style={{ width: '50px', height: 'auto', marginRight: '5px' }}
                                />
                                <span>{node.name}</span>
                            </>
                        )}
                    </div>
                    {node.children && node.expanded && (
                        <div style={{ marginLeft: '20px' }}>
                            {renderTreeNodes(node.children, false)}
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
        }).filter(Boolean); // Remove any null entries
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
                        {renderTreeNodes(fileStructure, true)}
                    </div>
                    <p>Selected files: {selectedImageIds.length}</p>
                    <p>Defined subsets: {subsets.length}</p>
                    <div>
                        {subsets.map((subset, index) => (
                            <div key={subset.id}>
                                <strong>{subset.name}</strong>: {subset.ids.length} files selected
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <Button
                            variant="primary"
                            onClick={handleCreateSubsets}
                            disabled={selectedImageIds.length === 0}
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
