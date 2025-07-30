/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */
import React, { useCallback, useState, useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import { calculateScreenCoverage } from "../Utils/CalculateScreenCoverage";
import { loadModels } from "../Utils/LoadModels";
import {
  createOctreeBlock,
  createOctreeInfo,
} from "../Utils/CreateOctreeBlock";
import { GetTagDetails } from "../services/TagApi";
import { getUnassignedmodel } from "../services/BulkImportApi";
import { url } from "../services/Url";
import { SaveOrginalMesh } from "../services/GlobalModalApi";
import axios from "axios";
import {
  processIsolatedMeshes,
  findIsolatedMeshes,
  calculateCumulativeBoundingBox,
  analyzeIsolatedMeshes
} from "../Utils/IsolatedMeshProcessor"; // The code I provided earlier


// Simplified configuration
const BATCH_SIZE = 10;
const DB_BATCH_SIZE = 50;

const PERFORMANCE_CONFIG = {
  FILE_BATCH_SIZE: 50,           // Your current: 10
  MESH_BATCH_SIZE: 500,          // New: process more meshes per batch  
  DB_BATCH_SIZE: 1000,           // Your current: 50
  API_BATCH_SIZE: 200,           // New: larger API batches
  CHUNK_SIZE: 500,               // Your current: 100
  MAX_CONCURRENT_FILES: 10,      // New: parallel processing
  MEMORY_CLEANUP_INTERVAL: 100,  // New: cleanup every N meshes
};

function SampleCreate() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const meshIdCounter = useRef(1);
  const dbConnection = useRef(null);
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const [processProgress, setProcessProgress] = useState({
    stage: "",
    current: 0,
    total: 0,
    subStage: "",
    subProgress: 0,
    processingStage: 0,
    startTime: null,
  });
  const GetTags = async () => {
    const response = await GetTagDetails(projectId);
    if (response.status === 200 && Array.isArray(response.data)) {
      const tagFiles = await Promise.all(
        response.data
          .filter((tag) => tag.filename)
          .map(async (tag) => {
            const fileUrl = `${url}/tags/${projectId}/${tag.filename}`;
            // Fetch the file and convert to File object
            return await urlToFileObject(fileUrl, tag.filename);
          })
      );
      setFiles(tagFiles);
        setStatus(`${tagFiles.length} file(s) selected. Click "Create" to start processing.`);
 
    } else {
      console.error("Unexpected response format or error in GetTags");
    }
   
  };

  const fetchUnassignedModels = async () => {
    const response = await getUnassignedmodel(projectId);
    if (response.status === 200 && Array.isArray(response.data.data)) {
      const modelFiles = await Promise.all(
        response.data.data
          .filter((tag) => tag.fileName)
          .map(async (tag) => {
            const fileUrl = `${url}/unassignedModels/${projectId}/${tag.fileName}`;
            // Fetch the file and convert to File object
            return await urlToFileObject(fileUrl, tag.fileName);
          })
      );
      setFiles(modelFiles);
        setStatus(`${modelFiles.length} file(s) selected. Click "Create" to start processing.`);
    
    } else {
      console.error(
        "Unexpected response format or error in fetchUnassignedModels"
      );
    }
  
  };

  const handleTagsandUnAssigned = async () => {
    const filesArray = [];

    // Fetch tags
    const response = await GetTagDetails(projectId);
    if (response.status === 200 && Array.isArray(response.data)) {
      const tagFiles = await Promise.all(
        response.data
          .filter((tag) => tag.filename)
          .map(async (tag) => {
            const fileUrl = `${url}/tags/${projectId}/${tag.filename}`;
            return await urlToFileObject(fileUrl, tag.filename);
          })
      );
      filesArray.push(...tagFiles);
    } else {
      console.error("Unexpected tag response format or error");
    }

    // Fetch unassigned models
    const result = await getUnassignedmodel(projectId);
    if (result.status === 200 && Array.isArray(result.data.data)) {
      const modelFiles = await Promise.all(
        result.data.data
          .filter((tag) => tag.fileName)
          .map(async (tag) => {
            const fileUrl = `${url}/unassignedModels/${projectId}/${tag.fileName}`;
            return await urlToFileObject(fileUrl, tag.fileName);
          })
      );
      filesArray.push(...modelFiles);
    } else {
      console.error("Unexpected model response format or error");
    }

    setFiles(filesArray);
  setStatus(`${filesArray.length} file(s) selected. Click "Create" to start processing.`);
  };

  // Helper function to convert URL to File object
  const urlToFileObject = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const lastModified = new Date(
        response.headers.get("last-modified") || Date.now()
      );

      return new File([blob], filename, {
        type: blob.type || "",
        lastModified: lastModified.getTime(),
      });
    } catch (error) {
      console.error(`Error fetching file ${url}:`, error);
      throw error;
    }
  };

  const handleTypeChange = (e) => {
    const value = e.target.value;

    if (value === "Tags") {
      GetTags();
    } else if (value === "unassigned_models") {
      fetchUnassignedModels();
    } else if (value === "Tags, unassigned_models") {
      handleTagsandUnAssigned();
    }
  };

  // Optimized IndexedDB initialization
  const initDB = useCallback(async () => {
    if (dbConnection.current) return dbConnection.current;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("piping", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbConnection.current = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const storeNames = [
          "octree",
          "originalMeshes",
          "mergedSkippedMeshes",
          "mergedMeshes",
        ];

        storeNames.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        });
      };
    });
  }, []);

  // Optimized batch storage
const batchStoreInDBOptimized = async (operations) => {
  const db = await initDB();
  const stores = new Map();

  // Group operations by store
  operations.forEach((op) => {
    if (!stores.has(op.store)) {
      stores.set(op.store, []);
    }
    stores.get(op.store).push(op);
  });

  // Process each store with larger batches (500 instead of small batches)
  const promises = Array.from(stores.entries()).map(async ([storeName, ops]) => {
    const batchSize = 500; // Increased batch size
    for (let i = 0; i < ops.length; i += batchSize) {
      const batch = ops.slice(i, i + batchSize);
      
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);

      // Process batch in parallel
      await Promise.all(
        batch.map(op => 
          new Promise((resolve, reject) => {
            const request = store.put(op.data, op.key);
            request.onsuccess = resolve;
            request.onerror = reject;
          })
        )
      );
    }
  });

  await Promise.all(promises);
};

  // Optimized file loading
  const loadFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const scene = sceneRef.current;
          const data = event.target.result;

          const result = await BABYLON.SceneLoader.LoadAssetContainerAsync(
            "file:",
            file,
            scene,
            null,
            ".glb"
          );

          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Optimized mesh processing without simplification
