import { SaveMergedMesh } from "../services/GlobalModalApi";
import { initDB } from "./DbInit";
import { processMeshDataOffline } from "./processMeshDataOffline";

const STORE_CHUNK_SIZE = 25;
const WORKER_CHUNK_SIZE = 1000; // Process models in chunks of 1000
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  
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
        } catch (e) {
            workerScript = `/meshProcessingWorker.js?v=${Date.now()}`;
        }
        
        // this.worker = new Worker('meshProcessingWorker.js');
         this.worker  = new Worker(new URL("../Utils/meshProcessingWorker.js", import.meta.url));
        console.log('Worker created successfully');
       this.worker.onmessage = (e) => {
    const { type, data, error, messageId } = e.data;
    
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
        
        onProgress?.({ stage: 'Data loaded', progress: 10 });
        
        // SMART DECISION: Choose processing method based on dataset size
        const LARGE_DATASET_THRESHOLD = 50000; // 50K models
        const isLargeDataset = lowPolyModels.length > LARGE_DATASET_THRESHOLD;
      
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
        const { allMergedMeshes, placementSummary, totalStoredMeshes } = await createAndMergeMeshes(
            finalPlacement, 
            lowPolyModels, 
            onProgress
        );
        
        // Step 5: Store final summary
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
    
    // Step 1: Process octree structure on main thread
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
// Updated createAndMergeMeshes function with proper data serialization for backend
async function createAndMergeMeshes(finalPlacement, lowPolyModels, onProgress) {
  console.log("Creating mesh placement map...");

  // Create model lookup for merging
  const modelMap = {};
  lowPolyModels.forEach((model) => {
    const id = model.fileName || model.data?.metadata?.id;
    if (id) {
      modelMap[id] = model;
    }
  });

  const meshPlacementMap = new Map();

  // Organize by node
  for (let depth = 0; depth <= 4; depth++) {
    const depthKey = `depth${depth}`;
    finalPlacement[depthKey].forEach((meshInfo) => {
      const nodeKey = `node${meshInfo.placedNodeNumber}`;
      if (!meshPlacementMap.has(nodeKey)) {
        meshPlacementMap.set(nodeKey, []);
      }
      meshPlacementMap.get(nodeKey).push({
        meshId: meshInfo.meshId,
        category: meshInfo.category,
        screenCoverage: meshInfo.screenCoverage,
        originalNode: meshInfo.originalNodeNumber,
        originalDepth: meshInfo.originalDepth,
      });
    });
  }

  console.log(
    `Processing ${meshPlacementMap.size} nodes with streaming merge and store...`
  );

  // Track statistics
  let totalStoredMeshes = 0;
  let processedNodes = 0;
  const totalNodes = meshPlacementMap.size;
  const categoryStats = { small: 0, medium: 0, large: 0 };
  const nodeList = [];
  const meshesToSend = []; // Collect meshes for backend save outside transaction

  // Get database connection
  const db = await initDB();

  // Process nodes in batches
  const BATCH_SIZE = 10;
  const nodeEntries = Array.from(meshPlacementMap.entries());

  for (
    let batchStart = 0;
    batchStart < nodeEntries.length;
    batchStart += BATCH_SIZE
  ) {
    console.log(
      `🔄 Starting batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(
        nodeEntries.length / BATCH_SIZE
      )}`
    );

    // Create a new transaction for this batch
    const storeTx = db.transaction(["mergedMeshes"], "readwrite");
    const mergedStore = storeTx.objectStore("mergedMeshes");

    const batchEnd = Math.min(batchStart + BATCH_SIZE, nodeEntries.length);

    // Process nodes in this batch
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const [nodeKey, meshes] = nodeEntries[i];
      const nodeNumber = parseInt(nodeKey.replace("node", ""));

      console.log(
        `  🔄 Processing node ${nodeNumber} with ${meshes.length} meshes... (${
          processedNodes + 1
        }/${totalNodes})`
      );

      const meshesToMerge = [];
      const meshKeys = [];

      // Collect meshes for this node
      for (const meshInfo of meshes) {
        const model = modelMap[meshInfo.meshId];
        if (model && model.data) {
          const meshData = {
            positions: new Float32Array(model.data.positions),
            indices: new Uint32Array(model.data.indices),
            normals: model.data.normals
              ? new Float32Array(model.data.normals)
              : null,
            transforms: model.data.transforms,
            color: model.data.color,
          };

          meshesToMerge.push(meshData);
          meshKeys.push({
            meshId: meshInfo.meshId,
            category: meshInfo.category,
            screenCoverage: meshInfo.screenCoverage,
            originalNode: meshInfo.originalNode,
            originalDepth: meshInfo.originalDepth,
            fileName: model.fileName,
            parentFileName: model.data.metadata.fileId,
            metadataId: model.data.metadata.id,
            screenCoverage: model.data.metadata.screenCoverage,
            name: model.data.name,
          });

          categoryStats[meshInfo.category]++;
        }
      }

      if (meshesToMerge.length > 0) {
        // Merge meshes
        console.log(`    🔨 Merging ${meshesToMerge.length} meshes...`);
        const mergedVertexData = processMeshDataOffline(meshesToMerge);
        const detailedVertexMappings = mergedVertexData.vertexMappings.map(
          (mapping, index) => ({
            ...mapping,
            meshId: meshKeys[index].meshId,
            fileName: meshKeys[index].fileName,
            metadataId: meshKeys[index].metadataId,
            screenCoverage: meshKeys[index].screenCoverage,
            parentFileName: meshKeys[index].parentFileName,
            name: meshKeys[index].name,
            start: mapping.startVertex,
            count: mapping.vertexCount,
          })
        );

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
            worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          },
          parentFileName: mergedVertexData.parentFile,
          metadata: {
            nodeNumber: nodeNumber,
            meshCount: meshesToMerge.length,
            originalMeshKeys: meshKeys,
            vertexMappings: detailedVertexMappings,
            categories: {
              small: meshKeys.filter((m) => m.category === "small").length,
              medium: meshKeys.filter((m) => m.category === "medium").length,
              large: meshKeys.filter((m) => m.category === "large").length,
            },
          },
        };

        // Store to database within transaction
        console.log(`    💾 Storing merged mesh to database...`);
        batchPromises.push(mergedStore.put(mergedMeshData, mergedMeshData.id));

        // Prepare data for backend - ensure proper serialization
        const backendData = {
          MergedMeshId: mergedMeshData.id,
          data: {
          
            ...mergedMeshData,
            // Convert typed arrays to regular arrays for JSON serialization
            vertexData: {
              ...mergedVertexData,
              positions: Array.from(mergedVertexData.positions),
              indices: Array.from(mergedVertexData.indices),
              normals: mergedVertexData.normals ? Array.from(mergedVertexData.normals) : null,
              colors: mergedVertexData.colors ? Array.from(mergedVertexData.colors) : null,
              vertexMappings: mergedVertexData.vertexMappings.map(mapping => ({
                ...mapping,
                startVertex: mapping.startVertex,
                vertexCount: mapping.vertexCount
              }))
            },
            // Ensure colors are properly serialized
            colors: mergedVertexData.colors ? Array.from(mergedVertexData.colors) : null,
            // Include all metadata
            metadata: {
              ...mergedMeshData.metadata,
              originalMeshKeys: meshKeys.map(key => ({
                ...key,
                // Ensure no circular references
                transforms: key.transforms ? JSON.parse(JSON.stringify(key.transforms)) : null
              })),
              vertexMappings: detailedVertexMappings.map(mapping => ({
                ...mapping,
                // Ensure no circular references
                transforms: mapping.transforms ? JSON.parse(JSON.stringify(mapping.transforms)) : null
              }))
            }
          },
          projectId,
        };

        // Collect for backend save (outside transaction)
        meshesToSend.push(backendData);

        nodeList.push({
          nodeNumber: nodeNumber,
          meshCount: meshesToMerge.length,
          categories: mergedMeshData.metadata.categories,
        });

        totalStoredMeshes++;

        // Clear large objects from memory
        mergedMeshData.vertexData = null;
        mergedMeshData.colors = null;
        console.log(
          `    ✅ Node ${nodeNumber} completed and cleared from memory`
        );
      }

      // Clear arrays
      meshesToMerge.length = 0;
      meshKeys.length = 0;

      processedNodes++;
    }

    // Wait for all put operations in this batch to complete
    await Promise.all(batchPromises);

    // Complete this batch transaction
    await storeTx.done;
    console.log(`  ✅ Batch completed - stored ${batchEnd - batchStart} nodes`);

    // Update progress
    const progress = 85 + (processedNodes / totalNodes) * 10;
    onProgress?.({
      stage: `Merged & stored ${processedNodes}/${totalNodes} nodes (${totalStoredMeshes} meshes)`,
      progress,
    });

    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  }

  // Save to backend outside transaction
  console.log(`📤 Sending ${meshesToSend.length} merged meshes to backend...`);
  for (const meshToSend of meshesToSend) {
    try {
      await SaveMergedMesh(meshToSend);
      console.log(`    📤 Sent merged mesh ${meshToSend.MergedMeshId} to backend`);
    } catch (err) {
      console.error(
        `    ❌ Failed to send merged mesh ${meshToSend.MergedMeshId} to backend`,
        err
      );
    }
  }

  console.log(
    `🎉 Streaming merge completed! Processed ${totalStoredMeshes} merged meshes`
  );

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
      depth4: finalPlacement.depth4.length,
    },
    nodeList: nodeList,
    processedAt: new Date().toISOString(),
    streamingMode: true,
  };

  // Store placement summary in a separate transaction
  const summaryTx = db.transaction(["mergedMeshes"], "readwrite");
  await summaryTx.objectStore("mergedMeshes").put(placementSummary, "placementSummary");
  await summaryTx.done;

  return {
    allMergedMeshes: [], // Empty - data is already in database
    placementSummary: placementSummary,
    totalStoredMeshes: totalStoredMeshes,
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

