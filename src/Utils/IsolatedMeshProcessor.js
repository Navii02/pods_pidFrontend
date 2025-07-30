/**
 * IsolatedMeshProcessor.js
 * Custom isolated mesh processing utilities for CreateGlobalModal workflow
 */
import * as BABYLON from "@babylonjs/core";
import { createOctreeBlock } from "./CreateOctreeBlock";

// Configuration constants
const MAX_DEPTH = 4;
const MIN_SIZE = 0;

// Global tracking variables (matching your existing structure)
let nodesAtDepth = new Array(MAX_DEPTH + 1).fill(0);
let nodeNumbersByDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
let nodesAtDepthWithBoxes = new Array(MAX_DEPTH + 1).fill(0);
let boxesAtDepth = Array.from({ length: MAX_DEPTH + 1 }, () => new Set());
let nodeContents = new Map();
let nodeDepths = new Map();
let nodeParents = new Map();
let nodeCounter = 1;

/**
 * Reset tracking variables - call this before creating new octree
 */
const resetTrackingVariables = () => {
  nodesAtDepth = new Array(MAX_DEPTH + 1).fill(0);
  nodeNumbersByDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
  nodesAtDepthWithBoxes = new Array(MAX_DEPTH + 1).fill(0);
  boxesAtDepth = Array.from({ length: MAX_DEPTH + 1 }, () => new Set());
  nodeContents = new Map();
  nodeDepths = new Map();
  nodeParents = new Map();
  nodeCounter = 1;
};

/**
 * Identifies meshes that are isolated (alone) in octree nodes
 * Specifically designed for your meshInfo structure
 */
export const findIsolatedMeshes = (block, isolatedMeshIds = new Set(), minDepth = 1) => {
  // Check if this block has exactly one mesh and is at sufficient depth
  if (block.meshInfos && block.meshInfos.length === 1 && block.depth >= minDepth) {
    const meshId = block.meshInfos[0].id;
    isolatedMeshIds.add(meshId);
    console.log(`Found isolated mesh ${meshId} at depth ${block.depth} in node ${block.nodeNumber}`);
  }
  
  // Recursively check child blocks
  if (block.blocks && block.blocks.length > 0) {
    block.blocks.forEach(childBlock => {
      findIsolatedMeshes(childBlock, isolatedMeshIds, minDepth);
    });
  }
  
  return isolatedMeshIds;
};

/**
 * Removes isolated meshes from your specific meshInfo array structure
 */
export const removeIsolatedMeshes = (meshInfos, isolatedMeshIds) => {
  const filteredMeshes = meshInfos.filter(meshInfo => 
    !isolatedMeshIds.has(meshInfo.metadata.id)
  );
  
  console.log(`Removed ${isolatedMeshIds.size} isolated meshes`);
  console.log(`Remaining meshes: ${filteredMeshes.length}`);
  
  return filteredMeshes;
};

/**
 * Calculates cumulative bounding box from your meshInfo structure
 */