const processMeshOptimized = async (mesh, fileId, parentFile, materialCache = new Map()) => {
  if (!mesh.geometry) return null;

  const meshId = meshIdCounter.current++;
  const originalMeshId = `ori${String(meshId).padStart(7, "0")}`;

  // Fast bounding box calculation
  const boundingInfo = mesh.getBoundingInfo();
 const bounds = {
  minimumWorld: {
    x: boundingInfo.boundingBox.minimumWorld.x,
    y: boundingInfo.boundingBox.minimumWorld.y,
    z: boundingInfo.boundingBox.minimumWorld.z
  },
  maximumWorld: {
    x: boundingInfo.boundingBox.maximumWorld.x,
    y: boundingInfo.boundingBox.maximumWorld.y,
    z: boundingInfo.boundingBox.maximumWorld.z
  }
}

  // Fast screen coverage calculation
  const camera = sceneRef.current.activeCamera;
  const distance = BABYLON.Vector3.Distance(camera.position, boundingInfo.boundingSphere.centerWorld);
  const radius = boundingInfo.boundingSphere.radiusWorld;
  const screenCoverage = Math.min(1.0, radius / Math.max(distance, 0.1));

  // Optimized material handling with caching
  let materialColor = null;
  if (mesh.material) {
    const materialId = mesh.material.uniqueId || mesh.material.id;
    if (materialCache.has(materialId)) {
      materialColor = materialCache.get(materialId);
    } else {
      if (mesh.material instanceof BABYLON.PBRMaterial) {
        const color = mesh.material.albedoColor || mesh.material._albedoColor;
        materialColor = color ? { r: color.r, g: color.g, b: color.b } : null;
      }
      materialCache.set(materialId, materialColor);
    }
  }

  // Skip full vertex data for very small meshes
  const vertexCount = mesh.getTotalVertices();
  let positions, normals, indices;
  
  if (vertexCount < 100 && screenCoverage < 0.001) {
    positions = [];
    normals = [];
    indices = [];
  } else {
    // Parallel data extraction
    [positions, normals, indices] = await Promise.all([
      Promise.resolve(mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) || []),
      Promise.resolve(mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind) || []),
      Promise.resolve(mesh.getIndices() || [])
    ]);
  }

  return {
    meshInfo: {
      metadata: { id: originalMeshId, fileId, screenCoverage, parentFile },
      boundingInfo: { boundingBox: bounds },
      transforms: { worldMatrix: mesh.getWorldMatrix().toArray() },
    },
    meshData: {
      fileName: originalMeshId,
      data: {
        parentFile: parentFile,
        positions: positions ? Array.from(positions) : [],
        normals: normals ? Array.from(normals) : [],
        indices: indices ? Array.from(indices) : [],
        boundingBox: bounds,
        name: mesh.name,
        color: materialColor,
        metadata: {
          id: originalMeshId,
          fileId,
          screenCoverage,
          geometryInfo: {
            totalVertices: vertexCount,
            totalIndices: indices?.length || 0,
            faceCount: (indices?.length || 0) / 3,
          },
        },
        transforms: {
          position: mesh.position.asArray(),
          rotation: mesh.rotation.asArray(),
          scaling: mesh.scaling.asArray(),
          worldMatrix: mesh.getWorldMatrix().toArray(),
        },
      },
    },
  };
};

  const validateFile = (file) => {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      throw new Error("Invalid file type. Only GLB files are supported.");
    }
    if (file.size === 0) {
      throw new Error("File is empty.");
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      // 2GB limit
      throw new Error("File is too large.");
    }
  };

