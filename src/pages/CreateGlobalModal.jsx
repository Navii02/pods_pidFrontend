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
  distributeMeshesToOctree,
} from "../Utils/CreateOctreeBlock";
import { GetTagDetails } from "../services/TagApi";
import { getUnassignedmodel } from "../services/BulkImportApi";
import { url } from "../services/Url";


// Simplified configuration
const BATCH_SIZE = 10;
const DB_BATCH_SIZE = 50;

function CreateGlobalModal() {
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
  console.log(files);

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
  const processMesh = async (mesh, fileId, ParentFile) => {
    if (!mesh.geometry) return null;

    const meshId = meshIdCounter.current++;
    const originalMeshId = `ori${String(meshId).padStart(7, "0")}`;

    const screenCoverage = calculateScreenCoverage(
      mesh,
      sceneRef.current.activeCamera,
      engineRef.current
    );

    // Process mesh data in parallel
    const [positions, normals, indices] = await Promise.all([
      mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind),
      mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind),
      mesh.getIndices(),
    ]);

    // Extract material color if available
    let materialColor = null;
    if (mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
      const color = mesh.material.albedoColor || mesh.material._albedoColor;
      materialColor = {
        r: color.r,
        g: color.g,
        b: color.b,
      };
    }

    const meshData = {
      fileName: originalMeshId,
      data: {
        ParentFile: ParentFile,
        positions: Array.from(positions),
        normals: Array.from(normals),
        indices: Array.from(indices),
        boundingBox: mesh.getBoundingInfo().boundingBox,
        name: mesh.name,
        color: materialColor,
        metadata: {
          id: originalMeshId,
          fileId,
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

    // Return processing results
    return {
      meshInfo: {
        metadata: {
          id: originalMeshId,
          fileId,
          screenCoverage,
          ParentFile,
        },
        boundingInfo: mesh.getBoundingInfo(),
        transforms: {
          worldMatrix: mesh.getWorldMatrix().toArray(),
        },
      },
      color: meshData.data.color,
      meshData,
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

  const processFile = async (file) => {
    validateFile(file);
    const container = await loadFile(file);
    const fileNameWithoutExt = file.name.replace(/\.glb$/i, ""); // Remove .glb (case-insensitive)
    const fileId = fileNameWithoutExt; // Replace non-alphanumerics with "_"
    const meshPromises = [];
    const dbOperations = [];

    try {
      // Process meshes in parallel
      for (const mesh of container.meshes) {
        if (!mesh.geometry) continue;
        meshPromises.push(processMesh(mesh, fileId, file.name));
      }

      const results = (await Promise.all(meshPromises)).filter(Boolean);

      results.forEach(({ meshInfo, meshData }) => {
        dbOperations.push({
          store: "originalMeshes",
          key: meshData.fileName,
          data: meshData,
        });
      });

      await batchStoreInDB(dbOperations);

      return results.map((r) => r.meshInfo);
    } catch (error) {
      console.error(`Error processing file ${fileId}:`, error);
      throw error;
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
          batch.map((file) => processFile(file))
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

      await batchStoreInDB([
        {
          store: "octree",
          key: "mainOctree",
          data: octreeInfo,
        },
      ]);

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

  // Helper functions
  const getMinBounds = (meshInfos) => {
    return meshInfos.reduce((min, info) => {
      const bounds = info.boundingInfo.boundingBox.minimumWorld;
      return new BABYLON.Vector3(
        Math.min(min.x, bounds.x),
        Math.min(min.y, bounds.y),
        Math.min(min.z, bounds.z)
      );
    }, new BABYLON.Vector3(Infinity, Infinity, Infinity));
  };

  const getMaxBounds = (meshInfos) => {
    return meshInfos.reduce((max, info) => {
      const bounds = info.boundingInfo.boundingBox.maximumWorld;
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

  // UPDATED: Enhanced octree analysis function with improved structure detection
  const analyzeOctree = async () => {
    try {
      const db = await initDB();

      // Get the main octree from the database
      const octreeData = await new Promise((resolve, reject) => {
        const transaction = db.transaction("octree", "readonly");
        const store = transaction.objectStore("octree");
        const request = store.get("mainOctree");

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!octreeData) {
        console.error("No octree data found in the database");
        return;
      }

      // Debug: Log the high-level structure to examine it without overwhelming the console
      console.log(
        "Octree data structure:",
        JSON.stringify(
          Object.keys(octreeData).reduce((obj, key) => {
            obj[key] =
              typeof octreeData[key] === "object"
                ? "[Object]"
                : octreeData[key];
            return obj;
          }, {})
        )
      );

      // Structure to hold node and mesh counts per depth
      const stats = {
        nodesByDepth: {}, // { depth: nodeCount }
        meshesByDepth: {}, // { depth: Set of meshIds }
        // Track processed nodes to avoid double-counting
        processedNodes: new Set(),
      };

      // Initialize stats for depths 0-4
      for (let i = 0; i <= 4; i++) {
        stats.nodesByDepth[i] = 0;
        stats.meshesByDepth[i] = new Set(); // Use Set to avoid duplicate mesh IDs
      }

      // Improved recursive function to analyze octree structure
      // Returns a boolean indicating if the object was identified as a block
      const analyzeBlock = (block, depth = 0, path = "", nodeId = null) => {
        if (!block || typeof block !== "object") return false;

        // Try to identify a unique ID for this node to avoid double-counting
        const id =
          nodeId ||
          (block.properties && block.properties.nodeNumber) ||
          block.nodeNumber ||
          path;

        // Skip if we've already processed this node
        if (stats.processedNodes.has(id)) {
          return true; // Return true to indicate this was a block, but already processed
        }

        // Check if this is a block node using multiple indicators
        let isBlock = false;

        // Check for common block properties
        if (
          // Standard octree node structure
          (block.bounds && (block.bounds.min || block.bounds.max)) ||
          // Alternative structures
          (block.min && block.max) ||
          // Check for meshInfos
          (block.meshInfos && Array.isArray(block.meshInfos)) ||
          // Check for properties that indicate this is a node
          (block.properties && block.properties.depth !== undefined) ||
          // Check if it has child blocks
          (block.relationships && block.relationships.childBlocks)
        ) {
          isBlock = true;
          stats.processedNodes.add(id);
          stats.nodesByDepth[depth] = (stats.nodesByDepth[depth] || 0) + 1;

          // Process meshInfos if present
          if (block.meshInfos && Array.isArray(block.meshInfos)) {
            const meshIds = block.meshInfos
              .filter((mesh) => mesh && mesh.id)
              .map((mesh) => mesh.id);

            if (meshIds.length > 0) {
              meshIds.forEach((id) => stats.meshesByDepth[depth].add(id));
              console.log(
                `  Found ${meshIds.length} meshes at depth ${depth}, path: ${path}`
              );
            }
          }

          // Look for child blocks - check multiple possible child block properties
          const childArrays = [
            block.relationships?.childBlocks,
            block.blocks,
            block.children,
            block.subdivisions,
            block.subBlocks,
          ].filter((arr) => arr && Array.isArray(arr));

          // Process all child arrays
          childArrays.forEach((childArray) => {
            console.log(
              `  Processing ${childArray.length} children at depth ${depth}`
            );

            childArray.forEach((child, i) => {
              if (child) {
                const childNodeId =
                  (child.properties && child.properties.nodeNumber) ||
                  child.nodeNumber ||
                  `${id}-child-${i}`;
                analyzeBlock(child, depth + 1, `${path}[${i}]`, childNodeId);
              }
            });
          });
        }

        // If not explicitly a block, check if it contains a blockHierarchy
        if (!isBlock && block.data && block.data.blockHierarchy) {
          return analyzeBlock(
            block.data.blockHierarchy,
            depth,
            `${path}.data.blockHierarchy`
          );
        }

        // If not explicitly a block, recursively check properties
        if (!isBlock) {
          // For arrays
          if (Array.isArray(block)) {
            block.forEach((item, i) => {
              if (item && typeof item === "object") {
                const wasBlock = analyzeBlock(item, depth, `${path}[${i}]`);
                isBlock = isBlock || wasBlock;
              }
            });
          }
          // For objects
          else {
            for (const key of Object.keys(block)) {
              if (block[key] && typeof block[key] === "object") {
                // Skip some properties that are unlikely to contain block structures
                if (
                  [
                    "min",
                    "max",
                    "bounds",
                    "transforms",
                    "boundingInfo",
                  ].includes(key)
                )
                  continue;

                const wasBlock = analyzeBlock(
                  block[key],
                  depth,
                  `${path}.${key}`
                );
                isBlock = isBlock || wasBlock;
              }
            }
          }
        }

        return isBlock;
      };

      // Start analysis from the root
      console.log("Starting octree analysis...");

      // Try to analyze from different potential starting points
      let foundStructure = false;

      // 1. Try the standard expected path
      if (octreeData.data && octreeData.data.blockHierarchy) {
        console.log("Analyzing from data.blockHierarchy...");
        foundStructure = analyzeBlock(
          octreeData.data.blockHierarchy,
          0,
          "blockHierarchy"
        );
      }

      // 2. Try other common paths if the first attempt didn't find anything
      if (!foundStructure && octreeData.blockHierarchy) {
        console.log("Analyzing from blockHierarchy...");
        foundStructure = analyzeBlock(
          octreeData.blockHierarchy,
          0,
          "blockHierarchy"
        );
      }

      // 3. As a last resort, start from the root
      if (!foundStructure) {
        console.log("Analyzing from root...");
        foundStructure = analyzeBlock(octreeData, 0, "root");
      }

      // Log results
      console.log("\n===== OCTREE ANALYSIS RESULTS =====");
      console.log("Node counts by depth:");

      // Print node counts for depths 0-4
      for (let depth = 0; depth <= 4; depth++) {
        console.log(`  Depth ${depth}: ${stats.nodesByDepth[depth]} nodes`);
      }

      console.log("\nMesh IDs by depth:");

      // Print mesh IDs for depths 0-4
      for (let depth = 0; depth <= 4; depth++) {
        const meshIds = Array.from(stats.meshesByDepth[depth] || []);
        console.log(`  Depth ${depth}: ${meshIds.length} unique meshes`);
        if (meshIds.length > 0) {
          console.log(
            `    Mesh IDs: ${meshIds.slice(0, 10).join(", ")}${
              meshIds.length > 10 ? "..." : ""
            }`
          );
        }

        // Check for shared meshes with other depths
        for (let otherDepth = 0; otherDepth <= 4; otherDepth++) {
          if (otherDepth !== depth) {
            const otherMeshIds = stats.meshesByDepth[otherDepth];
            if (otherMeshIds && otherMeshIds.size > 0) {
              const shared = new Set(
                [...meshIds].filter((id) => otherMeshIds.has(id))
              );
              if (shared.size > 0) {
                console.log(
                  `    WARNING: ${shared.size} meshes also appear at depth ${otherDepth}!`
                );
                console.log(
                  `    Shared IDs: ${Array.from(shared)
                    .slice(0, 5)
                    .join(", ")}${shared.size > 5 ? "..." : ""}`
                );
              }
            }
          }
        }
      }

      // Calculate total metrics
      const totalNodes = Object.values(stats.nodesByDepth).reduce(
        (sum, count) => sum + count,
        0
      );
      const totalMeshes = new Set(
        Object.values(stats.meshesByDepth).flatMap((set) => Array.from(set))
      ).size;

      console.log("\nSummary:");
      console.log(`  Total nodes: ${totalNodes}`);
      console.log(`  Total unique meshes: ${totalMeshes}`);
      console.log(`  Processed node count: ${stats.processedNodes.size}`);
      console.log("==================================");

      // Get the original mesh data for reference
      try {
        const meshDataRequest = await new Promise((resolve, reject) => {
          const transaction = db.transaction("originalMeshes", "readonly");
          const store = transaction.objectStore("originalMeshes");
          const request = store.get("meshData");

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (meshDataRequest && Array.isArray(meshDataRequest)) {
          console.log(
            `For reference: Total meshes in originalMeshes store: ${meshDataRequest.length}`
          );

          // Cross-check with octree
          const originalMeshIds = new Set(
            meshDataRequest
              .filter((mesh) => mesh && mesh.metadata && mesh.metadata.id)
              .map((mesh) => mesh.metadata.id)
          );

          const octreeMeshIds = new Set(
            Object.values(stats.meshesByDepth).flatMap((set) => Array.from(set))
          );

          const missingInOctree = new Set(
            [...originalMeshIds].filter((id) => !octreeMeshIds.has(id))
          );

          const extraInOctree = new Set(
            [...octreeMeshIds].filter((id) => !originalMeshIds.has(id))
          );

          console.log(`  Meshes missing from octree: ${missingInOctree.size}`);
          if (missingInOctree.size > 0) {
            console.log(
              `    Missing IDs: ${Array.from(missingInOctree)
                .slice(0, 10)
                .join(", ")}${missingInOctree.size > 10 ? "..." : ""}`
            );
          }

          console.log(`  Extra meshes in octree: ${extraInOctree.size}`);
          if (extraInOctree.size > 0) {
            console.log(
              `    Extra IDs: ${Array.from(extraInOctree)
                .slice(0, 10)
                .join(", ")}${extraInOctree.size > 10 ? "..." : ""}`
            );
          }
        }
      } catch (error) {
        console.error("Error accessing mesh data:", error);
      }
    } catch (error) {
      console.error("Error analyzing octree:", error);
      console.error("Error stack:", error.stack);
    }
  };

  // React Progress Component
  const ProgressDisplay = ({ progress }) => {
    const { stage, processingStage, subStage, subProgress, current, total } =
      progress;

    return (
      <div className="progress-container">
        <div className="main-stage">
          <h3>
            Stage {processingStage}: {stage}
          </h3>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${subProgress}%` }}
            />
          </div>
          <p>
            {subProgress}% - {subStage}
          </p>
          {current && total && (
            <p>
              {current} / {total} items processed
            </p>
          )}
        </div>

        <div className="stage-indicators">
          {[
            "Processing Files",
            "Storing Meshes",
            "Creating Octree",
            "Processing Models",
            "Complete",
          ].map((stageName, index) => (
            <div
              key={index}
              className={`stage-indicator ${
                index + 1 < processingStage
                  ? "completed"
                  : index + 1 === processingStage
                  ? "active"
                  : "pending"
              }`}
            >
              {stageName}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const OnTest = async () => {
    const response = await fetch(
      `http://localhost:5000/api/get-allfiles/${projectId}`
    );
    console.log(response);
    const files = await response.json();
    console.log("Files:", files);
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
                  <label onClick={OnTest}>Folder Name *</label>
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
              onClick={handleCreateClick}
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

export default CreateGlobalModal;
