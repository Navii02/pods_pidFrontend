/* eslint-disable no-restricted-globals */

// meshProcessingWorker.js - Fixed version with proper error handling


// meshProcessingWorker.js - Complete version with both new and legacy functions

const TARGET_DEPTH = 4;
const COVERAGE_THRESHOLDS = {
    LARGE: 1,
    MEDIUM: 0.3,
    SMALL: 0.3
};


self.onmessage = async function(e) {
    const { type, data, messageId } = e.data;
    
    try {
        switch (type) {
            case 'TEST':
                console.log('Worker: Handling test message');
                self.postMessage({ 
                    type: 'TEST_RESPONSE',
                    messageId 
                });
                break;
                
            case 'PROCESS_OCTREE_STRUCTURE':
                const octreeResult = await processOctreeStructure(data);
                self.postMessage({ 
                    type: 'OCTREE_STRUCTURE_COMPLETE', 
                    data: octreeResult,
                    messageId
                });
                break;
                
            case 'PROCESS_MODEL_CHUNK':
                const chunkResult = await processModelChunk(data);
                self.postMessage({ 
                    type: 'MODEL_CHUNK_COMPLETE', 
                    data: chunkResult,
                    messageId
                });
                break;
                
            // YOUR ORIGINAL FUNCTIONS
            case 'PROCESS_MESH_CATEGORIZATION':
                const categorizationResult = await processMeshCategorization(data);
                self.postMessage({ 
                    type: 'CATEGORIZATION_COMPLETE', 
                    data: categorizationResult,
                    messageId
                });
                break;
                
            case 'PROCESS_OVERLAPPING':
                const overlapResult = await processOverlappingInWorker(data);
                self.postMessage({ 
                    type: 'OVERLAP_PROCESSING_COMPLETE', 
                    data: overlapResult,
                    messageId
                });
                break;
                
            default:
                console.error('Worker: Unknown message type:', type);
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({ 
            type: 'ERROR', 
            error: error.message,
            stack: error.stack,
            messageId
        });
    }
};

// NEW: Process octree structure only (for chunked processing)
async function processOctreeStructure({ octreeData }) {
    console.log('Extracting octree structure...');
    
    const nodesByDepth = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    const stack = [{block: octreeData.blockHierarchy, depth: 0}];
    
    let totalNodes = 0;
    
    while (stack.length > 0) {
        const {block, depth} = stack.pop();
        
        if (depth <= 4) {
            nodesByDepth[depth].push({
                nodeNumber: block.properties.nodeNumber,
                meshIds: block.meshInfos ? block.meshInfos.map(info => info.id) : [],
                bounds: block.bounds,
                depth: depth
            });
            
            totalNodes++;
            
            if (block.relationships?.childBlocks) {
                stack.push(...block.relationships.childBlocks.map(child => ({
                    block: child,
                    depth: depth + 1
                })));
            }
        }
    }
    
       
    return { nodesByDepth };
}

// NEW: Process a chunk of models (for chunked processing)
// Process a chunk of models (for chunked processing)
async function processModelChunk({ modelChunk, nodesByDepth }) {
   
    
    const finalPlacement = {
        depth0: [],
        depth1: [],
        depth2: [],
        depth3: [],
        depth4: []
    };
    
    let processedCount = 0;
    let categorizedCount = 0;
    let skippedNoData = 0;
    let skippedNoCategory = 0;
    
    // Categorize models in this chunk
    for (const model of modelChunk) {
        processedCount++;
        
        if (!model.screenCoverage) {
            skippedNoData++;
            continue;
        }
        
        const category = categorizeModel(model.screenCoverage);
        if (!category) {
            skippedNoCategory++;
            continue;
        }
        
        categorizedCount++;
        
        // Find appropriate placement
        const placement = findModelPlacement(model, category, nodesByDepth);
        
        if (placement) {
            finalPlacement[`depth${placement.placedDepth}`].push({
                meshId: model.id,
                category: category,
                screenCoverage: model.screenCoverage,
                originalNodeNumber: placement.originalNode,
                originalDepth: placement.originalDepth,
                placedNodeNumber: placement.placedNode,
                placedDepth: placement.placedDepth,
                bounds: model.bounds
            });
        }
        
        // Report progress every 100 models
        if (processedCount % 100 === 0) {
            self.postMessage({ 
                type: 'PROGRESS', 
                data: { 
                    stage: `PROCESSING_CHUNK`,
                    progress: (processedCount / modelChunk.length) * 100
                }
            });
        }
    }
    
   
    return { 
        finalPlacement,
        stats: {
            processedCount,
            categorizedCount,
            skippedNoData,
            skippedNoCategory
        }
    };
}
// YOUR ORIGINAL FUNCTIONS BELOW:

// Main processing function for mesh categorization
async function processMeshCategorization({ octreeData, modelMap }) {
    self.postMessage({ type: 'PROGRESS', data: { stage: 'COLLECTING_NODES', progress: 0 } });
    

    // Step 1: Collect all nodes at all depths
    const nodesByDepth = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    const stack = [{block: octreeData.blockHierarchy, depth: 0}];

    while (stack.length > 0) {
        const {block, depth} = stack.pop();

        if (depth <= 4) {
            nodesByDepth[depth].push({
                block: block,
                nodeNumber: block.properties.nodeNumber,
                meshIds: block.meshInfos ? block.meshInfos.map(info => info.id) : [],
                bounds: block.bounds
            });

            if (block.relationships?.childBlocks) {
                stack.push(...block.relationships.childBlocks.map(child => ({
                    block: child,
                    depth: depth + 1
                })));
            }
        }
    }

    self.postMessage({ type: 'PROGRESS', data: { stage: 'CATEGORIZING_MESHES', progress: 25 } });

    // Process each depth for categorization
    const largeMeshes = {};
    const mediumMeshes = {};
    const smallMeshes = {};

    // Process depth 2 for large meshes
    await categorizeAtDepth(nodesByDepth[2], 2, modelMap, largeMeshes, 'large');
    self.postMessage({ type: 'PROGRESS', data: { stage: 'CATEGORIZING_MESHES', progress: 50 } });

    // Process depth 3 for medium meshes  
    await categorizeAtDepth(nodesByDepth[3], 3, modelMap, mediumMeshes, 'medium');
    self.postMessage({ type: 'PROGRESS', data: { stage: 'CATEGORIZING_MESHES', progress: 75 } });

    // Process depth 4 for small meshes
    await categorizeAtDepth(nodesByDepth[4], 4, modelMap, smallMeshes, 'small');
    self.postMessage({ type: 'PROGRESS', data: { stage: 'CATEGORIZING_MESHES', progress: 100 } });

    return {
        nodesByDepth,
        largeMeshes,
        mediumMeshes,
        smallMeshes
    };
}

// Helper function to categorize meshes at a specific depth
async function categorizeAtDepth(nodes, depth, modelMap, meshStorage, category) {
    const thresholds = {
        'large': { min: COVERAGE_THRESHOLDS.LARGE, max: Infinity },
        'medium': { min: COVERAGE_THRESHOLDS.MEDIUM, max: COVERAGE_THRESHOLDS.LARGE },
        'small': { min: 0, max: COVERAGE_THRESHOLDS.MEDIUM }
    };

    const threshold = thresholds[category];

    for (const node of nodes) {
        for (const meshId of node.meshIds) {
            let model = modelMap[meshId];

            if (!model) {
                const matchingKey = Object.keys(modelMap).find(key => key.includes(meshId));
                if (matchingKey) {
                    model = modelMap[matchingKey];
                }
            }

            if (model && model.data.metadata.screenCoverage !== undefined) {
                const coverage = model.data.metadata.screenCoverage;

                if (coverage >= threshold.min && coverage < threshold.max) {
                    const meshInfo = {
                        meshId: meshId,
                        nodeNumber: node.nodeNumber,
                        depth: depth,
                        screenCoverage: coverage,
                        bounds: model.data.bounds || node.bounds
                    };

                    if (!meshStorage[node.nodeNumber]) {
                        meshStorage[node.nodeNumber] = [];
                    }
                    meshStorage[node.nodeNumber].push(meshInfo);
                }
            }
        }
    }
}

// Process overlapping meshes in worker
async function processOverlappingInWorker({ meshesObj, category, nodesByDepth, modelMap, octreeData }) {
    const processedIds = new Set();
    const finalPlacement = {
        depth0: [],
        depth1: [],
        depth2: [],
        depth3: [],
        depth4: []
    };
    
    
    let processedCount = 0;
    let overlappingCount = 0;
    let relocatedCount = 0;

    const totalMeshes = Object.values(meshesObj).reduce((sum, arr) => sum + arr.length, 0);
    let currentMesh = 0;

    for (const [nodeNumber, meshes] of Object.entries(meshesObj)) {
        for (const meshInfo of meshes) {
            if (processedIds.has(meshInfo.meshId)) continue;
            processedIds.add(meshInfo.meshId);
            processedCount++;
            currentMesh++;

            // Report progress
            if (currentMesh % 100 === 0) {
                self.postMessage({ 
                    type: 'PROGRESS', 
                    data: { 
                        stage: `PROCESSING_${category.toUpperCase()}_OVERLAP`,
                        progress: (currentMesh / totalMeshes) * 100
                    }
                });
            }

            const nodeInfo = nodesByDepth[meshInfo.depth].find(n => n.nodeNumber === meshInfo.nodeNumber);
            if (!nodeInfo) continue;

            // Check for overlaps
            const sameDepthNodes = nodesByDepth[meshInfo.depth].filter(
                n => n.nodeNumber !== meshInfo.nodeNumber
            );
            const meshIdsAtSameDepth = sameDepthNodes.flatMap(n => n.meshIds);

            const hasOverlap = checkMeshOverlapInNode(
                meshInfo.bounds,
                meshIdsAtSameDepth,
                meshInfo.meshId,
                modelMap
            );

            let placedDepth = meshInfo.depth;
            let placedNodeNumber = meshInfo.nodeNumber;

            if (hasOverlap) {
                overlappingCount++;

                const nonOverlappingParent = findNonOverlappingParent(
                    octreeData,
                    meshInfo.bounds,
                    meshInfo.meshId,
                    meshInfo.nodeNumber,
                    modelMap
                );

                if (nonOverlappingParent) {
                    relocatedCount++;
                    placedDepth = nonOverlappingParent.depth;
                    placedNodeNumber = nonOverlappingParent.nodeNumber;
                } else {
                    placedDepth = 0;
                    placedNodeNumber = 1;
                    relocatedCount++;
                }
            }

            finalPlacement[`depth${placedDepth}`].push({
                meshId: meshInfo.meshId,
                category: category,
                screenCoverage: meshInfo.screenCoverage,
                originalNodeNumber: meshInfo.nodeNumber,
                originalDepth: meshInfo.depth,
                placedNodeNumber: placedNodeNumber,
                placedDepth: placedDepth,
                bounds: meshInfo.bounds
            });
        }
    }

    return {
        finalPlacement,
        stats: {
            processedCount,
            overlappingCount,
            relocatedCount
        }
    };
}

// Helper functions
function checkMeshOverlapInNode(meshBounds, nodeMeshIds, currentMeshId, modelMap) {
    const otherMeshIds = nodeMeshIds.filter(id => id !== currentMeshId);

    for (const otherMeshId of otherMeshIds) {
        let otherModel = modelMap[otherMeshId];

        if (!otherModel) {
            const matchingKey = Object.keys(modelMap).find(key => key.includes(otherMeshId));
            if (matchingKey) {
                otherModel = modelMap[matchingKey];
            }
        }

        if (otherModel && otherModel.data.bounds) {
            if (checkBoundsOverlap(meshBounds, otherModel.data.bounds)) {
                return true;
            }
        }
    }

    return false;
}

function checkBoundsOverlap(bounds1, bounds2) {
    return (
        bounds1.min.x <= bounds2.max.x && bounds1.max.x >= bounds2.min.x &&
        bounds1.min.y <= bounds2.max.y && bounds1.max.y >= bounds2.min.y &&
        bounds1.min.z <= bounds2.max.z && bounds1.max.z >= bounds2.min.z
    );
}

// Helper function to find a parent node where the mesh doesn't overlap
function findNonOverlappingParent(octreeData, meshBounds, meshId, currentNodeNumber, modelMap) {
    // Navigate up the octree to find parent nodes
    const findNodeAndPath = (block, nodeNumber, path = []) => {
        if (!block) return null;

        if (block.properties && block.properties.nodeNumber === nodeNumber) {
            return { node: block, path };
        }

        if (block.relationships && block.relationships.childBlocks) {
            for (let i = 0; i < block.relationships.childBlocks.length; i++) {
                const result = findNodeAndPath(
                    block.relationships.childBlocks[i], 
                    nodeNumber, 
                    [...path, i]
                );
                if (result) return result;
            }
        }

        return null;
    };

    // Get parent node from path
    const getParentNode = (node, path) => {
        if (!node || path.length === 0) return null;

        // Find the parent depth
        const parentDepth = node.properties.depth - 1;
        if (parentDepth < 0) return null;

        // Get parent node by traversing up one level in the octree
        let parentNode = octreeData;
        let currentPath = [];

        for (let i = 0; i < path.length - 1; i++) {
            currentPath.push(path[i]);
            if (!parentNode.relationships || !parentNode.relationships.childBlocks) {
                return null;
            }
            parentNode = parentNode.relationships.childBlocks[path[i]];
        }

        return parentNode;
    };

    // Start from the current node
    const nodeResult = findNodeAndPath(octreeData, currentNodeNumber);
    if (!nodeResult) return null;

    const { node, path } = nodeResult;

    // Get parent node
    let currentNode = node;
    let currentPath = path;
    let currentDepth = node.properties.depth;

    while (currentDepth > 0) {
        const parentNode = getParentNode(currentNode, currentPath);
        if (!parentNode) break;

        // Check if mesh overlaps in parent node
        const parentMeshIds = parentNode.meshInfos ? 
            parentNode.meshInfos.map(info => info.id) : [];

        const hasOverlap = checkMeshOverlapInNode(
            meshBounds, 
            parentMeshIds, 
            meshId, 
            modelMap
        );

        if (!hasOverlap) {
            return {
                depth: parentNode.properties.depth,
                nodeNumber: parentNode.properties.nodeNumber
            };
        }

        // Move up to the next parent
        currentNode = parentNode;
        currentPath = currentPath.slice(0, -1);
        currentDepth--;
    }

    return null; // No non-overlapping parent found
}

// NEW HELPER FUNCTIONS for chunked processing:

// Categorize model by screen coverage
function categorizeModel(screenCoverage) {
    if (screenCoverage >= COVERAGE_THRESHOLDS.LARGE) {
        return 'large';
    } else if (screenCoverage >= COVERAGE_THRESHOLDS.MEDIUM) {
        return 'medium';
    } else if (screenCoverage < COVERAGE_THRESHOLDS.MEDIUM) {
        return 'small';
    }
    return null;
}

// Find appropriate placement for model
function findModelPlacement(model, category, nodesByDepth) {
    // Target depth based on category
    const targetDepth = {
        'large': 2,
        'medium': 3,
        'small': 4
    }[category];

    // Try to find a suitable node at target depth
    const nodesAtDepth = nodesByDepth[targetDepth] || [];

    // First, try to find a node that already contains this mesh
    let suitableNode = nodesAtDepth.find(node => 
        node.meshIds.includes(model.id)
    );

    // If not found, try to find a compatible node based on bounds
    if (!suitableNode && model.bounds) {
        suitableNode = nodesAtDepth.find(node => 
            node.bounds && checkBoundsCompatibility(model.bounds, node.bounds)
        );
    }

    // If still not found, use the first available node at target depth
    if (!suitableNode && nodesAtDepth.length > 0) {
        suitableNode = nodesAtDepth[0];
    }

    if (suitableNode) {
        return {
            originalNode: suitableNode.nodeNumber,
            originalDepth: targetDepth,
            placedNode: suitableNode.nodeNumber,
            placedDepth: targetDepth
        };
    }

    // Fallback to root node
    const rootNodes = nodesByDepth[0] || [];
    const rootNode = rootNodes.length > 0 ? rootNodes[0] : { nodeNumber: 1 };

    return {
        originalNode: rootNode.nodeNumber,
        originalDepth: 0,
        placedNode: rootNode.nodeNumber,
        placedDepth: 0
    };
}

// Simple bounds compatibility check
function checkBoundsCompatibility(bounds1, bounds2) {
    if (!bounds1 || !bounds2) return true;

    // Check if bounds are within reasonable proximity
    const center1 = {
        x: (bounds1.min.x + bounds1.max.x) / 2,
        y: (bounds1.min.y + bounds1.max.y) / 2,
        z: (bounds1.min.z + bounds1.max.z) / 2
    };

    const center2 = {
        x: (bounds2.min.x + bounds2.max.x) / 2,
        y: (bounds2.min.y + bounds2.max.y) / 2,
        z: (bounds2.min.z + bounds2.max.z) / 2
    };

    // Simple distance check
    const distance = Math.sqrt(
        Math.pow(center1.x - center2.x, 2) +
        Math.pow(center1.y - center2.y, 2) +
        Math.pow(center1.z - center2.z, 2)
    );

    // Consider compatible if centers are within reasonable distance
    return distance < 1000; // Adjust this threshold as needed
}

console.log('Worker script initialization complete');