const CHUNK_SIZE = 100;
const saveToAPIOptimized = async (meshDataArray) => {
  const API_BATCH_SIZE = PERFORMANCE_CONFIG.API_BATCH_SIZE;
  const promises = [];
  
  for (let i = 0; i < meshDataArray.length; i += API_BATCH_SIZE) {
    const batch = meshDataArray.slice(i, i + API_BATCH_SIZE);
    
    const apiData = batch.map(({ meshData }) => ({
      MeshId: meshData.fileName,
      data: meshData,
      projectId: projectId,
    }));

    const promise = SaveOrginalMesh({ meshes: apiData })
      .catch(error => {
        console.error(`API batch ${i / API_BATCH_SIZE + 1} failed:`, error);
        throw error;
      });
    
    promises.push(promise);
    
    // Limit concurrent API calls (max 5 at once)
    if (promises.length >= 5) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
  }
};
const processFileOptimized = async (file, materialCache) => {
  validateFile(file);

  const container = await loadFile(file);
  const fileNameWithoutExt = file.name.replace(/\.glb$/i, "");
  const fileId = fileNameWithoutExt;

  try {
    // Filter valid meshes upfront
    const validMeshes = container.meshes.filter(mesh => mesh.geometry);
    
    // Process in larger batches
    const results = [];
    for (let i = 0; i < validMeshes.length; i += PERFORMANCE_CONFIG.MESH_BATCH_SIZE) {
      const batch = validMeshes.slice(i, i + PERFORMANCE_CONFIG.MESH_BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(mesh => processMeshOptimized(mesh, fileId, file.name, materialCache))
      );
      
      results.push(...batchResults.filter(Boolean));
      
      // Memory cleanup every 100 meshes
      if (i % PERFORMANCE_CONFIG.MEMORY_CLEANUP_INTERVAL === 0) {
        if (global.gc) global.gc();
      }
    }

    return results.map(r => ({ meshInfo: r.meshInfo, meshData: r.meshData }));
  } finally {
    container.dispose();
  }
};


  // Modified handleFileChange - only stores files, doesn't process
  const handleFileChange = useCallback((event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);

    // Reset processing state
    setIsProcessing(false);
    setStatus("");
    setProcessProgress({
      stage: "",
      current: 0,
      total: 0,
      subStage: "",
      subProgress: 0,
      processingStage: 0,
      startTime: null,
    });

    // Update status to show files are selected
    if (selectedFiles.length > 0) {
      setStatus(
        `${selectedFiles.length} file(s) selected. Click "Create" to start processing.`
      );
    }
  }, []);

  // New function to handle the Create button click
  const handleCreateClick = useCallback(async () => {
    if (files.length === 0) {
      setStatus("Please select files first.");
      return;
    }

    if (isProcessing) {
      setStatus("Processing already in progress.");
      return;
    }

    setIsProcessing(true);
    setStatus("Processing started...");

    try {
      let allMeshInfos = [];

      // Step 1: Process Files (Main Thread)
      updateProgress({
        stage: "Processing Files",
        current: 0,
        total: files.length,
        processingStage: 1,
        subStage: "Initializing",
        subProgress: 0,
        startTime: Date.now(),
      });

      // Process files in batches
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((file) => processFileOptimized(file))
        );
        allMeshInfos = allMeshInfos.concat(batchResults.flat());

        const progress = Math.min(
          Math.floor(((i + BATCH_SIZE) / files.length) * 100),
          100
        );
        updateProgress({
          stage: "Processing Files",
          processingStage: 1,
          current: i + batch.length,
          total: files.length,
          subStage: `Processing batch ${i / BATCH_SIZE + 1}`,
          subProgress: progress,
        });
      }

      // Step 2: Store Meshes
      updateProgress({
        stage: "Storing Meshes",
        processingStage: 2,
        subStage: "Saving meshes to database",
        subProgress: 0,
      });

      updateProgress({
        stage: "Storing Meshes",
        processingStage: 2,
        subStage: "Meshes stored successfully",
        subProgress: 100,
      });

      // Step 3: Create Octree
      updateProgress({
        stage: "Creating Octree",
        processingStage: 3,
        subStage: "Building octree structure",
        subProgress: 0,
      });
console.log( getMinBounds(allMeshInfos),getMaxBounds(allMeshInfos))
      const octreeRoot = createOctreeBlock(
        sceneRef.current,
        getMinBounds(allMeshInfos),
        getMaxBounds(allMeshInfos),
        allMeshInfos,
        0,
        null
      );

      const octreeInfo = createOctreeInfo(
        octreeRoot,
        getMinBounds(allMeshInfos),
        getMaxBounds(allMeshInfos)
      );

      await batchStoreInDBOptimized([
        {
          store: "octree",
          key: "mainOctree",
          data: octreeInfo,
        },
      ]);    
      console.log(octreeInfo);
      
      await sendOctreeToBackend(octreeInfo);

      updateProgress({
        stage: "Creating Octree",
        processingStage: 3,
        subStage: "Octree created successfully",
        subProgress: 100,
      });

      // Clear memory
      allMeshInfos = [];

      // Step 4: Load Models with Worker
      updateProgress({
        stage: "Loading Models",
        processingStage: 4,
        subStage: "Initializing worker",
        subProgress: 0,
      });

      // Set up worker progress listener
      const handleWorkerProgress = (event) => {
        const { stage, progress } = event.detail;
        updateProgress({
          stage: "Processing Models",
          processingStage: 4,
          subStage: stage,
          subProgress: progress,
        });
      };

      window.addEventListener("meshProcessingProgress", handleWorkerProgress);

      try {
        // Call the worker-based loadModels function
        await loadModels((progressData) => {
          updateProgress({
            stage: progressData.stage,
            processingStage: 4,
            subStage: progressData.stage,
            subProgress: progressData.progress,
          });
        });
      } finally {
        window.removeEventListener(
          "meshProcessingProgress",
          handleWorkerProgress
        );
      }

      // Step 5: Complete
      updateProgress({
        stage: "Complete",
        processingStage: 5,
        subStage: "Processing complete",
        subProgress: 100,
      });

      setStatus("Processing completed successfully!");
    } catch (error) {
      console.error("Error:", error);
      setStatus("Error: " + error.message);
      updateProgress({
        stage: "Error",
        subStage: error.message,
        subProgress: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [files, isProcessing]);

const handleCreateClickWithIsolatedMeshOptimization = useCallback(async () => {
  if (files.length === 0) {
    setStatus("Please select files first.");
    return;
  }

  if (isProcessing) {
    setStatus("Processing already in progress.");
    return;
  }

  setIsProcessing(true);
  setStatus("Processing started...");

  try {
    let allMeshInfos = [];

    // Step 1: Process Files (unchanged)
    updateProgress({
      stage: "Processing Files",
      current: 0,
      total: files.length,
      processingStage: 1,
      subStage: "Initializing",
      subProgress: 0,
      startTime: Date.now(),
    });

    // Process files in batches (unchanged)
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((file) => processFileOptimized(file))
      );
      allMeshInfos = allMeshInfos.concat(batchResults.flat());

      const progress = Math.min(
        Math.floor(((i + BATCH_SIZE) / files.length) * 100),
        100
      );
      updateProgress({
        stage: "Processing Files",
        processingStage: 1,
        current: i + batch.length,
        total: files.length,
        subStage: `Processing batch ${i / BATCH_SIZE + 1}`,
        subProgress: progress,
      });
    }

    // Step 2: Store Meshes (unchanged)
    updateProgress({
      stage: "Storing Meshes",
      processingStage: 2,
      subStage: "Saving meshes to database",
      subProgress: 0,
    });

    updateProgress({
      stage: "Storing Meshes",
      processingStage: 2,
      subStage: "Meshes stored successfully",
      subProgress: 100,
    });

    // 🔥 NEW STEP 2.5: Analyze and Optimize Isolated Meshes
    updateProgress({
      stage: "Analyzing Mesh Distribution",
      processingStage: 2.5,
      subStage: "Analyzing isolated meshes",
      subProgress: 0,
    });

    console.log(`Initial mesh count: ${allMeshInfos.length}`);

    // Analyze isolated meshes before processing
    const analysis = await analyzeIsolatedMeshes(sceneRef.current, allMeshInfos);
    console.log("Isolated mesh analysis:", analysis);

    let optimizedMeshInfos = allMeshInfos;
    let optimizationStats = null;

    // Only proceed with optimization if beneficial
    if (analysis.isolatedByDepth[1]?.length > 0 || 
        analysis.isolatedByDepth[2]?.length > 0 ||
        analysis.smallIsolatedMeshes.length > 0) {
      
      updateProgress({
        stage: "Optimizing Mesh Distribution",
        processingStage: 2.5,
        subStage: "Removing isolated meshes",
        subProgress: 30,
      });

      // Process isolated meshes with configuration
      const optimizationResult = await processIsolatedMeshes(
        sceneRef.current, 
        allMeshInfos, 
        1  // Minimum depth to consider for isolation
      );

      if (optimizationResult.statistics.removedCount > 0) {
        optimizedMeshInfos = optimizationResult.meshInfos;
        optimizationStats = optimizationResult.statistics;

        console.log(`Optimization completed:`);
        console.log(`- Removed ${optimizationStats.removedCount} isolated meshes`);
        console.log(`- Remaining meshes: ${optimizationStats.remainingCount}`);
        console.log(`- Bounding box reduction: ${optimizationStats.boundingBoxChange.reductionPercentage.toFixed(2)}%`);

        updateProgress({
          stage: "Optimizing Mesh Distribution",
          processingStage: 2.5,
          subStage: `Removed ${optimizationStats.removedCount} isolated meshes`,
          subProgress: 70,
        });
      } else {
        console.log("No optimization needed - no isolated meshes found");
      }
    } else {
      console.log("No isolated meshes detected - skipping optimization");
    }

    updateProgress({
      stage: "Optimizing Mesh Distribution",
      processingStage: 2.5,
      subStage: "Mesh optimization completed",
      subProgress: 100,
    });

    // Step 3: Create Octree (modified to use optimized meshes)
    updateProgress({
      stage: "Creating Octree",
      processingStage: 3,
      subStage: "Building octree structure",
      subProgress: 0,
    });

    const octreeRoot = createOctreeBlock(
      sceneRef.current,
      getMinBounds(optimizedMeshInfos), // Use optimized meshes
      getMaxBounds(optimizedMeshInfos), // Use optimized meshes
      optimizedMeshInfos,               // Use optimized meshes
      0,
      null
    );

    const octreeInfo = createOctreeInfo(
      octreeRoot,
      getMinBounds(optimizedMeshInfos),
      getMaxBounds(optimizedMeshInfos)
    );

    // Add optimization metadata to octree info
    if (optimizationStats) {
      octreeInfo.optimization = {
        enabled: true,
        originalMeshCount: allMeshInfos.length,
        optimizedMeshCount: optimizedMeshInfos.length,
        removedMeshCount: optimizationStats.removedCount,
        boundingBoxReduction: optimizationStats.boundingBoxChange.reductionPercentage,
        optimizationTimestamp: new Date().toISOString()
      };
    } else {
      octreeInfo.optimization = {
        enabled: false,
        originalMeshCount: allMeshInfos.length,
        optimizedMeshCount: allMeshInfos.length,
        removedMeshCount: 0
      };
    }

    await batchStoreInDBOptimized([
      {
        store: "octree",
        key: "mainOctree",
        data: octreeInfo,
      },
    ]);

    console.log("Octree created with optimization info:", octreeInfo);
    
    await sendOctreeToBackend(octreeInfo);

    updateProgress({
      stage: "Creating Octree",
      processingStage: 3,
      subStage: "Octree created successfully",
      subProgress: 100,
    });

    // Clear memory
    allMeshInfos = [];
    optimizedMeshInfos = [];

    updateProgress({
      stage: "Loading Models",
      processingStage: 4,
      subStage: "Initializing worker",
      subProgress: 0,
    });

    const handleWorkerProgress = (event) => {
      const { stage, progress } = event.detail;
      updateProgress({
        stage: "Processing Models",
        processingStage: 4,
        subStage: stage,
        subProgress: progress,
      });
    };

    window.addEventListener("meshProcessingProgress", handleWorkerProgress);

    try {
      await loadModels((progressData) => {
        updateProgress({
          stage: progressData.stage,
          processingStage: 4,
          subStage: progressData.stage,
          subProgress: progressData.progress,
        });
      });
    } finally {
      window.removeEventListener("meshProcessingProgress", handleWorkerProgress);
    }

    // Step 5: Complete
    updateProgress({
      stage: "Complete",
      processingStage: 5,
      subStage: "Processing complete",
      subProgress: 100,
    });

    // Enhanced success message with optimization stats
    let successMessage = "Processing completed successfully!";
    if (optimizationStats && optimizationStats.removedCount > 0) {
      successMessage += ` Optimization: ${optimizationStats.removedCount} isolated meshes removed, ${optimizationStats.boundingBoxChange.reductionPercentage.toFixed(1)}% size reduction.`;
    }
    setStatus(successMessage);

  } catch (error) {
    console.error("Error:", error);
    setStatus("Error: " + error.message);
    updateProgress({
      stage: "Error",
      subStage: error.message,
      subProgress: 0,
    });
  } finally {
    setIsProcessing(false);
  }
}, [files, isProcessing]);

