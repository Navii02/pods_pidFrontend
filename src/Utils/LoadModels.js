import { initDB } from "./DbInit";
import { processMeshDataOffline } from "./processMeshDataOffline";

const STORE_CHUNK_SIZE = 25;
const WORKER_CHUNK_SIZE = 1000; // Process models in chunks of 1000

class MeshProcessingWorker {
    constructor() {
        this.worker = null;
        this.messageId = 0;
        this.pendingPromises = new Map();
    }

    async initialize() {
        try {
            console.log('Attempting to create worker...');
            
             let workerScript;
        try {
            // Add cache busting parameter
            const cacheBuster = `?v=${Date.now()}`;
            workerScript = new URL(`./meshProcessingWorker.js${cacheBuster}`, import.meta.url);
            console.log('Using import.meta.url:', workerScript.href);
        } catch (e) {
            workerScript = `/meshProcessingWorker.js?v=${Date.now()}`;
            console.log('Using direct path:', workerScript);
        }
        
        // this.worker = new Worker('meshProcessingWorker.js');
         this.worker  = new Worker(new URL("../Utils/meshProcessingWorker.js", import.meta.url));
        console.log('Worker created successfully');
       this.worker.onmessage = (e) => {
    const { type, data, error, messageId } = e.data;
    console.log(e.data);
    
    if (type === 'PROGRESS') {
        window.dispatchEvent(new CustomEvent('meshProcessingProgress', { detail: data }));
        return;
    }
    
    const promise = this.pendingPromises.get(messageId || 'default');
    if (promise) {
        this.pendingPromises.delete(messageId || 'default');
        
        if (type === 'ERROR') {
            console.error('Worker error:', error);
            promise.reject(new Error(error));
        } else {
            // Handle different response types
            switch (type) {
                case 'TEST_RESPONSE':
                case 'OCTREE_STRUCTURE_COMPLETE':
                case 'MODEL_CHUNK_COMPLETE':
                case 'CATEGORIZATION_COMPLETE':
                case 'OVERLAP_PROCESSING_COMPLETE':
                    promise.resolve(data);
                    break;
                default:
                    console.warn('Unknown response type:', type);
                    promise.resolve(data);
            }
        }
    }
};

            this.worker.onerror = (error) => {
                console.error('Worker onerror:', error);
                for (const promise of this.pendingPromises.values()) {
                    promise.reject(error);
                }
                this.pendingPromises.clear();
            };
            
            // Test worker
            await this.testWorker();
            console.log('Worker test successful');
            
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            throw new Error(`Worker initialization failed: ${error.message}`);
        }
    }

    async testWorker() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker test timeout'));
            }, 5000);
            
            const messageId = 'test';
            this.pendingPromises.set(messageId, {
                resolve: () => {
                    clearTimeout(timeout);
                    resolve();
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            
            this.worker.postMessage({ type: 'TEST', messageId });
        });
    }

    async sendMessage(type, data) {
        if (!this.worker) {
            throw new Error('Worker not initialized');
        }
        
        const messageId = ++this.messageId;
        console.log(`Sending message to worker: ${type} (ID: ${messageId})`);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingPromises.delete(messageId);
                reject(new Error(`Worker message timeout for ${type}`));
            }, 300000);
            
            this.pendingPromises.set(messageId, { 
                resolve: (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            
            try {
                this.worker.postMessage({
                    type,
                    data,
                    messageId
                });
            } catch (error) {
                clearTimeout(timeout);
                this.pendingPromises.delete(messageId);
                console.error('Failed to send message to worker:', error);
                reject(new Error(`Failed to send message: ${error.message}`));
            }
        });
    }

    terminate() {
        if (this.worker) {
            console.log('Terminating worker...');
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingPromises.clear();
    }
}

// Main loadModels function with chunked processing
export const loadModels = async (onProgress = null) => {
    console.log('Starting to process models with worker-based overlap detection...');
    
    const worker = new MeshProcessingWorker();
    
    try {
        await worker.initialize();
        
        // Step 1: Load data from IndexedDB
        console.log('Loading data from IndexedDB...');
        const db = await initDB();
        const tx = db.transaction(['octree', 'originalMeshes'], 'readonly');
        
        const [octreeData, lowPolyModels] = await Promise.all([
            tx.objectStore('octree').get('mainOctree'),
            tx.objectStore('originalMeshes').getAll()
        ]);
        
        if (!octreeData?.data) {
            throw new Error('No octree data found');
        }
        
        console.log(`Loaded ${lowPolyModels.length} models`);
        onProgress?.({ stage: 'Data loaded', progress: 10 });
        
        // SMART DECISION: Choose processing method based on dataset size
        const LARGE_DATASET_THRESHOLD = 50000; // 50K models
        const isLargeDataset = lowPolyModels.length > LARGE_DATASET_THRESHOLD;
        
        console.log(`Dataset size: ${lowPolyModels.length} models`);
        console.log(`Processing mode: ${isLargeDataset ? 'MAIN THREAD (Large Dataset)' : 'WORKER (Normal Dataset)'}`);
        
        let finalPlacement;
        
        if (isLargeDataset) {
            // For large datasets: Process on main thread to avoid memory transfer issues
            finalPlacement = await processLargeDatasetOnMainThread(
                octreeData.data, 
                lowPolyModels, 
                onProgress
            );
        } else {
            // For normal datasets: Use worker processing
            finalPlacement = await processNormalDatasetWithWorker(
                worker,
                octreeData.data,
                lowPolyModels,
                onProgress
            );
        }
        
        // Step 4: STREAMING merge and store (same for both approaches)
        console.log('Starting streaming merge and store...');
        const { allMergedMeshes, placementSummary, totalStoredMeshes } = await createAndMergeMeshes(
            finalPlacement, 
            lowPolyModels, 
            onProgress
        );
        
        // Step 5: Store final summary
        console.log('Storing final summary...');
        const summaryTx = db.transaction(['mergedMeshes', 'octree'], 'readwrite');
        await summaryTx.objectStore('mergedMeshes').put(placementSummary, 'placementSummary');
        await summaryTx.objectStore('octree').put(octreeData, 'mainOctree');
        await summaryTx.done;
        
        onProgress?.({ stage: 'Complete', progress: 100 });
        
        console.log(`🎉 Processing complete! Stored ${totalStoredMeshes} merged meshes`);
        
        return {
            mergedMeshes: [],
            placementSummary: placementSummary,
            finalPlacement: finalPlacement,
            totalStoredMeshes: totalStoredMeshes,
            processingMode: isLargeDataset ? 'main-thread' : 'worker',
            message: `Successfully processed ${totalStoredMeshes} meshes using ${isLargeDataset ? 'main thread' : 'worker'} approach`
        };
        
    } catch (error) {
        console.error('Error in loadModels:', error);
        throw error;
    } finally {
        worker.terminate();
    }
};

