// meshProcessingWorker.js - Web Worker for heavy mesh processing tasks
// Import necessary libraries (adjust paths as needed)
/* eslint no-restricted-globals: off */
import * as BABYLON from "@babylonjs/core";

// Worker state
let meshIdCounter = 0;
let nodeCounter = 0;
let nodesAtDepth = {};
let nodesAtDepthWithBoxes = {};
let boxesAtDepth = {};

// Constants
const MAX_DEPTH = 4;
const MIN_SIZE = 0.1;
const COVERAGE_THRESHOLDS = {
  LARGE: 2,
  MEDIUM: 1
};
const STORE_CHUNK_SIZE = 50;

// Database helper
let dbInstance = null;

const initDB = async () => {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('piping', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('originalMeshes')) {
        db.createObjectStore('originalMeshes');
      }
      if (!db.objectStoreNames.contains('octree')) {
        db.createObjectStore('octree');
      }
      if (!db.objectStoreNames.contains('mergedMeshes')) {
        db.createObjectStore('mergedMeshes');
      }
    };
  });
};

// Mesh data extraction function
const extractMeshDataFromFile = async (file, fileId, cameraInfo) => {
  try {
    // Create a temporary engine and scene for processing
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    
    // Load the file
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", file, scene);
    const meshes = result.meshes.filter(
      mesh => mesh.name !== "__root__" && mesh.isVisible && mesh.geometry
    );

    const extractedMeshData = [];

    meshes.forEach((mesh, index) => {
      try {
        // Generate unique mesh ID
        const originalMeshId = `${fileId}_mesh_${String(index).padStart(4, '0')}`;
        meshIdCounter++;

        // Extract geometry data
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        const indices = mesh.getIndices();

        if (!positions || !normals || !indices) {
          console.warn(`Mesh ${mesh.name} is missing required geometry data`);
          return;
        }

        // Calculate screen coverage
        const screenCoverage = calculateScreenCoverage(mesh, cameraInfo);

        // Extract bounding box
        const boundingInfo = mesh.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;

        const meshData = {
          fileName: originalMeshId,
          data: {
            fileName: originalMeshId,
            positions: Array.from(positions),
            normals: Array.from(normals),
            indices: Array.from(indices),
            boundingBox: {
              minimumWorld: {
                x: boundingBox.minimumWorld.x,
                y: boundingBox.minimumWorld.y,
                z: boundingBox.minimumWorld.z
              },
              maximumWorld: {
                x: boundingBox.maximumWorld.x,
                y: boundingBox.maximumWorld.y,
                z: boundingBox.maximumWorld.z
              }
            },
            name: mesh.name,
            metadata: {
              id: originalMeshId,
              fileId: fileId,
              screenCoverage,
              geometryInfo: {
                totalVertices: mesh.getTotalVertices(),
                totalIndices: mesh.getTotalIndices(),
                faceCount: mesh.getTotalIndices() / 3,
              },
            },
            transforms: {
              position: mesh.position.asArray(),
              rotation: mesh.rotation.asArray(),
              scaling: mesh.scaling.asArray(),
              worldMatrix: mesh.getWorldMatrix().toArray(),
            },
          },
        };

        extractedMeshData.push(meshData);
      } catch (error) {
        console.error(`Error extracting data from mesh ${mesh.name}:`, error);
      }
    });

    // Cleanup
    scene.dispose();
    engine.dispose();

    return extractedMeshData;
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return [];
  }
};

// Screen coverage calculation
const calculateScreenCoverage = (mesh, cameraInfo) => {
  try {
    const boundingInfo = mesh.getBoundingInfo();
    if (!boundingInfo) return 0;

    const boundingBox = boundingInfo.boundingBox;
    const centerWorld = boundingBox.centerWorld || boundingBox.center;

    let minimumWorld = boundingBox.minimumWorld;
    let maximumWorld = boundingBox.maximumWorld;

    if (!minimumWorld || !maximumWorld) {
      minimumWorld = boundingBox.minimum;
      maximumWorld = boundingBox.maximum;
    }

    // Calculate size using pure math operations
    const size = {
      x: maximumWorld.x - minimumWorld.x,
      y: maximumWorld.y - minimumWorld.y,
      z: maximumWorld.z - minimumWorld.z
    };

    const dimensions = [
      Math.abs(size.x) || 0.001,
      Math.abs(size.y) || 0.001,
      Math.abs(size.z) || 0.001,
    ];

    const maxDimension = Math.max(...dimensions);
    const otherDimensions = dimensions.filter(dim => dim !== maxDimension);
    const averageOfOthers = otherDimensions.length > 0
      ? otherDimensions.reduce((a, b) => a + b, 0) / otherDimensions.length
      : maxDimension / 2;

    const cameraRadius = cameraInfo.radius || 10;
    const radiusScreen = averageOfOthers / cameraRadius;
    const renderWidth = 1024; // Default render width

    return radiusScreen * renderWidth;
  } catch (error) {
    console.warn("Error calculating screen coverage:", error);
    return 0;
  }
};