const handleCreateClickOptimized = useCallback(async () => {
  if (files.length === 0) {
    setStatus("Please select files first.");
    return;
  }

  if (isProcessing) {
    setStatus("Processing already in progress.");
    return;
  }

  setIsProcessing(true);
  setStatus("Processing started with optimizations...");

  try {
    const startTime = Date.now();
    let allResults = [];
    const globalMaterialCache = new Map(); // Shared material cache

    // Step 1: Process files in larger batches
    updateProgress({
      stage: "Processing Files (Optimized)",
      current: 0,
      total: files.length,
      processingStage: 1,
      subStage: "Processing with increased batch sizes",
      subProgress: 0,
      startTime: startTime,
    });

    // Process files in optimized batches
    for (let i = 0; i < files.length; i += PERFORMANCE_CONFIG.FILE_BATCH_SIZE) {
      const batch = files.slice(i, i + PERFORMANCE_CONFIG.FILE_BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(file => processFileOptimized(file, globalMaterialCache))
      );
      
      allResults = allResults.concat(batchResults.flat());

      updateProgress({
        stage: "Processing Files (Optimized)",
        processingStage: 1,
        current: i + batch.length,
        total: files.length,
        subStage: `Processed ${i + batch.length}/${files.length} files`,
        subProgress: Math.round(((i + batch.length) / files.length) * 100),
      });
    }

    console.log(`Processed ${allResults.length} meshes in ${(Date.now() - startTime) / 1000}s`);

    // Step 2: Bulk database storage
    updateProgress({
      stage: "Bulk Database Storage",
      processingStage: 2,
      subStage: "Storing in large batches",
      subProgress: 0,
    });

    const dbOperations = allResults.map(({ meshData }) => ({
      store: "originalMeshes",
      key: meshData.fileName,
      data: meshData,
    }));

    await batchStoreInDBOptimized(dbOperations);

    updateProgress({
      stage: "Bulk Database Storage",
      processingStage: 2,
      subStage: "Database storage completed",
      subProgress: 100,
    });

    // Step 3: Optimized API upload
    updateProgress({
      stage: "Bulk API Upload",
      processingStage: 3,
      subStage: "Uploading in larger batches",
      subProgress: 0,
    });

    await saveToAPIOptimized(allResults);

    updateProgress({
      stage: "Bulk API Upload",
      processingStage: 3,
      subStage: "API upload completed",
      subProgress: 100,
    });

    // Continue with octree creation...
    const meshInfos = allResults.map(r => r.meshInfo);
    
    const octreeRoot = createOctreeBlock(
      sceneRef.current,
      getMinBounds(meshInfos),
      getMaxBounds(meshInfos),
      meshInfos,
      0,
      null
    );

    const octreeInfo = createOctreeInfo(
      octreeRoot,
      getMinBounds(meshInfos),
      getMaxBounds(meshInfos)
    );

    // Add performance data
    octreeInfo.performance = {
      processingTime: Date.now() - startTime,
      meshCount: allResults.length,
      fileCount: files.length,
      optimizations: PERFORMANCE_CONFIG
    };

    await batchStoreInDBOptimized([
      {
        store: "octree",
        key: "mainOctree",
        data: octreeInfo,
      },
    ]);

    await sendOctreeToBackend(octreeInfo);

    const totalTime = (Date.now() - startTime) / 1000;
    updateProgress({
      stage: "Complete",
      processingStage: 5,
      subStage: `Completed in ${totalTime.toFixed(1)}s`,
      subProgress: 100,
    });

    setStatus(`Processing completed! ${allResults.length} meshes processed in ${totalTime.toFixed(1)} seconds.`);

  } catch (error) {
    console.error("Error:", error);
    setStatus("Error: " + error.message);
  } finally {
    setIsProcessing(false);
  }
}, [files, isProcessing]);