// Large dataset processing (main thread)
async function processLargeDatasetOnMainThread(octreeData, lowPolyModels, onProgress) {
    console.log('🖥️ Processing large dataset on main thread...');
    
    // Step 1: Process octree structure on main thread
    console.log('Processing octree structure on main thread...');
    onProgress?.({ stage: 'Processing octree structure', progress: 20 });
    
    const nodesByDepth = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    const stack = [{block: octreeData.blockHierarchy, depth: 0}];
    
    while (stack.length > 0) {
        const {block, depth} = stack.pop();
        
        if (depth <= 4) {
            nodesByDepth[depth].push({
                nodeNumber: block.properties.nodeNumber,
                meshIds: block.meshInfos ? block.meshInfos.map(info => info.id) : [],
                bounds: block.bounds,
                depth: depth
            });
            
            if (block.relationships?.childBlocks) {
                stack.push(...block.relationships.childBlocks.map(child => ({
                    block: child,
                    depth: depth + 1
                })));
            }
        }
    }
    
    console.log('Octree structure processed on main thread:');
    for (let i = 0; i <= 4; i++) {
        console.log(`  Depth ${i}: ${nodesByDepth[i].length} nodes`);
    }
    
    // Step 2: Process models in chunks on main thread
    console.log('Processing models in chunks on main thread...');
    const finalPlacement = {
        depth0: [],
        depth1: [],
        depth2: [],
        depth3: [],
        depth4: []
    };
    
    const MAIN_THREAD_CHUNK_SIZE = 5000; // Smaller chunks for main thread
    let processedModels = 0;
    
    for (let i = 0; i < lowPolyModels.length; i += MAIN_THREAD_CHUNK_SIZE) {
        const chunk = lowPolyModels.slice(i, i + MAIN_THREAD_CHUNK_SIZE);
        console.log(`Processing chunk ${Math.floor(i / MAIN_THREAD_CHUNK_SIZE) + 1}/${Math.ceil(lowPolyModels.length / MAIN_THREAD_CHUNK_SIZE)}`);
        
        // Process chunk on main thread
        const chunkResult = processModelChunkOnMainThread(chunk, nodesByDepth);
        
        // Merge results
        mergeFinalPlacement(finalPlacement, chunkResult.finalPlacement);
        
        processedModels += chunk.length;
        const progress = 20 + (processedModels / lowPolyModels.length) * 65;
        onProgress?.({ stage: `Processed ${processedModels}/${lowPolyModels.length} models`, progress });
        
        // Allow UI to breathe
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return finalPlacement;
}

// Process model chunk on main thread (same logic as worker)
function processModelChunkOnMainThread(modelChunk, nodesByDepth) {
    const finalPlacement = {
        depth0: [],
        depth1: [],
        depth2: [],
        depth3: [],
        depth4: []
    };
    
    let categorizedCount = 0;
    
    for (const model of modelChunk) {
        const screenCoverage = model.data?.metadata?.screenCoverage;
        if (!screenCoverage) continue;
        
        const category = categorizeModel(screenCoverage);
        if (!category) continue;
        
        // Extract bounds from boundingBox
        let bounds = null;
        if (model.data?.boundingBox) {
            const bbox = model.data.boundingBox;
            if (bbox.center && bbox.extendSize) {
                bounds = {
                    min: {
                        x: bbox.center.x - bbox.extendSize.x / 2,
                        y: bbox.center.y - bbox.extendSize.y / 2,
                        z: bbox.center.z - bbox.extendSize.z / 2
                    },
                    max: {
                        x: bbox.center.x + bbox.extendSize.x / 2,
                        y: bbox.center.y + bbox.extendSize.y / 2,
                        z: bbox.center.z + bbox.extendSize.z / 2
                    }
                };
            }
        }
        
        const modelData = {
            id: model.fileName || model.data?.metadata?.id,
            screenCoverage: screenCoverage,
            bounds: bounds
        };
        
        const placement = findModelPlacement(modelData, category, nodesByDepth);
        
        if (placement) {
            finalPlacement[`depth${placement.placedDepth}`].push({
                meshId: modelData.id,
                category: category,
                screenCoverage: screenCoverage,
                originalNodeNumber: placement.originalNode,
                originalDepth: placement.originalDepth,
                placedNodeNumber: placement.placedNode,
                placedDepth: placement.placedDepth,
                bounds: bounds
            });
            categorizedCount++;
        }
    }
    
    return { 
        finalPlacement,
        stats: { categorizedCount }
    };
}

// Normal dataset processing (worker) - same as before
async function processNormalDatasetWithWorker(worker, octreeData, lowPolyModels, onProgress) {
    console.log('🔧 Processing normal dataset with worker...');
    
    // Send octree structure to worker
    console.log('Sending octree structure to worker...');
    const octreeStructure = await worker.sendMessage('PROCESS_OCTREE_STRUCTURE', {
        octreeData: octreeData
    });
    
    onProgress?.({ stage: 'Octree structure processed', progress: 20 });
    
    // Process models in chunks
    console.log('Processing models in chunks with worker...');
    const finalPlacement = {
        depth0: [],
        depth1: [],
        depth2: [],
        depth3: [],
        depth4: []
    };
    
    const modelChunks = createModelChunks(lowPolyModels, 1000);
    console.log(`Created ${modelChunks.length} model chunks`);
    
    let processedChunks = 0;
    for (const chunk of modelChunks) {
        console.log(`Processing chunk ${processedChunks + 1}/${modelChunks.length}`);
        
        const chunkResult = await worker.sendMessage('PROCESS_MODEL_CHUNK', {
            modelChunk: chunk,
            nodesByDepth: octreeStructure.nodesByDepth
        });
        
        mergeFinalPlacement(finalPlacement, chunkResult.finalPlacement);
        
        processedChunks++;
        const progress = 20 + (processedChunks / modelChunks.length) * 65;
        onProgress?.({ stage: `Processed ${processedChunks}/${modelChunks.length} chunks`, progress });
    }
    
    return finalPlacement;
}

// Helper functions (add these to main thread)
function categorizeModel(screenCoverage) {
    const COVERAGE_THRESHOLDS = {
        LARGE: 1,
        MEDIUM: 0.3,
        SMALL: 0.3
    };
    
    if (screenCoverage >= COVERAGE_THRESHOLDS.LARGE) {
        return 'large';
    } else if (screenCoverage >= COVERAGE_THRESHOLDS.MEDIUM) {
        return 'medium';
    } else if (screenCoverage < COVERAGE_THRESHOLDS.MEDIUM) {
        return 'small';
    }
    return null;
}

function findModelPlacement(model, category, nodesByDepth) {
    const targetDepth = {
        'large': 2,
        'medium': 3,
        'small': 4
    }[category];
    
    const nodesAtDepth = nodesByDepth[targetDepth] || [];
    
    let suitableNode = nodesAtDepth.find(node => 
        node.meshIds.includes(model.id)
    );
    
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
    
    const rootNodes = nodesByDepth[0] || [];
    const rootNode = rootNodes.length > 0 ? rootNodes[0] : { nodeNumber: 1 };
    
    return {
        originalNode: rootNode.nodeNumber,
        originalDepth: 0,
        placedNode: rootNode.nodeNumber,
        placedDepth: 0
    };
}

// Create model chunks with only necessary data
function createModelChunks(models, chunkSize) {
    const chunks = [];
    
    for (let i = 0; i < models.length; i += chunkSize) {
        const chunk = models.slice(i, i + chunkSize).map(model => ({
            // Only send essential data to worker
            id: model.fileName || model.data?.metadata?.id,
            screenCoverage: model.data?.metadata?.screenCoverage,
            bounds: model.data?.bounds,
            // Don't send heavy geometry data to worker
        }));
        
        chunks.push(chunk);
    }
    
    return chunks;
}

// Helper functions
function mergeFinalPlacement(target, source) {
    for (let depth = 0; depth <= 4; depth++) {
        const depthKey = `depth${depth}`;
        if (source[depthKey]) {
            target[depthKey].push(...source[depthKey]);
        }
    }
}

// Memory-efficient createAndMergeMeshes function - FIXED TRANSACTION HANDLING
async function createAndMergeMeshes(finalPlacement, lowPolyModels, onProgress) {
    console.log('Creating mesh placement map...');
    
    // Create model lookup for merging
    const modelMap = {};
    lowPolyModels.forEach(model => {
        const id = model.fileName || model.data?.metadata?.id;
        if (id) {
            modelMap[id] = model;
        }
    });
    
    const meshPlacementMap = new Map();
    
    // Organize by node
    for (let depth = 0; depth <= 4; depth++) {
        const depthKey = `depth${depth}`;
        finalPlacement[depthKey].forEach(meshInfo => {
            const nodeKey = `node${meshInfo.placedNodeNumber}`;
            
            if (!meshPlacementMap.has(nodeKey)) {
                meshPlacementMap.set(nodeKey, []);
            }
            
            meshPlacementMap.get(nodeKey).push({
                meshId: meshInfo.meshId,
                category: meshInfo.category,
                screenCoverage: meshInfo.screenCoverage,
                originalNode: meshInfo.originalNodeNumber,
                originalDepth: meshInfo.originalDepth
            });
        });
    }
    
    console.log(`Processing ${meshPlacementMap.size} nodes with streaming merge and store...`);
    
    // Track statistics
    let totalStoredMeshes = 0;
    let processedNodes = 0;
    const totalNodes = meshPlacementMap.size;
    const categoryStats = { small: 0, medium: 0, large: 0 };
    const nodeList = [];
    
    // Get database connection
    const db = await initDB();
    
    // Process nodes in batches to avoid transaction timeout
    const BATCH_SIZE = 10; // Process 10 nodes per transaction
    const nodeEntries = Array.from(meshPlacementMap.entries());
    
    for (let batchStart = 0; batchStart < nodeEntries.length; batchStart += BATCH_SIZE) {
        // Create fresh transaction for each batch
        console.log(`🔄 Starting batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(nodeEntries.length / BATCH_SIZE)}`);
        
        const storeTx = db.transaction(['mergedMeshes'], 'readwrite');
        const mergedStore = storeTx.objectStore('mergedMeshes');
        
        const batchEnd = Math.min(batchStart + BATCH_SIZE, nodeEntries.length);
        
        // Process nodes in this batch
        for (let i = batchStart; i < batchEnd; i++) {
            const [nodeKey, meshes] = nodeEntries[i];
            const nodeNumber = parseInt(nodeKey.replace('node', ''));
            
            console.log(`  🔄 Processing node ${nodeNumber} with ${meshes.length} meshes... (${processedNodes + 1}/${totalNodes})`);
            
            const meshesToMerge = [];
            const meshKeys = [];
            
            // Collect meshes for this node
            for (const meshInfo of meshes) {
                const model = modelMap[meshInfo.meshId];
                
                if (model && model.data) {
                    const meshData = {
                        positions: new Float32Array(model.data.positions),
                        indices: new Uint32Array(model.data.indices),
                        normals: model.data.normals ? 
                            new Float32Array(model.data.normals) : null,
                        transforms: model.data.transforms,
                        color: model.data.color
                    };
                    
                    meshesToMerge.push(meshData);
                    meshKeys.push({
                        meshId: meshInfo.meshId,
                        category: meshInfo.category,
                        screenCoverage: meshInfo.screenCoverage,
                        originalNode: meshInfo.originalNode,
                        originalDepth: meshInfo.originalDepth,
                          fileName: model.fileName,
                            metadataId: model.data.metadata.id,
                            screenCoverage: model.data.metadata.screenCoverage,
                            name:model.data.name
                    });
                    
                    // Update category statistics
                    categoryStats[meshInfo.category]++;
                }
            }
            
            if (meshesToMerge.length > 0) {
                // Step 1: MERGE this node's meshes
                console.log(`    🔨 Merging ${meshesToMerge.length} meshes...`);
                const mergedVertexData = processMeshDataOffline(meshesToMerge);
const detailedVertexMappings = mergedVertexData.vertexMappings.map((mapping, index) => ({
            ...mapping,
            meshId: meshKeys[index].meshId,
            fileName: meshKeys[index].fileName,
            metadataId: meshKeys[index].metadataId,
            screenCoverage: meshKeys[index].screenCoverage,
            name: meshKeys[index].name,
            start: mapping.startVertex,  // For compatibility with existing highlighting
            count: mapping.vertexCount   // For compatibility with existing highlighting
        }));
      
                const meshId = `merged_node${nodeNumber}`;
                
                const mergedMeshData = {
                    id: meshId,
                    name: meshId,
                    vertexData: mergedVertexData,
                    colors: mergedVertexData.colors,
                    transforms: {
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scaling: { x: 1, y: 1, z: 1 },
                        worldMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
                    },
                    metadata: {
                        nodeNumber: nodeNumber,
                        meshCount: meshesToMerge.length,
                        originalMeshKeys: meshKeys,
                         vertexMappings: detailedVertexMappings ,
                        categories: {
                            small: meshKeys.filter(m => m.category === 'small').length,
                            medium: meshKeys.filter(m => m.category === 'medium').length,
                            large: meshKeys.filter(m => m.category === 'large').length
                        },
                    }
                };
                
                // Step 2: STORE to database within this transaction
                console.log(`    💾 Storing merged mesh to database...`);
                await mergedStore.put(mergedMeshData, mergedMeshData.id);
                
                // Step 3: CLEAR from memory
                nodeList.push({
                    nodeNumber: nodeNumber,
                    meshCount: meshesToMerge.length,
                    categories: mergedMeshData.metadata.categories
                });
                
                totalStoredMeshes++;
                
                // Clear large objects from memory
                mergedMeshData.vertexData = null;
                mergedMeshData.colors = null;
                console.log(`    ✅ Node ${nodeNumber} completed and cleared from memory`);
            }
            
            // Clear arrays
            meshesToMerge.length = 0;
            meshKeys.length = 0;
            
            processedNodes++;
        }
        
        // Complete this batch transaction
        await storeTx.done;
        console.log(`  ✅ Batch completed - stored ${batchEnd - batchStart} nodes`);
        
        // Update progress
        const progress = 85 + (processedNodes / totalNodes) * 10;
        onProgress?.({ 
            stage: `Merged & stored ${processedNodes}/${totalNodes} nodes (${totalStoredMeshes} meshes)`, 
            progress 
        });
        
        // Force garbage collection hint
        if (global.gc) {
            global.gc();
        }
        
        // Small delay between batches to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`🎉 Streaming merge completed! Processed ${totalStoredMeshes} merged meshes`);
    
    // Create lightweight summary
    const placementSummary = {
        totalMeshes: totalStoredMeshes,
        totalNodes: processedNodes,
        byCategory: categoryStats,
        byDepth: {
            depth0: finalPlacement.depth0.length,
            depth1: finalPlacement.depth1.length,
            depth2: finalPlacement.depth2.length,
            depth3: finalPlacement.depth3.length,
            depth4: finalPlacement.depth4.length
        },
        nodeList: nodeList,
        processedAt: new Date().toISOString(),
        streamingMode: true
    };
    
    return { 
        allMergedMeshes: [], // Empty - data is already in database
        placementSummary: placementSummary,
        totalStoredMeshes: totalStoredMeshes
    };
}

async function storeResults(db, allMergedMeshes, placementSummary, octreeData) {
    const storeTx = db.transaction(['mergedMeshes', 'octree'], 'readwrite');
    const mergedStore = storeTx.objectStore('mergedMeshes');
    
    console.log(`Storing ${allMergedMeshes.length} merged meshes`);
    
    for (let i = 0; i < allMergedMeshes.length; i += STORE_CHUNK_SIZE) {
        const storeChunk = allMergedMeshes.slice(i, i + STORE_CHUNK_SIZE);
        await Promise.all(
            storeChunk.map(async data => {
                await mergedStore.put(data, data.id);
            })
        );
    }
    
    await mergedStore.put(placementSummary, 'placementSummary');
    await storeTx.objectStore('octree').put(octreeData, 'mainOctree');
    await storeTx.done;
}

// import { initDB } from "./DbInit";
// import { processMeshDataOffline } from "./processMeshDataOffline";

// const TARGET_DEPTH = 4;
// const CHUNK_SIZE = 3;
// const STORE_CHUNK_SIZE = 25;

// // Screen coverage thresholds for mesh categorization
//    const COVERAGE_THRESHOLDS = {
//         LARGE: 0.3,    // Screen coverage >= 1
//         MEDIUM: 0.085, // 0.3 <= Screen coverage < 1
//         SMALL: 0.085   // Screen coverage < 0.3
//     };


// export const loadModelsWithWorker = () => {
//   return new Promise((resolve, reject) => {
//     // Create progress state in main thread
//     const updateProgress = (progressData) => {
//       // Update your UI with progress information
//       console.log(`Progress: ${progressData.stage} - ${progressData.subStage} (${progressData.subProgress}%)`);
//     };

//     try {
//       // Create and start the worker
//     //   const worker = new Worker('../components/MeshWorker.js');

//     const worker = new Worker(new URL("../components/meshWorker.js", import.meta.url));

      
//       // Listen for messages from the worker
//       worker.onmessage = (event) => {
//         const { type, data, error } = event.data;
        
//         switch (type) {
//           case 'progress':
//             updateProgress(data);
//             break;
//           case 'complete':
//             console.log('Worker completed successfully!');
//             worker.terminate();
//             resolve(data);
//             break;
//           case 'error':
//             console.error('Worker error:', error);
//             worker.terminate();
//             reject(new Error(error));
//             break;
//         }
//       };
      
//       // Handle worker errors
//       worker.onerror = (error) => {
//         console.error('Worker error:', error);
//         worker.terminate();
//         reject(error);
//       };
      
//       // Start the worker
//       worker.postMessage({ action: 'start' });
      
//     } catch (error) {
//       console.error('Error creating worker:', error);
//       reject(error);
//     }
//   });
// };



// export const loadModels = async () => {
//     console.log('Starting to process models with overlap detection...');
    
//     try {
//         const db = await initDB();
        
//         const tx = db.transaction(['octree', 'originalMeshes'], 'readonly');
        
//         const [octreeData, lowPolyModels] = await Promise.all([
//             tx.objectStore('octree').get('mainOctree'),
//             tx.objectStore('originalMeshes').getAll()
//         ]);
        
//         if (!octreeData?.data) {
//             throw new Error('No octree data found');
//         }
        
//         // Create model lookup map
//         const modelMap = new Map();
//         lowPolyModels.forEach(model => {
//             if (model.fileName) {
//                 modelMap.set(model.fileName, model);
//             }
//             if (model.data?.metadata?.id) {
//                 modelMap.set(model.data.metadata.id, model);
//             }
//         });
        
//         console.log(`Loaded ${lowPolyModels.length} models`);
        
//         // Step 1: Collect all nodes at all depths
//         console.log('\nSTEP 1: Collecting nodes at all depths...');
//         const nodesByDepth = { 0: [], 1: [], 2: [], 3: [], 4: [] };
//         const stack = [{block: octreeData.data.blockHierarchy, depth: 0}];
        
//         while (stack.length > 0) {
//             const {block, depth} = stack.pop();
            
//             if (depth <= 4) {
//                 nodesByDepth[depth].push({
//                     block: block,
//                     nodeNumber: block.properties.nodeNumber,
//                     meshIds: block.meshInfos ? block.meshInfos.map(info => info.id) : [],
//                     bounds: block.bounds
//                 });
                
//                 if (block.relationships?.childBlocks) {
//                     stack.push(...block.relationships.childBlocks.map(child => ({
//                         block: child,
//                         depth: depth + 1
//                     })));
//                 }
//             }
//         }
        
//         // Log node counts
//         for (let i = 0; i <= 4; i++) {
//             console.log(`  Depth ${i}: ${nodesByDepth[i].length} nodes`);
//         }
        
//         // Arrays to store categorized meshes (steps 2-4)
//         const largeMeshes = {}; // depth 2, coverage >= 2
//         const mediumMeshes = {}; // depth 3, 1 <= coverage < 2
//         const smallMeshes = {}; // depth 4, coverage < 1
        
//         // Final placement arrays for each depth
//         const finalPlacement = {
//             depth0: [],
//             depth1: [],
//             depth2: [],
//             depth3: [],
//             depth4: []
//         };
        
//         // STEP 2: Process depth 2 for large meshes
//         console.log('\nSTEP 2: Processing depth 2 for LARGE meshes (coverage >= 2)...');
//         for (const node of nodesByDepth[2]) {
//             const nodeLargeMeshes = [];
            
//             for (const meshId of node.meshIds) {
//                 let model = modelMap.get(meshId);
                
//                 if (!model) {
//                     const matchingKey = Array.from(modelMap.keys()).find(key => 
//                         key.includes(meshId)
//                     );
//                     if (matchingKey) {
//                         model = modelMap.get(matchingKey);
//                     }
//                 }
                
//                 if (model && model.data.metadata.screenCoverage !== undefined) {
//                     const coverage = model.data.metadata.screenCoverage;
                    
//                     // Only consider large meshes at depth 2
//                     if (coverage >= COVERAGE_THRESHOLDS.LARGE) {
//                         const meshInfo = {
//                             meshId: meshId,
//                             nodeNumber: node.nodeNumber,
//                             depth: 2,
//                             screenCoverage: coverage,
//                             bounds: model.data.bounds || node.bounds
//                         };
                        
//                         // Store by node number for easier lookup
//                         if (!largeMeshes[node.nodeNumber]) {
//                             largeMeshes[node.nodeNumber] = [];
//                         }
//                         largeMeshes[node.nodeNumber].push(meshInfo);
//                         nodeLargeMeshes.push(meshInfo);
//                     }
//                 }
//             }
            
//             if (nodeLargeMeshes.length > 0) {
//                 console.log(`  Node ${node.nodeNumber}: ${nodeLargeMeshes.length} large meshes`);
//             }
//         }
        
//         // Count total large meshes
//         const totalLargeMeshes = Object.values(largeMeshes).reduce((sum, arr) => sum + arr.length, 0);
//         console.log(`  Total large meshes at depth 2: ${totalLargeMeshes}`);
        
//         // STEP 3: Process depth 3 for medium meshes
//         console.log('\nSTEP 3: Processing depth 3 for MEDIUM meshes (1 <= coverage < 2)...');
//         for (const node of nodesByDepth[3]) {
//             const nodeMediumMeshes = [];
            
//             for (const meshId of node.meshIds) {
//                 let model = modelMap.get(meshId);
                
//                 if (!model) {
//                     const matchingKey = Array.from(modelMap.keys()).find(key => 
//                         key.includes(meshId)
//                     );
//                     if (matchingKey) {
//                         model = modelMap.get(matchingKey);
//                     }
//                 }
                
//                 if (model && model.data.metadata.screenCoverage !== undefined) {
//                     const coverage = model.data.metadata.screenCoverage;
                    
//                     // Only consider medium meshes at depth 3
//                     if (coverage >= COVERAGE_THRESHOLDS.MEDIUM && coverage < COVERAGE_THRESHOLDS.LARGE) {
//                         const meshInfo = {
//                             meshId: meshId,
//                             nodeNumber: node.nodeNumber,
//                             depth: 3,
//                             screenCoverage: coverage,
//                             bounds: model.data.bounds || node.bounds
//                         };
                        
//                         // Store by node number
//                         if (!mediumMeshes[node.nodeNumber]) {
//                             mediumMeshes[node.nodeNumber] = [];
//                         }
//                         mediumMeshes[node.nodeNumber].push(meshInfo);
//                         nodeMediumMeshes.push(meshInfo);
//                     }
//                 }
//             }
            
//             if (nodeMediumMeshes.length > 0) {
//                 console.log(`  Node ${node.nodeNumber}: ${nodeMediumMeshes.length} medium meshes`);
//             }
//         }
        
//         // Count total medium meshes
//         const totalMediumMeshes = Object.values(mediumMeshes).reduce((sum, arr) => sum + arr.length, 0);
//         console.log(`  Total medium meshes at depth 3: ${totalMediumMeshes}`);
        
//         // STEP 4: Process depth 4 for small meshes
//         console.log('\nSTEP 4: Processing depth 4 for SMALL meshes (coverage < 1)...');
//         for (const node of nodesByDepth[4]) {
//             const nodeSmallMeshes = [];
            
//             for (const meshId of node.meshIds) {
//                 let model = modelMap.get(meshId);
                
//                 if (!model) {
//                     const matchingKey = Array.from(modelMap.keys()).find(key => 
//                         key.includes(meshId)
//                     );
//                     if (matchingKey) {
//                         model = modelMap.get(matchingKey);
//                     }
//                 }
                
//                 if (model && model.data.metadata.screenCoverage !== undefined) {
//                     const coverage = model.data.metadata.screenCoverage;
                    
//                     // Only consider small meshes at depth 4
//                     if (coverage < COVERAGE_THRESHOLDS.MEDIUM) {
//                         const meshInfo = {
//                             meshId: meshId,
//                             nodeNumber: node.nodeNumber,
//                             depth: 4,
//                             screenCoverage: coverage,
//                             bounds: model.data.bounds || node.bounds
//                         };
                        
//                         // Store by node number
//                         if (!smallMeshes[node.nodeNumber]) {
//                             smallMeshes[node.nodeNumber] = [];
//                         }
//                         smallMeshes[node.nodeNumber].push(meshInfo);
//                         nodeSmallMeshes.push(meshInfo);
//                     }
//                 }
//             }
            
//             if (nodeSmallMeshes.length > 0) {
//                 console.log(`  Node ${node.nodeNumber}: ${nodeSmallMeshes.length} small meshes`);
//             }
//         }
        
//         // Count total small meshes
//         const totalSmallMeshes = Object.values(smallMeshes).reduce((sum, arr) => sum + arr.length, 0);
//         console.log(`  Total small meshes at depth 4: ${totalSmallMeshes}`);
        
//         // STEPS 5-8: Process overlapping meshes
//         console.log('\nSTEPS 5-8: Processing overlapping meshes and creating final placement...');
        
//         // Process small meshes first (depth 4)
//         console.log('\nProcessing small meshes (depth 4) for overlap...');
//         await processOverlapping(smallMeshes, 'small', nodesByDepth, modelMap, octreeData.data, finalPlacement);
        
//         // Process medium meshes next (depth 3)
//         console.log('\nProcessing medium meshes (depth 3) for overlap...');
//         await processOverlapping(mediumMeshes, 'medium', nodesByDepth, modelMap, octreeData.data, finalPlacement);
        
//         // Process large meshes last (depth 2)
//         console.log('\nProcessing large meshes (depth 2) for overlap...');
//         await processOverlapping(largeMeshes, 'large', nodesByDepth, modelMap, octreeData.data, finalPlacement);
        
//         // Output the final placement arrays
//         console.log('\nFINAL PLACEMENT ARRAYS BY DEPTH:');
//         for (let depth = 0; depth <= 4; depth++) {
//             const depthKey = `depth${depth}`;
//             const byCategory = {
//                 large: finalPlacement[depthKey].filter(m => m.category === 'large').length,
//                 medium: finalPlacement[depthKey].filter(m => m.category === 'medium').length,
//                 small: finalPlacement[depthKey].filter(m => m.category === 'small').length
//             };
            
//             console.log(`  Depth ${depth}: ${finalPlacement[depthKey].length} total meshes`);
//             console.log(`    Large: ${byCategory.large}, Medium: ${byCategory.medium}, Small: ${byCategory.small}`);
            
//             // Show node distribution for this depth
//             const nodeDistribution = {};
//             finalPlacement[depthKey].forEach(item => {
//                 const nodeKey = `node${item.placedNodeNumber}`;
//                 if (!nodeDistribution[nodeKey]) {
//                     nodeDistribution[nodeKey] = { total: 0, large: 0, medium: 0, small: 0 };
//                 }
//                 nodeDistribution[nodeKey].total++;
//                 nodeDistribution[nodeKey][item.category]++;
//             });
            
//             // Print node distribution if there are nodes
//             if (Object.keys(nodeDistribution).length > 0) {
//                 console.log('    Node distribution:');
//                 Object.entries(nodeDistribution).forEach(([nodeKey, counts]) => {
//                     console.log(`      ${nodeKey}: ${counts.total} meshes (L:${counts.large}, M:${counts.medium}, S:${counts.small})`);
//                 });
//             }
//         }
        
//         // Create final mesh placement map
//         const meshPlacementMap = new Map();
        
//         // Organize by node
//         for (let depth = 0; depth <= 4; depth++) {
//             const depthKey = `depth${depth}`;
//             finalPlacement[depthKey].forEach(meshInfo => {
//                 const nodeKey = `node${meshInfo.placedNodeNumber}`;
                
//                 if (!meshPlacementMap.has(nodeKey)) {
//                     meshPlacementMap.set(nodeKey, []);
//                 }
                
//                 meshPlacementMap.get(nodeKey).push({
//                     meshId: meshInfo.meshId,
//                     category: meshInfo.category,
//                     screenCoverage: meshInfo.screenCoverage,
//                     originalNode: meshInfo.originalNodeNumber,
//                     originalDepth: meshInfo.originalDepth
//                 });
//             });
//         }
        
//         // Step 10: Merge and store meshes by node
//         console.log('\nSTEP 10: Merging and storing meshes by node...');
//         const allMergedMeshes = [];
        
//         for (const [nodeKey, meshes] of meshPlacementMap.entries()) {
//             const nodeNumber = parseInt(nodeKey.replace('node', ''));
//             console.log(`  Processing ${meshes.length} meshes for node ${nodeNumber}`);
            
//             const meshesToMerge = [];
//             const meshKeys = [];
            
//             for (const meshInfo of meshes) {
//                 let model = modelMap.get(meshInfo.meshId);
                
//                 if (!model) {
//                     const matchingKey = Array.from(modelMap.keys()).find(key => 
//                         key.includes(meshInfo.meshId)
//                     );
//                     if (matchingKey) {
//                         model = modelMap.get(matchingKey);
//                     }
//                 }
                
//                 if (model) {
//                     const meshData = {
//                         positions: new Float32Array(model.data.positions),
//                         indices: new Uint32Array(model.data.indices),
//                         normals: model.data.normals ? 
//                             new Float32Array(model.data.normals) : null,
//                         transforms: model.data.transforms,
//                         color: model.data.color
//                     };
                    
//                     meshesToMerge.push(meshData);
//                     meshKeys.push({
//                         meshId: meshInfo.meshId,
//                         category: meshInfo.category,
//                         screenCoverage: meshInfo.screenCoverage,
//                         originalNode: meshInfo.originalNode,
//                         originalDepth: meshInfo.originalDepth
//                     });
//                 }
//             }
            
//             if (meshesToMerge.length > 0) {
//                 const mergedVertexData = processMeshDataOffline(meshesToMerge);
//                 const meshId = `merged_node${nodeNumber}`;
                
//                 allMergedMeshes.push({
//                     id: meshId,
//                     name: meshId,
//                     vertexData: mergedVertexData,
//                     colors: mergedVertexData.colors,
//                     transforms: {
//                         position: { x: 0, y: 0, z: 0 },
//                         rotation: { x: 0, y: 0, z: 0 },
//                         scaling: { x: 1, y: 1, z: 1 },
//                         worldMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
//                     },
//                     metadata: {
//                         nodeNumber: nodeNumber,
//                         meshCount: meshesToMerge.length,
//                         originalMeshKeys: meshKeys,
//                         categories: {
//                             small: meshKeys.filter(m => m.category === 'small').length,
//                             medium: meshKeys.filter(m => m.category === 'medium').length,
//                             large: meshKeys.filter(m => m.category === 'large').length
//                         }
//                     }
//                 });
//             }
//         }
        
//         // Store merged meshes in database
//         const storeTx = db.transaction(['mergedMeshes', 'octree'], 'readwrite');
//         const mergedStore = storeTx.objectStore('mergedMeshes');
        
//         console.log(`  Storing ${allMergedMeshes.length} merged meshes`);
        
//         for (let i = 0; i < allMergedMeshes.length; i += STORE_CHUNK_SIZE) {
//             const storeChunk = allMergedMeshes.slice(i, i + STORE_CHUNK_SIZE);
//             await Promise.all(
//                 storeChunk.map(async data => {
//                     await mergedStore.put(data, data.id);
//                 })
//             );
//         }
        
//         // Store placement summary with depth-specific statistics
//         const placementSummary = {
//             totalMeshes: allMergedMeshes.length,
//             byCategory: {
//                 small: finalPlacement.depth0.concat(finalPlacement.depth1, finalPlacement.depth2, 
//                      finalPlacement.depth3, finalPlacement.depth4)
//                      .filter(m => m.category === 'small').length,
//                 medium: finalPlacement.depth0.concat(finalPlacement.depth1, finalPlacement.depth2, 
//                       finalPlacement.depth3, finalPlacement.depth4)
//                       .filter(m => m.category === 'medium').length,
//                 large: finalPlacement.depth0.concat(finalPlacement.depth1, finalPlacement.depth2, 
//                      finalPlacement.depth3, finalPlacement.depth4)
//                      .filter(m => m.category === 'large').length
//             },
//             byDepth: {
//                 depth0: finalPlacement.depth0.length,
//                 depth1: finalPlacement.depth1.length,
//                 depth2: finalPlacement.depth2.length,
//                 depth3: finalPlacement.depth3.length,
//                 depth4: finalPlacement.depth4.length
//             },
//             nodeMap: Object.fromEntries(meshPlacementMap),
//             processedAt: new Date().toISOString()
//         };
        
//         await mergedStore.put(placementSummary, 'placementSummary');
        
//         // Update octree
//         await storeTx.objectStore('octree').put(octreeData, 'mainOctree');
//         await storeTx.done;
        
//         console.log('\nProcessing complete!');
//         console.log(`Stored ${allMergedMeshes.length} merged meshes with overlap detection`);
//         console.log('Final placement summary:', placementSummary.byDepth);
        
//         return {
//             mergedMeshes: allMergedMeshes,
//             placementSummary: placementSummary,
//             finalPlacement: finalPlacement
//         };
        
//     } catch (error) {
//         console.error('Error in loadModels:', error);
//         throw error;
//     }
// };

// // Process overlapping meshes function
// async function processOverlapping(meshesObj, category, nodesByDepth, modelMap, octreeData, finalPlacement) {
//     // Track processed mesh IDs to avoid duplicates
//     const processedIds = new Set();
//     let processedCount = 0;
//     let overlappingCount = 0;
//     let relocatedCount = 0;
    
//     // Process all nodes that have meshes of this category
//     for (const [nodeNumber, meshes] of Object.entries(meshesObj)) {
//         console.log(`  Processing node ${nodeNumber} with ${meshes.length} ${category} meshes`);
        
//         for (const meshInfo of meshes) {
//             // Skip if already processed
//             if (processedIds.has(meshInfo.meshId)) continue;
//             processedIds.add(meshInfo.meshId);
//             processedCount++;
            
//             // Get the node containing this mesh
//             const nodeInfo = nodesByDepth[meshInfo.depth].find(n => n.nodeNumber === meshInfo.nodeNumber);
//             if (!nodeInfo) {
//                 console.log(`    Warning: Node ${meshInfo.nodeNumber} not found at depth ${meshInfo.depth}`);
//                 continue;
//             }
            
//             // // Check if mesh overlaps with other meshes in the same node
//             // const hasOverlap = checkMeshOverlapInNode(
//             //     meshInfo.bounds, 
//             //     nodeInfo.meshIds, 
//             //     meshInfo.meshId, 
//             //     modelMap
//             // );

//             // Get all other nodes at the same depth (excluding current node)
// const sameDepthNodes = nodesByDepth[meshInfo.depth].filter(
//     n => n.nodeNumber !== meshInfo.nodeNumber
// );

// // Collect all mesh IDs in other nodes at same depth
// const meshIdsAtSameDepth = sameDepthNodes.flatMap(n => n.meshIds);

// // Optionally include current node if you want to check both
// // const meshIdsAtSameDepth = nodesByDepth[meshInfo.depth]
// //     .flatMap(n => n.meshIds)
// //     .filter(id => id !== meshInfo.meshId);

// // Check overlap against all meshes at same depth
// const hasOverlap = checkMeshOverlapInNode(
//     meshInfo.bounds,
//     meshIdsAtSameDepth,
//     meshInfo.meshId,
//     modelMap
// );

            
//             let placedDepth = meshInfo.depth;
//             let placedNodeNumber = meshInfo.nodeNumber;
            
//             if (hasOverlap) {
//                 overlappingCount++;
//                 console.log(`    Mesh ${meshInfo.meshId} overlaps in node ${meshInfo.nodeNumber}`);
                
//                 // Find a parent node where the mesh doesn't overlap
//                 const nonOverlappingParent = findNonOverlappingParent(
//                     octreeData,
//                     meshInfo.bounds,
//                     meshInfo.meshId,
//                     meshInfo.nodeNumber,
//                     modelMap
//                 );
                
//                 if (nonOverlappingParent) {
//                     relocatedCount++;
//                     placedDepth = nonOverlappingParent.depth;
//                     placedNodeNumber = nonOverlappingParent.nodeNumber;
//                     console.log(`      Relocated to node ${placedNodeNumber} at depth ${placedDepth}`);
//                 } else {
//                     // Place at root if no non-overlapping parent found
//                     placedDepth = 0;
//                     placedNodeNumber = 1; // Root node is typically node 1
//                     console.log(`      Relocated to root node at depth 0`);
//                     relocatedCount++;
//                 }
//             }
            
//             // Add mesh to the appropriate depth array in finalPlacement
//             finalPlacement[`depth${placedDepth}`].push({
//                 meshId: meshInfo.meshId,
//                 category: category,
//                 screenCoverage: meshInfo.screenCoverage,
//                 originalNodeNumber: meshInfo.nodeNumber,
//                 originalDepth: meshInfo.depth,
//                 placedNodeNumber: placedNodeNumber,
//                 placedDepth: placedDepth,
//                 bounds: meshInfo.bounds
//             });
//         }
//     }
    
//     console.log(`  Processed ${processedCount} ${category} meshes`);
//     console.log(`  Found ${overlappingCount} overlapping meshes`);
//     console.log(`  Relocated ${relocatedCount} meshes to parent nodes`);
// }

// // Helper function to check if a mesh overlaps with others in the same node
// function checkMeshOverlapInNode(meshBounds, nodeMeshIds, currentMeshId, modelMap) {
//     // Skip self-comparison
//     const otherMeshIds = nodeMeshIds.filter(id => id !== currentMeshId);
    
//     for (const otherMeshId of otherMeshIds) {
//         let otherModel = modelMap.get(otherMeshId);
        
//         if (!otherModel) {
//             const matchingKey = Array.from(modelMap.keys()).find(key => 
//                 key.includes(otherMeshId)
//             );
//             if (matchingKey) {
//                 otherModel = modelMap.get(matchingKey);
//             }
//         }
        
//         if (otherModel && otherModel.data.bounds) {
//             const otherBounds = otherModel.data.bounds;
            
//             // Check for overlap using bounding box
//             if (checkBoundsOverlap(meshBounds, otherBounds)) {
//                 return true;
//             }
//         }
//     }
    
//     return false;
// }

// // Helper function to check if two bounding boxes overlap
// function checkBoundsOverlap(bounds1, bounds2) {
//     // Simple AABB overlap check
//     return (
//         bounds1.min.x <= bounds2.max.x && bounds1.max.x >= bounds2.min.x &&
//         bounds1.min.y <= bounds2.max.y && bounds1.max.y >= bounds2.min.y &&
//         bounds1.min.z <= bounds2.max.z && bounds1.max.z >= bounds2.min.z
//     );
// }

// // Helper function to find a parent node where the mesh doesn't overlap
// function findNonOverlappingParent(octreeData, meshBounds, meshId, currentNodeNumber, modelMap) {
//     // Navigate up the octree to find parent nodes
//     const findNodeAndPath = (block, nodeNumber, path = []) => {
//         if (!block) return null;
        
//         if (block.properties && block.properties.nodeNumber === nodeNumber) {
//             return { node: block, path };
//         }
        
//         if (block.relationships && block.relationships.childBlocks) {
//             for (let i = 0; i < block.relationships.childBlocks.length; i++) {
//                 const result = findNodeAndPath(
//                     block.relationships.childBlocks[i], 
//                     nodeNumber, 
//                     [...path, i]
//                 );
//                 if (result) return result;
//             }
//         }
        
//         return null;
//     };
    
//     // Get parent node from path
//     const getParentNode = (node, path) => {
//         if (!node || path.length === 0) return null;
        
//         // Find the parent depth
//         const parentDepth = node.properties.depth - 1;
//         if (parentDepth < 0) return null;
        
//         // Get parent node by traversing up one level in the octree
//         let parentNode = octreeData;
//         let currentPath = [];
        
//         for (let i = 0; i < path.length - 1; i++) {
//             currentPath.push(path[i]);
//             if (!parentNode.relationships || !parentNode.relationships.childBlocks) {
//                 return null;
//             }
//             parentNode = parentNode.relationships.childBlocks[path[i]];
//         }
        
//         return parentNode;
//     };
    
//     // Start from the current node
//     const nodeResult = findNodeAndPath(octreeData, currentNodeNumber);
//     if (!nodeResult) return null;
    
//     const { node, path } = nodeResult;
    
//     // Get parent node
//     let currentNode = node;
//     let currentPath = path;
//     let currentDepth = node.properties.depth;
    
//     while (currentDepth > 0) {
//         const parentNode = getParentNode(currentNode, currentPath);
//         if (!parentNode) break;
        
//         // Check if mesh overlaps in parent node
//         const parentMeshIds = parentNode.meshInfos ? 
//             parentNode.meshInfos.map(info => info.id) : [];
        
//         const hasOverlap = checkMeshOverlapInNode(
//             meshBounds, 
//             parentMeshIds, 
//             meshId, 
//             modelMap
//         );
        
//         if (!hasOverlap) {
//             return {
//                 depth: parentNode.properties.depth,
//                 nodeNumber: parentNode.properties.nodeNumber
//             };
//         }
        
//         // Move up to the next parent
//         currentNode = parentNode;
//         currentPath = currentPath.slice(0, -1);
//         currentDepth--;
//     }
    
//     return null; // No non-overlapping parent found
// }

// function updateOctreeNode(block, targetNodeNumber, meshKey, meshType, depth = 0) {
//     if (depth === TARGET_DEPTH && block.properties.nodeNumber === targetNodeNumber) {
//         block.meshInfos.push({
//             id: meshKey,
//             type: meshType
//         });
//         return true;
//     }
    
//     if (depth < TARGET_DEPTH && block.relationships?.childBlocks) {
//         for (const child of block.relationships.childBlocks) {
//             if (updateOctreeNode(child, targetNodeNumber, meshKey, meshType, depth + 1)) {
//                 return true;
//             }
//         }
//     }
//     return false;
// }

// // import { initDB } from "./DbInit";
// // import { processMeshDataOffline } from "./processMeshDataOffline";
// // const TARGET_DEPTH = 4;

// // export const loadModels = async () => {
// // //   setIsLoading(true);
// //   console.log('Starting to process models...');

// //   try {
// //       const db = await initDB();
// //       console.log('Database initialized:', db.name, db.version);
      
// //       const tx = db.transaction(['octree', 'lowPolyMeshes'], 'readonly');
// //       console.log('Started transaction for reading data');
      
// //       const [octreeData, lowPolyModels] = await Promise.all([
// //           tx.objectStore('octree').get('mainOctree'),
// //           tx.objectStore('lowPolyMeshes').getAll()
// //       ]);

// //       console.log('Octree data loaded:', octreeData ? 'Yes' : 'No');
// //       console.log('LowPoly models loaded:', lowPolyModels.length);

// //       if (!octreeData?.data) {
// //           throw new Error('No octree data found');
// //       }

// //       // Collect depth 4 nodes
// //       const depth4Nodes = [];
// //       const stack = [{block: octreeData.data.blockHierarchy, depth: 0}];
      
// //       while (stack.length > 0) {
// //           const {block, depth} = stack.pop();
          
// //           if (depth === TARGET_DEPTH && block.meshInfos?.length > 0) {
// //               depth4Nodes.push({
// //                   nodeNumber: block.properties.nodeNumber,
// //                   meshIds: block.meshInfos.map(info => info.id),
// //                   bounds: block.bounds
// //               });
// //           } else if (depth < TARGET_DEPTH && block.relationships?.childBlocks) {
// //               stack.push(...block.relationships.childBlocks.map(child => ({
// //                   block: child,
// //                   depth: depth + 1
// //               })));
// //           }
// //       }

// //       console.log('Found depth 4 nodes:', depth4Nodes.length);
// //       console.log('Sample node:', depth4Nodes[0]);

// //       // Create model lookup map
// //       const modelMap = new Map();
// //   lowPolyModels.forEach(model => {
// //     // Add both fileName and metadata.id as possible keys
// //     if (model.fileName) {
// //         modelMap.set(model.fileName, model);
// //     }
// //     if (model.data?.metadata?.id) {
// //         modelMap.set(model.data.metadata.id, model);
// //     }
// // });

// //       console.log('Model map size:', modelMap.size);

// //       const CHUNK_SIZE = 20;
// //       const chunks = [];
// //       for (let i = 0; i < depth4Nodes.length; i += CHUNK_SIZE) {
// //           chunks.push(depth4Nodes.slice(i, i + CHUNK_SIZE));
// //       }

// //       console.log('Number of chunks to process:', chunks.length);
// //       const mergedMeshesData = [];
// //       let processedCount = 0;

// //       // Process chunks
// //       for (const chunk of chunks) {
// //         const chunkData = await Promise.all(chunk.map(async node => {
// //             const meshesGroupedByFile = new Map(); // Group meshes by fileId
// //             console.log('Processing node:', node.nodeNumber, 'with meshIds:', node.meshIds);
            
// //             // First, collect and group mesh data by file
// //             for (const meshId of node.meshIds) {
// //                 console.log('Looking for meshId:', meshId);
                
// //                 let model = modelMap.get(meshId);
// //                 if (!model) {
// //                     const matchingKey = Array.from(modelMap.keys()).find(key => 
// //                         key.includes(meshId)
// //                     );
// //                     if (matchingKey) {
// //                         model = modelMap.get(matchingKey);
// //                         console.log('Found model through partial match:', matchingKey);
// //                     }
// //                 }
    
// //                 if (model && model.data?.metadata?.screenCoverage > 0.5) {
// //                     const fileId = model.data.metadata.fileId; // Get fileId from metadata
// //                     if (!meshesGroupedByFile.has(fileId)) {
// //                         meshesGroupedByFile.set(fileId, {
// //                             meshes: [],
// //                             originalKeys: []
// //                         });
// //                     }
    
// //                     meshesGroupedByFile.get(fileId).meshes.push({
// //                         positions: new Float32Array(model.data.positions),
// //                         indices: new Uint32Array(model.data.indices),
// //                         normals: model.data.normals ? 
// //                             new Float32Array(model.data.normals) : null,
// //                         transforms: model.data.transforms
// //                     });
    
// //                     meshesGroupedByFile.get(fileId).originalKeys.push({
// //                         meshId: meshId,
// //                         fileName: model.fileName,
// //                         metadataId: model.data.metadata.id,
// //                         screenCoverage: model.data.metadata.screenCoverage
// //                     });
// //                 }
// //             }
    
// //             // Process each file group separately
// //             const mergedResults = [];
// //             for (const [fileId, groupData] of meshesGroupedByFile.entries()) {
// //                 if (groupData.meshes.length > 0) {
// //                     const mergedVertexData = processMeshDataOffline(groupData.meshes);
// //                     console.log('Merged vertex data for file:', fileId, 'in node:', node.nodeNumber, {
// //                         positions: mergedVertexData.positions.length,
// //                         indices: mergedVertexData.indices.length,
// //                         normals: mergedVertexData.normals?.length
// //                     });
    
// //                     mergedResults.push({
// //                         name: `merged_lowpoly_${fileId}_${node.nodeNumber}`,
// //                         vertexData: mergedVertexData,
// //                         transforms: {
// //                             position: { x: 0, y: 0, z: 0 },
// //                             rotation: { x: 0, y: 0, z: 0 },
// //                             scaling: { x: 1, y: 1, z: 1 },
// //                             worldMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
// //                         },
// //                         metadata: {
// //                             nodeNumber: node.nodeNumber,
// //                             fileId: fileId,
// //                             originalMeshCount: groupData.meshes.length,
// //                             bounds: node.bounds,
// //                             originalMeshKeys: groupData.originalKeys
// //                         }
// //                     });
// //                 }
// //             }
    
// //             return mergedResults;
// //         }));
    
// //         // Flatten the results since each node now might return multiple merged meshes
// //         const validResults = chunkData.flat().filter(Boolean);
// //         console.log('Valid results in chunk:', validResults.length);
// //         mergedMeshesData.push(...validResults);
        
// //         processedCount += chunk.length;
// //         console.log(`Processed ${processedCount} of ${depth4Nodes.length} nodes`);
    
// //         await new Promise(resolve => setTimeout(resolve, 0));
// //     }
// //       console.log('Total merged meshes data:', mergedMeshesData.length);

// //       // Store results
// //       if (mergedMeshesData.length > 0) {
// //           const STORE_CHUNK_SIZE = 50;
// //           const storeTx = db.transaction('mergedlowPoly', 'readwrite');
// //           const store = storeTx.objectStore('mergedlowPoly');
// //           console.log('Started storage transaction');

// //           for (let i = 0; i < mergedMeshesData.length; i += STORE_CHUNK_SIZE) {
// //             const storeChunk = mergedMeshesData.slice(i, i + STORE_CHUNK_SIZE);
// //             console.log('Storing chunk:', i / STORE_CHUNK_SIZE + 1, 'of', 
// //                 Math.ceil(mergedMeshesData.length / STORE_CHUNK_SIZE));
            
// //             try {
// //                 await Promise.all(
// //                     storeChunk.map(async data => {
// //                         const key = `merged_lowpoly_${data.metadata.fileId}_${data.metadata.nodeNumber}`;
// //                         console.log('Storing mesh data with key:', key);
// //                         await store.put(data, key);
// //                     })
// //                 );
// //                 console.log('Successfully stored chunk');
// //             } catch (error) {
// //                 console.error('Error storing chunk:', error);
// //                 throw error;
// //             }
// //         }

// //           try {
// //               await storeTx.done;
// //               console.log('Storage transaction completed successfully');
              
// //               // Verify storage
// //               const verifyTx = db.transaction('mergedlowPoly', 'readonly');
// //               const verifyStore = verifyTx.objectStore('mergedlowPoly');
// //               const storedCount = await verifyStore.count();
// //               console.log('Verified stored mesh count:', storedCount);
// //           } catch (error) {
// //               console.error('Transaction completion error:', error);
// //               throw error;
// //           }
// //       }

// //   } catch (error) {
// //       console.error('Error in loadModels:', error);
// //   } finally {
// //     //   setIsLoading(false);
// //   }
// // };


// // import { initDB } from "./DbInit";
// // import { processMeshDataOffline } from "./processMeshDataOffline";
// // import * as BABYLON from '@babylonjs/core';

// // const TARGET_DEPTH = 4;

// // // Function to convert mesh data to ArrayBuffer
// // const convertMeshToArrayBuffer = (vertexData, transforms, metadata) => {
// //     // Create an object with all the mesh data
// //     const meshData = {
// //         positions: Array.from(vertexData.positions),
// //         indices: Array.from(vertexData.indices),
// //         normals: vertexData.normals ? Array.from(vertexData.normals) : null,
// //         transforms: transforms,
// //         metadata: metadata
// //     };

// //     // Convert to JSON string
// //     const jsonString = JSON.stringify(meshData);
    
// //     // Convert to ArrayBuffer
// //     const encoder = new TextEncoder();
// //     const arrayBuffer = encoder.encode(jsonString).buffer;
    
// //     return arrayBuffer;
// // };

// // export const loadModels = async () => {
// //     console.log('Starting to process models...');

// //     try {
// //         const db = await initDB();
// //         console.log('Database initialized:', db.name, db.version);
        
// //         const tx = db.transaction(['octree', 'lowPolyMeshes'], 'readonly');
// //         const [octreeData, lowPolyModels] = await Promise.all([
// //             tx.objectStore('octree').get('mainOctree'),
// //             tx.objectStore('lowPolyMeshes').getAll()
// //         ]);

// //         if (!octreeData?.data) {
// //             throw new Error('No octree data found');
// //         }
// //                   // Collect depth 4 nodes
// //                   const depth4Nodes = [];
// //                   const stack = [{block: octreeData.data.blockHierarchy, depth: 0}];
                  
// //                   while (stack.length > 0) {
// //                       const {block, depth} = stack.pop();
                      
// //                       if (depth === TARGET_DEPTH && block.meshInfos?.length > 0) {
// //                           depth4Nodes.push({
// //                               nodeNumber: block.properties.nodeNumber,
// //                               meshIds: block.meshInfos.map(info => info.id),
// //                               bounds: block.bounds
// //                           });
// //                       } else if (depth < TARGET_DEPTH && block.relationships?.childBlocks) {
// //                           stack.push(...block.relationships.childBlocks.map(child => ({
// //                               block: child,
// //                               depth: depth + 1
// //                           })));
// //                       }
// //                   }
            
// //                   console.log('Found depth 4 nodes:', depth4Nodes.length);
// //                   console.log('Sample node:', depth4Nodes[0]);
            
// //                   // Create model lookup map
// //                   const modelMap = new Map();
// //               lowPolyModels.forEach(model => {
// //                 // Add both fileName and metadata.id as possible keys
// //                 if (model.fileName) {
// //                     modelMap.set(model.fileName, model);
// //                 }
// //                 if (model.data?.metadata?.id) {
// //                     modelMap.set(model.data.metadata.id, model);
// //                 }
// //             });
            
// //                   console.log('Model map size:', modelMap.size);
            
// //                   const CHUNK_SIZE = 20;
// //                   const chunks = [];
// //                   for (let i = 0; i < depth4Nodes.length; i += CHUNK_SIZE) {
// //                       chunks.push(depth4Nodes.slice(i, i + CHUNK_SIZE));
// //                   }
            
// //                   console.log('Number of chunks to process:', chunks.length);
// //                   const mergedMeshesData = [];
// //                   let processedCount = 0;
            
// //                   // Process chunks
// //                   for (const chunk of chunks) {
// //                       const chunkData = await Promise.all(chunk.map(async node => {
// //                           const meshesForNode = [];
// //                           console.log('Processing node:', node.nodeNumber, 'with meshIds:', node.meshIds);
                          
// //                           // Collect mesh data
// //                           for (const meshId of node.meshIds) {
// //                             // Log the current meshId we're looking for
// //                             console.log('Looking for meshId:', meshId);
                            
// //                             // Try direct lookup first
// //                             let model = modelMap.get(meshId);
                            
// //                             // If not found, try partial matching like in original code
// //                             if (!model) {
// //                                 const matchingKey = Array.from(modelMap.keys()).find(key => 
// //                                     key.includes(meshId)
// //                                 );
// //                                 if (matchingKey) {
// //                                     model = modelMap.get(matchingKey);
// //                                     console.log('Found model through partial match:', matchingKey);
// //                                 }
// //                             }
                        
// //                             if (model && model.data?.metadata?.screenCoverage > 0.01) {
// //                               console.log('Found matching model with sufficient screen coverage:', {
// //                                   meshId,
// //                                   fileName: model.fileName,
// //                                   metadataId: model.data?.metadata?.id,
// //                                   screenCoverage: model.data.metadata.screenCoverage
// //                               });
// //                                 meshesForNode.push({
// //                                     positions: new Float32Array(model.data.positions),
// //                                     indices: new Uint32Array(model.data.indices),
// //                                     normals: model.data.normals ? 
// //                                         new Float32Array(model.data.normals) : null,
// //                                     transforms: model.data.transforms
// //                                 });
// //                             } else {
// //                                 console.warn('No matching model found for meshId:', meshId);
// //                             }
// //                         }
            
// //                           if (meshesForNode.length > 0) {
// //                               const mergedVertexData = processMeshDataOffline(meshesForNode);
// //                               console.log('Merged vertex data for node:', node.nodeNumber, {
// //                                   positions: mergedVertexData.positions.length,
// //                                   indices: mergedVertexData.indices.length,
// //                                   normals: mergedVertexData.normals?.length
// //                               });
                              
// //                               // Store the original mesh keys/IDs that were used in this merge
// //                               const originalMeshKeys = node.meshIds.map(meshId => {
// //                                   // Try to get both the fileName and metadata.id if they exist
// //                                   const model = modelMap.get(meshId) || Array.from(modelMap.entries())
// //                                       .find(([key]) => key.includes(meshId))?.[1];
                                  
// //                                   return {
// //                                       meshId: meshId,
// //                                       fileName: model?.fileName,
// //                                       metadataId: model?.data?.metadata?.id,
// //                                       screenCoverage: model?.data?.metadata?.screenCoverage,
// //                                       originalMeshKeys: model?.data?.metadata?.originalMeshKeys || [],
// //                                   };
// //                               });
                              
// //                               return {
// //                                 name: `lpoly_node_${node.nodeNumber}`,
// //                                 vertexData: mergedVertexData,
// //                                 // Add default transforms if none exist
// //                                 transforms: {
// //                                     position: { x: 0, y: 0, z: 0 },
// //                                     rotation: { x: 0, y: 0, z: 0 },
// //                                     scaling: { x: 1, y: 1, z: 1 },
// //                                     worldMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] // Identity matrix as default
// //                                 },
// //                                 metadata: {
// //                                     nodeNumber: node.nodeNumber,
// //                                     originalMeshCount: meshesForNode.length,
// //                                     bounds: node.bounds,
// //                                     originalMeshKeys: originalMeshKeys, // Add the original mesh keys to metadata
// //                                 }
// //                             };
// //                           }
// //                           return null;
// //                       }));
            
// //                       // Add valid results to final array
// //                       const validResults = chunkData.filter(Boolean);
// //                       console.log('Valid results in chunk:', validResults.length);
// //                       mergedMeshesData.push(...validResults);
                      
// //                       processedCount += chunk.length;
// //                       console.log(`Processed ${processedCount} of ${depth4Nodes.length} nodes`);
            
// //                       await new Promise(resolve => setTimeout(resolve, 0));
// //                   }
            
// //                   console.log('Total merged meshes data:', mergedMeshesData.length);
            
// //                   // Store results
// //                   if (mergedMeshesData.length > 0) {
// //                     const STORE_CHUNK_SIZE = 50;
// //                     const storeTx = db.transaction('mergedMeshArrayBuffer', 'readwrite');
// //                     const store = storeTx.objectStore('mergedMeshArrayBuffer');
// //                     console.log('Started storage transaction for binary files');
        
// //                     for (let i = 0; i < mergedMeshesData.length; i += STORE_CHUNK_SIZE) {
// //                         const storeChunk = mergedMeshesData.slice(i, i + STORE_CHUNK_SIZE);
// //                         console.log('Processing binary chunk:', i / STORE_CHUNK_SIZE + 1, 'of', 
// //                             Math.ceil(mergedMeshesData.length / STORE_CHUNK_SIZE));
                        
// //                         try {
// //                             await Promise.all(
// //                                 storeChunk.map(async data => {
// //                                     const key = `merged_node_${data.metadata.nodeNumber}`;
// //                                     console.log('Converting mesh to binary:', key);
                                    
// //                                     // Convert to ArrayBuffer
// //                                     const arrayBuffer = convertMeshToArrayBuffer(
// //                                         data.vertexData,
// //                                         data.transforms,
// //                                         data.metadata
// //                                     );
                                    
// //                                     // Store array buffer data
// //                                     await store.put({
// //                                         arrayBuffer: arrayBuffer,
// //                                         metadata: data.metadata,
// //                                         fileName: key
// //                                     }, key);
                                    
// //                                     console.log('Successfully stored binary:', key);
// //                                 })
// //                             );
// //                             console.log('Successfully stored binary chunk');
// //                         } catch (error) {
// //                             console.error('Error storing binary chunk:', error);
// //                             throw error;
// //                         }
// //                     }
        
// //                     try {
// //                         await storeTx.done;
// //                         console.log('Binary storage transaction completed successfully');
                        
// //                         // Verify storage
// //                         const verifyTx = db.transaction('mergedMeshArrayBuffer', 'readonly');
// //                         const verifyStore = verifyTx.objectStore('mergedMeshArrayBuffer');
// //                         const storedCount = await verifyStore.count();
// //                         console.log('Verified stored binary count:', storedCount);
// //                     } catch (error) {
// //                         console.error('Transaction completion error:', error);
// //                         throw error;
// //                     }
// //                 }
// //             } catch (error) {
// //                 console.error('Error in loadModels:', error);
// //             }
// //         };