// Database operations
const batchStoreInDB = async (operations) => {
  const db = await initDB();
  const stores = new Map();

  // Group operations by store
  operations.forEach((op) => {
    if (!stores.has(op.store)) {
      stores.set(op.store, []);
    }
    stores.get(op.store).push(op);
  });

  // Process each store in parallel
  await Promise.all(
    Array.from(stores.entries()).map(([storeName, ops]) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);

      return Promise.all(
        ops.map(
          (op) =>
            new Promise((resolve, reject) => {
              const request = store.put(op.data, op.key);
              request.onsuccess = resolve;
              request.onerror = reject;
            })
        )
      );
    })
  );
};

// Octree creation functions
const createOctreeBlock = (bounds, meshInfos, depth, parent) => {
  nodeCounter++;
  const nodeNumber = nodeCounter;

  // Initialize depth tracking
  if (!nodesAtDepth[depth]) {
    nodesAtDepth[depth] = 0;
    nodesAtDepthWithBoxes[depth] = 0;
    boxesAtDepth[depth] = new Set();
  }
  nodesAtDepth[depth]++;

  const centerX = (bounds.minimum.x + bounds.maximum.x) / 2;
  const centerY = (bounds.minimum.y + bounds.maximum.y) / 2;
  const centerZ = (bounds.minimum.z + bounds.maximum.z) / 2;

  const sizeX = bounds.maximum.x - bounds.minimum.x;
  const sizeY = bounds.maximum.y - bounds.minimum.y;
  const sizeZ = bounds.maximum.z - bounds.minimum.z;

  const block = {
    minPoint: bounds.minimum,
    maxPoint: bounds.maximum,
    center: { x: centerX, y: centerY, z: centerZ },
    size: { x: sizeX, y: sizeY, z: sizeZ },
    meshInfos: [],
    blocks: [],
    depth: depth,
    nodeNumber: nodeNumber,
    parent: parent
  };

  // Add meshes that fit in this block
  meshInfos.forEach(meshInfo => {
    if (isPointInBounds(meshInfo.boundingBox, bounds)) {
      block.meshInfos.push(meshInfo);
      boxesAtDepth[depth].add(meshInfo.metadata.id);
    }
  });

  if (block.meshInfos.length > 0) {
    nodesAtDepthWithBoxes[depth]++;
  }

  // Create child blocks if conditions are met
  if (depth < MAX_DEPTH && block.meshInfos.length > 1 && 
      Math.min(sizeX, sizeY, sizeZ) > MIN_SIZE) {
    
    const childBounds = [
      // 8 octants
      {
        minimum: bounds.minimum,
        maximum: { x: centerX, y: centerY, z: centerZ }
      },
      {
        minimum: { x: centerX, y: bounds.minimum.y, z: bounds.minimum.z },
        maximum: { x: bounds.maximum.x, y: centerY, z: centerZ }
      },
      {
        minimum: { x: bounds.minimum.x, y: centerY, z: bounds.minimum.z },
        maximum: { x: centerX, y: bounds.maximum.y, z: centerZ }
      },
      {
        minimum: { x: centerX, y: centerY, z: bounds.minimum.z },
        maximum: { x: bounds.maximum.x, y: bounds.maximum.y, z: centerZ }
      },
      {
        minimum: { x: bounds.minimum.x, y: bounds.minimum.y, z: centerZ },
        maximum: { x: centerX, y: centerY, z: bounds.maximum.z }
      },
      {
        minimum: { x: centerX, y: bounds.minimum.y, z: centerZ },
        maximum: { x: bounds.maximum.x, y: centerY, z: bounds.maximum.z }
      },
      {
        minimum: { x: bounds.minimum.x, y: centerY, z: centerZ },
        maximum: { x: centerX, y: bounds.maximum.y, z: bounds.maximum.z }
      },
      {
        minimum: { x: centerX, y: centerY, z: centerZ },
        maximum: bounds.maximum
      }
    ];

    childBounds.forEach(childBound => {
      const childMeshes = block.meshInfos.filter(meshInfo =>
        isPointInBounds(meshInfo.boundingBox, childBound)
      );

      if (childMeshes.length > 0) {
        const childBlock = createOctreeBlock(childBound, childMeshes, depth + 1, block);
        block.blocks.push(childBlock);
      }
    });
  }

  return block;
};

const isPointInBounds = (boundingBox, bounds) => {
  return (
    boundingBox.minimumWorld.x >= bounds.minimum.x &&
    boundingBox.maximumWorld.x <= bounds.maximum.x &&
    boundingBox.minimumWorld.y >= bounds.minimum.y &&
    boundingBox.maximumWorld.y <= bounds.maximum.y &&
    boundingBox.minimumWorld.z >= bounds.minimum.z &&
    boundingBox.maximumWorld.z <= bounds.maximum.z
  );
};