// Helper function to transform mesh data for IsolatedMeshProcessor compatibility
const transformMeshInfoForProcessor = (meshInfo) => {
  // Check if boundingBox is in array format [min, max] and convert to object format
  const boundingBox = meshInfo.boundingInfo.boundingBox;
  
  let transformedBoundingBox;
  if (Array.isArray(boundingBox.min) && Array.isArray(boundingBox.max)) {
    // Convert from array format to object format
    transformedBoundingBox = {
      minimumWorld: {
        x: boundingBox.min[0],
        y: boundingBox.min[1],
        z: boundingBox.min[2]
      },
      maximumWorld: {
        x: boundingBox.max[0],
        y: boundingBox.max[1],
        z: boundingBox.max[2]
      }
    };
  } else if (boundingBox.minimumWorld && boundingBox.maximumWorld) {
    // Already in correct format
    transformedBoundingBox = boundingBox;
  } else {
    // Handle other possible formats
    console.warn('Unknown bounding box format:', boundingBox);
    transformedBoundingBox = {
      minimumWorld: { x: 0, y: 0, z: 0 },
      maximumWorld: { x: 1, y: 1, z: 1 }
    };
  }

  return {
    ...meshInfo,
    boundingInfo: {
      ...meshInfo.boundingInfo,
      boundingBox: transformedBoundingBox
    }
  };
};

// Debug function to log mesh data structure
const debugMeshStructure = (meshInfos, sampleCount = 3) => {
  console.log('=== Mesh Data Structure Debug ===');
  console.log(`Total meshes: ${meshInfos.length}`);
  
  const samples = meshInfos.slice(0, sampleCount);
  samples.forEach((mesh, index) => {
    console.log(`Sample mesh ${index + 1}:`, {
      metadata: mesh.metadata,
      boundingInfo: mesh.boundingInfo,
      transforms: mesh.transforms ? 'present' : 'missing'
    });
    
    if (mesh.boundingInfo?.boundingBox) {
      console.log(`Bounding box structure:`, mesh.boundingInfo.boundingBox);
    }
  });
  console.log('=== End Debug ===');
};