export const calculateCumulativeBoundingBox = (meshInfos) => {
  if (!meshInfos || meshInfos.length === 0) {
    console.warn("No meshes provided for bounding box calculation");
    return {
      min: new BABYLON.Vector3(0, 0, 0),
      max: new BABYLON.Vector3(0, 0, 0)
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  meshInfos.forEach(meshInfo => {
    // Use your specific boundingInfo structure
    const bounds = meshInfo.boundingInfo.boundingBox;
    const worldMin = bounds.minimumWorld;
    const worldMax = bounds.maximumWorld;

    // Update cumulative bounds
    minX = Math.min(minX, worldMin.x, worldMax.x);
    minY = Math.min(minY, worldMin.y, worldMax.y);
    minZ = Math.min(minZ, worldMin.z, worldMax.z);
    
    maxX = Math.max(maxX, worldMin.x, worldMax.x);
    maxY = Math.max(maxY, worldMin.y, worldMax.y);
    maxZ = Math.max(maxZ, worldMin.z, worldMax.z);
  });

  return {
    min: new BABYLON.Vector3(minX, minY, minZ),
    max: new BABYLON.Vector3(maxX, maxY, maxZ)
  };
};

/**
 * Complete process to remove isolated meshes and rebuild octree
 * Integrated with your specific workflow
 */
export const processIsolatedMeshes = async (scene, originalMeshInfos, minDepth = 1) => {
  console.log("Starting isolated mesh processing...");
  
  // Step 1: Create initial octree to identify isolated meshes
  resetTrackingVariables();
  const initialBounds = calculateCumulativeBoundingBox(originalMeshInfos);
  console.log("Initial bounding box:", initialBounds);
  
  const initialOctree = createOctreeBlock(
    scene, 
    initialBounds.min, 
    initialBounds.max, 
    originalMeshInfos, 
    0, 
    null
  );

  // Step 2: Find isolated meshes
  const isolatedMeshIds = findIsolatedMeshes(initialOctree, new Set(), minDepth);
  
  if (isolatedMeshIds.size === 0) {
    console.log("No isolated meshes found");
    return {
      octree: initialOctree,
      boundingBox: initialBounds,
      meshInfos: originalMeshInfos,
      removedMeshes: [],
      statistics: {
        totalMeshes: originalMeshInfos.length,
        removedCount: 0,
        remainingCount: originalMeshInfos.length
      }
    };
  }

  // Step 3: Remove isolated meshes
  const filteredMeshInfos = removeIsolatedMeshes(originalMeshInfos, isolatedMeshIds);
  
  // Step 4: Recalculate bounding box
  const newBounds = calculateCumulativeBoundingBox(filteredMeshInfos);
  console.log("New bounding box after removal:", newBounds);

  // Step 5: Rebuild octree with filtered meshes
  resetTrackingVariables();
  
  const newOctree = createOctreeBlock(
    scene,
    newBounds.min,
    newBounds.max,
    filteredMeshInfos,
    0,
    null
  );

  // Collect removed mesh information
  const removedMeshes = originalMeshInfos.filter(meshInfo => 
    isolatedMeshIds.has(meshInfo.metadata.id)
  );

  console.log("Isolated mesh processing completed");
  
  return {
    octree: newOctree,
    boundingBox: newBounds,
    meshInfos: filteredMeshInfos,
    removedMeshes: removedMeshes,
    isolatedMeshIds: Array.from(isolatedMeshIds),
    statistics: {
      totalMeshes: originalMeshInfos.length,
      removedCount: isolatedMeshIds.size,
      remainingCount: filteredMeshInfos.length,
      boundingBoxChange: {
        originalVolume: calculateVolume(initialBounds),
        newVolume: calculateVolume(newBounds),
        reductionPercentage: calculateReductionPercentage(initialBounds, newBounds)
      }
    }
  };
};

/**
 * Analyze isolated meshes without removing them
 * Useful for getting statistics before deciding to optimize
 */
export const analyzeIsolatedMeshes = async (scene, meshInfos) => {
  console.log("=== Isolated Mesh Analysis ===");
  
  resetTrackingVariables();
  const bounds = calculateCumulativeBoundingBox(meshInfos);
  const octree = createOctreeBlock(scene, bounds.min, bounds.max, meshInfos, 0, null);
  
  const isolatedByDepth = {};
  
  // Analyze isolation at different depths
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const isolated = findIsolatedMeshes(octree, new Set(), depth);
    isolatedByDepth[depth] = Array.from(isolated);
    console.log(`Depth ${depth}: ${isolated.size} isolated meshes`);
  }

  // Advanced analysis for small meshes
  const smallIsolatedMeshes = findSmallIsolatedMeshes(octree, meshInfos);

  console.log("\nAnalysis Summary:");
  console.log("- Isolated meshes by depth:", isolatedByDepth);
  console.log(`- Small isolated meshes: ${smallIsolatedMeshes.size}`);
  
  return {
    isolatedByDepth,
    smallIsolatedMeshes: Array.from(smallIsolatedMeshes),
    recommendations: generateRecommendations(isolatedByDepth, smallIsolatedMeshes)
  };
};

/**
 * Find small isolated meshes based on bounding box size
 */
const findSmallIsolatedMeshes = (block, allMeshInfos, sizeThreshold = 0.1) => {
  const smallMeshIds = new Set();
  
  const analyzeBlock = (currentBlock) => {
    if (currentBlock.meshInfos && currentBlock.meshInfos.length === 1) {
      const meshId = currentBlock.meshInfos[0].id;
      
      // Find the corresponding meshInfo from your structure
      const meshInfo = allMeshInfos.find(info => info.metadata.id === meshId);
      if (meshInfo) {
        const bounds = meshInfo.boundingInfo.boundingBox;
        const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        if (maxDimension < sizeThreshold) {
          smallMeshIds.add(meshId);
          console.log(`Small isolated mesh found: ${meshId}, size: ${maxDimension.toFixed(3)}`);
        }
      }
    }

    if (currentBlock.blocks) {
      currentBlock.blocks.forEach(analyzeBlock);
    }
  };

  analyzeBlock(block);
  return smallMeshIds;
};

/**
 * Generate optimization recommendations
 */
const generateRecommendations = (isolatedByDepth, smallIsolated) => {
  const recommendations = [];
  
  const totalIsolated = Object.values(isolatedByDepth).reduce((sum, arr) => sum + arr.length, 0);
  
  if (totalIsolated > 0) {
    recommendations.push(`Consider removing ${totalIsolated} isolated meshes to optimize octree structure`);
  }
  
  if (smallIsolated.length > 0) {
    recommendations.push(`${smallIsolated.length} small isolated meshes could be removed for better performance`);
  }
  
  const deepIsolated = isolatedByDepth[MAX_DEPTH] || [];
  if (deepIsolated.length > 0) {
    recommendations.push(`${deepIsolated.length} meshes are isolated at maximum depth - consider removing or adjusting MAX_DEPTH`);
  }
  
  return recommendations;
};

/**
 * Helper function to calculate volume of a bounding box
 */
const calculateVolume = (bounds) => {
  const size = bounds.max.subtract(bounds.min);
  return size.x * size.y * size.z;
};

/**
 * Calculate percentage reduction in bounding box volume
 */
const calculateReductionPercentage = (originalBounds, newBounds) => {
  const originalVolume = calculateVolume(originalBounds);
  const newVolume = calculateVolume(newBounds);
  
  if (originalVolume === 0) return 0;
  return ((originalVolume - newVolume) / originalVolume) * 100;
};

/**
 * Iterative refinement - remove isolated meshes multiple times
 * Useful when removing meshes creates new isolated meshes
 */
export const iterativeIsolatedMeshRefinement = async (scene, meshInfos, maxIterations = 3, minDepth = 1) => {
  console.log("=== Iterative Isolated Mesh Refinement ===");
  
  let currentMeshInfos = [...meshInfos];
  let totalRemoved = 0;
  let iteration = 0;

  while (iteration < maxIterations) {
    console.log(`\n--- Iteration ${iteration + 1} ---`);
    
    const result = await processIsolatedMeshes(scene, currentMeshInfos, minDepth);
    
    if (result.statistics.removedCount === 0) {
      console.log("No more isolated meshes found. Stopping iteration.");
      break;
    }

    currentMeshInfos = result.meshInfos;
    totalRemoved += result.statistics.removedCount;
    iteration++;
    
    console.log(`Removed ${result.statistics.removedCount} meshes in this iteration`);
    console.log(`Total removed so far: ${totalRemoved}`);
  }

  // Final octree creation
  resetTrackingVariables();
  const finalBounds = calculateCumulativeBoundingBox(currentMeshInfos);
  const finalOctree = createOctreeBlock(
    scene,
    finalBounds.min,
    finalBounds.max,
    currentMeshInfos,
    0,
    null
  );

  console.log(`\nIterative refinement completed:`);
  console.log(`- Total iterations: ${iteration}`);
  console.log(`- Total meshes removed: ${totalRemoved}`);
  console.log(`- Final mesh count: ${currentMeshInfos.length}`);

  return {
    octree: finalOctree,
    meshInfos: currentMeshInfos,
    boundingBox: finalBounds,
    iterations: iteration,
    totalRemoved: totalRemoved,
    statistics: {
      totalMeshes: meshInfos.length,
      removedCount: totalRemoved,
      remainingCount: currentMeshInfos.length,
      boundingBoxChange: {
        originalVolume: calculateVolume(calculateCumulativeBoundingBox(meshInfos)),
        newVolume: calculateVolume(finalBounds),
        reductionPercentage: calculateReductionPercentage(
          calculateCumulativeBoundingBox(meshInfos), 
          finalBounds
        )
      }
    }
  };
};

/**
 * Debug function to log detailed octree structure
 */
export const debugOctreeStructure = (block, depth = 0) => {
  const indent = "  ".repeat(depth);
  console.log(`${indent}Node ${block.nodeNumber} (depth ${depth}): ${block.meshInfos?.length || 0} meshes`);
  
  if (block.meshInfos && block.meshInfos.length > 0) {
    block.meshInfos.forEach(mesh => {
      console.log(`${indent}  - Mesh: ${mesh.id}`);
    });
  }
  
  if (block.blocks && block.blocks.length > 0) {
    block.blocks.forEach(child => {
      debugOctreeStructure(child, depth + 1);
    });
  }
};

export default {
  findIsolatedMeshes,
  removeIsolatedMeshes,
  calculateCumulativeBoundingBox,
  processIsolatedMeshes,
  analyzeIsolatedMeshes,
  iterativeIsolatedMeshRefinement,
  debugOctreeStructure,
  resetTrackingVariables
};

/**
 * IsolatedMeshProcessor.js
 * Custom isolated mesh processing utilities with merged mesh storage
 */
// import * as BABYLON from "@babylonjs/core";
// import { createOctreeBlock, createOctreeInfo } from "./CreateOctreeBlock";

// // Configuration constants
// const MAX_DEPTH = 4;
// const MIN_SIZE = 0;

// // Global tracking variables (matching your existing structure)
// let nodesAtDepth = new Array(MAX_DEPTH + 1).fill(0);
// let nodeNumbersByDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
// let nodesAtDepthWithBoxes = new Array(MAX_DEPTH + 1).fill(0);
// let boxesAtDepth = Array.from({ length: MAX_DEPTH + 1 }, () => new Set());
// let nodeContents = new Map();
// let nodeDepths = new Map();
// let nodeParents = new Map();
// let nodeCounter = 1;

// // Counter for merged node naming
// let mergedNodeCounter = 1;

// /**
//  * Reset tracking variables - call this before creating new octree
//  */
// const resetTrackingVariables = () => {
//   nodesAtDepth = new Array(MAX_DEPTH + 1).fill(0);
//   nodeNumbersByDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
//   nodesAtDepthWithBoxes = new Array(MAX_DEPTH + 1).fill(0);
//   boxesAtDepth = Array.from({ length: MAX_DEPTH + 1 }, () => new Set());
//   nodeContents = new Map();
//   nodeDepths = new Map();
//   nodeParents = new Map();
//   nodeCounter = 1;
// };

// /**
//  * Reset merged node counter
//  */
// const resetMergedNodeCounter = () => {
//   mergedNodeCounter = 1;
// };

// /**
//  * Identifies meshes that are isolated (alone) in octree nodes
//  * Returns both isolated mesh IDs and their node information
//  */
// export const findIsolatedMeshesWithNodeInfo = (block, isolatedMeshData = [], minDepth = 1) => {
//   // Check if this block has exactly one mesh and is at sufficient depth
//   if (block.meshInfos && block.meshInfos.length === 1 && block.depth >= minDepth) {
//     const meshInfo = block.meshInfos[0];
//     isolatedMeshData.push({
//       meshId: meshInfo.id,
//       meshInfo: meshInfo,
//       nodeNumber: block.nodeNumber,
//       depth: block.depth,
//       blockBounds: {
//         min: block.min,
//         max: block.max
//       }
//     });
//     console.log(`Found isolated mesh ${meshInfo.id} at depth ${block.depth} in node ${block.nodeNumber}`);
//   }
  
//   // Recursively check child blocks
//   if (block.blocks && block.blocks.length > 0) {
//     block.blocks.forEach(childBlock => {
//       findIsolatedMeshesWithNodeInfo(childBlock, isolatedMeshData, minDepth);
//     });
//   }
  
//   return isolatedMeshData;
// };

// /**
//  * Creates merged mesh data from isolated meshes
//  */
// const createMergedMeshFromIsolated = async (isolatedMeshData, allMeshInfos, projectId) => {
//   const mergedMeshes = [];
//   const mergedMeshOperations = [];

//   for (const isolated of isolatedMeshData) {
//     // Find the full mesh data from original meshes
//     const originalMeshData = allMeshInfos.find(mesh => 
//       mesh.metadata && mesh.metadata.id === isolated.meshId
//     );

//     if (!originalMeshData) {
//       console.warn(`Could not find original mesh data for ${isolated.meshId}`);
//       continue;
//     }

//     // Create merged mesh identifier
//     const mergedNodeId = `merged_node_${String(mergedNodeCounter).padStart(3, '0')}`;
//     mergedNodeCounter++;

//     // Create merged mesh data structure
//     const mergedMeshData = {
//       fileName: mergedNodeId,
//       data: {
//         ...originalMeshData, // Keep all original mesh data
//         mergedMetadata: {
//           id: mergedNodeId,
//           originalMeshId: isolated.meshId,
//           originalNodeNumber: isolated.nodeNumber,
//           isolationDepth: isolated.depth,
//           isolatedAt: new Date().toISOString(),
//           blockBounds: isolated.blockBounds,
//           reason: 'isolated_mesh_optimization'
//         },
//         // Update metadata to reflect merged status
//         metadata: {
//           ...originalMeshData.metadata,
//           id: mergedNodeId,
//           mergedFrom: isolated.meshId,
//           nodeNumber: isolated.nodeNumber,
//           isolationDepth: isolated.depth
//         }
//       },
//       projectId: projectId
//     };

//     mergedMeshes.push(mergedMeshData);

//     // Prepare for IndexedDB storage
//     mergedMeshOperations.push({
//       store: "mergedMeshes",
//       key: mergedNodeId,
//       data: mergedMeshData
//     });

//     console.log(`Created merged mesh: ${mergedNodeId} from isolated mesh ${isolated.meshId}`);
//   }

//   return {
//     mergedMeshes,
//     mergedMeshOperations
//   };
// };

// /**
//  * Complete process to handle isolated meshes by storing them as merged meshes
//  * and rebuilding octree without them
//  */
// export const processIsolatedMeshesWithMerging = async (
//   scene, 
//   originalMeshInfos, 
//   allOriginalMeshData,
//   projectId,
//   batchStoreInDB,
//   minDepth = 1
// ) => {
//   console.log("Starting isolated mesh processing with merging...");
//   resetMergedNodeCounter();
  
//   // Step 1: Create initial octree to identify isolated meshes
//   resetTrackingVariables();
//   const initialBounds = calculateCumulativeBoundingBox(originalMeshInfos);
//   console.log("Initial bounding box:", initialBounds);
  
//   const initialOctree = createOctreeBlock(
//     scene, 
//     initialBounds.min, 
//     initialBounds.max, 
//     originalMeshInfos, 
//     0, 
//     null
//   );

//   // Step 2: Find isolated meshes with their node information
//   const isolatedMeshData = findIsolatedMeshesWithNodeInfo(initialOctree, [], minDepth);
  
//   if (isolatedMeshData.length === 0) {
//     console.log("No isolated meshes found");
//     return {
//       octree: initialOctree,
//       boundingBox: initialBounds,
//       meshInfos: originalMeshInfos,
//       mergedMeshes: [],
//       statistics: {
//         totalMeshes: originalMeshInfos.length,
//         isolatedCount: 0,
//         mergedCount: 0,
//         remainingCount: originalMeshInfos.length
//       }
//     };
//   }

//   // Step 3: Create merged meshes from isolated meshes
//   const { mergedMeshes, mergedMeshOperations } = await createMergedMeshFromIsolated(
//     isolatedMeshData, 
//     allOriginalMeshData,
//     projectId
//   );

//   // Step 4: Store merged meshes in IndexedDB
//   if (mergedMeshOperations.length > 0) {
//     await batchStoreInDB(mergedMeshOperations);
//     console.log(`Stored ${mergedMeshOperations.length} merged meshes in IndexedDB`);
//   }

//   // Step 5: Remove isolated meshes from main mesh list
//   const isolatedMeshIds = new Set(isolatedMeshData.map(item => item.meshId));
//   const filteredMeshInfos = originalMeshInfos.filter(meshInfo => 
//     !isolatedMeshIds.has(meshInfo.metadata.id)
//   );
  
//   console.log(`Filtered out ${isolatedMeshIds.size} isolated meshes`);
//   console.log(`Remaining meshes for octree: ${filteredMeshInfos.length}`);
  
//   // Step 6: Recalculate bounding box with remaining meshes
//   const newBounds = calculateCumulativeBoundingBox(filteredMeshInfos);
//   console.log("New bounding box after isolation:", newBounds);

//   // Step 7: Rebuild octree with filtered meshes
//   resetTrackingVariables();
  
//   const newOctree = createOctreeBlock(
//     scene,
//     newBounds.min,
//     newBounds.max,
//     filteredMeshInfos,
//     0,
//     null
//   );

//   console.log("Isolated mesh processing with merging completed");
  
//   return {
//     octree: newOctree,
//     boundingBox: newBounds,
//     meshInfos: filteredMeshInfos,
//     mergedMeshes: mergedMeshes,
//     isolatedMeshData: isolatedMeshData,
//     statistics: {
//       totalMeshes: originalMeshInfos.length,
//       isolatedCount: isolatedMeshIds.size,
//       mergedCount: mergedMeshes.length,
//       remainingCount: filteredMeshInfos.length,
//       boundingBoxChange: {
//         originalVolume: calculateVolume(initialBounds),
//         newVolume: calculateVolume(newBounds),
//         reductionPercentage: calculateReductionPercentage(initialBounds, newBounds)
//       }
//     }
//   };
// };

// /**
//  * Legacy function updated to work with new system
//  */
// export const processIsolatedMeshes = async (scene, originalMeshInfos, minDepth = 1) => {
//   console.log("Starting isolated mesh processing (legacy mode)...");
  
//   // For backward compatibility, use the original removal method
//   resetTrackingVariables();
//   const initialBounds = calculateCumulativeBoundingBox(originalMeshInfos);
  
//   const initialOctree = createOctreeBlock(
//     scene, 
//     initialBounds.min, 
//     initialBounds.max, 
//     originalMeshInfos, 
//     0, 
//     null
//   );

//   const isolatedMeshIds = findIsolatedMeshes(initialOctree, new Set(), minDepth);
  
//   if (isolatedMeshIds.size === 0) {
//     return {
//       octree: initialOctree,
//       boundingBox: initialBounds,
//       meshInfos: originalMeshInfos,
//       removedMeshes: [],
//       statistics: {
//         totalMeshes: originalMeshInfos.length,
//         removedCount: 0,
//         remainingCount: originalMeshInfos.length
//       }
//     };
//   }

//   const filteredMeshInfos = removeIsolatedMeshes(originalMeshInfos, isolatedMeshIds);
//   const newBounds = calculateCumulativeBoundingBox(filteredMeshInfos);

//   resetTrackingVariables();
//   const newOctree = createOctreeBlock(
//     scene,
//     newBounds.min,
//     newBounds.max,
//     filteredMeshInfos,
//     0,
//     null
//   );

//   const removedMeshes = originalMeshInfos.filter(meshInfo => 
//     isolatedMeshIds.has(meshInfo.metadata.id)
//   );

//   return {
//     octree: newOctree,
//     boundingBox: newBounds,
//     meshInfos: filteredMeshInfos,
//     removedMeshes: removedMeshes,
//     isolatedMeshIds: Array.from(isolatedMeshIds),
//     statistics: {
//       totalMeshes: originalMeshInfos.length,
//       removedCount: isolatedMeshIds.size,
//       remainingCount: filteredMeshInfos.length,
//       boundingBoxChange: {
//         originalVolume: calculateVolume(initialBounds),
//         newVolume: calculateVolume(newBounds),
//         reductionPercentage: calculateReductionPercentage(initialBounds, newBounds)
//       }
//     }
//   };
// };

// /**
//  * Identifies meshes that are isolated (alone) in octree nodes
//  * Specifically designed for your meshInfo structure
//  */
// export const findIsolatedMeshes = (block, isolatedMeshIds = new Set(), minDepth = 1) => {
//   // Check if this block has exactly one mesh and is at sufficient depth
//   if (block.meshInfos && block.meshInfos.length === 1 && block.depth >= minDepth) {
//     const meshId = block.meshInfos[0].id;
//     isolatedMeshIds.add(meshId);
//     console.log(`Found isolated mesh ${meshId} at depth ${block.depth} in node ${block.nodeNumber}`);
//   }
  
//   // Recursively check child blocks
//   if (block.blocks && block.blocks.length > 0) {
//     block.blocks.forEach(childBlock => {
//       findIsolatedMeshes(childBlock, isolatedMeshIds, minDepth);
//     });
//   }
  
//   return isolatedMeshIds;
// };

// /**
//  * Removes isolated meshes from your specific meshInfo array structure
//  */
// export const removeIsolatedMeshes = (meshInfos, isolatedMeshIds) => {
//   const filteredMeshes = meshInfos.filter(meshInfo => 
//     !isolatedMeshIds.has(meshInfo.metadata.id)
//   );
  
//   console.log(`Removed ${isolatedMeshIds.size} isolated meshes`);
//   console.log(`Remaining meshes: ${filteredMeshes.length}`);
  
//   return filteredMeshes;
// };

// /**
//  * Calculates cumulative bounding box from your meshInfo structure
//  */
// export const calculateCumulativeBoundingBox = (meshInfos) => {
//   if (!meshInfos || meshInfos.length === 0) {
//     console.warn("No meshes provided for bounding box calculation");
//     return {
//       min: new BABYLON.Vector3(0, 0, 0),
//       max: new BABYLON.Vector3(0, 0, 0)
//     };
//   }

//   let minX = Infinity, minY = Infinity, minZ = Infinity;
//   let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

//   meshInfos.forEach(meshInfo => {
//     // Use your specific boundingInfo structure
//     const bounds = meshInfo.boundingInfo.boundingBox;
//     const worldMin = bounds.minimumWorld;
//     const worldMax = bounds.maximumWorld;

//     // Update cumulative bounds
//     minX = Math.min(minX, worldMin.x, worldMax.x);
//     minY = Math.min(minY, worldMin.y, worldMax.y);
//     minZ = Math.min(minZ, worldMin.z, worldMax.z);
    
//     maxX = Math.max(maxX, worldMin.x, worldMax.x);
//     maxY = Math.max(maxY, worldMin.y, worldMax.y);
//     maxZ = Math.max(maxZ, worldMin.z, worldMax.z);
//   });

//   return {
//     min: new BABYLON.Vector3(minX, minY, minZ),
//     max: new BABYLON.Vector3(maxX, maxY, maxZ)
//   };
// };

// /**
//  * Analyze isolated meshes without processing them
//  */
// export const analyzeIsolatedMeshes = async (scene, meshInfos) => {
//   console.log("=== Isolated Mesh Analysis ===");
  
//   resetTrackingVariables();
//   const bounds = calculateCumulativeBoundingBox(meshInfos);
//   const octree = createOctreeBlock(scene, bounds.min, bounds.max, meshInfos, 0, null);
  
//   const isolatedByDepth = {};
  
//   // Analyze isolation at different depths
//   for (let depth = 1; depth <= MAX_DEPTH; depth++) {
//     const isolated = findIsolatedMeshes(octree, new Set(), depth);
//     isolatedByDepth[depth] = Array.from(isolated);
//     console.log(`Depth ${depth}: ${isolated.size} isolated meshes`);
//   }

//   // Advanced analysis for small meshes
//   const smallIsolatedMeshes = findSmallIsolatedMeshes(octree, meshInfos);

//   console.log("\nAnalysis Summary:");
//   console.log("- Isolated meshes by depth:", isolatedByDepth);
//   console.log(`- Small isolated meshes: ${smallIsolatedMeshes.size}`);
  
//   return {
//     isolatedByDepth,
//     smallIsolatedMeshes: Array.from(smallIsolatedMeshes),
//     recommendations: generateRecommendations(isolatedByDepth, smallIsolatedMeshes)
//   };
// };

// /**
//  * Find small isolated meshes based on bounding box size
//  */
// const findSmallIsolatedMeshes = (block, allMeshInfos, sizeThreshold = 0.1) => {
//   const smallMeshIds = new Set();
  
//   const analyzeBlock = (currentBlock) => {
//     if (currentBlock.meshInfos && currentBlock.meshInfos.length === 1) {
//       const meshId = currentBlock.meshInfos[0].id;
      
//       // Find the corresponding meshInfo from your structure
//       const meshInfo = allMeshInfos.find(info => info.metadata.id === meshId);
//       if (meshInfo) {
//         const bounds = meshInfo.boundingInfo.boundingBox;
//         const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
//         const maxDimension = Math.max(size.x, size.y, size.z);
        
//         if (maxDimension < sizeThreshold) {
//           smallMeshIds.add(meshId);
//           console.log(`Small isolated mesh found: ${meshId}, size: ${maxDimension.toFixed(3)}`);
//         }
//       }
//     }

//     if (currentBlock.blocks) {
//       currentBlock.blocks.forEach(analyzeBlock);
//     }
//   };

//   analyzeBlock(block);
//   return smallMeshIds;
// };

// /**
//  * Generate optimization recommendations
//  */
// const generateRecommendations = (isolatedByDepth, smallIsolated) => {
//   const recommendations = [];
  
//   const totalIsolated = Object.values(isolatedByDepth).reduce((sum, arr) => sum + arr.length, 0);
  
//   if (totalIsolated > 0) {
//     recommendations.push(`Consider processing ${totalIsolated} isolated meshes as merged meshes`);
//   }
  
//   if (smallIsolated.length > 0) {
//     recommendations.push(`${smallIsolated.length} small isolated meshes could be merged for better performance`);
//   }
  
//   const deepIsolated = isolatedByDepth[MAX_DEPTH] || [];
//   if (deepIsolated.length > 0) {
//     recommendations.push(`${deepIsolated.length} meshes are isolated at maximum depth`);
//   }
  
//   return recommendations;
// };

// /**
//  * Helper function to calculate volume of a bounding box
//  */
// const calculateVolume = (bounds) => {
//   const size = bounds.max.subtract(bounds.min);
//   return size.x * size.y * size.z;
// };

// /**
//  * Calculate percentage reduction in bounding box volume
//  */
// const calculateReductionPercentage = (originalBounds, newBounds) => {
//   const originalVolume = calculateVolume(originalBounds);
//   const newVolume = calculateVolume(newBounds);
  
//   if (originalVolume === 0) return 0;
//   return ((originalVolume - newVolume) / originalVolume) * 100;
// };

// /**
//  * Debug function to log detailed octree structure
//  */
// export const debugOctreeStructure = (block, depth = 0) => {
//   const indent = "  ".repeat(depth);
//   console.log(`${indent}Node ${block.nodeNumber} (depth ${depth}): ${block.meshInfos?.length || 0} meshes`);
  
//   if (block.meshInfos && block.meshInfos.length > 0) {
//     block.meshInfos.forEach(mesh => {
//       console.log(`${indent}  - Mesh: ${mesh.id}`);
//     });
//   }
  
//   if (block.blocks && block.blocks.length > 0) {
//     block.blocks.forEach(child => {
//       debugOctreeStructure(child, depth + 1);
//     });
//   }
// };

// export default {
//   findIsolatedMeshes,
//   findIsolatedMeshesWithNodeInfo,
//   removeIsolatedMeshes,
//   calculateCumulativeBoundingBox,
//   processIsolatedMeshes,
//   processIsolatedMeshesWithMerging,
//   analyzeIsolatedMeshes,
//   debugOctreeStructure,
//   resetTrackingVariables,
//   resetMergedNodeCounter
// };