// Serialize octree for storage
const serializeBlock = (block) => {
  if (!block) return null;

  const meshInfos = Array.isArray(block.meshInfos) ? block.meshInfos : [];
  const processedMeshInfos = meshInfos.map((info) => ({
    id: info.id || info.metadata?.id || "unknown",
    ...info,
  }));

  return {
    bounds: {
      min: { x: block.minPoint.x, y: block.minPoint.y, z: block.minPoint.z },
      max: { x: block.maxPoint.x, y: block.maxPoint.y, z: block.maxPoint.z },
    },
    meshInfos: processedMeshInfos,
    properties: {
      depth: block.depth || 0,
      nodeNumber: block.nodeNumber || 0,
      capacity: block.meshInfos ? block.meshInfos.length : 0,
    },
    relationships: {
      childBlocks: Array.isArray(block.blocks)
        ? block.blocks
            .filter((childBlock) => childBlock)
            .map((childBlock) => serializeBlock(childBlock))
        : [],
      parentNode: block.parent ? block.parent.nodeNumber : null,
    },
  };
};

// Merged mesh processing (simplified version)
const processMergedMeshes = async (octreeData) => {
  try {
    const db = await initDB();
    
    // Get all original meshes
    const tx = db.transaction(['originalMeshes'], 'readonly');
    const meshStore = tx.objectStore('originalMeshes');
    
    const lowPolyModels = await new Promise((resolve, reject) => {
      const request = meshStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Create model lookup map
    const modelMap = new Map();
    lowPolyModels.forEach((model) => {
      if (model.fileName) {
        modelMap.set(model.fileName, model);
      }
      if (model.data?.metadata?.id) {
        modelMap.set(model.data.metadata.id, model);
      }
    });

    // Process the octree and create merged meshes
    // (This is a simplified version - implement full logic as needed)
    const mergedMeshes = [];
    let processedNodes = 0;

    // Traverse octree and process nodes
    const processNode = (node, depth = 0) => {
      if (!node || !node.meshInfos || node.meshInfos.length === 0) return;

      processedNodes++;
      
      // Create merged mesh for this node
      const nodeId = `merged_node_${node.properties.nodeNumber}`;
      const mergedMesh = {
        id: nodeId,
        name: nodeId,
        metadata: {
          nodeNumber: node.properties.nodeNumber,
          depth: depth,
          meshCount: node.meshInfos.length
        }
      };

      mergedMeshes.push(mergedMesh);

      // Process child nodes
      if (node.relationships && node.relationships.childBlocks) {
        node.relationships.childBlocks.forEach(child => {
          processNode(child, depth + 1);
        });
      }
    };

    processNode(octreeData.data.blockHierarchy);

    // Store merged meshes
    const storeTx = db.transaction(['mergedMeshes'], 'readwrite');
    const mergedStore = storeTx.objectStore('mergedMeshes');

    for (const mesh of mergedMeshes) {
      await new Promise((resolve, reject) => {
        const request = mergedStore.put(mesh, mesh.id);
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    }

    return {
      mergedMeshCount: mergedMeshes.length,
      processedNodes: processedNodes
    };

  } catch (error) {
    console.error('Error in processMergedMeshes:', error);
    throw error;
  }
};

// Message handler
self.onmessage = async (e) => {
  const { type, ...data } = e.data;

  try {
    switch (type) {
      case 'EXTRACT_MESH_DATA':
        const meshData = await extractMeshDataFromFile(data.file, data.fileId, data.camera);
        self.postMessage({ meshData });
        break;

      case 'BATCH_STORE_DB':
        await batchStoreInDB(data.operations);
        self.postMessage({ result: 'success' });
        break;

      case 'CREATE_OCTREE':
        // Reset counters
        nodeCounter = 0;
        nodesAtDepth = {};
        nodesAtDepthWithBoxes = {};
        boxesAtDepth = {};

        const octreeRoot = createOctreeBlock(data.bounds, data.meshInfos, 0, null);
        
        const octreeInfo = {
          name: "mainOctree",
          data: {
            blockHierarchy: serializeBlock(octreeRoot),
            version: "1.0",
          },
          bounds: {
            min: data.bounds.minimum,
            max: data.bounds.maximum,
          },
          properties: {
            maxDepth: MAX_DEPTH,
            minSize: MIN_SIZE,
            totalNodes: nodeCounter,
            nodesPerLevel: Array(MAX_DEPTH + 1)
              .fill(0)
              .map((_, i) => nodesAtDepth[i] || 0),
            nodesWithBoxes: nodesAtDepthWithBoxes,
          },
          timestamp: new Date().toISOString(),
        };

        self.postMessage({ octreeData: octreeInfo });
        break;

      case 'PROCESS_MERGED_MESHES':
        const result = await processMergedMeshes(data.octreeData);
        self.postMessage({ result });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};