const handleCreateClickCombinedOptimized = useCallback(async () => {
  if (files.length === 0) {
    setStatus("Please select files first.");
    return;
  }

  if (isProcessing) {
    setStatus("Processing already in progress.");
    return;
  }

  setIsProcessing(true);
  setStatus("Processing started with full optimizations...");

  try {
    const startTime = Date.now();
    let allResults = [];
    const globalMaterialCache = new Map();
    let optimizationStats = null; // Declare at function level

    // Step 1: Process files with optimized batching
    updateProgress({
      stage: "Processing Files (Optimized)",
      current: 0,
      total: files.length,
      processingStage: 1,
      subStage: "Processing with increased batch sizes",
      subProgress: 0,
      startTime: startTime,
    });

    for (let i = 0; i < files.length; i += PERFORMANCE_CONFIG.FILE_BATCH_SIZE) {
      const batch = files.slice(i, i + PERFORMANCE_CONFIG.FILE_BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(file => processFileOptimized(file, globalMaterialCache))
      );
      
      allResults = allResults.concat(batchResults.flat());

      updateProgress({
        stage: "Processing Files (Optimized)",
        processingStage: 1,
        current: i + batch.length,
        total: files.length,
        subStage: `Processed ${i + batch.length}/${files.length} files`,
        subProgress: Math.round(((i + batch.length) / files.length) * 100),
      });
    }

    console.log(`Processed ${allResults.length} meshes in ${(Date.now() - startTime) / 1000}s`);

    // Step 2: Bulk database storage (optimized)
    updateProgress({
      stage: "Bulk Database Storage",
      processingStage: 2,
      subStage: "Storing in large batches",
      subProgress: 0,
    });

    const dbOperations = allResults.map(({ meshData }) => ({
      store: "originalMeshes",
      key: meshData.fileName,
      data: meshData,
    }));

    await batchStoreInDBOptimized(dbOperations);

    updateProgress({
      stage: "Bulk Database Storage",
      processingStage: 2,
      subStage: "Database storage completed",
      subProgress: 100,
    });

    // Step 2.5: Analyze and Optimize Isolated Meshes (with data transformation)
    updateProgress({
      stage: "Analyzing Mesh Distribution",
      processingStage: 2.5,
      subStage: "Analyzing isolated meshes",
      subProgress: 0,
    });

    let meshInfos = allResults.map(r => r.meshInfo);
    console.log(`Initial mesh count: ${meshInfos.length}`);

    // Debug the mesh structure before transformation
    debugMeshStructure(meshInfos);

    try {
      // Transform mesh data for IsolatedMeshProcessor compatibility
      const transformedMeshInfos = meshInfos.map(transformMeshInfoForProcessor);
      
      // Debug the transformed structure
      console.log('=== Transformed Mesh Structure ===');
      if (transformedMeshInfos.length > 0) {
        console.log('First transformed mesh:', transformedMeshInfos[0]);
        console.log('Bounding box structure:', transformedMeshInfos[0].boundingInfo.boundingBox);
      }

      // Analyze isolated meshes with transformed data
      const analysis = await analyzeIsolatedMeshes(sceneRef.current, transformedMeshInfos);
      console.log("Isolated mesh analysis:", analysis);

      let optimizedMeshInfos = meshInfos; // Keep original format for further processing

      // Only proceed with optimization if beneficial
      if (analysis.isolatedByDepth[1]?.length > 0 || 
          analysis.isolatedByDepth[2]?.length > 0 ||
          analysis.smallIsolatedMeshes.length > 0) {
        
        updateProgress({
          stage: "Optimizing Mesh Distribution",
          processingStage: 2.5,
          subStage: "Removing isolated meshes",
          subProgress: 30,
        });

        // Process isolated meshes with transformed data
        const optimizationResult = await processIsolatedMeshes(
          sceneRef.current, 
          transformedMeshInfos, 
          1
        );

        if (optimizationResult.statistics.removedCount > 0) {
          // Map the optimized results back to original mesh infos
          const optimizedIds = new Set(optimizationResult.meshInfos.map(m => m.metadata.id));
          optimizedMeshInfos = meshInfos.filter(m => optimizedIds.has(m.metadata.id));
          optimizationStats = optimizationResult.statistics;

          console.log(`Optimization completed:`);
          console.log(`- Removed ${optimizationStats.removedCount} isolated meshes`);
          console.log(`- Remaining meshes: ${optimizationStats.remainingCount}`);
          console.log(`- Bounding box reduction: ${optimizationStats.boundingBoxChange.reductionPercentage.toFixed(2)}%`);

          updateProgress({
            stage: "Optimizing Mesh Distribution",
            processingStage: 2.5,
            subStage: `Removed ${optimizationStats.removedCount} isolated meshes`,
            subProgress: 70,
          });
        } else {
          console.log("No optimization needed - no isolated meshes found");
        }
      } else {
        console.log("No isolated meshes detected - skipping optimization");
      }

      meshInfos = optimizedMeshInfos; // Update for further processing

    } catch (isolatedMeshError) {
      console.error("Error in isolated mesh processing:", isolatedMeshError);
      console.log("Continuing without isolated mesh optimization");
      // Continue with original meshInfos if isolated mesh processing fails
    }

    updateProgress({
      stage: "Optimizing Mesh Distribution",
      processingStage: 2.5,
      subStage: "Mesh optimization completed",
      subProgress: 100,
    });

    // Ensure ALL meshInfos are consistently formatted before any further use
    meshInfos = meshInfos.map(transformMeshInfoForProcessor);
    console.log('All mesh data standardized to object format');

    // Step 3: Optimized API upload
    updateProgress({
      stage: "Bulk API Upload",
      processingStage: 3,
      subStage: "Uploading in larger batches",
      subProgress: 0,
    });

    await saveToAPIOptimized(allResults);

    updateProgress({
      stage: "Bulk API Upload",
      processingStage: 3,
      subStage: "API upload completed",
      subProgress: 100,
    });

    // Step 4: Create Octree (using consistently formatted meshes)
    updateProgress({
      stage: "Creating Octree",
      processingStage: 4,
      subStage: "Building octree structure",
      subProgress: 0,
    });

    const octreeRoot = createOctreeBlock(
      sceneRef.current,
      getMinBounds(meshInfos),
      getMaxBounds(meshInfos),
      meshInfos,
      0,
      null
    );

    const octreeInfo = createOctreeInfo(
      octreeRoot,
      getMinBounds(meshInfos),
      getMaxBounds(meshInfos)
    );

    // Add both performance and optimization metadata
    const totalTime = Date.now() - startTime;
    octreeInfo.performance = {
      processingTime: totalTime,
      meshCount: allResults.length,
      fileCount: files.length,
      optimizations: PERFORMANCE_CONFIG
    };

    // Add optimization metadata to octree info
    if (optimizationStats) {
      octreeInfo.optimization = {
        enabled: true,
        originalMeshCount: allResults.length,
        optimizedMeshCount: meshInfos.length,
        removedMeshCount: optimizationStats.removedCount,
        boundingBoxReduction: optimizationStats.boundingBoxChange.reductionPercentage,
        optimizationTimestamp: new Date().toISOString()
      };
    } else {
      octreeInfo.optimization = {
        enabled: false,
        originalMeshCount: allResults.length,
        optimizedMeshCount: meshInfos.length,
        removedMeshCount: 0
      };
    }

    await batchStoreInDBOptimized([
      {
        store: "octree",
        key: "mainOctree",
        data: octreeInfo,
      },
    ]);

    console.log("Octree created with performance and optimization info:", octreeInfo);
    
    await sendOctreeToBackend(octreeInfo);

    updateProgress({
      stage: "Creating Octree",
      processingStage: 4,
      subStage: "Octree created successfully",
      subProgress: 100,
    });

    // Step 5: Load Models with Worker
    updateProgress({
      stage: "Loading Models",
      processingStage: 5,
      subStage: "Initializing worker",
      subProgress: 0,
    });

    const handleWorkerProgress = (event) => {
      const { stage, progress } = event.detail;
      updateProgress({
        stage: "Processing Models",
        processingStage: 5,
        subStage: stage,
        subProgress: progress,
      });
    };

    window.addEventListener("meshProcessingProgress", handleWorkerProgress);

    try {
      await loadModels((progressData) => {
        updateProgress({
          stage: progressData.stage,
          processingStage: 5,
          subStage: progressData.stage,
          subProgress: progressData.progress,
        });
      });
    } finally {
      window.removeEventListener("meshProcessingProgress", handleWorkerProgress);
    }

    // Step 6: Complete
    const finalTime = (Date.now() - startTime) / 1000;
    updateProgress({
      stage: "Complete",
      processingStage: 6,
      subStage: `Completed in ${finalTime.toFixed(1)}s`,
      subProgress: 100,
    });

    // Enhanced success message with both performance and optimization stats
    let successMessage = `Processing completed! ${allResults.length} meshes processed in ${finalTime.toFixed(1)} seconds.`;
    
    if (optimizationStats && optimizationStats.removedCount > 0) {
      successMessage += ` Optimization: ${optimizationStats.removedCount} isolated meshes removed, ${optimizationStats.boundingBoxChange.reductionPercentage.toFixed(1)}% size reduction.`;
    }
    
    setStatus(successMessage);

    // Clear memory
    allResults = [];
    meshInfos = [];

  } catch (error) {
    console.error("Error:", error);
    setStatus("Error: " + error.message);
    updateProgress({
      stage: "Error",
      subStage: error.message,
      subProgress: 0,
    });
  } finally {
    setIsProcessing(false);
  }
}, [files, isProcessing]);

// Enhanced isolated mesh analysis for debugging
const analyzeCurrentOctree = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(['octree'], 'readonly');
    const store = tx.objectStore('octree');
    
    const octreeRequest = store.get('mainOctree');
    
    const result = await new Promise((resolve, reject) => {
      octreeRequest.onsuccess = () => resolve(octreeRequest.result);
      octreeRequest.onerror = () => reject(octreeRequest.error);
    });
    
    if (result && result.data) {
      console.log('=== Octree Analysis ===');
      console.log('Total nodes per level:', result.properties?.nodesPerLevel);
      console.log('Nodes with boxes per level:', result.properties?.nodesWithBoxes);
      console.log('Total meshes:', result.statistics?.totalMeshes);
      console.log('Meshes per level:', result.statistics?.meshesPerLevel);
      
      if (result.optimization) {
        console.log('=== Optimization Info ===');
        console.log('Optimization enabled:', result.optimization.enabled);
        console.log('Original mesh count:', result.optimization.originalMeshCount);
        console.log('Optimized mesh count:', result.optimization.optimizedMeshCount);
        console.log('Removed mesh count:', result.optimization.removedMeshCount);
        console.log('Bounding box reduction:', result.optimization.boundingBoxReduction + '%');
      }
      
      return result;
    } else {
      console.log('No octree data found');
      return null;
    }
    
  } catch (error) {
    console.error('Error analyzing octree:', error);
    throw error;
  }
};

// Configuration options for isolated mesh processing
const ISOLATED_MESH_CONFIG = {
  enableOptimization: true,
  minDepthForIsolation: 1,
  maxDepthForIsolation: 4,
  considerMeshSize: true,
  minSizeThreshold: 0.1,
  considerDistance: false,
  maxDistanceFromCenter: Infinity,
  enableIterativeRefinement: false,
  maxRefinementIterations: 2
};

// Advanced processing with custom configuration
const processWithCustomConfiguration = async (meshInfos, config = ISOLATED_MESH_CONFIG) => {
  if (!config.enableOptimization) {
    return {
      meshInfos: meshInfos,
      statistics: { removedCount: 0 }
    };
  }

  let currentMeshInfos = [...meshInfos];
  let totalRemoved = 0;

  if (config.enableIterativeRefinement) {
    // Iterative refinement
    for (let i = 0; i < config.maxRefinementIterations; i++) {
      const result = await processIsolatedMeshes(
        sceneRef.current,
        currentMeshInfos,
        config.minDepthForIsolation
      );

      if (result.statistics.removedCount === 0) break;

      currentMeshInfos = result.meshInfos;
      totalRemoved += result.statistics.removedCount;
    }

    return {
      meshInfos: currentMeshInfos,
      statistics: { removedCount: totalRemoved }
    };
  } else {
    // Single pass
    return await processIsolatedMeshes(
      sceneRef.current,
      currentMeshInfos,
      config.minDepthForIsolation
    );
  }
};

  const serializeOctree = (octreeInfo) => {
  // Create a more efficient serialization format
  const serialized = {
    name: octreeInfo.name,
    bounds: octreeInfo.bounds,
    properties: octreeInfo.properties,
    statistics: octreeInfo.statistics,
    timestamp: octreeInfo.timestamp,
    data: {
      blockHierarchy: {
        bounds: octreeInfo.data.blockHierarchy.bounds,
        properties: octreeInfo.data.blockHierarchy.properties,
        relationships: octreeInfo.data.blockHierarchy.relationships,
        meshInfos: octreeInfo.data.blockHierarchy.meshInfos.map(mesh => ({
          id: mesh.id,
          bounds: mesh.bounds,
          vertexCount: mesh.vertexCount,
          // Include only necessary mesh data
          metadata: mesh.metadata || null
        }))
      }
    }
  };

  // Stringify with circular reference handling
  const seen = new WeakSet();
  return JSON.stringify(serialized, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  });
};

const sendOctreeToBackend = async (octreeInfo) => {
  try {
    // Use a proper serialization library for circular references
    const serializeOctree = (data) => {
      const seen = new WeakSet();
      return JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
    };

    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
    const serializedData = serializeOctree(octreeInfo);
    const totalChunks = Math.ceil(serializedData.length / CHUNK_SIZE);

    // Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunk = serializedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('octreeId', octreeInfo.name);
      formData.append('chunkIndex', i);
      formData.append('totalChunks', totalChunks);
      formData.append('chunkData', new Blob([chunk]));

      await axios.post(`${url}/api/octree/chunk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          updateProgress({
            stage: "Uploading Octree",
            subStage: `Chunk ${i+1}/${totalChunks}`,
            subProgress: percent
          });
        }
      });
    }

    // Finalize upload
    await axios.post(`${url}/api/octree/finalize`, {
      projectId,
      octreeId: octreeInfo.name,
      totalChunks
    },{timeout:20000});

    return { success: true };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
  // Helper functions
// Replace your existing getMinBounds and getMaxBounds functions with these updated versions:

// Helper functions - Updated to handle both array and object formats
const getMinBounds = (meshInfos) => {
  return meshInfos.reduce((min, info) => {
    const boundingBox = info.boundingInfo.boundingBox;
    let bounds;
    
    // Handle both formats: array format {min: [x,y,z]} and object format {minimumWorld: {x,y,z}}
    if (boundingBox.minimumWorld) {
      // Object format (transformed)
      bounds = boundingBox.minimumWorld;
    } else if (boundingBox.min && Array.isArray(boundingBox.min)) {
      // Array format (original)
      bounds = { x: boundingBox.min[0], y: boundingBox.min[1], z: boundingBox.min[2] };
    } else {
      console.warn('Unknown bounding box format:', boundingBox);
      bounds = { x: 0, y: 0, z: 0 };
    }
    
    return new BABYLON.Vector3(
      Math.min(min.x, bounds.x),
      Math.min(min.y, bounds.y),
      Math.min(min.z, bounds.z)
    );
  }, new BABYLON.Vector3(Infinity, Infinity, Infinity));
};

const getMaxBounds = (meshInfos) => {
  return meshInfos.reduce((max, info) => {
    const boundingBox = info.boundingInfo.boundingBox;
    let bounds;
    
    // Handle both formats: array format {max: [x,y,z]} and object format {maximumWorld: {x,y,z}}
    if (boundingBox.maximumWorld) {
      // Object format (transformed)  
      bounds = boundingBox.maximumWorld;
    } else if (boundingBox.max && Array.isArray(boundingBox.max)) {
      // Array format (original)
      bounds = { x: boundingBox.max[0], y: boundingBox.max[1], z: boundingBox.max[2] };
    } else {
      console.warn('Unknown bounding box format:', boundingBox);
      bounds = { x: 1, y: 1, z: 1 };
    }
    
    return new BABYLON.Vector3(
      Math.max(max.x, bounds.x),
      Math.max(max.y, bounds.y),
      Math.max(max.z, bounds.z)
    );
  }, new BABYLON.Vector3(-Infinity, -Infinity, -Infinity));
};
  const updateProgress = (updates) => {
    setProcessProgress((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const calculateOverallProgress = () => {
    const { processingStage, current, total } = processProgress;
    const stageWeight = 25;
    const baseProgress = processingStage * stageWeight;

    if (total === 0) return baseProgress;
    const stageProgress = (current / total) * stageWeight;
    return Math.min(baseProgress + stageProgress, 100);
  };

  // Initialize 3D scene
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.display = "none";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;
    sceneRef.current = scene;

    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      0,
      Math.PI / 3,
      10,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    // Optimize camera settings
    camera.radius = 100;
    camera.alpha = Math.PI / 4;
    camera.beta = Math.PI / 3;
    camera.wheelPrecision = 50;
    camera.minZ = 0.1;
    camera.maxZ = 1000;

    scene.activeCamera = camera;

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );

    // Optimize rendering
    engine.setHardwareScalingLevel(1);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.autoClear = false;
    scene.autoClearDepthAndStencil = false;

    engine.runRenderLoop(() => scene.render());

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      engine.dispose();
      scene.dispose();
      canvas.remove();
    };
  }, []);

  const handleloadModels = async () => {
    await loadModels();
  };
// const loadOctree = async () => {
//   const db = await initDB();
//   const tx = db.transaction(['octree'], 'readonly');
  
//   const octreeRequest = await tx.objectStore('octree').get('mainOctree');
  
//   console.log(octreeRequest?.data);

//   // Send octree data to the backend
//   // await sendOctreeToBackend(octreeData.data);
// }

const loadOctree = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(['octree'], 'readonly');
    const store = tx.objectStore('octree');
    
    // Get the octree data
    const octreeRequest = store.get('mainOctree');
    
    // Wait for the request to complete
    const result = await new Promise((resolve, reject) => {
      octreeRequest.onsuccess = () => resolve(octreeRequest.result);
      octreeRequest.onerror = () => reject(octreeRequest.error);
    });
    
    if (result && result.data) {
      console.log('Octree data loaded:', result);
       await sendOctreeToBackend(result);
  
    } else {
      console.log('No octree data found in storage');
      return null;
    }
    
  } catch (error) {
    console.error('Error loading octree data:', error);
    throw error;
  }
};






  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div id="bulkImportDiv">
        <div className="page">
          <section className="page-section">
            <div className="row">
              <h4>Create Global modal</h4>
            </div>
          </section>
          <hr />
          <section className="page-section">
            <div className="row">
              <div className="col-md-6">
                <div
                  className="dialog-input"
                  style={{ fontSize: "13px", lineHeight: "30px" }}
                >
                  <label >Folder Name *</label>
                  <select style={{ width: "100%" }} onChange={handleTypeChange}>
                    <option value="">Choose type</option>
                    <option value="Tags">Assigned tags</option>
                    <option value="unassigned_models">Unassigned models</option>
                    <option value="Tags, unassigned_models">Both</option>
                  </select>

                  <p className="dialog-input text-center mt-4"> OR</p>
                  <label htmlFor="">Choose file</label>
                  <input
                    type="file"
                    accept=".glb"
                    multiple
                    onChange={handleFileChange}
                    className="ms-1"
                    disabled={isProcessing}
                  />
                  {/* <button onClick={loadOctree}>load octree</button>
                  <button onClick={handleloadModels}>load models</button> */}
                 
                  {status && (
                    <div
                      className="mt-2 text-sm"
                      style={{
                        color: status.includes("Error")
                          ? "red"
                          : status.includes("completed")
                          ? "green"
                          : "gray",
                      }}
                    >
                      {status}
                    </div>
                  )}

                  {processProgress.processingStage > 0 && (
                    <div className="mt-4 space-y-2">
                      {/* Overall Progress */}
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{processProgress.stage}</span>
                        <span>{Math.round(calculateOverallProgress())}%</span>
                      </div>

                      {/* Main Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${calculateOverallProgress()}%` }}
                        />
                      </div>

                      {/* Sub-progress Section */}
                      {processProgress.subStage && (
                        <div className="text-sm text-gray-500">
                          <div className="flex justify-between">
                            <span>{processProgress.subStage}</span>
                            <span>
                              {Math.round(processProgress.subProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${processProgress.subProgress}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Statistics Display */}
                      {processProgress.processingStage === 4 &&
                        processProgress.startTime && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-700">
                              Processing Statistics
                            </h3>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">
                                  Total Files:
                                </span>{" "}
                                {files.length}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Processing Time:
                                </span>
                                {` ${(
                                  (Date.now() - processProgress.startTime) /
                                  1000
                                ).toFixed(1)}s`}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <hr />
            <button
              onClick={handleCreateClickCombinedOptimized}
              className="btn btn-light"
              style={{ fontSize: "12px" }}
              disabled={isProcessing || files.length === 0}
            >
              {isProcessing ? "Processing..." : "Create"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SampleCreate;