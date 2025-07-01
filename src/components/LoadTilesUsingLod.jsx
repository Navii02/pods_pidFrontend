import React, { useEffect, useRef, useState, useCallback } from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/gui";
import { Modal } from "react-bootstrap";
import { FreeCameraMouseInput } from "../Utils/FlyControls";
import { FreeCameraTouchInput } from "../Utils/TouchControls";
import * as GUI from "@babylonjs/gui";
import {
  calculateElevationAngle,
  calculatePlanAngle,
} from "../Utils/GeometryCalculation";
import {
  fetchFromGentagInfo,
  fetchFromGentagInfoFields,
  getEquipmentDetails,
  getLineDetails,
  getTagDetailsFromFileName,
  getValveDetails,
} from "../services/TagApi";
import CommentModal from "./CommentModal";
import {
  getAllcomments,
  deleteComment,
  updateComment,
} from "../services/CommentApi";
import { updateProjectContext } from "../context/ContextShare";
import { useContext } from "react";
import { getStatustableData } from "../services/CommentApi";
import DeleteConfirm from "../components/DeleteConfirm";
import Alert from "./Alert";
import { AllSavedView, SaveSavedView } from "../services/CommonApis";
import { WaterMaterial } from "@babylonjs/materials";

class WebWorkerTilesetLODManager {
  constructor(scene, camera, highlightRefs = null) {
    this.scene = scene;
    this.camera = camera;
    this.highlightRefs = highlightRefs;
    this.maxDistance = 0;
    this.threshold30Percent = 0;
    this.threshold80Percent = 0;
    this.activeMeshes = new Map();
    this.loadedNodeNumbers = new Set();
    this.activeDepth = 0;
    this.nodeDepths = new Map();
    this.nodeCenters = new Map();
    this.currentVisibleNodes = new Set();
    this.tilesetMetadata = null;
    this.updateFrequency = 16;
    this.frameCounter = 0;
    this.lastCameraPosition = null;
    this.cameraMovementThreshold = 10;
    this.isUpdating = false;
    this.lastUpdate = 0;
    this.unloadDistanceMultiplier = 1.5;

    // Progressive loading state
    this.depth2LoadedInitially = false;
    this.loadedDepths = new Set();

    // Web Worker setup
    this.workers = new Map();
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    // Worker ready state tracking
    this.workerReadyStates = new Map();
    this.workerReadyStates.set(2, false);
    this.workerReadyStates.set(3, false);
    this.workerReadyStates.set(4, false);
    this.workerReadyStates.set("disposal", false);
    this.workerReadyStates.set("frustum", false);
    this.workerReadyStates.set("distance", false);
    this.allWorkersReady = false;

    // Distance worker initialization tracking
    this.distanceWorkerInitialized = false;

    // Loading queues (now managed by main thread but executed by workers)
    this.loadingQueues = new Map();
    this.loadingQueues.set(2, []);
    this.loadingQueues.set(3, []);
    this.loadingQueues.set(4, []);

    // Disposal queue for the disposal worker
    this.disposalQueue = [];
    this.disposalWorkerLoad = 0;
    this.maxDisposalWorkerLoad = 5;

    // Frustum culling state
    this.frustumCullingEnabled = true;
    this.frustumBufferMultiplier = 1.5;
    this.nodeVisibilityStates = new Map(); // nodeNumber -> 'visible', 'hidden', 'disposed'
    this.lastFrustumUpdate = 0;
    this.frustumUpdateFrequency = 60; // Update frustum every 60ms
    this.disposedByFrustum = new Set(); // Track nodes disposed by frustum culling

    // Distance calculation worker state
    this.distanceCalculationEnabled = true;
    this.lastDistanceCalculation = 0;
    this.distanceCalculationFrequency = 50; // Every 50ms
    this.pendingDistanceCalculation = false;

    // Worker load balancing
    this.workerLoadCounts = new Map();
    this.workerLoadCounts.set(2, 0);
    this.workerLoadCounts.set(3, 0);
    this.workerLoadCounts.set(4, 0);
    this.workerLoadCounts.set("disposal", 0);
    this.workerLoadCounts.set("frustum", 0);
    this.workerLoadCounts.set("distance", 0);

    this.maxWorkerLoad = 3; // Max concurrent requests per worker

    // Performance tracking
    this.distanceWorkerStats = {
      calculationsPerSecond: 0,
      averageCalculationTime: 0,
      lastCalculationTime: 0,
    };

    // Optimization features
    this.spatialOptimization = new SpatialOptimization();
    this.octreeCenter = null;

    // Highlighting
    this.highlightMaterial = null;
    this.highlightedMesh = null;

    // NEW: Frame budget and priority system
    this.frameBudget = 16; // Target 60fps (16ms per frame)
    this.meshCreationBudget = 8; // Max 8ms per frame for mesh creation
    this.lastFrameTime = 0;
    this.meshCreationQueue = [];
    this.isProcessingMeshes = false;
    this.maxMeshesPerFrame = 1; // Limit meshes created per frame
    this.frameTimeTracker = {
      meshCreation: 0,
      cameraUpdate: 0,
      lodUpdate: 0,
    };

    // Priority levels
    this.PRIORITY = {
      CAMERA: 1,
      LOD_UPDATE: 2,
      MESH_CREATION: 3,
      BACKGROUND_TASKS: 4,
    };

    // Initialize systems
    this.initializeFrameScheduler();
    this.initializeWorkers();
    this.startLoadingQueueProcessor();
  }

  // NEW: Initialize frame-based task scheduler
  initializeFrameScheduler() {
    this.taskQueue = new Map();
    this.taskQueue.set(this.PRIORITY.CAMERA, []);
    this.taskQueue.set(this.PRIORITY.LOD_UPDATE, []);
    this.taskQueue.set(this.PRIORITY.MESH_CREATION, []);
    this.taskQueue.set(this.PRIORITY.BACKGROUND_TASKS, []);

    this.isSchedulerRunning = false;
    this.startFrameScheduler();
  }

  // NEW: Frame scheduler that respects priorities
  startFrameScheduler() {
    if (this.isSchedulerRunning) return;
    this.isSchedulerRunning = true;

    const processFrame = () => {
      const frameStart = performance.now();
      const targetFrameTime = this.frameBudget;

      // Process tasks by priority
      for (const [priority, tasks] of this.taskQueue.entries()) {
        const elapsed = performance.now() - frameStart;

        // Leave time for rendering and camera updates
        if (elapsed > targetFrameTime * 0.7) break;

        // Process tasks at current priority level
        while (
          tasks.length > 0 &&
          performance.now() - frameStart < targetFrameTime * 0.7
        ) {
          const task = tasks.shift();
          if (task && typeof task.execute === "function") {
            try {
              task.execute();
            } catch (error) {
              console.error("Task execution error:", error);
            }
          }
        }
      }

      // Continue scheduling
      if (this.isSchedulerRunning) {
        requestAnimationFrame(processFrame);
      }
    };

    requestAnimationFrame(processFrame);
  }

  // NEW: Add task to priority queue
  addTask(priority, taskFunction, description = "") {
    if (!this.taskQueue.has(priority)) {
      priority = this.PRIORITY.BACKGROUND_TASKS;
    }

    this.taskQueue.get(priority).push({
      execute: taskFunction,
      description,
      timestamp: performance.now(),
    });
  }

  // NEW: Yield control back to main thread
  async yieldToMainThread() {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  // NEW: Yield control using scheduler API if available
  async yieldToScheduler() {
    return new Promise((resolve) => {
      if ("scheduler" in window && "postTask" in window.scheduler) {
        window.scheduler.postTask(resolve, { priority: "background" });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  initializeWorkers() {
    try {
      // Initialize workers for each depth
      this.workers.set(
        2,
        new Worker(new URL("../worker/worker_depth2.js", import.meta.url))
      );
      this.workers.set(
        3,
        new Worker(new URL("../worker/worker_depth3.js", import.meta.url))
      );
      this.workers.set(
        4,
        new Worker(new URL("../worker/worker_depth4.js", import.meta.url))
      );
      this.workers.set(
        "disposal",
        new Worker(
          new URL("../worker/mesh-disposal-worker.js", import.meta.url)
        )
      );
      this.workers.set(
        "frustum",
        new Worker(
          new URL("../worker/frustum-culling-worker.js", import.meta.url)
        )
      );
      this.workers.set(
        "distance",
        new Worker(
          new URL("../worker/distance-calculation-worker.js", import.meta.url)
        )
      );

      // Set up message handlers for each worker
      this.workers.forEach((worker, depth) => {
        worker.onmessage = (event) => this.handleWorkerMessage(event, depth);
        worker.onerror = (error) => {
          console.error(`Worker error for depth ${depth}:`, error);
        };
      });
    } catch (error) {
      console.error("Failed to initialize web workers:", error);
      // Fallback to main thread loading
      this.workers.clear();
    }
  }

  handleWorkerMessage(event, depth) {
    const {
      type,
      requestId,
      nodeNumber,
      meshData,
      error,
      priority,
      reason,
      results,
      stats,
      result,
    } = event.data;

    switch (type) {
      case "WORKER_READY":
        this.workerReadyStates.set(depth, true);
        this.checkAllWorkersReady();
        break;

      case "WORKER_ERROR":
        console.error(`Worker initialization error for depth ${depth}:`, error);
        break;

      case "MESH_LOADED":
        // Decrease worker load count for loading workers
        if (
          depth !== "disposal" &&
          depth !== "frustum" &&
          depth !== "distance"
        ) {
          this.workerLoadCounts.set(
            depth,
            Math.max(0, this.workerLoadCounts.get(depth) - 1)
          );
        }
        this.handleMeshLoaded(requestId, nodeNumber, meshData, depth, priority);
        break;

      case "MESH_SKIPPED":
        // Decrease worker load count for loading workers
        if (
          depth !== "disposal" &&
          depth !== "frustum" &&
          depth !== "distance"
        ) {
          this.workerLoadCounts.set(
            depth,
            Math.max(0, this.workerLoadCounts.get(depth) - 1)
          );
        }

        this.pendingRequests.delete(requestId);
        break;

      case "MESH_NOT_FOUND":
        // Decrease worker load count for loading workers
        if (
          depth !== "disposal" &&
          depth !== "frustum" &&
          depth !== "distance"
        ) {
          this.workerLoadCounts.set(
            depth,
            Math.max(0, this.workerLoadCounts.get(depth) - 1)
          );
        }
        console.warn(`Mesh not found for node ${nodeNumber} at depth ${depth}`);
        this.pendingRequests.delete(requestId);
        break;

      case "ERROR":
        // Decrease worker load count for loading workers
        if (
          depth !== "disposal" &&
          depth !== "frustum" &&
          depth !== "distance"
        ) {
          this.workerLoadCounts.set(
            depth,
            Math.max(0, this.workerLoadCounts.get(depth) - 1)
          );
        }
        console.error(`Worker error for node ${nodeNumber}:`, error);
        this.pendingRequests.delete(requestId);
        break;

      case "BATCH_LOADED":
        this.handleBatchLoaded(event.data);
        break;

      // Disposal worker message types
      case "MESH_DISPOSED":
        this.workerLoadCounts.set(
          "disposal",
          Math.max(0, this.workerLoadCounts.get("disposal") - 1)
        );
        this.handleMeshDisposed(requestId, nodeNumber, priority);
        break;

      case "BATCH_DISPOSED":
        this.handleBatchDisposed(requestId, results, stats);
        break;

      case "DISPOSAL_ERROR":
        this.workerLoadCounts.set(
          "disposal",
          Math.max(0, this.workerLoadCounts.get("disposal") - 1)
        );
        console.error(`Disposal worker error for node ${nodeNumber}:`, error);
        this.pendingRequests.delete(requestId);
        break;

      case "DISPOSAL_CACHE_CLEARED":
        break;

      case "DISPOSAL_STATS":
        break;

      // Frustum culling worker message types
      case "FRUSTUM_UPDATED":
        this.workerLoadCounts.set(
          "frustum",
          Math.max(0, this.workerLoadCounts.get("frustum") - 1)
        );
        this.pendingRequests.delete(requestId);
        break;

      case "CULLING_RESULTS":
        this.workerLoadCounts.set(
          "frustum",
          Math.max(0, this.workerLoadCounts.get("frustum") - 1)
        );
        this.handleFrustumCullingResults(event.data.results, event.data.stats);
        this.pendingRequests.delete(requestId);
        break;

      case "FRUSTUM_ERROR":
        this.workerLoadCounts.set(
          "frustum",
          Math.max(0, this.workerLoadCounts.get("frustum") - 1)
        );
        console.error(`Frustum worker error:`, error);
        this.pendingRequests.delete(requestId);
        break;

      case "CULLING_CACHE_CLEARED":
        break;

      case "CULLING_STATS":
        break;

      case "BUFFER_MULTIPLIER_SET":
        break;

      // Distance calculation worker messages
      case "DISTANCES_CALCULATED":
        this.workerLoadCounts.set(
          "distance",
          Math.max(0, this.workerLoadCounts.get("distance") - 1)
        );
        this.handleDistanceCalculationResults(result);
        this.pendingRequests.delete(requestId);
        this.pendingDistanceCalculation = false;
        break;

      case "DISTANCE_WORKER_INITIALIZED":
        this.distanceWorkerInitialized = true;
        this.pendingRequests.delete(requestId);
        // Now we can start depth 2 loading
        this.loadAllDepth2Meshes();
        break;

      case "DISTANCE_STATISTICS":
        this.updateDistanceWorkerStats(stats);
        this.pendingRequests.delete(requestId);
        break;

      case "DISTANCE_ERROR":
        this.workerLoadCounts.set(
          "distance",
          Math.max(0, this.workerLoadCounts.get("distance") - 1)
        );
        console.error("Distance calculation worker error:", error);
        this.pendingRequests.delete(requestId);
        this.pendingDistanceCalculation = false;
        break;

      case "NODES_UPDATED":
        this.pendingRequests.delete(requestId);
        break;

      default:
        console.warn("Unknown worker message type:", type);
    }
  }

  // Check if all workers are ready and trigger initialization
  checkAllWorkersReady() {
    const allReady = Array.from(this.workerReadyStates.values()).every(
      (ready) => ready
    );
    if (allReady && !this.allWorkersReady) {
      this.allWorkersReady = true;

      // Initialize distance worker with node data - but don't start loading yet
      // Loading will start when we receive DISTANCE_WORKER_INITIALIZED message
      this.initializeDistanceWorker();
    }
  }

  // Initialize distance worker with node data
  async initializeDistanceWorker() {
    const worker = this.workers.get("distance");
    if (!worker || !this.workerReadyStates.get("distance")) {
      return false;
    }

    // Prepare node data for worker
    const nodeData = [];
    for (const [nodeNumber, center] of this.nodeCenters.entries()) {
      const depth = this.nodeDepths.get(nodeNumber);
      if (depth >= 2 && depth <= 4) {
        nodeData.push({
          nodeNumber,
          center,
          depth,
          bounds: this.calculateNodeBounds(center, depth),
          maxDistance: this.maxDistance,
        });
      }
    }

    const requestId = this.requestIdCounter++;
    this.pendingRequests.set(requestId, {
      type: "DISTANCE_WORKER_INIT",
      timestamp: performance.now(),
    });

    worker.postMessage({
      type: "INITIALIZE_NODES",
      data: { nodes: nodeData },
      requestId,
    });

    return true;
  }

  // Calculate node bounds for worker initialization
  calculateNodeBounds(center, depth) {
    const size = this.estimateNodeSize(depth);
    return {
      min: { x: center.x - size, y: center.y - size, z: center.z - size },
      max: { x: center.x + size, y: center.y + size, z: center.z + size },
    };
  }

  // Extract camera data for frustum culling
  extractCameraData() {
    const camera = this.camera;

    // Get matrices
    const viewMatrix = camera.getViewMatrix().asArray();
    const projectionMatrix = camera.getProjectionMatrix().asArray();

    // Get camera properties
    return {
      viewMatrix,
      projectionMatrix,
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: camera.getTarget().x,
        y: camera.getTarget().y,
        z: camera.getTarget().z,
      },
      fov: camera.fov,
      aspect: camera.getEngine().getAspectRatio(camera),
      near: camera.minZ,
      far: camera.maxZ,
    };
  }

  // Extract enhanced camera data including movement for distance worker
  extractEnhancedCameraData() {
    const camera = this.camera;
    const currentPosition = camera.position.clone();

    // Calculate camera movement
    let speed = 0;
    let viewDirection = camera
      .getTarget()
      .subtract(currentPosition)
      .normalize();

    if (this.lastCameraPosition) {
      const movement = currentPosition.subtract(this.lastCameraPosition);
      speed = movement.length();

      // Use movement direction if camera is moving significantly
      if (speed > this.cameraMovementThreshold * 0.1) {
        viewDirection = movement.normalize();
      }
    }

    return {
      position: {
        x: currentPosition.x,
        y: currentPosition.y,
        z: currentPosition.z,
      },
      viewDirection: {
        x: viewDirection.x,
        y: viewDirection.y,
        z: viewDirection.z,
      },
      speed,
      target: {
        x: camera.getTarget().x,
        y: camera.getTarget().y,
        z: camera.getTarget().z,
      },
      fov: camera.fov,
      aspect: camera.getEngine().getAspectRatio(camera),
      near: camera.minZ,
      far: camera.maxZ,
    };
  }

  // Get current loading states for all nodes
  getCurrentLoadingStates() {
    const states = {};

    // Mark loaded nodes
    this.loadedNodeNumbers.forEach((nodeNumber) => {
      states[nodeNumber] = "loaded";
    });

    // Mark nodes in loading queues
    this.loadingQueues.forEach((queue, depth) => {
      queue.forEach((item) => {
        states[item.nodeNumber] = "loading";
      });
    });

    // Mark nodes with pending requests
    this.pendingRequests.forEach((request) => {
      if (request.nodeNumber) {
        states[request.nodeNumber] = "loading";
      }
    });

    return states;
  }

  // Main distance calculation method using worker
  calculateDistancesWithWorker() {
    const now = performance.now();

    // Check if we should skip this calculation
    if (
      !this.distanceCalculationEnabled ||
      !this.distanceWorkerInitialized || // Check if worker is initialized with node data
      this.pendingDistanceCalculation ||
      now - this.lastDistanceCalculation < this.distanceCalculationFrequency ||
      !this.workers.has("distance") ||
      this.workerLoadCounts.get("distance") > 0
    ) {
      return false;
    }

    // Extract camera data
    const cameraData = this.extractEnhancedCameraData();

    // Prepare thresholds
    const thresholds = {
      maxDistance: this.maxDistance,
      threshold30Percent: this.threshold30Percent,
      threshold80Percent: this.threshold80Percent,
      bufferZone: this.maxDistance * 0.03,
    };

    // Get current loading states
    const currentStates = this.getCurrentLoadingStates();

    // Send to worker
    const worker = this.workers.get("distance");
    const requestId = this.requestIdCounter++;

    this.pendingRequests.set(requestId, {
      type: "DISTANCE_CALCULATION",
      timestamp: now,
    });

    this.workerLoadCounts.set(
      "distance",
      this.workerLoadCounts.get("distance") + 1
    );
    this.pendingDistanceCalculation = true;

    worker.postMessage({
      type: "CALCULATE_DISTANCES",
      data: {
        cameraData,
        thresholds,
        currentStates,
      },
      requestId,
    });

    this.lastDistanceCalculation = now;
    return true;
  }

  // Handle results from distance calculation worker
  handleDistanceCalculationResults(result) {
    if (result.error) {
      console.error("Distance calculation error:", result.error);
      return;
    }

    const {
      nodesToLoad,
      nodesToUnload,
      visibilityUpdates,
      predictiveLoads,
      statistics,
    } = result;

    // Process loading requests
    Object.entries(nodesToLoad).forEach(([depthKey, nodes]) => {
      const depth = parseInt(depthKey.replace("depth", ""));
      nodes.forEach(({ nodeNumber, priority }) => {
        this.addToLoadingQueue(nodeNumber, depth, priority);
      });
    });

    // Process unloading requests
    if (nodesToUnload.length > 0) {
      this.unloadMeshes(nodesToUnload);
    }

    // Process visibility updates
    this.applyVisibilityUpdates(visibilityUpdates);

    // Process predictive loads
    if (predictiveLoads.length > 0) {
      predictiveLoads.forEach(({ nodeNumber, depth, priority }) => {
        this.addToLoadingQueue(nodeNumber, depth, priority);
      });
    }

    // Update statistics
    if (statistics) {
      this.distanceWorkerStats.lastCalculationTime = statistics.calculationTime;
      this.distanceWorkerStats.averageCalculationTime =
        statistics.averageCalculationTime;
    }
  }

  // Apply visibility updates from worker calculations
  applyVisibilityUpdates(visibilityUpdates) {
    let updatedCount = 0;

    visibilityUpdates.forEach(({ nodeNumber, shouldBeVisible }) => {
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && mesh.isVisible !== shouldBeVisible) {
        mesh.isVisible = shouldBeVisible;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
    }
  }

  // Update frustum culling
  updateFrustumCulling() {
    const now = performance.now();
    if (now - this.lastFrustumUpdate < this.frustumUpdateFrequency) {
      return; // Skip if updated recently
    }

    if (!this.frustumCullingEnabled || !this.workers.has("frustum")) {
      return;
    }

    const worker = this.workers.get("frustum");
    if (this.workerLoadCounts.get("frustum") > 0) {
      return; // Worker is busy
    }

    // Extract camera data
    const cameraData = this.extractCameraData();

    // Update frustum in worker
    const requestId = this.requestIdCounter++;
    this.pendingRequests.set(requestId, {
      type: "FRUSTUM_UPDATE",
      timestamp: now,
    });

    this.workerLoadCounts.set(
      "frustum",
      this.workerLoadCounts.get("frustum") + 1
    );

    worker.postMessage({
      type: "UPDATE_FRUSTUM",
      cameraData,
      requestId,
    });

    this.lastFrustumUpdate = now;
  }

  // Perform frustum culling on all nodes
  performFrustumCulling() {
    if (!this.frustumCullingEnabled || !this.workers.has("frustum")) {
      return;
    }

    const worker = this.workers.get("frustum");
    if (this.workerLoadCounts.get("frustum") > 0) {
      return; // Worker is busy
    }

    // Prepare node data for frustum testing
    const nodeData = [];
    for (const [nodeNumber, center] of this.nodeCenters.entries()) {
      const depth = this.nodeDepths.get(nodeNumber);
      if (depth !== 2 && depth !== 3 && depth !== 4) continue;

      // Create bounding box from center (estimate size based on depth)
      const size = this.estimateNodeSize(depth);
      const bounds = {
        min: { x: center.x - size, y: center.y - size, z: center.z - size },
        max: { x: center.x + size, y: center.y + size, z: center.z + size },
      };

      const currentState =
        this.nodeVisibilityStates.get(nodeNumber) ||
        (this.loadedNodeNumbers.has(nodeNumber) ? "visible" : "disposed");

      nodeData.push({
        nodeNumber,
        bounds,
        currentState,
        depth,
      });
    }

    if (nodeData.length === 0) return;

    // Send to frustum worker
    const requestId = this.requestIdCounter++;
    this.pendingRequests.set(requestId, {
      type: "FRUSTUM_CULLING",
      timestamp: performance.now(),
    });

    this.workerLoadCounts.set(
      "frustum",
      this.workerLoadCounts.get("frustum") + 1
    );

    worker.postMessage({
      type: "CULL_NODES",
      nodeData,
      requestId,
    });
  }

  // Estimate node size based on depth
  estimateNodeSize(depth) {
    // Rough estimates - you may want to adjust these based on your octree structure
    switch (depth) {
      case 2:
        return this.maxDistance * 0.3;
      case 3:
        return this.maxDistance * 0.15;
      case 4:
        return this.maxDistance * 0.07;
      default:
        return this.maxDistance * 0.1;
    }
  }

  // Handle frustum culling results
  handleFrustumCullingResults(results, stats) {
    const { visible, hidden, dispose, reload } = results;

    // Update visibility states
    visible.forEach((nodeNumber) => {
      this.nodeVisibilityStates.set(nodeNumber, "visible");
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && !mesh.isVisible) {
        mesh.isVisible = true;
      }
    });

    hidden.forEach((nodeNumber) => {
      this.nodeVisibilityStates.set(nodeNumber, "hidden");
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && mesh.isVisible) {
        mesh.isVisible = false;
      }
    });

    // Dispose nodes outside buffer (except depth 2)
    if (dispose.length > 0) {
      const filteredDispose = dispose.filter(
        (nodeNumber) => this.nodeDepths.get(nodeNumber) !== 2
      );
      if (filteredDispose.length > 0) {
        filteredDispose.forEach((nodeNumber) => {
          this.nodeVisibilityStates.set(nodeNumber, "disposed");
          this.disposedByFrustum.add(nodeNumber);
        });
        this.unloadMeshes(filteredDispose);
      }
    }

    // Reload nodes coming back into buffer
    if (reload.length > 0) {
      reload.forEach((nodeNumber) => {
        const depth = this.nodeDepths.get(nodeNumber);
        if (depth && depth !== 2) {
          this.nodeVisibilityStates.set(nodeNumber, "hidden"); // Start as hidden, will be shown if in frustum
          this.disposedByFrustum.delete(nodeNumber);

          // Add to loading queue with high priority (distance-based)
          const center = this.nodeCenters.get(nodeNumber);
          if (center) {
            const distance = BABYLON.Vector3.Distance(
              this.camera.position,
              center
            );
            this.addToLoadingQueue(nodeNumber, depth, distance * 0.5); // Higher priority for reload
          }
        }
      });
    }
  }

  // Handle mesh disposal completion
  handleMeshDisposed(requestId, nodeNumber, priority) {
    this.pendingRequests.delete(requestId);

    // Additional cleanup if needed
    // Note: The actual Babylon.js mesh disposal happens on the main thread
    // The worker just handles the disposal coordination and queuing
  }

  // Handle batch disposal completion
  handleBatchDisposed(requestId, results, stats) {
    results.forEach((result) => {
      if (result.success) {
      } else {
        console.warn(
          `Failed to dispose mesh for node ${result.nodeNumber}:`,
          result.error
        );
      }
    });

    this.pendingRequests.delete(requestId);
  }

  // MODIFIED: Handle mesh loaded with frame budget
  async handleMeshLoaded(requestId, nodeNumber, meshData, depth, priority) {
    // Queue mesh creation as low priority task
    this.addTask(
      this.PRIORITY.MESH_CREATION,
      async () => {
        try {
          // Remove from pending requests
          this.pendingRequests.delete(requestId);

          // Create mesh with yielding
          const mesh = await this.createMeshFromMergedData(
            meshData,
            nodeNumber,
            depth
          );

          if (mesh) {
            // Check if mesh should be visible based on current camera position
            const shouldBeVisible = this.shouldMeshBeVisible(nodeNumber, depth);
            mesh.isVisible = shouldBeVisible;
          }
        } catch (error) {
          console.error(`Error creating mesh for node ${nodeNumber}:`, error);
        }
      },
      `Handle loaded mesh ${nodeNumber}`
    );
  }

  shouldMeshBeVisible(nodeNumber, depth) {
    // Depth 2: Always visible once loaded (base LOD level)
    if (depth === 2) {
      return true;
    }

    const center = this.nodeCenters.get(nodeNumber);
    if (!center) return false;

    const centerDistance = BABYLON.Vector3.Distance(
      this.camera.position,
      center
    );
    const mesh = this.activeMeshes.get(nodeNumber);

    let faceDistance = centerDistance;
    if (mesh && mesh.getBoundingInfo && mesh.getBoundingInfo()) {
      const boundingSphere = mesh.getBoundingInfo().boundingSphere;
      faceDistance = Math.max(0, centerDistance - boundingSphere.radius);
    }

    const bufferZone = this.maxDistance * 0.03;

    switch (depth) {
      case 3:
        return faceDistance <= this.threshold80Percent + bufferZone;
      case 4:
        return faceDistance <= this.threshold30Percent + bufferZone;
      default:
        return false;
    }
  }

  addToLoadingQueue(nodeNumber, depth, priority) {
    // Check if already loaded, loading, or in queue
    if (
      this.loadedNodeNumbers.has(nodeNumber) ||
      this.isNodeInQueue(nodeNumber, depth) ||
      Array.from(this.pendingRequests.values()).some(
        (req) => req.nodeNumber === nodeNumber
      )
    ) {
      return;
    }

    const queue = this.loadingQueues.get(depth);
    if (!queue) return;

    // Smart priority: combine distance with importance
    const importance = this.calculateNodeImportance(nodeNumber, depth);
    const finalPriority = priority - importance; // Lower number = higher priority

    queue.push({
      nodeNumber,
      depth,
      priority: finalPriority,
      importance,
      timestamp: performance.now(),
    });

    // Keep queue size manageable
    if (queue.length > 50) {
      queue.sort((a, b) => a.priority - b.priority);
      queue.splice(30); // Keep top 30 priority items
    }
  }

  isNodeInQueue(nodeNumber, depth) {
    const queue = this.loadingQueues.get(depth);
    return queue && queue.some((item) => item.nodeNumber === nodeNumber);
  }

  removeFromLoadingQueue(nodeNumber, depth) {
    const queue = this.loadingQueues.get(depth);
    if (!queue) return;

    const index = queue.findIndex((item) => item.nodeNumber === nodeNumber);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  // Calculate node importance based on position and camera movement
  calculateNodeImportance(nodeNumber, depth) {
    const center = this.nodeCenters.get(nodeNumber);
    if (!center) return 0;

    let importance = 0;

    // 1. Camera direction alignment (prioritize nodes in view direction)
    const cameraTarget = this.camera.getTarget();
    const cameraPosition = this.camera.position;
    const viewDirection = cameraTarget.subtract(cameraPosition).normalize();
    const nodeDirection = center.subtract(cameraPosition).normalize();
    const alignment = BABYLON.Vector3.Dot(viewDirection, nodeDirection);
    importance += alignment * 50; // 0-50 points for alignment

    // 2. Central nodes get priority (closer to octree center)
    if (this.octreeCenter) {
      const distanceFromCenter = BABYLON.Vector3.Distance(
        center,
        this.octreeCenter
      );
      const maxOctreeDistance = this.maxDistance;
      const centralityScore = 1 - distanceFromCenter / maxOctreeDistance;
      importance += centralityScore * 30; // 0-30 points for centrality
    }

    // 3. Depth-based importance (depth 3 slightly preferred over 4 for base coverage)
    if (depth === 3) importance += 20;
    if (depth === 4) importance += 10;

    return importance;
  }

  // Process queued disposal requests
  processDisposalQueue() {
    if (!this.disposalQueue || this.disposalQueue.length === 0) return;
    if (!this.workerLoadCounts.has("disposal")) return;
    if (this.workerLoadCounts.get("disposal") >= this.maxDisposalWorkerLoad)
      return;

    // Sort disposal queue by priority
    this.disposalQueue.sort((a, b) => a.priority - b.priority);

    while (
      this.disposalQueue.length > 0 &&
      this.workerLoadCounts.get("disposal") < this.maxDisposalWorkerLoad
    ) {
      const disposalRequest = this.disposalQueue.shift();
      this.requestDisposalFromWorker(
        disposalRequest.nodeNumbers,
        disposalRequest.priority
      );
    }
  }

  requestDisposalFromWorker(nodeNumbers, priority = 0) {
    const worker = this.workers.get("disposal");
    if (!worker) {
      console.warn("No disposal worker available");
      return;
    }

    const requestId = this.requestIdCounter++;

    this.pendingRequests.set(requestId, {
      nodeNumbers,
      priority,
      timestamp: performance.now(),
      type: "DISPOSAL",
    });

    this.workerLoadCounts.set(
      "disposal",
      this.workerLoadCounts.get("disposal") + 1
    );

    worker.postMessage({
      type: "DISPOSE_MESHES",
      nodeNumbers,
      requestId,
      priority,
    });
  }

  // MODIFIED: Improved queue processor with frame budget
  startLoadingQueueProcessor() {
    const processQueue = () => {
      const frameStart = performance.now();
      const maxFrameTime = this.meshCreationBudget;
      let processedInFrame = 0;

      // Process in logical order: depth 2, then 3, then 4
      for (const depth of [2, 3, 4]) {
        if (performance.now() - frameStart > maxFrameTime) break;
        if (processedInFrame >= this.maxMeshesPerFrame) break;

        const queue = this.loadingQueues.get(depth);
        const worker = this.workers.get(depth);
        const currentLoad = this.workerLoadCounts.get(depth);

        if (
          !queue ||
          !worker ||
          queue.length === 0 ||
          currentLoad >= this.maxWorkerLoad
        ) {
          continue;
        }

        // Batch loading: process multiple items at once for better performance
        const batchSize = Math.min(
          this.maxWorkerLoad - currentLoad,
          queue.length,
          this.maxMeshesPerFrame - processedInFrame,
          2 // Reduced from 3 to 2 for better frame budget
        );

        if (batchSize <= 0) continue;

        // Sort queue by smart priority (distance + mesh importance)
        queue.sort((a, b) => {
          // Primary: distance (closer first)
          const distanceDiff = a.priority - b.priority;
          if (Math.abs(distanceDiff) > this.maxDistance * 0.1) {
            return distanceDiff;
          }

          // Secondary: prefer central/important nodes
          const aImportance = this.calculateNodeImportance(
            a.nodeNumber,
            a.depth
          );
          const bImportance = this.calculateNodeImportance(
            b.nodeNumber,
            b.depth
          );
          return bImportance - aImportance; // Higher importance first
        });

        // Process batch
        for (let i = 0; i < batchSize; i++) {
          if (performance.now() - frameStart > maxFrameTime) break;

          const item = queue.shift();
          if (!item) break;

          // Double-check if still needed
          if (!this.shouldLoadNode(item.nodeNumber, item.depth)) {
            continue;
          }

          // Send request to worker
          this.requestMeshFromWorker(
            item.nodeNumber,
            item.depth,
            item.priority
          );
          processedInFrame++;
        }

        // Break after processing one depth to maintain balance
        break;
      }

      // Continue processing with proper scheduling
      if (this.isSchedulerRunning) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if ("requestIdleCallback" in window) {
          requestIdleCallback(processQueue, { timeout: 16 });
        } else {
          setTimeout(processQueue, 16);
        }
      }
    };

    processQueue();
  }

  // Improved worker load balancing
  requestMeshFromWorker(nodeNumber, depth, priority = 0) {
    const worker = this.workers.get(depth);
    if (!worker) {
      console.warn(`No worker available for depth ${depth}`);
      return;
    }

    // Check if worker is overloaded
    const currentLoad = this.workerLoadCounts.get(depth);
    if (currentLoad >= this.maxWorkerLoad) {
      console.warn(`Worker for depth ${depth} is at max capacity`);
      return;
    }

    const requestId = this.requestIdCounter++;

    // Track pending request with enhanced metadata
    this.pendingRequests.set(requestId, {
      nodeNumber,
      depth,
      priority,
      timestamp: performance.now(),
      type: "MESH_LOAD",
    });

    // Increase worker load count
    this.workerLoadCounts.set(depth, currentLoad + 1);

    // Send request to worker with urgency flag for very close meshes
    const center = this.nodeCenters.get(nodeNumber);
    const distance = center
      ? BABYLON.Vector3.Distance(this.camera.position, center)
      : Infinity;
    const isUrgent = distance < this.maxDistance * 0.2; // Very close meshes

    worker.postMessage({
      type: "LOAD_MESH",
      nodeNumber,
      requestId,
      priority,
      urgent: isUrgent,
      timestamp: performance.now(),
    });
  }

  shouldLoadNode(nodeNumber, depth) {
    if (this.loadedNodeNumbers.has(nodeNumber)) {
      return false;
    }

    // Depth 2: Always load if not already loaded (base LOD level)
    if (depth === 2) {
      return true;
    }

    const center = this.nodeCenters.get(nodeNumber);
    if (!center) return false;

    const centerDistance = BABYLON.Vector3.Distance(
      this.camera.position,
      center
    );
    const bufferZone = this.maxDistance * 0.03;

    switch (depth) {
      case 3:
        return centerDistance <= this.threshold80Percent + bufferZone;
      case 4:
        return centerDistance <= this.threshold30Percent + bufferZone;
      default:
        return false;
    }
  }

  // Load all depth 2 meshes immediately (no distance checking)
  async loadAllDepth2Meshes() {
    try {
      const depth2Nodes = this.getNodesAtDepth(2);

      const worker = this.workers.get(2);
      if (!worker) {
        console.error("No worker available for depth 2");
        return;
      }

      // Check if depth 2 worker is ready
      if (!this.workerReadyStates.get(2)) {
        console.warn("Depth 2 worker not ready yet, cannot load meshes");
        return;
      }

      // Use batch loading for better performance
      const requestId = this.requestIdCounter++;

      this.pendingRequests.set(requestId, {
        type: "BATCH",
        nodeNumbers: depth2Nodes,
        depth: 2,
        timestamp: performance.now(),
      });

      worker.postMessage({
        type: "PRELOAD_BATCH",
        nodeNumbers: depth2Nodes,
        requestId,
      });
    } catch (error) {
      console.error("Error loading initial depth 2 meshes:", error);
    }
  }

  handleBatchLoaded(data) {
    const { requestId, results, depth, stats } = data;

    // Process each result using for...of to preserve this context
    const processResults = async () => {
      for (const result of results) {
        if (result.success && result.meshData) {
          try {
            const mesh = await this.createMeshFromMergedData(
              result.meshData,
              result.nodeNumber,
              depth
            );
            if (mesh) {
              mesh.isVisible = true; // Depth 2 meshes are always visible initially
            }
          } catch (error) {
            console.error(
              `Error creating batch mesh for node ${result.nodeNumber}:`,
              error
            );
          }
        } else if (result.skipped) {
          // Skip nodes without mesh data - this is normal, not an error
        } else {
          // Only log actual errors, not missing mesh data
          if (!result.reason || result.reason !== "No mesh data") {
            console.warn(
              `Failed to load mesh for node ${result.nodeNumber}:`,
              result.error
            );
          }
        }
      }

      // Mark depth 2 as initially loaded when batch is complete
      if (depth === 2) {
        this.depth2LoadedInitially = true;
        this.loadedDepths.add(2);
      }
    };

    // Execute the processing
    processResults();

    this.pendingRequests.delete(requestId);
  }

  // MODIFIED: Async mesh creation with yielding
  async createMeshFromMergedData(meshData, nodeNumber, depth) {
    return new Promise((resolve) => {
      // Add mesh creation as low priority task
      this.addTask(
        this.PRIORITY.MESH_CREATION,
        async () => {
          try {
            const mesh = await this.createMeshFromMergedDataInternal(
              meshData,
              nodeNumber,
              depth
            );
            resolve(mesh);
          } catch (error) {
            console.error(`Error creating mesh for node ${nodeNumber}:`, error);
            resolve(null);
          }
        },
        `Create mesh for node ${nodeNumber}`
      );
    });
  }

  // NEW: Internal mesh creation with frame yielding
  async createMeshFromMergedDataInternal(meshData, nodeNumber, depth) {
    const startTime = performance.now();

    if (!meshData || !meshData.vertexData) {
      console.warn(
        `Invalid mesh data for node ${nodeNumber} at depth ${depth}`
      );
      return null;
    }

    if (!meshData.vertexData.positions || !meshData.vertexData.indices) {
      console.warn(
        `Missing required vertex data for node ${nodeNumber} at depth ${depth}`
      );
      return null;
    }

    const existingMesh = this.activeMeshes.get(nodeNumber);
    if (existingMesh && this.nodeDepths.get(nodeNumber) === depth) {
      return existingMesh;
    }

    // Yield control if we've used too much frame time
    if (performance.now() - startTime > this.meshCreationBudget) {
      await this.yieldToMainThread();
    }

    const mesh = new BABYLON.Mesh(
      meshData.name || `lod_node_${nodeNumber}`,
      this.scene
    );

    // Create vertex data in chunks to avoid blocking
    const vertexData = new BABYLON.VertexData();

    // Process positions
    vertexData.positions = meshData.vertexData.positions;

    // Yield after positions
    if (performance.now() - startTime > this.meshCreationBudget) {
      await this.yieldToMainThread();
    }

    vertexData.indices = meshData.vertexData.indices;

    if (meshData.vertexData.normals) {
      vertexData.normals = meshData.vertexData.normals;

      // Yield after normals
      if (performance.now() - startTime > this.meshCreationBudget) {
        await this.yieldToMainThread();
      }
    }

    if (meshData.vertexData.colors) {
      vertexData.colors = meshData.vertexData.colors;
    }

    // Apply vertex data
    vertexData.applyToMesh(mesh);

    // Yield after applying vertex data
    if (performance.now() - startTime > this.meshCreationBudget) {
      await this.yieldToMainThread();
    }

    // Handle transforms
    if (meshData.transforms) {
      if (meshData.transforms.worldMatrix) {
        mesh.setPreTransformMatrix(
          BABYLON.Matrix.FromArray(meshData.transforms.worldMatrix)
        );
      } else {
        mesh.position = new BABYLON.Vector3(
          meshData.transforms.position.x,
          meshData.transforms.position.y,
          meshData.transforms.position.z
        );
        mesh.rotation = new BABYLON.Vector3(
          meshData.transforms.rotation.x,
          meshData.transforms.rotation.y,
          meshData.transforms.rotation.z
        );
        mesh.scaling = new BABYLON.Vector3(
          meshData.transforms.scaling.x,
          meshData.transforms.scaling.y,
          meshData.transforms.scaling.z
        );
      }
    }

    // Create material efficiently
    const material = new BABYLON.StandardMaterial(
      mesh.name + "_material",
      this.scene
    );
    material.backFaceCulling = false;
    material.twoSidedLighting = true;

    // Use vertex colors if available, otherwise use depth-based colors
    if (meshData.vertexData.colors) {
      // material.useVertexColors = true;
    } else {
      // Fallback to depth-based diffuse colors
      switch (depth) {
        case 2:
          material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2);
          break;
        case 3:
          material.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
          break;
        case 4:
          material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.8);
          break;
        default:
          material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      }
    }

    mesh.material = material;
    mesh.originalMaterial = material;

    // Enhanced metadata storage
    mesh.metadata = {
      ...meshData.metadata,
      nodeNumber,
      depth,
      isLodMesh: true,
      originalMeshCount: meshData.metadata?.originalMeshCount || 0,
      originalMeshKeys: meshData.metadata?.originalMeshKeys || [],
      vertexMappings: meshData.metadata?.vertexMappings || [],
      mergedVertexData: meshData.vertexData,
    };

    // Add utility methods to mesh
    this.addMeshUtilityMethods(mesh);

    mesh.isPickable = true;
    this.activeMeshes.set(nodeNumber, mesh);
    this.loadedNodeNumbers.add(nodeNumber);

    return mesh;
  }

  addMeshUtilityMethods(mesh) {
    // Store reference to the LOD manager for access in mesh methods
    const lodManager = this;

    // Add click detection function
    mesh.getClickedOriginalMesh = function (faceId) {
      const mappingInfo = this.findOriginalMeshFromFace(
        faceId,
        this.getIndices(),
        this.metadata.vertexMappings
      );

      if (mappingInfo) {
        // Find the corresponding mesh info
        const meshInfo = this.metadata.vertexMappings.find(
          (mapping) => mapping.meshIndex === mappingInfo.meshIndex
        );

        return {
          ...mappingInfo,
          meshId: meshInfo.meshId,
          fileName: meshInfo.fileName,
          metadataId: meshInfo.metadataId,
          screenCoverage: meshInfo.screenCoverage,
          name: meshInfo.name,
          parentFileName: meshInfo.parentFileName,
          nodeNumber: this.metadata.nodeNumber,
        };
      }

      return null;
    };

    // Add function to extract individual mesh data
    mesh.extractIndividualMeshData = function (meshIndex) {
      const mapping = this.metadata.vertexMappings.find(
        (m) => m.meshIndex === meshIndex
      );

      if (mapping) {
        return this.extractMeshDataFromMapping(
          this.metadata.mergedVertexData,
          mapping
        );
      }

      return null;
    };

    // UPDATED: Enhanced highlight function with proper state tracking
    mesh.highlightOriginalMesh = function (meshId) {
      console.log("🎯 Highlighting mesh:", meshId);

      const mapping = this.metadata.vertexMappings.find(
        (m) => m.meshId === meshId
      );

      if (!mapping) {
        console.log("❌ No mapping found for meshId:", meshId);
        return;
      }

      console.log("✅ Found mapping:", mapping);

      // Store reference to currently highlighted mesh and meshId using LOD manager refs
      if (lodManager.highlightRefs) {
        lodManager.highlightRefs.currentHighlightedMeshRef.current = this;
        lodManager.highlightRefs.currentHighlightedMeshIdRef.current = meshId;
        console.log("📝 Stored current highlighted mesh:", meshId);
      }

      // Store original material if not already stored
      if (!this._originalMaterial) {
        this._originalMaterial = this.material;
      }

      // Apply highlight using vertex colors
      this.highlightWithVertexColors(mapping);
    };

    // UPDATED: Improved vertex color highlighting that preserves originals
    mesh.highlightWithVertexColors = function (mapping) {
      const positionData = this.getVerticesData(
        BABYLON.VertexBuffer.PositionKind
      );
      const vertexCount = positionData.length / 3;

      // Store original vertex colors if they exist, or create white colors
      let colors = this.getVerticesData(BABYLON.VertexBuffer.ColorKind);

      if (!colors) {
        // No existing vertex colors - create white colors to preserve material
        colors = new Float32Array(vertexCount * 4);
        for (let i = 0; i < vertexCount; i++) {
          colors[i * 4 + 0] = 1.0; // R
          colors[i * 4 + 1] = 1.0; // G
          colors[i * 4 + 2] = 1.0; // B
          colors[i * 4 + 3] = 1.0; // A
        }
      }

      // Store original colors for restoration (only once per mesh)
      if (!this._originalVertexColors) {
        this._originalVertexColors = colors.slice(); // Copy array
        console.log("💾 Stored original vertex colors for restoration");
      }

      // Apply highlight to specific vertex range
      for (let i = mapping.start; i < mapping.start + mapping.count; i++) {
        if (i < vertexCount) {
          colors[i * 4 + 0] = 1.0; // R - Yellow highlight
          colors[i * 4 + 1] = 1.0; // G
          colors[i * 4 + 2] = 0.0; // B
          colors[i * 4 + 3] = 1.0; // A
        }
      }

      this.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);

      if (this.material) {
        this.material.useVertexColors = true;
      }

      console.log("🎨 Applied vertex color highlight");
    };

    // UPDATED: Improved remove highlight function
    mesh.removeHighlight = function () {
      console.log("🧹 Removing highlight from mesh:", this.name);

      // Remove overlay if exists
      if (this._highlightOverlay) {
        this._highlightOverlay.dispose();
        this._highlightOverlay = null;
        console.log("🗑️ Highlight overlay removed");
      }

      // Restore original vertex colors for the ENTIRE mesh
      if (this._originalVertexColors) {
        console.log("🔄 Restoring original vertex colors for entire mesh");
        this.setVerticesData(
          BABYLON.VertexBuffer.ColorKind,
          this._originalVertexColors,
          true
        );
        console.log("🔄 Original vertex colors restored");

        // Clear the stored original colors so they can be re-captured for the next highlight
        this._originalVertexColors = null;
      } else if (this.getVerticesData(BABYLON.VertexBuffer.ColorKind)) {
        // Remove vertex colors entirely to restore material color
        this.removeVerticesData(BABYLON.VertexBuffer.ColorKind);
        if (this.material) {
          this.material.useVertexColors = false;
        }
        console.log("🔄 Vertex colors removed, material color restored");
      }

      // Restore original material
      if (this._originalMaterial) {
        this.material = this._originalMaterial;
        console.log("🔄 Original material restored");
      }

      console.log("✅ Highlight removal completed");
    };

    // Enhanced clear highlight function
    mesh.clearHighlight = function () {
      let colors = this.getVerticesData(BABYLON.VertexBuffer.ColorKind);

      if (!colors) {
        const vertexCount =
          this.getVerticesData(BABYLON.VertexBuffer.PositionKind).length / 3;
        colors = new Float32Array(vertexCount * 4);
      }

      for (let i = 0; i < colors.length; i += 4) {
        colors[i] = 1; // R
        colors[i + 1] = 0.3; // G
        colors[i + 2] = 0.3; // B
        colors[i + 3] = 1; // A
      }

      this.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    };

    // Helper method for finding original mesh from face
    mesh.findOriginalMeshFromFace = function (faceId, indices, vertexMappings) {
      if (!indices || !vertexMappings || faceId === undefined) return null;

      // Get the vertex indices for the clicked face
      const vertexIndex1 = indices[faceId * 3];
      const vertexIndex2 = indices[faceId * 3 + 1];
      const vertexIndex3 = indices[faceId * 3 + 2];

      // Find which original mesh these vertices belong to
      for (const mapping of vertexMappings) {
        const start = mapping.startVertex;
        const end = mapping.startVertex + mapping.vertexCount;

        // Check if all three vertices of the face belong to this original mesh
        if (
          vertexIndex1 >= start &&
          vertexIndex1 < end &&
          vertexIndex2 >= start &&
          vertexIndex2 < end &&
          vertexIndex3 >= start &&
          vertexIndex3 < end
        ) {
          return {
            meshIndex: mapping.meshIndex,
            startVertex: mapping.startVertex,
            vertexCount: mapping.vertexCount,
            startIndex: mapping.startIndex,
            indexCount: mapping.indexCount,
            faceId: faceId,
            // Calculate relative face ID within the original mesh
            relativeFaceId: Math.floor((faceId * 3 - mapping.startIndex) / 3),
          };
        }
      }

      return null;
    };

    // Helper method to extract individual mesh data from merged data
    mesh.extractMeshDataFromMapping = function (mergedData, meshMapping) {
      const vertexCount = meshMapping.vertexCount;
      const indexCount = meshMapping.indexCount;

      // Extract positions
      const positions = new Float32Array(vertexCount * 3);
      const startPos = meshMapping.startVertex * 3;
      for (let i = 0; i < vertexCount * 3; i++) {
        positions[i] = mergedData.positions[startPos + i];
      }

      // Extract indices and adjust them to start from 0
      const indices = new Uint32Array(indexCount);
      const startIdx = meshMapping.startIndex;
      const vertexOffset = meshMapping.startVertex;
      for (let i = 0; i < indexCount; i++) {
        indices[i] = mergedData.indices[startIdx + i] - vertexOffset;
      }

      // Extract normals if available
      let normals = null;
      if (mergedData.normals) {
        normals = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount * 3; i++) {
          normals[i] = mergedData.normals[startPos + i];
        }
      }

      // Extract colors if available
      let colors = null;
      if (mergedData.colors) {
        colors = new Float32Array(vertexCount * 4);
        const startColor = meshMapping.startVertex * 4;
        for (let i = 0; i < vertexCount * 4; i++) {
          colors[i] = mergedData.colors[startColor + i];
        }
      }

      return {
        positions,
        indices,
        normals,
        colors,
        vertexCount,
        indexCount,
      };
    };
  }

  unloadMeshes(nodeNumbers) {
    nodeNumbers.forEach((nodeNumber) => {
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh) {
        mesh.dispose();
        this.activeMeshes.delete(nodeNumber);
        this.loadedNodeNumbers.delete(nodeNumber);
      }
    });
  }

  findAllMeshesByTag(tagName) {
    const results = [];

    // Search through all active LOD meshes
    for (const [nodeNumber, lodMesh] of this.activeMeshes.entries()) {
      if (!lodMesh.metadata || !lodMesh.metadata.vertexMappings) {
        continue;
      }

      // Find all mappings in this mesh that match the tag
      const matchingMappings = lodMesh.metadata.vertexMappings.filter(
        (mapping) => {
          return (
            mapping.name === tagName ||
            mapping.fileName === tagName ||
            mapping.meshId === tagName ||
            mapping.metadataId === tagName ||
            (mapping.parentFileName && mapping.parentFileName === tagName) ||
            // Also check for tag-based identifiers
            (mapping.tag && mapping.tag === tagName) ||
            (mapping.tagId && mapping.tagId === tagName)
          );
        }
      );

      // Add each matching mapping as a separate result
      matchingMappings.forEach((mapping) => {
        results.push({
          lodMesh,
          mapping,
          nodeNumber,
          depth: lodMesh.metadata.depth,
        });
      });
    }

    return results;
  }

  // UPDATED: Select tag that may span multiple nodes
  selectTagInLOD(tagName) {
    console.log("🔍 Searching for tag across all LOD meshes:", tagName);

    const results = this.findAllMeshesByTag(tagName);

    if (results.length === 0) {
      console.warn("❌ Tag not found in any LOD mesh:", tagName);
      return null;
    }

    console.log(`✅ Found tag in ${results.length} LOD mesh(es):`, {
      tagName,
      meshCount: results.length,
      nodes: results.map((r) => r.nodeNumber),
      depths: results.map((r) => r.depth),
    });

    // Clear any existing highlights
    this.clearAllHighlights();

    // Highlight ALL occurrences of the tag
    let totalHighlighted = 0;
    results.forEach((result, index) => {
      const { lodMesh, mapping, nodeNumber, depth } = result;

      console.log(
        `🎯 Highlighting tag part ${index + 1}/${
          results.length
        } in node ${nodeNumber}:`,
        {
          meshName: lodMesh.name,
          mapping: {
            meshId: mapping.meshId,
            name: mapping.name,
            startVertex: mapping.startVertex,
            vertexCount: mapping.vertexCount,
          },
        }
      );

      if (lodMesh.highlightOriginalMesh) {
        lodMesh.highlightOriginalMesh(mapping.meshId);
        totalHighlighted++;
      }
    });

    // Store multi-node selection state
    if (this.highlightRefs) {
      this.highlightRefs.currentHighlightedMeshRef.current = results[0].lodMesh; // Primary mesh
      this.highlightRefs.currentHighlightedMeshIdRef.current = tagName;
      this.highlightRefs.multiNodeSelection = results; // Store all highlighted parts
    }

    console.log(
      `✅ Successfully highlighted ${totalHighlighted} parts of tag "${tagName}"`
    );

    return {
      tagName,
      results,
      totalParts: results.length,
      highlightedParts: totalHighlighted,
      nodes: results.map((r) => r.nodeNumber),
      isMultiNode: results.length > 1,
    };
  }

  // UPDATED: Enhanced focus method for multi-node tags
  selectAndFocusTag(tagName, shouldFocus = false) {
    const result = this.selectTagInLOD(tagName);

    if (!result || !shouldFocus) {
      return result;
    }

    // Calculate combined bounding box for all parts of the tag
    try {
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      let hasValidBounds = false;

      result.results.forEach(({ lodMesh, mapping }) => {
        const meshData = lodMesh.extractIndividualMeshData(mapping.meshIndex);
        if (meshData && meshData.positions) {
          // Calculate bounds for this part
          for (let i = 0; i < meshData.positions.length; i += 3) {
            const x = meshData.positions[i];
            const y = meshData.positions[i + 1];
            const z = meshData.positions[i + 2];

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
            hasValidBounds = true;
          }
        }
      });

      if (hasValidBounds) {
        // Calculate center and size of combined bounding box
        const center = new BABYLON.Vector3(
          (minX + maxX) / 2,
          (minY + maxY) / 2,
          (minZ + maxZ) / 2
        );

        const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

        console.log(`🎯 Focusing on multi-node tag "${tagName}":`, {
          center: { x: center.x, y: center.y, z: center.z },
          size,
          totalParts: result.totalParts,
        });

        // Focus camera on the combined bounds
        this.focusCameraOnPoint(center, size);
      }
    } catch (error) {
      console.error("Error focusing on multi-node tag:", error);
    }

    return result;
  }

  // UPDATED: Enhanced clear highlights to handle multi-node selections
  clearAllHighlights() {
    console.log("🧹 Clearing all highlights (including multi-node selections)");

    // Clear highlights from all LOD meshes
    for (const [nodeNumber, lodMesh] of this.activeMeshes.entries()) {
      if (lodMesh.removeHighlight) {
        lodMesh.removeHighlight();
      }
    }

    // Clear any manager-level highlight references
    if (this.highlightRefs) {
      if (this.highlightRefs.currentHighlightedMeshRef) {
        this.highlightRefs.currentHighlightedMeshRef.current = null;
      }
      if (this.highlightRefs.currentHighlightedMeshIdRef) {
        this.highlightRefs.currentHighlightedMeshIdRef.current = null;
      }
      // Clear multi-node selection state
      if (this.highlightRefs.multiNodeSelection) {
        this.highlightRefs.multiNodeSelection = null;
      }
    }

    // Clear traditional highlight
    this.unhighlightMesh();

    console.log("✅ All highlights cleared");
  }

  // NEW: Get information about current multi-node selection
  getCurrentMultiNodeSelection() {
    if (this.highlightRefs && this.highlightRefs.multiNodeSelection) {
      const selection = this.highlightRefs.multiNodeSelection;
      return {
        tagName: this.highlightRefs.currentHighlightedMeshIdRef.current,
        totalParts: selection.length,
        nodes: selection.map((r) => r.nodeNumber),
        depths: selection.map((r) => r.depth),
        meshNames: selection.map((r) => r.lodMesh.name),
        isMultiNode: selection.length > 1,
      };
    }
    return null;
  }

  // NEW: Utility to find which nodes contain parts of a specific tag
  getNodesContainingTag(tagName) {
    const results = this.findAllMeshesByTag(tagName);
    return {
      tagName,
      nodeNumbers: [...new Set(results.map((r) => r.nodeNumber))],
      totalParts: results.length,
      isMultiNode: results.length > 1,
      details: results.map((r) => ({
        nodeNumber: r.nodeNumber,
        depth: r.depth,
        meshName: r.lodMesh.name,
        partName: r.mapping.name || r.mapping.meshId,
      })),
    };
  }

  // NEW: Enhanced method to check if a tag spans multiple nodes
  isTagMultiNode(tagName) {
    const results = this.findAllMeshesByTag(tagName);
    const uniqueNodes = new Set(results.map((r) => r.nodeNumber));
    return {
      isMultiNode: uniqueNodes.size > 1,
      nodeCount: uniqueNodes.size,
      partCount: results.length,
      nodes: Array.from(uniqueNodes),
    };
  }

  // Helper method to focus camera
  focusCameraOnPoint(center, size) {
    if (!this.camera) return;

    const distance = size * 2; // Adjust multiplier as needed
    const direction = this.camera.position.subtract(center).normalize();
    const newPosition = center.add(direction.scale(distance));

    // Animate camera to new position
    BABYLON.Animation.CreateAndStartAnimation(
      "cameraFocus",
      this.camera,
      "position",
      30, // fps
      30, // duration frames
      this.camera.position,
      newPosition,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Update camera target
    BABYLON.Animation.CreateAndStartAnimation(
      "cameraTarget",
      this.camera,
      "target",
      30,
      30,
      this.camera.getTarget(),
      center,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  // MODIFIED: Update method with priority scheduling
  update() {
    const now = performance.now();

    // Always prioritize camera-related updates
    this.addTask(
      this.PRIORITY.CAMERA,
      () => {
        // Quick camera movement check
        if (
          this.isUpdating ||
          now - this.lastUpdate < 8.33 / this.updateFrequency
        ) {
          return;
        }

        this.isUpdating = true;
        this.lastUpdate = now;

        try {
          this.frameCounter++;
          if (this.frameCounter < this.updateFrequency) {
            this.isUpdating = false;
            return;
          }
          this.frameCounter = 0;

          const currentPosition = this.camera.position.clone();
          if (this.lastCameraPosition) {
            const movementDistance = BABYLON.Vector3.Distance(
              currentPosition,
              this.lastCameraPosition
            );
            if (movementDistance < this.cameraMovementThreshold) {
              this.isUpdating = false;
              return;
            }
          }
          this.lastCameraPosition = currentPosition;

          // Schedule LOD updates as medium priority
          this.addTask(
            this.PRIORITY.LOD_UPDATE,
            () => {
              this.performLODUpdate();
            },
            "LOD Update"
          );

          this.isUpdating = false;
        } catch (error) {
          console.error("Error in LOD update:", error);
          this.isUpdating = false;
        }
      },
      "Camera Update"
    );
  }

  // NEW: Separate LOD update logic
  performLODUpdate() {
    try {
      // Use distance worker if available and enabled
      if (this.distanceCalculationEnabled && this.workers.has("distance")) {
        const workerUsed = this.calculateDistancesWithWorker();

        if (!workerUsed) {
          // Fallback to original distance calculation if worker is busy
          this.performFallbackDistanceCalculation();
        }
      } else {
        // Fallback to original method
        this.performFallbackDistanceCalculation();
      }

      // Update frustum culling (independent of distance calculations)
      if (this.frustumCullingEnabled) {
        this.updateFrustumCulling();
        if (this.frameCounter % 2 === 0) {
          this.performFrustumCulling();
        }
      }

      // Process disposal queue
      if (this.workers.has("disposal")) {
        this.processDisposalQueue();
      }
    } catch (error) {
      console.error("Error in LOD update:", error);
    }
  }

  // Fallback distance calculation (original method)
  performFallbackDistanceCalculation() {
    const bufferZone = this.maxDistance * 0.03;
    const nodesToUnload = new Set();

    for (const [nodeNumber, center] of this.nodeCenters.entries()) {
      const depth = this.nodeDepths.get(nodeNumber);
      if (depth !== 2 && depth !== 3 && depth !== 4) continue;

      const centerDistance = BABYLON.Vector3.Distance(
        this.camera.position,
        center
      );
      let faceDistance = centerDistance;

      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && mesh.getBoundingInfo && mesh.getBoundingInfo()) {
        const boundingSphere = mesh.getBoundingInfo().boundingSphere;
        faceDistance = Math.max(0, centerDistance - boundingSphere.radius);
      }

      const isLoaded = this.loadedNodeNumbers.has(nodeNumber);
      const priority = faceDistance;

      // Original LOD logic...
      if (depth === 2) {
        if (!isLoaded && !this.depth2LoadedInitially) {
          this.addToLoadingQueue(nodeNumber, depth, priority);
        }
      } else if (depth === 3) {
        if (!isLoaded && faceDistance <= this.threshold80Percent + bufferZone) {
          this.addToLoadingQueue(nodeNumber, depth, priority);
        } else if (
          isLoaded &&
          faceDistance > this.threshold80Percent + bufferZone * 1.2
        ) {
          nodesToUnload.add(nodeNumber);
        }
      } else if (depth === 4) {
        if (!isLoaded && faceDistance <= this.threshold30Percent + bufferZone) {
          this.addToLoadingQueue(nodeNumber, depth, priority);
        } else if (
          isLoaded &&
          faceDistance > this.threshold30Percent + bufferZone * 1.2
        ) {
          nodesToUnload.add(nodeNumber);
        }
      }

      // Update visibility
      if (isLoaded && mesh) {
        let shouldBeVisible =
          depth === 2 ||
          (depth === 3 &&
            faceDistance <= this.threshold80Percent + bufferZone) ||
          (depth === 4 && faceDistance <= this.threshold30Percent + bufferZone);

        if (mesh.isVisible !== shouldBeVisible) {
          mesh.isVisible = shouldBeVisible;
        }
      }
    }

    if (nodesToUnload.size > 0) {
      const filteredNodesToUnload = Array.from(nodesToUnload).filter(
        (nodeNumber) => this.nodeDepths.get(nodeNumber) !== 2
      );
      if (filteredNodesToUnload.length > 0) {
        this.unloadMeshes(filteredNodesToUnload);
      }
    }
  }

  // Highlight mesh functionality
  highlightMesh(mesh) {
    if (!mesh) return;

    if (!this.highlightMaterial) {
      this.highlightMaterial = new BABYLON.StandardMaterial(
        "highlightMaterial",
        this.scene
      );
      this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
      this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0);
      this.highlightMaterial.backFaceCulling = false;
      this.highlightMaterial.twoSidedLighting = true;
    }

    if (this.highlightedMesh && this.highlightedMesh !== mesh) {
      this.unhighlightMesh();
    }

    if (mesh.originalMaterial) {
      mesh.material = this.highlightMaterial;
      this.highlightedMesh = mesh;

      console.log("Selected mesh:", {
        name: mesh.name,
        nodeNumber: mesh.metadata?.nodeNumber,
        depth: mesh.metadata?.depth,
        isLodMesh: mesh.metadata?.isLodMesh || false,
      });

      if (mesh.metadata?.originalMeshKeys) {
        console.log(
          "Original mesh components:",
          mesh.metadata.originalMeshKeys
        );
      }
    }
  }

  unhighlightMesh() {
    if (this.highlightedMesh && this.highlightedMesh.originalMaterial) {
      this.highlightedMesh.material = this.highlightedMesh.originalMaterial;
      this.highlightedMesh = null;
    }
  }

  // Get nodes at specific depth
  getNodesAtDepth(depth) {
    return Array.from(this.nodeDepths.entries())
      .filter(([_, nodeDepth]) => nodeDepth === depth)
      .map(([nodeNumber, _]) => nodeNumber);
  }

  setDistanceThresholds(maxDistance) {
    this.maxDistance = maxDistance;
    this.threshold30Percent = maxDistance * 0.5;
    this.threshold80Percent = maxDistance * 0.9;
  }

  async processOctreeNodes(rootBlock, depth = 0, parent = null) {
    if (!rootBlock || !rootBlock.properties) return;

    const nodeNumber = rootBlock.properties.nodeNumber;
    const nodeDepth = depth;

    this.nodeDepths.set(nodeNumber, nodeDepth);

    if (rootBlock.bounds && rootBlock.bounds.min && rootBlock.bounds.max) {
      const min = new BABYLON.Vector3(
        rootBlock.bounds.min.x,
        rootBlock.bounds.min.y,
        rootBlock.bounds.min.z
      );

      const max = new BABYLON.Vector3(
        rootBlock.bounds.max.x,
        rootBlock.bounds.max.y,
        rootBlock.bounds.max.z
      );

      const center = BABYLON.Vector3.Center(min, max);
      this.nodeCenters.set(nodeNumber, center);
    }

    if (rootBlock.relationships && rootBlock.relationships.childBlocks) {
      for (const childBlock of rootBlock.relationships.childBlocks) {
        if (childBlock) {
          await this.processOctreeNodes(childBlock, depth + 1, nodeNumber);
        }
      }
    }
  }

  async initWithOctreeData(octreeData) {
    try {
      await this.processOctreeNodes(octreeData.data.blockHierarchy);

      return true;
    } catch (error) {
      console.error("Error initializing progressive LOD Manager:", error);
      return false;
    }
  }

  // Enhanced memory usage with distance worker stats
  getMemoryUsage() {
    const memoryMB = this.getTotalMemoryUsage();

    // Calculate queue information
    let totalQueued = 0;
    let totalLoading = 0;

    this.loadingQueues.forEach((queue, depth) => {
      totalQueued += queue.length;
      if (depth !== "disposal") {
        totalLoading += this.workerLoadCounts.get(depth);
      }
    });

    // Add disposal queue information
    totalQueued += this.disposalQueue.length;
    const disposalWorkerLoad = this.workerLoadCounts.get("disposal");
    const frustumWorkerLoad = this.workerLoadCounts.get("frustum");

    // Calculate frustum culling stats
    let visibleByFrustum = 0;
    let hiddenByFrustum = 0;
    let disposedByFrustum = 0;

    for (const [nodeNumber, state] of this.nodeVisibilityStates.entries()) {
      switch (state) {
        case "visible":
          visibleByFrustum++;
          break;
        case "hidden":
          hiddenByFrustum++;
          break;
        case "disposed":
          disposedByFrustum++;
          break;
      }
    }

    return {
      loadedNodes: this.loadedNodeNumbers.size || 0,
      activeMeshes: this.activeMeshes.size || 0,
      cachedMeshes: 0, // Workers handle their own caching
      memoryMB: memoryMB,
      queuedLoads: totalQueued,
      queuedDisposals: this.disposalQueue.length,
      hiddenMeshes: Array.from(this.activeMeshes.values()).filter(
        (mesh) => !mesh.isVisible
      ).length,
      frustumCulling: {
        enabled: this.frustumCullingEnabled,
        bufferMultiplier: this.frustumBufferMultiplier,
        visibleByFrustum,
        hiddenByFrustum,
        disposedByFrustum: this.disposedByFrustum.size,
      },
      workerLoads: {
        depth2: this.workerLoadCounts.get(2),
        depth3: this.workerLoadCounts.get(3),
        depth4: this.workerLoadCounts.get(4),
        disposal: disposalWorkerLoad,
        frustum: frustumWorkerLoad,
        distance: this.workerLoadCounts.get("distance"),
      },
      distanceWorker: {
        enabled: this.distanceCalculationEnabled,
        calculationsPerSecond: Math.round(
          1000 / (this.distanceWorkerStats.averageCalculationTime || 1)
        ),
        lastCalculationTime: this.distanceWorkerStats.lastCalculationTime,
        averageCalculationTime: this.distanceWorkerStats.averageCalculationTime,
        isPending: this.pendingDistanceCalculation,
      },
    };
  }

  getTotalMemoryUsage() {
    let totalMemory = 0;

    try {
      this.activeMeshes.forEach((mesh) => {
        const meshMemory = this.calculateMeshMemoryUsage(mesh);
        if (!isNaN(meshMemory) && isFinite(meshMemory)) {
          totalMemory += meshMemory;
        }
      });

      const memoryInMB = totalMemory / (1024 * 1024);

      if (isNaN(memoryInMB) || !isFinite(memoryInMB)) {
        console.warn(
          "Memory calculation resulted in NaN or Infinity:",
          totalMemory
        );
        return "0.00";
      }

      return memoryInMB.toFixed(2);
    } catch (error) {
      console.error("Error calculating total memory usage:", error);
      return "0.00";
    }
  }

  calculateMeshMemoryUsage(mesh) {
    if (!mesh || !mesh.geometry) return 0;

    let memoryBytes = 0;

    try {
      const vertexBuffers = mesh.geometry.getVertexBuffers();
      if (vertexBuffers) {
        for (const key in vertexBuffers) {
          const buffer = vertexBuffers[key];
          if (
            buffer &&
            buffer.getData &&
            typeof buffer.getData === "function"
          ) {
            const data = buffer.getData();
            if (data && data.length) {
              memoryBytes += data.length * 4;
            }
          }
        }
      }

      const indexBuffer = mesh.geometry.getIndexBuffer();
      if (indexBuffer && indexBuffer.length) {
        memoryBytes += indexBuffer.length * 4;
      }

      if (mesh.material) {
        if (mesh.material.diffuseTexture)
          memoryBytes += this.estimateTextureMemory(
            mesh.material.diffuseTexture
          );
        if (mesh.material.bumpTexture)
          memoryBytes += this.estimateTextureMemory(mesh.material.bumpTexture);
        if (mesh.material.ambientTexture)
          memoryBytes += this.estimateTextureMemory(
            mesh.material.ambientTexture
          );
        if (mesh.material.specularTexture)
          memoryBytes += this.estimateTextureMemory(
            mesh.material.specularTexture
          );
      }
    } catch (error) {
      console.warn(
        `Error calculating memory for mesh ${mesh.name || "unknown"}:`,
        error
      );
      return 1024;
    }

    return memoryBytes;
  }

  estimateTextureMemory(texture) {
    if (!texture) return 0;

    try {
      let width = 256;
      let height = 256;

      if (texture.getSize && typeof texture.getSize === "function") {
        const size = texture.getSize();
        if (size) {
          width = size.width || width;
          height = size.height || height;
        }
      } else if (texture._width && texture._height) {
        width = texture._width;
        height = texture._height;
      } else if (texture.width && texture.height) {
        width = texture.width;
        height = texture.height;
      }

      width = Math.max(1, width);
      height = Math.max(1, height);

      return width * height * 4;
    } catch (error) {
      console.warn("Error estimating texture memory:", error);
      return 262144;
    }
  }

  // Update distance worker statistics
  updateDistanceWorkerStats(stats) {
    this.distanceWorkerStats = { ...this.distanceWorkerStats, ...stats };
  }

  // Control methods for distance calculation worker
  setDistanceCalculationEnabled(enabled) {
    this.distanceCalculationEnabled = enabled;
  }

  setDistanceCalculationFrequency(frequency) {
    this.distanceCalculationFrequency = Math.max(16, frequency); // Minimum 16ms
  }

  getDistanceWorkerStats() {
    const worker = this.workers.get("distance");
    if (!worker) {
      return { error: "No distance worker available" };
    }

    const requestId = this.requestIdCounter++;
    worker.postMessage({
      type: "GET_STATISTICS",
      requestId,
    });

    return { message: "Distance worker stats requested", requestId };
  }

  // Get disposal worker statistics
  getDisposalStats() {
    const worker = this.workers.get("disposal");
    if (!worker) {
      return { error: "No disposal worker available" };
    }

    const requestId = this.requestIdCounter++;

    worker.postMessage({
      type: "GET_DISPOSAL_STATS",
      requestId,
    });

    return { message: "Disposal stats requested", requestId };
  }

  // Clear disposal worker cache
  clearDisposalCache() {
    const worker = this.workers.get("disposal");
    if (!worker) {
      console.warn("No disposal worker available to clear cache");
      return;
    }

    worker.postMessage({
      type: "CLEAR_DISPOSAL_CACHE",
    });
  }

  // Frustum culling control methods
  setFrustumCullingEnabled(enabled) {
    this.frustumCullingEnabled = enabled;

    if (!enabled) {
      // Make all loaded meshes visible when frustum culling is disabled
      this.activeMeshes.forEach((mesh, nodeNumber) => {
        mesh.isVisible = true;
        this.nodeVisibilityStates.set(nodeNumber, "visible");
      });
    }
  }

  setFrustumBufferMultiplier(multiplier) {
    const worker = this.workers.get("frustum");
    if (!worker) {
      console.warn("No frustum worker available to set buffer multiplier");
      return;
    }

    const requestId = this.requestIdCounter++;

    worker.postMessage({
      type: "SET_BUFFER_MULTIPLIER",
      bufferMultiplier: multiplier,
      requestId,
    });

    this.frustumBufferMultiplier = multiplier;
  }

  getFrustumCullingStats() {
    const worker = this.workers.get("frustum");
    if (!worker) {
      return { error: "No frustum worker available" };
    }

    const requestId = this.requestIdCounter++;

    worker.postMessage({
      type: "GET_CULLING_STATS",
      requestId,
    });

    return { message: "Frustum stats requested", requestId };
  }

  clearFrustumCache() {
    const worker = this.workers.get("frustum");
    if (!worker) {
      console.warn("No frustum worker available to clear cache");
      return;
    }

    worker.postMessage({
      type: "CLEAR_CULLING_CACHE",
    });

    this.nodeVisibilityStates.clear();
    this.disposedByFrustum.clear();
  }

  // NEW: Performance monitoring
  getPerformanceStats() {
    return {
      frameTimeTracker: this.frameTimeTracker,
      taskQueueLengths: Object.fromEntries(
        Array.from(this.taskQueue.entries()).map(([priority, tasks]) => [
          priority,
          tasks.length,
        ])
      ),
      meshCreationBudget: this.meshCreationBudget,
      maxMeshesPerFrame: this.maxMeshesPerFrame,
      activeMeshCount: this.activeMeshes.size,
      pendingMeshCreation: this.taskQueue.get(this.PRIORITY.MESH_CREATION)
        .length,
    };
  }

  // NEW: Adjust performance settings dynamically
  adjustPerformanceSettings(targetFPS = 60) {
    const targetFrameTime = 1000 / targetFPS;

    // Adjust based on current performance
    if (this.frameTimeTracker.meshCreation > targetFrameTime * 0.3) {
      // Reduce mesh creation budget if taking too much time
      this.meshCreationBudget = Math.max(4, this.meshCreationBudget - 1);
      this.maxMeshesPerFrame = Math.max(1, this.maxMeshesPerFrame - 1);
    } else if (this.frameTimeTracker.meshCreation < targetFrameTime * 0.1) {
      // Increase budget if we have headroom
      this.meshCreationBudget = Math.min(12, this.meshCreationBudget + 1);
      this.maxMeshesPerFrame = Math.min(3, this.maxMeshesPerFrame + 1);
    }
  }

  // MODIFIED: Enhanced dispose method
  dispose() {
    // Stop frame scheduler
    this.isSchedulerRunning = false;

    // Clear task queues
    if (this.taskQueue) {
      this.taskQueue.forEach((queue) => (queue.length = 0));
      this.taskQueue.clear();
    }

    // Terminate all workers
    this.workers.forEach((worker, depth) => {
      console.log(`Terminating worker for ${depth}`);
      worker.terminate();
    });

    this.workers.clear();
    this.pendingRequests.clear();
    this.loadingQueues.clear();
    this.disposalQueue.length = 0;
    this.nodeVisibilityStates.clear();
    this.disposedByFrustum.clear();
    this.meshCreationQueue.length = 0;

    // Dispose all meshes
    this.activeMeshes.forEach((mesh) => {
      if (mesh && mesh.dispose) {
        mesh.dispose();
      }
    });

    this.activeMeshes.clear();
    this.loadedNodeNumbers.clear();
  }
}

// Spatial optimization helper class
class SpatialOptimization {
  constructor() {
    this.spatialGrid = new Map();
    this.gridSize = 1000;
    this.distanceCache = new Map();
    this.cacheValidUntil = 0;
    this.cacheValidityDuration = 100;
  }

  buildSpatialGrid(nodeCenters) {
    this.spatialGrid.clear();

    for (const [nodeNumber, center] of nodeCenters.entries()) {
      const gridX = Math.floor(center.x / this.gridSize);
      const gridY = Math.floor(center.y / this.gridSize);
      const gridZ = Math.floor(center.z / this.gridSize);
      const gridKey = `${gridX}_${gridY}_${gridZ}`;

      if (!this.spatialGrid.has(gridKey)) {
        this.spatialGrid.set(gridKey, []);
      }
      this.spatialGrid.get(gridKey).push(nodeNumber);
    }
  }

  getNodesInRange(cameraPosition, range) {
    const nearbyNodes = new Set();
    const gridRange = Math.ceil(range / this.gridSize);

    const camGridX = Math.floor(cameraPosition.x / this.gridSize);
    const camGridY = Math.floor(cameraPosition.y / this.gridSize);
    const camGridZ = Math.floor(cameraPosition.z / this.gridSize);

    for (let x = -gridRange; x <= gridRange; x++) {
      for (let y = -gridRange; y <= gridRange; y++) {
        for (let z = -gridRange; z <= gridRange; z++) {
          const gridKey = `${camGridX + x}_${camGridY + y}_${camGridZ + z}`;
          const nodes = this.spatialGrid.get(gridKey);
          if (nodes) {
            nodes.forEach((nodeNumber) => nearbyNodes.add(nodeNumber));
          }
        }
      }
    }

    return nearbyNodes;
  }

  getCachedDistance(cameraPosition, nodeCenter, nodeNumber) {
    const now = performance.now();

    if (now > this.cacheValidUntil) {
      this.distanceCache.clear();
      this.cacheValidUntil = now + this.cacheValidityDuration;
    }

    const cacheKey = `${nodeNumber}_${Math.floor(
      cameraPosition.x / 5
    )}_${Math.floor(cameraPosition.y / 5)}_${Math.floor(cameraPosition.z / 5)}`;

    if (this.distanceCache.has(cacheKey)) {
      return this.distanceCache.get(cacheKey);
    }

    const distance = BABYLON.Vector3.Distance(cameraPosition, nodeCenter);
    this.distanceCache.set(cacheKey, distance);

    return distance;
  }
}

const BabylonLODManager = ({
  mode,
  viewMode,
  setViewMode,
  leftNavVisible,
  showMeasure,
  showWireFrame,
  setShowWireFrame,
  selectedItem,
  setSelectedItem,
  setActiveButton,
  showComment,
  savedViewDialog,
  setSavedViewDialog,
  modalData,
  backgroundTheme,
  setGroundSettingParameter,
  setWaterSettingParameter,
  waterSettingParameter,
  baseSettingParameter,
  groundSettingParameter,
  setWaterSettingsVisible,
  setGroundSettingsVisible,
  
}) => {
  const currentHighlightedMeshRef = useRef(null);
  const currentHighlightedMeshIdRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRef = useRef(null);
  const lodManagerRef = useRef(null);
  const fileInputRef = useRef(null);

  const distanceThresholdRef = useRef(null);

  const modelInfoRef = useRef({ modelRadius: 1000 }); // For camera sensitivity
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hiddenMeshes, setHiddenMeshes] = useState(new Set());
  const [hiddenIndividualMeshes, setHiddenIndividualMeshes] = useState(
    new Set()
  );
  const { updateProject } = useContext(updateProjectContext);
  const [commentinfo, setcommentinfo] = useState("");
  const [commentinfotable, setcommentinfotable] = useState(false);
  const [allComments, SetAllComments] = useState([]);
  const [allCommentStatus, setAllCommentStatus] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [commentEdit, setCommentEdit] = useState("");
  const [editedCommentData, setEditedCommentData] = useState({});
  const [generalTagInfoFields, setGeneralTagInfoFields] = useState([]);
  const [allSavedViews, setAllSavedViews] = useState([]);
  // Camera and LOD state
  const [cameraType, setCameraType] = useState("orbit");
  const [cameraSpeed, setCameraSpeed] = useState(1.0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [lodInfo, setLodInfo] = useState({
    level: "--",
    distance: "--",
    memoryMB: "0.00",
    loadedNodes: 0,
    cachedMeshes: 0,
    threshold30: "--",
    threshold80: "--",
    queuedLoads: 0,
    queuedDisposals: 0,
    hiddenMeshes: 0,
  });

  const MAX_DEPTH = 4;
  const dbConnectionRef = useRef(null);
  // Screen coverage thresholds for mesh categorization
  const COVERAGE_THRESHOLDS = {
    LARGE: 0.3, // Screen coverage >= 1
    MEDIUM: 0.085, // 0.3 <= Screen coverage < 1
    SMALL: 0.085, // Screen coverage < 0.3
  };

  // Update the tracking variables to match original structure
  const [meshState, setMeshState] = useState({
    nodesAtDepth: new Array(MAX_DEPTH + 1).fill(0),
    nodeNumbersByDepth: Array.from({ length: MAX_DEPTH + 1 }, () => []),
    nodesAtDepthWithBoxes: new Array(MAX_DEPTH + 1).fill(0),
    boxesAtDepth: Array.from({ length: MAX_DEPTH + 1 }, () => new Set()),
    nodeContents: new Map(),
    nodeDepths: new Map(),
    nodeParents: new Map(),
    nodeCounter: 1,
  });

  // Selection mode state
  const [selectedItemName, setSelectedItemName] = useState("");
  const [backgroundColorTag, setBackgroundColorTag] = useState({});
  const [tagInfo, setTagInfo] = useState({});
  const [fileInfoDetails, setFileInfoDetails] = useState(null);
  const commentPositionRef = useRef({ x: 0, y: 0, z: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    bottom: "auto",
  });
  const [rightClickCoordinates, setRightClickCoordinates] = useState({
    x: 0,
    y: 0,
  });
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [allEquipementList, setallEquipementList] = useState([]);
  const [lineEqpInfo, setLineEqpInfo] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);
  const [tagInfoVisible, setTagInfoVisible] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchComments = async (projectId) => {
    try {
      const response = await getAllcomments(projectId);
      if (response.status === 200) {
        SetAllComments(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      setCustomAlert(true);
      setModalMessage("Failed to fetch comments");
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchComments(projectId);
    }
  }, [projectId, updateProject, isModalOpen]);

  const getStatusTable = async (projectId) => {
    try {
      const response = await getStatustableData(projectId);
      if (response.status === 200) {
        setAllCommentStatus(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch status table data:", error);
    }
  };

  useEffect(() => {
    getStatusTable(projectId);
  }, [updateProject]);

  const getGeneralTagInfoField = async (projectId) => {
    try {
      const response = await fetchFromGentagInfoFields(projectId);
      if (response.status === 200) {
        setGeneralTagInfoFields(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch status table data:", error);
    }
  };

  useEffect(() => {
    getGeneralTagInfoField(projectId);
  }, [updateProject]);

  const getAllSavedViews = async (projectId) => {
    try {
      const response = await AllSavedView(projectId);
      if (response.status === 200) {
        setAllSavedViews(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch all saved views table data:", error);
    }
  };

  useEffect(() => {
    getAllSavedViews(projectId);
  }, [updateProject]);

  const [performanceStats, setPerformanceStats] = useState({
    frameTimeTracker: { meshCreation: 0, cameraUpdate: 0, lodUpdate: 0 },
    taskQueueLengths: {},
    meshCreationBudget: 8,
    maxMeshesPerFrame: 1,
    activeMeshCount: 0,
    pendingMeshCreation: 0,
    fps: 60,
  });

  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
  const [preVRCameraState, setPreVRCameraState] = useState(null);
  const [showMeasureDetails, setShowMeasureDetails] = useState(false);
  const [showMeasureDetailsAbove, setshowMeasureDetailsAbove] = useState(false);
  const [allLabels, setAllLabels] = useState([]);

  const [point1, setPoint1] = useState(null);
  const [point2, setPoint2] = useState(null);
  const [distance, setDistance] = useState(null);
  const [differences, setDifferences] = useState({
    diffX: null,
    diffY: null,
    diffZ: null,
  });
  const [angles, setAngles] = useState({
    horizontalAngle: null,
    verticalAngle: null,
  });

  const measurementRef = useRef({
    pointA: null,
    pointB: null,
    line: null,
    text: null,
    markers: [],
  });

  const [groundFormValues, setGroundFormValues] = useState({
    level: groundSettingParameter?.level ?? 0,
    color: groundSettingParameter?.color ?? "#cccccc",
    opacity:
      groundSettingParameter?.opacity != null
        ? groundSettingParameter.opacity * 100
        : 100,
  });
  const [baseFormValues, setBaseFormValues] = useState({
    measureUnit: "m",
    customUnitFactor: 1,
    fov: 45,
    nearClip: 0.01,
    farClip: 1000,
    angularSensibility: 2000,
    wheelSensibility: 1,
    cameraSpeed: 1,
    inertia: 0.4,
    lightIntensity: 1.0,
    specularColor: "#ffffff",
    shadowsEnabled: true,
    metallic: 0.5,
    roughness: 0.5,
    reflectionIntensity: 1.0,
  });
  const [waterFormValues, setWaterFormValues] = useState({
    level: waterSettingParameter?.level ?? 0,
    opacity:
      waterSettingParameter?.opacity != null
        ? waterSettingParameter.opacity * 100
        : 100,
    color: waterSettingParameter?.color ?? "#1ca3ec",
    colorBlendFactor: waterSettingParameter?.colorBlendFactor ?? 0.5,
    bumpHeight: waterSettingParameter?.bumpHeight ?? 1.0,
    waveLength: waterSettingParameter?.waveLength ?? 1.0,
    windForce: waterSettingParameter?.windForce ?? 20,
  });

  const groundLevelRef = useRef();
  const groundColorRef = useRef();
  const groundOpacityRef = useRef();
  const groundRef = useRef(null);
  const waterMeshRef = useRef(null);
  const skyboxRef = useRef(null);
  // Update the tracking variables to match Fbxload.js structure
  let nodesAtDepth = new Array(MAX_DEPTH + 1).fill(0);
  let nodeNumbersByDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
  let nodesAtDepthWithBoxes = new Array(MAX_DEPTH + 1).fill(0);
  let boxesAtDepth = Array.from({ length: MAX_DEPTH + 1 }, () => new Set());
  let nodeContents = new Map();
  let nodeDepths = new Map();
  let nodeParents = new Map();
  let nodeCounter = 1;

  // Create scene function converted to React
  const createScene = useCallback(() => {
    if (!canvasRef.current) return null;

    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 1.0;

    // Store references
    engineRef.current = engine;
    sceneRef.current = scene;

    return { engine, scene };
  }, []);

  // Create orbit camera
  const createOrbitCamera = useCallback((scene, position, target) => {
    const camera = new BABYLON.ArcRotateCamera(
      "arcCamera",
      0,
      0,
      0,
      target || BABYLON.Vector3.Zero(),
      scene
    );

    if (position) {
      camera.setPosition(position);
    } else {
      camera.radius = 1000;
      camera.alpha = Math.PI / 2;
      camera.beta = 0;
    }

    if (distanceThresholdRef.current) {
      camera.wheelPrecision = distanceThresholdRef.current * 0.1;
      camera.lowerRadiusLimit = distanceThresholdRef.current * 0.1;
      camera.upperRadiusLimit = distanceThresholdRef.current * 3;
    } else {
      camera.wheelPrecision = 50;
      camera.lowerRadiusLimit = 1;
      camera.upperRadiusLimit = 1000;
    }

    camera.inertia = 0.5;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;
    camera.panningSensibility = 50;
    camera.panningInertia = 0.5;
    camera.wheelDeltaPercentage = 0.01;
    camera.pinchDeltaPercentage = 0.01;
    camera.minZ = 0.1;
    camera.maxZ = 1000000;

    return camera;
  }, []);

  // Create fly camera with improved input
  const createFlyCamera = useCallback(
    (scene, position, target) => {
      const camera = new BABYLON.UniversalCamera(
        "flyCamera",
        position || new BABYLON.Vector3(0, 0, -1000),
        scene
      );

      if (target) {
        camera.setTarget(target);
      }

      // Use improved mouse input
      const mouseInput = new FreeCameraMouseInput(camera);
      // mouseInput.setModelInfoRef(modelInfoRef);

      const touchInput = new FreeCameraTouchInput(camera);
      touchInput.camera = camera;

      camera.inputs.clear();
      camera.inputs.add(mouseInput);
      camera.inputs.add(touchInput);
      camera.speed = cameraSpeed * multiplier;
      camera.inertia = 0.3;
      camera.angularSensibility = 2000.0;
      camera.minZ = 0.1;
      camera.maxZ = 1000;
      camera.fov = 0.8;

      return camera;
    },
    [cameraSpeed, multiplier]
  );
  // Add these state variables to your component
  const [isXRSupported, setIsXRSupported] = useState(false);
  const [isInXR, setIsInXR] = useState(false);
  const xrHelperRef = useRef(null);
  const fallbackCameraRef = useRef(null);

  const [forceVRMode, setForceVRMode] = useState(false);
  // Emergency camera creation function
  const createEmergencyCamera = useCallback(
    (scene) => {
      try {
        const emergencyCamera = createOrbitCamera(scene);
        scene.activeCamera = emergencyCamera;
        cameraRef.current = emergencyCamera;
        emergencyCamera.attachControl(canvasRef.current, false);
        setCameraType("orbit");

        // Update LOD manager
        if (lodManagerRef.current) {
          lodManagerRef.current.camera = emergencyCamera;
          lodManagerRef.current.lastCameraPosition = null;
          lodManagerRef.current.update();
        }

        console.log("Emergency camera created successfully");
        return emergencyCamera;
      } catch (error) {
        console.error("Failed to create emergency camera:", error);
        return null;
      }
    },
    [createOrbitCamera]
  );
  // Modified checkXRSupport function for testing
  const checkXRSupport = useCallback(async () => {
    try {
      // For testing without headset - force return true
      if (forceVRMode) {
        console.log("VR mode forced for testing");
        setIsXRSupported(true);
        return true;
      }

      if ("xr" in navigator) {
        const isSupported = await navigator.xr.isSessionSupported(
          "immersive-vr"
        );
        setIsXRSupported(isSupported);
        return isSupported;
      }
      return false;
    } catch (error) {
      console.log("WebXR not supported:", error);
      // For testing - still allow if forced
      if (forceVRMode) {
        setIsXRSupported(true);
        return true;
      }
      return false;
    }
  }, [forceVRMode]);

  const createWebXRCamera = useCallback(
    async (scene, currentCamera) => {
      try {
        console.log("Setting up WebXR camera...");

        // STEP 1: Store current camera state BEFORE any changes
        const cameraState = {
          position: currentCamera.position.clone(),
          target: currentCamera.target
            ? currentCamera.target.clone()
            : currentCamera.getTarget().clone(),
          rotation: currentCamera.rotation
            ? currentCamera.rotation.clone()
            : null,
          alpha: currentCamera.alpha || 0,
          beta: currentCamera.beta || 0,
          radius: currentCamera.radius || 0,
          fov: currentCamera.fov || Math.PI / 4,
          type: currentCamera.constructor.name,
        };

        setPreVRCameraState(cameraState);
        console.log("Stored camera state:", cameraState);

        // Store current camera as fallback
        fallbackCameraRef.current = currentCamera;

        // For testing without headset, use a mock XR experience
        if (forceVRMode && !("xr" in navigator)) {
          return createMockVRExperienceWithPosition(scene, cameraState);
        }

        // STEP 2: Create XR experience
        const xrHelper = await scene.createDefaultXRExperienceAsync({
          floorMeshes: [],
          disableTeleportation: false,
          useCustomVRButton: false,
          // Try to disable automatic position reset
          optionalFeatures: ["local-floor", "bounded-floor"],
        });

        xrHelperRef.current = xrHelper;

        // STEP 3: Force position IMMEDIATELY after creation
        if (xrHelper.input.xrCamera) {
          console.log("Setting XR camera position immediately");
          setWebXRCameraPositionImmediate(xrHelper, cameraState);
        }

        // STEP 4: Set up event handlers with position forcing
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add(() => {
          console.log("XR pose set - forcing camera position again");
          setWebXRCameraPositionImmediate(xrHelper, cameraState);
        });

        xrHelper.baseExperience.onStateChangedObservable.add((state) => {
          switch (state) {
            case BABYLON.WebXRState.IN_XR:
              console.log("Entered XR - final position set");
              setIsInXR(true);
              // Force position one more time when fully in XR
              setTimeout(() => {
                setWebXRCameraPositionImmediate(xrHelper, cameraState);
              }, 100);

              // Update LOD manager with XR camera
              if (lodManagerRef.current && xrHelper.input.xrCamera) {
                lodManagerRef.current.camera = xrHelper.input.xrCamera;
                lodManagerRef.current.lastCameraPosition = null;
                lodManagerRef.current.update();
              }
              break;

            case BABYLON.WebXRState.EXITING_XR:
              console.log("Exiting XR - restoring camera position");
              setIsInXR(false);
              restoreCameraState(scene, cameraState);
              break;

            case BABYLON.WebXRState.NOT_IN_XR:
              console.log("Not in XR");
              setIsInXR(false);
              break;
          }
        });

        return xrHelper;
      } catch (error) {
        console.error("Failed to create WebXR camera:", error);

        // Fallback to mock VR for testing
        if (forceVRMode && preVRCameraState) {
          return createMockVRExperienceWithPosition(scene, preVRCameraState);
        }

        throw error;
      }
    },
    [forceVRMode]
  );

  // Improved position setting function
  const setWebXRCameraPositionImmediate = useCallback(
    (xrHelper, cameraState) => {
      if (!xrHelper.input.xrCamera || !cameraState) {
        console.warn("Cannot set XR camera position: missing camera or state");
        return;
      }

      try {
        const xrCamera = xrHelper.input.xrCamera;

        console.log("Setting XR camera position to:", cameraState.position);
        console.log("Setting XR camera target to:", cameraState.target);

        // Set position directly
        xrCamera.position.copyFrom(cameraState.position);

        // Set target
        xrCamera.setTarget(cameraState.target);

        // Copy other properties
        xrCamera.minZ = 0.1;
        xrCamera.maxZ = 1000000;
        xrCamera.fov = cameraState.fov;

        // Force update
        xrCamera.getViewMatrix(true); // Force matrix update

        console.log("XR camera positioned at:", xrCamera.position);
        console.log("XR camera target:", xrCamera.getTarget());
      } catch (error) {
        console.error("Error setting XR camera position:", error);
      }
    },
    []
  );

  // Mock VR experience with preserved position
  const createMockVRExperienceWithPosition = useCallback(
    (scene, cameraState) => {
      console.log("Creating mock VR experience with preserved position");

      // Create camera with EXACT same position
      const mockVRCamera = new BABYLON.UniversalCamera(
        "mockVRCamera",
        cameraState.position.clone(),
        scene
      );
      mockVRCamera.setTarget(cameraState.target.clone());
      mockVRCamera.fov = cameraState.fov;
      mockVRCamera.minZ = 0.1;
      mockVRCamera.maxZ = 1000000;

      // Set as active camera
      scene.activeCamera = mockVRCamera;
      mockVRCamera.attachControl(canvasRef.current, false);

      console.log("Mock VR camera positioned at:", mockVRCamera.position);
      console.log("Mock VR camera target:", mockVRCamera.getTarget());

      setIsInXR(true);
      setCameraType("webxr");

      return {
        input: { xrCamera: mockVRCamera },
        baseExperience: {
          onStateChangedObservable: {
            add: (callback) => {
              setTimeout(() => callback(BABYLON.WebXRState.ENTERING_XR), 100);
              setTimeout(() => callback(BABYLON.WebXRState.IN_XR), 500);
            },
          },
        },
        dispose: () => mockVRCamera.dispose(),
      };
    },
    []
  );

  // Function to restore camera state when exiting VR
  const restoreCameraState = useCallback(
    (scene, cameraState) => {
      if (!cameraState || !fallbackCameraRef.current) {
        console.warn(
          "Cannot restore camera state: missing state or fallback camera"
        );
        return;
      }

      try {
        const camera = fallbackCameraRef.current;

        console.log("Restoring camera to position:", cameraState.position);
        console.log("Restoring camera target:", cameraState.target);

        // Restore position and target
        if (camera instanceof BABYLON.ArcRotateCamera) {
          camera.setTarget(cameraState.target);
          camera.alpha = cameraState.alpha;
          camera.beta = cameraState.beta;
          camera.radius = cameraState.radius;
        } else if (camera instanceof BABYLON.UniversalCamera) {
          camera.position.copyFrom(cameraState.position);
          camera.setTarget(cameraState.target);
        }

        // Set as active camera
        scene.activeCamera = camera;
        cameraRef.current = camera;

        // Ensure camera control is properly attached
        if (canvasRef.current) {
          camera.attachControl(canvasRef.current, false);
        }

        // Update camera type
        setCameraType(cameraState.type.includes("ArcRotate") ? "orbit" : "fly");

        // Update LOD manager
        if (lodManagerRef.current) {
          lodManagerRef.current.camera = camera;
          lodManagerRef.current.lastCameraPosition = null;
          lodManagerRef.current.update();
        }

        console.log("Camera state restored successfully");
      } catch (error) {
        console.error("Error restoring camera state:", error);
        createEmergencyCamera(scene);
      }
    },
    [createEmergencyCamera]
  );

  const TestingControls = () => (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        backgroundColor: "rgba(255,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
      }}
    >
      <h4>Testing Controls</h4>
      <label>
        <input
          type="checkbox"
          checked={forceVRMode}
          onChange={(e) => setForceVRMode(e.target.checked)}
        />
        Force VR Mode (Testing)
      </label>
    </div>
  );

  // Helper function to set XR camera position based on current camera
  const setWebXRCameraPosition = useCallback((xrHelper, currentCamera) => {
    if (!xrHelper.input.xrCamera || !currentCamera) return;

    try {
      // Copy position from current camera
      xrHelper.input.xrCamera.position.copyFrom(currentCamera.position);

      // Set target if available
      const target = currentCamera.target || currentCamera.getTarget();
      if (target) {
        xrHelper.input.xrCamera.setTarget(target);
      }

      // Copy camera properties
      xrHelper.input.xrCamera.minZ = currentCamera.minZ || 0.1;
      xrHelper.input.xrCamera.maxZ = currentCamera.maxZ || 1000000;

      console.log("XR camera positioned at:", xrHelper.input.xrCamera.position);
    } catch (error) {
      console.error("Error setting XR camera position:", error);
    }
  }, []);

  // Helper function to setup XR features
  const setupXRFeatures = useCallback(async (xrHelper) => {
    try {
      const featuresManager = xrHelper.baseExperience.featuresManager;

      // Enable hand tracking if available
      if (
        featuresManager.getEnabledFeature(
          BABYLON.WebXRFeatureName.HAND_TRACKING
        )
      ) {
        console.log("Hand tracking enabled");
      }

      // Enable controller support
      if (xrHelper.input) {
        xrHelper.input.onControllerAddedObservable.add((controller) => {
          console.log("XR Controller added:", controller.uniqueId);

          controller.onMotionControllerInitObservable.add(
            (motionController) => {
              console.log("Motion controller initialized");

              // Add controller interactions here if needed
              const triggerComponent = motionController.getComponent(
                "xr-standard-trigger"
              );
              if (triggerComponent) {
                triggerComponent.onButtonStateChangedObservable.add(() => {
                  if (triggerComponent.pressed) {
                    console.log("XR trigger pressed");
                    // Add trigger functionality here
                  }
                });
              }
            }
          );
        });
      }

      // Enable movement feature
      // featuresManager.enableFeature(BABYLON.WebXRFeatureName.MOVEMENT, 'latest', {
      //   xrInput: xrHelper.input,
      //   movementSpeed: 1,
      //   rotationSpeed: 0.3
      // });
    } catch (error) {
      console.error("Error setting up XR features:", error);
    }
  }, []);

  // Updated toggleCamera function with proper camera management
  const toggleCamera = useCallback(
    async (type) => {
      if (!sceneRef.current || !engineRef.current) return;

      const scene = sceneRef.current;
      const canvas = canvasRef.current;
      const currentCamera = scene.activeCamera;

      // Ensure we have a current camera
      if (!currentCamera) {
        console.error("No active camera found");
        return;
      }

      // Handle WebXR camera type
      if (type === "webxr") {
        if (!isXRSupported) {
          alert("WebXR is not supported on this device/browser");
          return;
        }

        try {
          await createWebXRCamera(scene, currentCamera);
          setCameraType("webxr");
          return; // Don't continue with regular camera logic
        } catch (error) {
          console.error("Failed to initialize WebXR:", error);
          alert("Failed to initialize WebXR. Please try again.");
          return;
        }
      }

      // Handle exiting from WebXR
      if (cameraType === "webxr" && xrHelperRef.current) {
        try {
          // Exit XR session
          if (xrHelperRef.current.baseExperience.sessionManager.session) {
            await xrHelperRef.current.baseExperience.sessionManager.exitXRAsync();
          }

          // Dispose XR helper
          xrHelperRef.current.dispose();
          xrHelperRef.current = null;

          // The camera restoration will be handled by the XR state change observer
          // Don't continue with camera creation - let the XR exit handler manage it
          return;
        } catch (error) {
          console.error("Error exiting WebXR:", error);
        }
      }

      // Store camera state before any operations
      const cameraPosition = currentCamera.position.clone();
      const cameraTarget = currentCamera.target
        ? currentCamera.target.clone()
        : currentCamera.getTarget().clone();

      // Create new camera BEFORE disposing old one to prevent "no camera" errors
      let newCamera;
      if (type === "fly") {
        newCamera = createFlyCamera(scene, cameraPosition, cameraTarget);
      } else {
        newCamera = createOrbitCamera(scene, cameraPosition, cameraTarget);
      }

      // Ensure new camera is valid
      if (!newCamera) {
        console.error("Failed to create new camera");
        return;
      }

      // Set new camera as active BEFORE disposing old camera
      scene.activeCamera = newCamera;
      newCamera.attachControl(canvas, false);
      cameraRef.current = newCamera;

      // Now safely dispose the old camera (but not if it was an XR camera)
      if (cameraType !== "webxr" && currentCamera !== newCamera) {
        try {
          currentCamera.dispose();
        } catch (error) {
          console.warn("Error disposing old camera:", error);
        }
      }

      setCameraType(type);

      // Update LOD manager with new camera
      if (lodManagerRef.current) {
        lodManagerRef.current.camera = newCamera;
        lodManagerRef.current.lastCameraPosition = null;
        lodManagerRef.current.update();
      }
    },
    [
      createFlyCamera,
      createOrbitCamera,
      createWebXRCamera,
      isXRSupported,
      cameraType,
    ]
  );

  // Updated initializeCameras function with safety checks
  const initializeCameras = useCallback(
    async (scene) => {
      try {
        // Check WebXR support
        await checkXRSupport();

        // Create initial camera
        const orbitCamera = createOrbitCamera(scene);
        if (!orbitCamera) {
          throw new Error("Failed to create initial orbit camera");
        }

        orbitCamera.attachControl(canvasRef.current, false);
        scene.activeCamera = orbitCamera;
        cameraRef.current = orbitCamera;
        setCameraType("orbit");

        console.log("Cameras initialized successfully");
      } catch (error) {
        console.error("Error initializing cameras:", error);
        // Try to create a basic fallback camera
        try {
          const fallbackCamera = new BABYLON.ArcRotateCamera(
            "fallbackCamera",
            0,
            0,
            1000,
            BABYLON.Vector3.Zero(),
            scene
          );
          fallbackCamera.attachControl(canvasRef.current, false);
          scene.activeCamera = fallbackCamera;
          cameraRef.current = fallbackCamera;
          setCameraType("orbit");
          console.log("Fallback camera created");
        } catch (fallbackError) {
          console.error("Failed to create fallback camera:", fallbackError);
        }
      }
    },
    [createOrbitCamera, checkXRSupport]
  );

  // Add this useEffect in BabylonLODManager after the existing useEffects
  useEffect(() => {
    if (mode && sceneRef.current) {
      if (mode === "orbit") {
        toggleCamera("orbit");
      } else if (mode === "fly") {
        toggleCamera("fly");
      }
    }
  }, [mode, toggleCamera]);

  // Cleanup function for WebXR
  const cleanupWebXR = useCallback(() => {
    if (xrHelperRef.current) {
      try {
        xrHelperRef.current.dispose();
        xrHelperRef.current = null;
      } catch (error) {
        console.error("Error disposing WebXR:", error);
      }
    }
  }, []);

  // Safe render function
  const safeRender = useCallback(
    (scene) => {
      try {
        // Only render if we have a valid camera
        if (scene && scene.activeCamera) {
          scene.render();
        } else {
          console.warn("Skipping render: no active camera");
          // Try to create emergency camera if none exists
          if (scene && !scene.activeCamera) {
            createEmergencyCamera(scene);
          }
        }
      } catch (error) {
        console.error("Error during scene render:", error);
        // Try to recover by creating emergency camera
        if (scene && !scene.activeCamera) {
          createEmergencyCamera(scene);
        }
      }
    },
    [createEmergencyCamera]
  );

  // Updated useEffect with safer render loop
  useEffect(() => {
    const { engine, scene } = createScene();
    if (!engine || !scene) return;

    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Initialize cameras
    initializeCameras(scene);

    // Start render loop with safety checks
    engine.runRenderLoop(() => {
      safeRender(scene);
    });

    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("touchstart", handleTouchStart);

    // Engine resize handler
    const handleResize = () => {
      try {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
        engine.resize();
      } catch (error) {
        console.error("Error during resize:", error);
      }
    };

    window.addEventListener("resize", handleResize);

    if (engineRef.current) {
      setTimeout(() => {
        try {
          engineRef.current.resize();
        } catch (error) {
          console.error("Error during initial resize:", error);
        }
      }, 100);
    }

    return () => {
      // Cleanup WebXR
      cleanupWebXR();

      // Cleanup scene and engine
      if (sceneRef.current) {
        try {
          sceneRef.current.dispose();
          sceneRef.current = null;
        } catch (error) {
          console.error("Error disposing scene:", error);
        }
      }

      try {
        engine.dispose();
      } catch (error) {
        console.error("Error disposing engine:", error);
      }

      // Remove event listeners
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [createScene, initializeCameras, cleanupWebXR, safeRender]);

  // Add this safety check to your existing render loop in your main component
  // If you have a scene.onBeforeRenderObservable.add() in your main code, update it like this:
  const safeSceneRenderLoop = useCallback(() => {
    // FPS tracking
    fpsRef.current.frames++;
    const now = performance.now();
    if (now - fpsRef.current.lastTime >= 1000) {
      const fps = Math.round(
        (fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime)
      );
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;

      // Update performance stats
      if (lodManagerRef.current) {
        const stats = lodManagerRef.current.getPerformanceStats();
        setPerformanceStats((prev) => ({ ...prev, ...stats, fps }));

        // Auto-adjust performance settings based on FPS
        if (fps < 50) {
          lodManagerRef.current.adjustPerformanceSettings(60);
        }
      }
    }

    // Safety check before any scene operations
    if (!sceneRef.current || !sceneRef.current.activeCamera) {
      console.warn("Scene or camera not available for render operations");
      return;
    }

    const scene = sceneRef.current;
    const camera = scene.activeCamera;

    try {
      // Your existing LOD manager update code - now with priority handling
      if (lodManagerRef.current) {
        lodManagerRef.current.update();
      }

      // Update LOD info for React state (run less frequently to avoid performance impact)
      if (fpsRef.current.frames % 30 === 0) {
        // Update UI every 30 frames
        const activeLOD = lodManagerRef.current?.getActiveLODLevel
          ? lodManagerRef.current.getActiveLODLevel()
          : 0;
        const distanceToTarget =
          camera.radius ||
          BABYLON.Vector3.Distance(camera.position, camera.getTarget());
        const memUsage = lodManagerRef.current
          ? lodManagerRef.current.getMemoryUsage()
          : {
              memoryMB: "0.00",
              loadedNodes: 0,
              cachedMeshes: 0,
              queuedLoads: 0,
              queuedDisposals: 0,
              hiddenMeshes: 0,
              workerLoads: {},
            };

        if (lodManagerRef.current) {
          lodManagerRef.current.setFrustumCullingEnabled(true);
          lodManagerRef.current.setDistanceCalculationEnabled(true);
        }

        setLodInfo({
          level: activeLOD.toString(),
          distance: distanceToTarget.toFixed(0),
          memoryMB: memUsage.memoryMB,
          loadedNodes: memUsage.loadedNodes,
          cachedMeshes: memUsage.cachedMeshes,
          threshold30:
            lodManagerRef.current?.threshold30Percent?.toFixed(0) || "--",
          threshold80:
            lodManagerRef.current?.threshold80Percent?.toFixed(0) || "--",
          queuedLoads: memUsage.queuedLoads || 0,
          queuedDisposals: memUsage.queuedDisposals || 0,
          hiddenMeshes: memUsage.hiddenMeshes || 0,
          workerLoads: memUsage.workerLoads || {},
        });

        // Update loading state based on queue status and worker activity
        const isCurrentlyLoading =
          (memUsage.queuedLoads || 0) > 0 ||
          Object.values(memUsage.workerLoads || {}).some((load) => load > 0);

        if (isCurrentlyLoading !== isLoading) {
          setIsLoading(isCurrentlyLoading);

          // Update fly camera input loading state
          if (camera instanceof BABYLON.UniversalCamera && camera.inputs) {
            const mouseInput = camera.inputs.attached.mouse;
            if (mouseInput && mouseInput.setLoadingState) {
              mouseInput.setLoadingState(isCurrentlyLoading);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in render loop:", error);
      // Try to recover
      if (!scene.activeCamera) {
        createEmergencyCamera(scene);
      }
    }
  }, [isLoading, createEmergencyCamera]);

  // NEW: Performance control functions
  const adjustMeshCreationBudget = useCallback((budget) => {
    if (lodManagerRef.current) {
      lodManagerRef.current.meshCreationBudget = Math.max(
        2,
        Math.min(16, budget)
      );
    }
  }, []);

  const adjustMaxMeshesPerFrame = useCallback((count) => {
    if (lodManagerRef.current) {
      lodManagerRef.current.maxMeshesPerFrame = Math.max(1, Math.min(5, count));
    }
  }, []);

  const PerformancePanel = () => (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "300px",
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        minWidth: "250px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <strong>Performance Monitor</strong>
        <button
          onClick={() => setShowPerformancePanel(false)}
          style={{
            background: "red",
            color: "white",
            border: "none",
            borderRadius: "3px",
            padding: "2px 6px",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <strong>FPS: {performanceStats.fps}</strong>
        <div
          style={{
            width: "100%",
            height: "4px",
            backgroundColor: "#333",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (performanceStats.fps / 60) * 100)}%`,
              height: "100%",
              backgroundColor:
                performanceStats.fps >= 55
                  ? "#4CAF50"
                  : performanceStats.fps >= 30
                  ? "#FF9800"
                  : "#F44336",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <div>Mesh Creation Budget: {performanceStats.meshCreationBudget}ms</div>
        <input
          type="range"
          min="2"
          max="16"
          step="1"
          value={performanceStats.meshCreationBudget}
          onChange={(e) => adjustMeshCreationBudget(parseInt(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: "8px" }}>
        <div>Max Meshes/Frame: {performanceStats.maxMeshesPerFrame}</div>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={performanceStats.maxMeshesPerFrame}
          onChange={(e) => adjustMaxMeshesPerFrame(parseInt(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
        <div>Active Meshes: {performanceStats.activeMeshCount}</div>
        <div>Pending Creation: {performanceStats.pendingMeshCreation}</div>

        <div style={{ marginTop: "5px" }}>
          <strong>Task Queues:</strong>
          {Object.entries(performanceStats.taskQueueLengths).map(
            ([priority, count]) => (
              <div key={priority} style={{ paddingLeft: "10px" }}>
                Priority {priority}: {count}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  // Update camera speed for fly camera
  const updateCameraSpeed = useCallback(
    (speed) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      const actualSpeed = speed * multiplier;

      if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        scene.activeCamera.speed = actualSpeed;
      }

      setCameraSpeed(speed);
    },
    [multiplier]
  );

  // Update speed multiplier for fly camera
  const updateMultiplier = useCallback(
    (value) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      const validValue = isNaN(value) || value <= 0 ? 1 : value;
      const actualSpeed = cameraSpeed * validValue;

      if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        scene.activeCamera.speed = actualSpeed;
      }

      setMultiplier(validValue);
    },
    [cameraSpeed]
  );

  // // Function to create wireframe visualization
  const createWireframeBox = useCallback(
    (minimum, maximum, depth = 0) => {
      if (!sceneRef.current) return null;

      const scene = sceneRef.current;
      const size = maximum.subtract(minimum);
      const center = BABYLON.Vector3.Center(minimum, maximum);

      const box = BABYLON.MeshBuilder.CreateBox(
        "octreeVisBox_" + meshState.nodeCounter,
        {
          width: size.x,
          height: size.y,
          depth: size.z,
        },
        scene
      );

      box.position = center;
      const material = new BABYLON.StandardMaterial(
        "wireframeMat" + depth,
        scene
      );
      material.wireframe = true;

      switch (depth) {
        case 0:
          material.emissiveColor = new BABYLON.Color3(1, 0, 0);
          break;
        case 1:
          material.emissiveColor = new BABYLON.Color3(0, 1, 0);
          break;
        case 2:
          material.emissiveColor = new BABYLON.Color3(0, 0, 1);
          break;
        case 3:
          material.emissiveColor = new BABYLON.Color3(1, 1, 0);
          break;
      }

      box.material = material;
      box.isPickable = false;
      return box;
    },
    [meshState.nodeCounter]
  );

  //   const createWireframeBox = (bounds, depth = 0, nodeNumber = 0) => {
  //   if (!bounds || !sceneRef.current) {
  //     console.warn("Cannot create wireframe box - invalid bounds or scene");
  //     return null;
  //   }
  //   console.log(bounds);

  //   try {
  //     const min = bounds.min;
  //     const max = bounds.max;

  //     if (!min || !max) {
  //       console.warn("Cannot create wireframe box - invalid min/max bounds");
  //       return null;
  //     }

  //     const size = {
  //       width: Math.abs(max.x - min.x),
  //       height: Math.abs(max.y - min.y),
  //       depth: Math.abs(max.z - min.z),
  //     };

  //     const center = new BABYLON.Vector3(
  //       (max.x + min.x) / 2,
  //       (max.y + min.y) / 2,
  //       (max.z + min.z) / 2
  //     );

  //     // Create a unique name for the box that includes depth and node number
  //     const boxName = `octreeBox_d${depth}_n${nodeNumber}`;

  //     const box = BABYLON.MeshBuilder.CreateBox(
  //       boxName,
  //       size,
  //       sceneRef.current
  //     );

  //     box.position = center;
  //     const material = new BABYLON.StandardMaterial(
  //       `wireframeMat_d${depth}_n${nodeNumber}`,
  //       sceneRef.current
  //     );

  //     material.wireframe = true;

  //     // Adjust transparency based on depth
  //     // Root is most visible, deeper levels more transparent
  //     material.alpha = Math.max(0.2, 1 - (depth * 0.15));

  //     // Enhanced color scheme with more distinctive colors for each depth
  //     switch (depth) {
  //       case 0: // Root level - Bright Red
  //         material.emissiveColor = new BABYLON.Color3(1, 0, 0);
  //         material.diffuseColor = new BABYLON.Color3(1, 0, 0);
  //         material.alpha = 0.7; // More visible
  //         break;
  //       case 1: // Level 1 - Bright Green
  //         material.emissiveColor = new BABYLON.Color3(0, 1, 0);
  //         material.diffuseColor = new BABYLON.Color3(0, 1, 0);
  //         material.alpha = 0.6;
  //         break;
  //       case 2: // Level 2 - Bright Blue
  //         material.emissiveColor = new BABYLON.Color3(0, 0.4, 1);
  //         material.diffuseColor = new BABYLON.Color3(0, 0.4, 1);
  //         material.alpha = 0.5;
  //         break;
  //       case 3: // Level 3 - Yellow
  //         material.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
  //         material.diffuseColor = new BABYLON.Color3(1, 0.8, 0);
  //         material.alpha = 0.4;
  //         break;
  //       case 4: // Level 4 - Purple
  //         material.emissiveColor = new BABYLON.Color3(0.8, 0, 0.8);
  //         material.diffuseColor = new BABYLON.Color3(0.8, 0, 0.8);
  //         material.alpha = 0.3;
  //         break;
  //       // case 5: // Level 5 - Cyan
  //       //     material.emissiveColor = new BABYLON.Color3(0, 0.8, 0.8);
  //       //     material.diffuseColor = new BABYLON.Color3(0, 0.8, 0.8);
  //       //     material.alpha = 0.25;
  //       //     break;
  //       default: // Higher depths - Orange
  //         material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
  //         material.diffuseColor = new BABYLON.Color3(1, 0.5, 0);
  //         material.alpha = 0.2;
  //     }

  //     // Increase line thickness for better visibility
  //     material.wireframeLineWidth = 2;

  //     box.material = material;
  //     box.isPickable = false;

  //     // Store depth and node information in metadata
  //     box.metadata = {
  //       isWireframe: true,
  //       depth: depth,
  //       nodeNumber: nodeNumber,
  //       bounds: {
  //         min: new BABYLON.Vector3(min.x, min.y, min.z),
  //         max: new BABYLON.Vector3(max.x, max.y, max.z)
  //       }
  //     };

  //     return box;
  //   } catch (error) {
  //     console.error("Error creating wireframe box:", error);
  //     return null;
  //   }
  // };

  // Function to recursively create wireframes for the entire octree hierarchy

  const createOctreeWireframes = (rootBlock, depth = 0) => {
    if (!rootBlock || !rootBlock.bounds) return;
    console.log(rootBlock);
    // Create wireframe for current node
    const min = new BABYLON.Vector3(
      rootBlock.bounds.min.x,
      rootBlock.bounds.min.y,
      rootBlock.bounds.min.z
    );

    const max = new BABYLON.Vector3(
      rootBlock.bounds.max.x,
      rootBlock.bounds.max.y,
      rootBlock.bounds.max.z
    );

    // Create wireframe box for this node
    createWireframeBox(
      { min, max },
      depth,
      rootBlock.properties?.nodeNumber || 0
    );

    // Process child nodes recursively
    if (rootBlock.relationships && rootBlock.relationships.childBlocks) {
      for (const childBlock of rootBlock.relationships.childBlocks) {
        if (childBlock) {
          console.log(childBlock);
          createOctreeWireframes(childBlock, depth + 1);
        }
      }
    }
  };

  const fitCameraToOctree = useCallback((camera, maximum, minimum) => {
    const maxVector =
      maximum instanceof BABYLON.Vector3
        ? maximum
        : new BABYLON.Vector3(maximum.x, maximum.y, maximum.z);

    const minVector =
      minimum instanceof BABYLON.Vector3
        ? minimum
        : new BABYLON.Vector3(minimum.x, minimum.y, minimum.z);

    const center = BABYLON.Vector3.Center(minVector, maxVector);
    const size = maxVector.subtract(minVector);
    const maxDimension = Math.max(size.x, size.y, size.z);
    // Update model info for camera sensitivity
    modelInfoRef.current.modelRadius = maxDimension / 2;

    camera.setTarget(center);

    const fovRadians = camera.fov || Math.PI / 4;
    const distanceToFit = maxDimension / (2 * Math.tan(fovRadians / 2));

    camera.radius = distanceToFit * 2;
    camera.alpha = Math.PI / 2;
    camera.beta = 0;

    camera.wheelPrecision = 50;
    camera.minZ = maxDimension * 0.01;
    camera.maxZ = maxDimension * 1000;

    const maxDistance = distanceToFit; // Use this as the maximum distance for LOD
    distanceThresholdRef.current = maxDistance;

    console.log(`Maximum camera distance set to: ${maxDistance}`);

    return maxDistance;
  }, []);

  // Initialize IndexedDB with appropriate stores
  const initDB = useCallback(async () => {
    if (dbConnectionRef.current) return dbConnectionRef.current;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("piping", 1); //huldrascreencoverage,piping,jpmodule,testing12345

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        dbConnectionRef.current = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const storeNames = [
          "octree",
          "originalMeshes",
          "placementSummary",
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
  const [selectedMeshInfo, setSelectedMeshInfo] = useState(null);

  const loadMergedPolyMeshesWithWorkers = useCallback(async () => {
    console.log(
      "Starting to load merged low-poly models with web worker progressive LOD..."
    );
    setIsLoading(true);

    if (!sceneRef.current || !cameraRef.current) {
      setIsLoading(false);
      return;
    }

    const scene = sceneRef.current;
    const camera = cameraRef.current;

    // Notify fly camera input about loading state
    if (camera instanceof BABYLON.UniversalCamera && camera.inputs) {
      const mouseInput = camera.inputs.attached.mouse;
      if (mouseInput && mouseInput.setLoadingState) {
        mouseInput.setLoadingState(true);
      }
    }

    // Clear existing meshes and wireframes
    console.log("Clearing existing scene content...");
    scene.meshes.slice().forEach((mesh) => {
      if (
        !mesh.name.includes("light") &&
        !mesh.name.includes("camera") &&
        !mesh.name.includes("ground") &&
        mesh.id !== "BackgroundPlane"
      ) {
        console.log(`Disposing mesh: ${mesh.name}`);
        mesh.dispose();
      }
    });

    // Reset octree display counters
    setMeshState({
      nodesAtDepth: new Array(MAX_DEPTH + 1).fill(0),
      nodeNumbersByDepth: Array.from({ length: MAX_DEPTH + 1 }, () => []),
      nodesAtDepthWithBoxes: new Array(MAX_DEPTH + 1).fill(0),
      boxesAtDepth: Array.from({ length: MAX_DEPTH + 1 }, () => new Set()),
      nodeContents: new Map(),
      nodeDepths: new Map(),
      nodeParents: new Map(),
      nodeCounter: 1,
    });

    try {
      const db = await initDB();

      const octreeCheckTx = db.transaction(["octree"], "readonly");
      const octreeStore = octreeCheckTx.objectStore("octree");
      let octreeData = await new Promise((resolve, reject) => {
        const request = octreeStore.get("mainOctree");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!octreeData) {
        throw new Error("No octree data found");
      }

      if (
        !octreeData.bounds ||
        !octreeData.bounds.min ||
        !octreeData.bounds.max
      ) {
        throw new Error("Octree bounds are missing or incomplete");
      }

      const minVector = new BABYLON.Vector3(
        octreeData.bounds.min.x,
        octreeData.bounds.min.y,
        octreeData.bounds.min.z
      );

      const maxVector = new BABYLON.Vector3(
        octreeData.bounds.max.x,
        octreeData.bounds.max.y,
        octreeData.bounds.max.z
      );

      createWireframeBox(minVector, maxVector);

      // Initialize the enhanced web worker LOD manager
      const lodManager = new WebWorkerTilesetLODManager(scene, camera, {
        currentHighlightedMeshRef,
        currentHighlightedMeshIdRef,
      });
      lodManagerRef.current = lodManager;

      // Calculate distance thresholds
      const maxDistance = fitCameraToOctree(camera, maxVector, minVector);
      lodManager.setDistanceThresholds(maxDistance);

      // Initialize octree data in LOD manager
      await lodManager.initWithOctreeData(octreeData);

      // Load all depth 2 meshes initially
      await lodManager.loadAllDepth2Meshes();

      // Force an immediate update of visibility
      lodManager.lastCameraPosition = null;
      lodManager.frameCounter = lodManager.updateFrequency;
      lodManager.update();
      // Add the LOD manager to the scene's render loop
      scene.onBeforeRenderObservable.add(() => {
        lodManager.update();

        // Update LOD info for React state
        const activeLOD = lodManager.getActiveLODLevel
          ? lodManager.getActiveLODLevel()
          : 0;
        const distanceToTarget =
          camera.radius ||
          BABYLON.Vector3.Distance(camera.position, camera.getTarget());
        const memUsage = lodManager.getMemoryUsage();
        lodManager.setFrustumCullingEnabled(true);
        lodManager.setDistanceCalculationEnabled(true);

        setLodInfo({
          level: activeLOD.toString(),
          distance: distanceToTarget.toFixed(0),
          memoryMB: memUsage.memoryMB,
          loadedNodes: memUsage.loadedNodes,
          cachedMeshes: memUsage.cachedMeshes,
          threshold30: lodManager.threshold30Percent?.toFixed(0) || "--",
          threshold80: lodManager.threshold80Percent?.toFixed(0) || "--",
          queuedLoads: memUsage.queuedLoads || 0,
          queuedDisposals: memUsage.queuedDisposals || 0,
          hiddenMeshes: memUsage.hiddenMeshes || 0,
          workerLoads: memUsage.workerLoads || {},
        });

        // Update loading state based on queue status and worker activity
        const isCurrentlyLoading =
          (memUsage.queuedLoads || 0) > 0 ||
          Object.values(memUsage.workerLoads || {}).some((load) => load > 0);

        if (isCurrentlyLoading !== isLoading) {
          setIsLoading(isCurrentlyLoading);

          // Update fly camera input loading state
          if (camera instanceof BABYLON.UniversalCamera && camera.inputs) {
            const mouseInput = camera.inputs.attached.mouse;
            if (mouseInput && mouseInput.setLoadingState) {
              mouseInput.setLoadingState(isCurrentlyLoading);
            }
          }
        }
      });

      console.log(
        "Successfully loaded progressive LOD system with web workers"
      );
    } catch (error) {
      console.error("Error loading merged models with progressive LOD:", error);
      console.log(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);

      // Reset camera input loading state
      const camera = cameraRef.current;
      if (camera instanceof BABYLON.UniversalCamera && camera.inputs) {
        const mouseInput = camera.inputs.attached.mouse;
        if (mouseInput && mouseInput.setLoadingState) {
          mouseInput.setLoadingState(false);
        }
      }
    }
  }, [initDB, createWireframeBox, fitCameraToOctree, isLoading]);

  const handleDoubleClick = (event) => {
    if (!sceneRef.current && !canvasRef.current) return;
    const scene = sceneRef.current;
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedPoint) {
      const targetPoint = pickResult.pickedPoint;

      if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
        scene.activeCamera.setTarget(targetPoint.clone());
      } else if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        const cameraPosition = scene.activeCamera.position.clone();
        const direction = targetPoint.subtract(cameraPosition).normalize();
        const distance = BABYLON.Vector3.Distance(cameraPosition, targetPoint);
        const newTarget = cameraPosition.add(direction.scale(distance));
        scene.activeCamera.setTarget(newTarget);
      }

      console.log(
        "Camera target set to intersected point:",
        targetPoint.toString()
      );
    }
  };

  let lastTap = 0;

  const handleTouchStart = (event) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) {
      handleDoubleClick(event);
    }

    lastTap = currentTime;
  };

  const speedBar = cameraType === "fly" && (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        zIndex: 100,
        padding: "10px",
        display: "flex",
        flexDirection: "row",
        gap: "10px",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: "5px",
        color: "white",
      }}
    >
      <div>
        <strong>Speed: {(cameraSpeed * multiplier).toFixed(2)}</strong>
      </div>
      <input
        type="range"
        min="0.1"
        max="2"
        step="0.1"
        value={cameraSpeed}
        onChange={(e) => updateCameraSpeed(parseFloat(e.target.value))}
        style={{ width: "100px" }}
      />
      <div>Multiplier:</div>
      <input
        type="number"
        min="0.1"
        step="0.5"
        value={multiplier}
        onChange={(e) => updateMultiplier(parseFloat(e.target.value))}
        style={{ width: "60px", padding: "2px" }}
      />
    </div>
  );

  // Apply view (top, front, side etc.)
  const applyView = (viewName) => {
    if (!sceneRef.current) return;
console.log(viewName);
    const scene = sceneRef.current;
    const activeCamera = scene.activeCamera;

    // Step 1: Filter out unwanted meshes
    const includedMeshes = scene.meshes.filter(
      (mesh) =>
        mesh.isVisible &&
        mesh.isEnabled() &&
        mesh.getTotalVertices() > 0 &&
        !mesh.name.toLowerCase().includes("root") &&
        !mesh.name.toLowerCase().includes("sky") &&
        !mesh.name.toLowerCase().includes("ground")
    );

    if (includedMeshes.length === 0) return;

    // Step 2: Compute combined bounding box
    let min = includedMeshes[0]
      .getBoundingInfo()
      .boundingBox.minimumWorld.clone();
    let max = includedMeshes[0]
      .getBoundingInfo()
      .boundingBox.maximumWorld.clone();

    includedMeshes.forEach((mesh) => {
      const bb = mesh.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
    });

    const center = BABYLON.Vector3.Center(min, max);
    const radius = BABYLON.Vector3.Distance(min, max) / 2;

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Calculate distance needed to fit bounding box into view
    const fovRadians = scene.activeCamera.fov || Math.PI / 4;
    const distanceToFit = maxDimension / Math.tan(fovRadians / 2);

    // Store in ref
    modelInfoRef.current.boundingBoxMax = max;
    modelInfoRef.current.boundingBoxMin = min;

    modelInfoRef.current.boundingBoxCenter = center;
    modelInfoRef.current.modelRadius = distanceToFit;

    const targetPoint = center.clone();
console.log(modelInfoRef.current);

    // If in fly camera mode (UniversalCamera)
    if (
      activeCamera instanceof BABYLON.UniversalCamera &&
      !(activeCamera instanceof BABYLON.ArcRotateCamera)
    ) {
      // Calculate a good distance for positioning the camera
      const distance =
        modelInfoRef.current.modelRadius ||
        BABYLON.Vector3.Distance(activeCamera.position, targetPoint);

      // Create temporary vectors for the new position calculation
      let direction = new BABYLON.Vector3(0, 0, distance);
      let upVector = new BABYLON.Vector3(0, 1, 0);

      // Set the direction based on the view type
      if (viewName === "Top View") {
        direction = new BABYLON.Vector3(0, -distance, 0);
        upVector = new BABYLON.Vector3(0, 0, 1);
      } else if (viewName === "Bottom View") {
        direction = new BABYLON.Vector3(0, distance, 0);
        upVector = new BABYLON.Vector3(0, 0, -1);
      } else if (viewName === "Front View") {
        direction = new BABYLON.Vector3(0, 0, -distance);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Back View") {
        direction = new BABYLON.Vector3(0, 0, distance);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Right Side View") {
        direction = new BABYLON.Vector3(-distance, 0, 0);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Left Side View") {
        direction = new BABYLON.Vector3(distance, 0, 0);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Fit View") {
        direction = new BABYLON.Vector3(0, -distance, 0);
        upVector = new BABYLON.Vector3(0, 0, 1);
      }

      // Calculate the new camera position
      const newPosition = targetPoint.subtract(direction);

      // Set camera position
      activeCamera.position = newPosition;

      // Set the camera's target
      activeCamera.setTarget(targetPoint);
    }
    // If in orbit camera mode (ArcRotateCamera)
    else if (activeCamera instanceof BABYLON.ArcRotateCamera) {
      // Use the stored model center and radius if available
      if (modelInfoRef.current.boundingBoxCenter) {
        activeCamera.target = modelInfoRef.current.boundingBoxCenter.clone();

        // Apply the view's camera settings
        switch (viewName) {
          case "Top View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          case "Front View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Right Side View":
            activeCamera.alpha = 0;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Left Side View":
            activeCamera.alpha = Math.PI;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Bottom View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI;
            break;
          case "Back View":
            activeCamera.alpha = -Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Fit View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          default:
            break;
        }

        // Keep the current radius or use the model radius if available
        activeCamera.radius =
          modelInfoRef.current.modelRadius || activeCamera.radius;
      } else {
        // If no model info is available, just apply the view
        const currentTarget = activeCamera.target.clone();
        const currentRadius = activeCamera.radius;

        switch (viewName) {
          case "Top View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          case "Front View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Right Side View":
            activeCamera.alpha = 0;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Left Side View":
            activeCamera.alpha = Math.PI;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Bottom View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI;
            break;
          case "Back View":
            activeCamera.alpha = -Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Fit View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          default:
            break;
        }

        activeCamera.target = currentTarget;
        activeCamera.radius = currentRadius;
      }
    }
  };

  // useEffect for all views(top,front...) functionality
  useEffect(() => {
    applyView(viewMode);
  }, [viewMode]);

  // useEffect for allview timeout functionality
  useEffect(() => {
    return () => {
      setViewMode("");
    };
  }, []);

  useEffect(() => {
    let observer = null;

    if (showMeasure) {
      let unit = "m";
      let scaleValue = 1;
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      // Store observer reference for measurement
      observer = scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.event.button !== 0) {
          return;
        }
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
          // Only process left mouse button clicks (button 0)
          if (pointerInfo.event.button !== 0) {
            return;
          }

          if (pointerInfo.pickInfo.hit) {
            const mesh = pointerInfo.pickInfo.pickedMesh;

            // Skip environment meshes
            if (
              mesh.name.includes("skyBox") ||
              mesh.name.includes("ground") ||
              mesh.name.includes("water")
            ) {
              clearMeasurement();
              setshowMeasureDetailsAbove(false);
              return;
            }

            // Handle the measurement
            handleMeasurementPick(pointerInfo.pickInfo, unit, scaleValue);

            // Find the topmost pickable parent mesh with metadata
            let targetMesh = mesh;
            while (
              targetMesh &&
              (!targetMesh.metadata ||
                Object.keys(targetMesh.metadata).length === 0)
            ) {
              targetMesh = targetMesh.parent;
            }
          } else {
            // clearMeasurement();
            // setshowMeasureDetailsAbove(false);
          }
        }
      });
    } else {
      // Cleanup when showMeasure becomes false
      clearMeasurement();
      setshowMeasureDetailsAbove(false);
    }

    // Cleanup function to remove event listener
    return () => {
      if (sceneRef.current && observer) {
        sceneRef.current.onPointerObservable.remove(observer);
      }
    };
  }, [showMeasure]);

  const handleMeasurementPick = (pickInfo, unit, scaleValue) => {
    if (!showMeasure || !pickInfo.hit || !pickInfo.pickedMesh) return;

    // Skip measurement markers themselves
    const mesh = pickInfo.pickedMesh;
    if (
      mesh.name.startsWith("measureMarker") ||
      mesh.name.startsWith("pointLabel") ||
      mesh.name.startsWith("measureTextPlane") ||
      mesh.name.startsWith("xLine") ||
      mesh.name.startsWith("yLine") ||
      mesh.name.startsWith("zLine") ||
      mesh.name.startsWith("measureLine") ||
      mesh.name === "box" ||
      mesh.name.includes("Line")
    ) {
      return;
    }

    // Get the exact position in world space
    const pickedPoint = pickInfo.pickedPoint;

    // If this is the first point
    if (!measurementRef.current.pointA) {
      // Clear any previous measurement first
      clearMeasurement();

      // Set first point
      measurementRef.current.pointA = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Update UI state
      setPoint1({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });
    }
    // If this is the second point
    else if (!measurementRef.current.pointB) {
      measurementRef.current.pointB = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Create line between points
      updateMeasurementLine();

      // Update UI state with calculated values
      setPoint2({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });

      // Calculate differences
      const p1 = measurementRef.current.pointA;
      const p2 = measurementRef.current.pointB;

      // Raw differences (no scale)
      const rawDiffX = Math.abs(p2.x - p1.x);
      const rawDiffY = Math.abs(p2.y - p1.y);
      const rawDiffZ = Math.abs(p2.z - p1.z);

      // Apply scale
      const scaledDiffX = (rawDiffX * parseFloat(scaleValue)).toFixed(2);
      const scaledDiffY = (rawDiffY * parseFloat(scaleValue)).toFixed(2);
      const scaledDiffZ = (rawDiffZ * parseFloat(scaleValue)).toFixed(2);

      setDifferences({
        diffX: scaledDiffX,
        diffY: scaledDiffY,
        diffZ: scaledDiffZ,
      });

      const distance = BABYLON.Vector3.Distance(p1, p2).toFixed(2);
      const rawDistance = BABYLON.Vector3.Distance(p1, p2) * scaleValue;
      setDistance(`${rawDistance.toFixed(2)} ${unit}`);

      // Calculate angles similar to the provided code
      const horizontalAngle = calculatePlanAngle(p1, p2).toFixed(2);
      const verticalAngle = calculateElevationAngle(p1, p2).toFixed(2);

      setAngles({
        horizontalAngle: horizontalAngle + "°",
        verticalAngle: verticalAngle + "°",
      });
      setshowMeasureDetailsAbove(true);
    }
    // If we already have two points, start a new measurement
    else {
      clearMeasurement();
      setshowMeasureDetailsAbove(false);

      // Set new first point
      measurementRef.current.pointA = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Update UI state
      setPoint1({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });
    }
  };

  // Create a point marker for measurement
  const createPointMarker = (position) => {
    const scene = sceneRef.current;
    if (!scene) return null;

    // Create a container for all marker elements
    const markerContainer = new BABYLON.TransformNode(
      "measureMarkerContainer",
      scene
    );
    markerContainer.position = position.clone();

    // Create invisible box as attachment point
    const box = BABYLON.MeshBuilder.CreateBox(
      "measureMarkerBox",
      { size: 0.1 },
      scene
    );
    box.isVisible = false;
    box.isPickable = false;
    box.parent = markerContainer;
    box.position = BABYLON.Vector3.Zero(); // Local position is zero relative to container

    // Create GUI for the marker (X-shaped cross)
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "MarkerUI",
      true,
      scene
    );

    // Create rectangle container
    const container = new GUI.Rectangle();
    container.width = "9px";
    container.height = "9px";
    container.color = "transparent";
    container.background = "transparent";
    advancedTexture.addControl(container);
    container.linkWithMesh(box);

    // Create diagonal line 1 (top-left to bottom-right)
    const line1 = new GUI.Line();
    line1.x1 = 0;
    line1.y1 = 0;
    line1.x2 = 8;
    line1.y2 = 8;
    line1.lineWidth = 2;
    line1.color = "#FFA500"; // Orange color
    container.addControl(line1);

    // Create diagonal line 2 (top-right to bottom-left)
    const line2 = new GUI.Line();
    line2.x1 = 8;
    line2.y1 = 0;
    line2.x2 = 0;
    line2.y2 = 8;
    line2.lineWidth = 2;
    line2.color = "#FFA500"; // Orange color
    container.addControl(line2);

    // Store elements for later cleanup
    const elem = {
      box: box,
      container: container,
      markerContainer: markerContainer,
      gui: advancedTexture,
    };

    // Add to marker array for tracking
    measurementRef.current.markers.push(elem);

    return markerContainer;
  };

  // Update measurement line
  const updateMeasurementLine = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    const { pointA, pointB, line, text } = measurementRef.current;

    if (pointA && pointB) {
      // If a line already exists, dispose it
      if (line) {
        line.dispose();
      }

      // If a text mesh exists, dispose it
      if (text) {
        text.dispose();
      }

      // Create a new line
      const points = [pointA.clone(), pointB.clone()];

      const newLine = BABYLON.MeshBuilder.CreateLines(
        "measureLine",
        { points: points },
        scene
      );
      newLine.color = new BABYLON.Color3(1, 0.647, 0);
      measurementRef.current.line = newLine;

      // Calculate distance
      const distance = BABYLON.Vector3.Distance(pointA, pointB);

      // Create a midpoint for the text label
      const midPoint = BABYLON.Vector3.Center(pointA, pointB);

      // Create a dynamic texture for the distance text
      const textureWidth = 256;
      const textureHeight = 64;
      const dynamicTexture = new BABYLON.DynamicTexture(
        "measureTextTexture",
        { width: textureWidth, height: textureHeight },
        scene,
        false
      );
      dynamicTexture.hasAlpha = true;
    }
  };

  // Clear measurement function
  const clearMeasurement = () => {
    // Reset state variables
    setPoint1(null);
    setPoint2(null);
    setDistance(null);
    setDifferences({
      diffX: null,
      diffY: null,
      diffZ: null,
    });
    setAngles({
      horizontalAngle: null,
      verticalAngle: null,
    });

    // Remove line if it exists
    if (measurementRef.current.line) {
      measurementRef.current.line.dispose();
      measurementRef.current.line = null;
    }

    // Remove text if it exists
    if (measurementRef.current.text) {
      measurementRef.current.text.dispose();
      measurementRef.current.text = null;
    }

    // Remove all markers and their children
    measurementRef.current.markers.forEach((marker) => {
      if (marker) {
        // Clean up GUI elements first
        if (marker.container) {
          marker.container.dispose();
        }
        if (marker.gui) {
          marker.gui.dispose();
        }
        // Then dispose the mesh objects
        if (marker.box) {
          marker.box.dispose();
        }
        if (marker.markerContainer) {
          marker.markerContainer.dispose();
        }
      }
    });

    // Reset measurement state
    measurementRef.current = {
      pointA: null,
      pointB: null,
      line: null,
      text: null,
      markers: [],
    };
  };
  const handleShowMeasureDetails = () => {
    setShowMeasureDetails(!showMeasureDetails);
  };

  const handleWireFrame = () => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    // scene.meshes.forEach((mesh) => {
    //   if (
    //     mesh.material &&
    //     mesh.name !== "skyBox" &&
    //     mesh.name !== "waterMesh" &&
    //     mesh.name !== "ground"
    //   ) {
    //     mesh.material.wireframe = !mesh.material.wireframe;
    //   }
    // });
    scene.forceWireframe = !scene.forceWireframe;
    setShowWireFrame((prev) => !prev);
  };

  useEffect(() => {
    if (showWireFrame) {
      handleWireFrame();
    }
  }, [showWireFrame]);

  function clearAllPipingStores() {
    const confirmClear = window.confirm(
      "Are you sure you want to clear all data in the 'piping' database? This action cannot be undone."
    );

    if (!confirmClear) return; // ❌ User canceled

    const request = indexedDB.open("piping");

    request.onsuccess = function (event) {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames);

      const transaction = db.transaction(storeNames, "readwrite");

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        store.clear().onsuccess = () => {};
        store.clear().onerror = (e) => {
          console.error(`Error clearing store ${storeName}:`, e);
        };
      });

      transaction.oncomplete = () => {
        alert("All data cleared from the 'piping' database.");
        db.close();
      };
    };

    request.onerror = function (event) {
      console.error("❌ Failed to open database:", event.target.error);
      alert("Failed to open the 'piping' database.");
    };
  }

  // Add these refs
  const selectedMeshRef = useRef(null);
  const highlightedMeshRef = useRef(null);
  const highlightMaterialRef = useRef(null);

  // Enhanced mesh selection functions (replace the existing ones)
  const highlightMesh = (mesh) => {
    if (!mesh || !sceneRef.current) return;

    // Create highlight material if it doesn't exist
    if (!highlightMaterialRef.current) {
      highlightMaterialRef.current = new BABYLON.StandardMaterial(
        "highlightMaterial",
        sceneRef.current
      );
      highlightMaterialRef.current.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow
      highlightMaterialRef.current.specularColor = new BABYLON.Color3(
        0.5,
        0.5,
        0.5
      );
      highlightMaterialRef.current.emissiveColor = new BABYLON.Color3(
        0.3,
        0.3,
        0
      );
      highlightMaterialRef.current.backFaceCulling = false;
      highlightMaterialRef.current.twoSidedLighting = true;
    }

    // Store original material if not already stored
    if (mesh.originalMaterial) {
      mesh.material = highlightMaterialRef.current;
      highlightedMeshRef.current = mesh;
    } else if (mesh.material) {
      // Store original material
      mesh.originalMaterial = mesh.material;
      mesh.material = highlightMaterialRef.current;
      highlightedMeshRef.current = mesh;
    }
  };

  const dehighlightMesh = () => {
    if (
      currentHighlightedMeshRef.current &&
      currentHighlightedMeshIdRef.current
    ) {
      // For merged meshes, we need to remove the specific individual mesh highlight
      if (
        typeof currentHighlightedMeshRef.current.removeHighlight === "function"
      ) {
        // Call removeHighlight which will restore the original vertex colors for the whole merged mesh
        currentHighlightedMeshRef.current.removeHighlight();
      } else {
      }
    }

    // Clear refs
    currentHighlightedMeshRef.current = null;
    currentHighlightedMeshIdRef.current = null;

    // Clear React state
    setSelectedItemName({ name: "" });
    setSelectedMeshInfo(null);
    setTagInfo(null);
    setBackgroundColorTag({});
  };

  // 4. UPDATE THE clearSelection FUNCTION
  const clearSelection = () => {
    // Remove highlighting from currently selected mesh
    if (
      currentHighlightedMeshRef.current &&
      typeof currentHighlightedMeshRef.current.removeHighlight === "function"
    ) {
      currentHighlightedMeshRef.current.removeHighlight();
    }

    // Clear refs
    currentHighlightedMeshRef.current = null;
    currentHighlightedMeshIdRef.current = null;

    // Clear all selection-related states
    setSelectedItemName({ name: "" });
    setSelectedMeshInfo(null);
    setTagInfo(null);
    setBackgroundColorTag({});
    // Exit selection mode
    setSelectedItem(false);
  };

  const pointerObserverRef = useRef(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const canvas = scene.getEngine().getRenderingCanvas();

    // preventing to the inbuilt context menu of web
    const preventContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    // Add to canvas
    canvas.addEventListener("contextmenu", preventContextMenu, true); // Use capture phase
    canvas.oncontextmenu = preventContextMenu;

    // Add to canvas parent if it exists
    const canvasParent = canvas.parentElement;
    if (canvasParent) {
      canvasParent.addEventListener("contextmenu", preventContextMenu, true);
    }

    // Add to document as fallback
    document.addEventListener("contextmenu", preventContextMenu, true);
    // Remove old observer if it exists
    if (pointerObserverRef.current) {
      scene.onPointerObservable.remove(pointerObserverRef.current);
      pointerObserverRef.current = null;
    }

    // Add observer only if selection mode is ON
    if (selectedItem) {
      pointerObserverRef.current = scene.onPointerObservable.add(
        (pointerInfo) => {
          const camera = scene.activeCamera;
          if (!camera || !pointerInfo || !pointerInfo.event) return;

          switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
              handleUnifiedPointerDown(pointerInfo);
              break;

            case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
              if (selectedItem && pointerInfo.pickInfo?.pickedMesh) {
                const pickedMesh = pointerInfo.pickInfo.pickedMesh;
                if (typeof pickedMesh.clearHighlight === "function") {
                  pickedMesh.clearHighlight();
                }
              }
              break;
          }
        }
      );
    } else {
      setIsMenuOpen(false);
      setActiveButton(null);
    }

    // Cleanup on unmount
    return () => {
      canvas.removeEventListener("contextmenu", preventContextMenu, true);
      if (canvasParent) {
        canvasParent.removeEventListener(
          "contextmenu",
          preventContextMenu,
          true
        );
      }
      document.removeEventListener("contextmenu", preventContextMenu, true);
      if (pointerObserverRef.current) {
        scene.onPointerObservable.remove(pointerObserverRef.current);
        pointerObserverRef.current = null;
      }
    };
  }, [selectedItem]);

  // Unified pointer down handler that doesn't interfere with camera controls
  const handleUnifiedPointerDown = (pointerInfo) => {
    const { event, pickInfo } = pointerInfo;

    const isLeftClick = event.button === 0;
    const isRightClick = event.button === 2;

    // ✅ Always prevent default right-click menu
    if (isRightClick) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!selectedItem) {
      return; // Do nothing when not in selection mode
    }
    // Handle left click
    if (isLeftClick && selectedItem) {
      // Only handle selection when selection mode is active
      if (pickInfo?.hit && pickInfo?.pickedMesh) {
        // Check if it's a selectable mesh
        const pickedMesh = pickInfo.pickedMesh;

        if (isSelectableMesh(pickedMesh)) {
          handleMeshSelection(pickInfo);
          return; // Don't allow camera control
        }
      } else {
        // Clicked on empty space in selection mode - exit selection mode
        setSelectedItem(false);
        clearSelection();
        return;
      }
    } else if (isRightClick && selectedItem) {
      if (pickInfo?.hit && pickInfo?.pickedMesh) {
        showContextMenu(event.clientX, event.clientY, pickInfo.pickedMesh);
      } else {
        showContextMenu(event.clientX, event.clientY, null);
      }
    }
  };

  const showContextMenu = (x, y, mesh) => {
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const isSpaceBelow = y + 200 <= windowHeight;
    const isSpaceRight = x + 180 <= windowWidth;
    const top = isSpaceBelow ? y : y - 200;
    const left = isSpaceRight ? x : x - 180;

    setMenuPosition({ top, left });

    // if (selectedItem) {
    setRightClickCoordinates({ x: top, y: left });
    setIsMenuOpen(true);
    // } else {
    //   console.log("No mesh selected for context menu");
    // }
  };

  // Helper function to determine if a mesh is selectable
  const isSelectableMesh = (mesh) => {
    if (!mesh || !mesh.metadata) return false;

    // Skip wireframes, environment meshes, and UI elements
    const nonSelectableNames = [
      "octreeVisBox_",
      "wireframe",
      "skyBox",
      "ground",
      "water",
      "measureMarker",
      "measureLine",
      "pointLabel",
      "measureTextPlane",
      "xLine",
      "yLine",
      "zLine",
      "Line",
    ];

    return !nonSelectableNames.some((name) => mesh.name.includes(name));
  };

  const handleMeshSelection = async (pickInfo) => {
    const pickedMesh = pickInfo.pickedMesh;
    const intersectionPoint = pickInfo.pickedPoint;

    // Store intersection point for potential comment/annotation placement
    commentPositionRef.current = {
      intersectionPointX: intersectionPoint._x,
      intersectionPointY: intersectionPoint._y,
      intersectionPointZ: intersectionPoint._z,
    };

    // Check if this is a merged mesh with vertex mappings
    if (
      pickedMesh.metadata.isLodMesh &&
      pickedMesh.metadata.vertexMappings &&
      pickInfo.faceId !== undefined
    ) {
      // Get the clicked original mesh info
      if (typeof pickedMesh.getClickedOriginalMesh === "function") {
        const originalMeshInfo = pickedMesh.getClickedOriginalMesh(
          pickInfo.faceId
        );

        if (originalMeshInfo) {
          console.log("🎯 === INDIVIDUAL MESH SELECTED ===");
          console.log("📊 Selected mesh info:", originalMeshInfo);

          // CHECK: Are we clicking on the same individual mesh that's already highlighted?
          const isSameMesh =
            currentHighlightedMeshRef.current === pickedMesh &&
            currentHighlightedMeshIdRef.current === originalMeshInfo.meshId;

          if (isSameMesh) {
            return; // Don't do anything if it's the same individual mesh
          }

          // ALWAYS dehighlight first (whether it's a different mesh or different individual mesh)
          dehighlightMesh();

          // Store selected mesh reference
          selectedMeshRef.current = pickedMesh;

          // Highlight the individual mesh within the merged mesh
          if (typeof pickedMesh.highlightOriginalMesh === "function") {
            pickedMesh.highlightOriginalMesh(originalMeshInfo.meshId);
          }

          setSelectedItemName({
            name: originalMeshInfo.name || originalMeshInfo.meshId,
            parentFileName: originalMeshInfo.parentFileName || "",
          });

          // Process tag information
          const meshFileName =
            originalMeshInfo.fileName || originalMeshInfo.meshId;
          const tagKey = meshFileName;

          if (tagKey) {
            setBackgroundColorTag({ [tagKey]: true });
          }

          // Set detailed mesh information
          setSelectedMeshInfo({
            type: "individual",
            meshId: originalMeshInfo.meshId,
            name: originalMeshInfo.name || originalMeshInfo.meshId,
            fileName: originalMeshInfo.fileName,
            parentFileName: originalMeshInfo.parentFileName,
            nodeNumber: originalMeshInfo.nodeNumber,
            screenCoverage: originalMeshInfo.screenCoverage,
            faceId: originalMeshInfo.faceId,
            relativeFaceId: originalMeshInfo.relativeFaceId,
          });

          // NEW: Fetch additional details based on parentFileName
          await fetchAdditionalMeshDetails(originalMeshInfo.parentFileName);

          // Set tag info
          setTagInfo({
            filename: tagKey,
            meshname: originalMeshInfo.name || originalMeshInfo.meshId,
            meshId: originalMeshInfo.meshId,
            parentFileName: originalMeshInfo.parentFileName,
            nodeNumber: originalMeshInfo.nodeNumber,
          });
        } else {
          handleMergedMeshSelection(pickedMesh, pickInfo);
        }
      } else {
        handleMergedMeshSelection(pickedMesh, pickInfo);
      }
    } else {
      // Handle non-merged mesh or mesh without vertex mappings
    }
  };

  // NEW: Function to fetch additional details based on parentFileName
  const fetchAdditionalMeshDetails = async (parentFileName) => {
    if (!parentFileName) {
      console.log("No parentFileName provided");
      return;
    }

    const parentFile = `${parentFileName}.glb`;
    try {
      const response = await getTagDetailsFromFileName(projectId, parentFile);
      if (response.status === 200) {
        const matchingTag = response.data;
        const fileMetadata = matchingTag.fileMetadata;
        // Based on tag type, fetch corresponding details
        let additionalDetails = null;
        let extraTableData = null;
        const userDefinedDisplay = new Map();

        switch (matchingTag.type?.toLowerCase()) {
          case "line":
            additionalDetails = await fetchLineDetails(matchingTag.tagId);
            break;
          case "equipment":
            additionalDetails = await fetchEquipmentDetails(matchingTag.tagId);
            break;
          case "valve":
            additionalDetails = await fetchValveDetails(matchingTag.tagId);
            break;

          default:
            console.log("❓ Unknown tag type:", matchingTag.type);
            return;
        }
        try {
          extraTableData = await fetchFromGentagInfo(
            matchingTag.tagId,
            projectId
          );
          if (response.status === 200) {
            console.log("🗂️ Additional table data fetched:", extraTableData);

            if (extraTableData.data) {
              generalTagInfoFields.forEach(({ id, field, unit }) => {
                const taginfoKey = `taginfo${id}`;
                const value = extraTableData.data[taginfoKey];

                // Insert into Map to guarantee order
                userDefinedDisplay.set(`${field} (${unit})`, value);
              });
            }
            console.log("userDefinedDisplay", userDefinedDisplay);
          }
        } catch (extraError) {
          console.error(
            "⚠️ Failed to fetch additional table data:",
            extraError
          );
          // Continue execution even if additional table fetch fails
        }
        if (additionalDetails) {
          // Update the selected mesh info with additional details
          setSelectedMeshInfo((prev) => ({
            ...prev,
            tagDetails: matchingTag,
            additionalDetails: additionalDetails,
            detailsType: matchingTag.type,
            fileMetadata: fileMetadata,
            extraTableData: extraTableData,
            UsertagInfoDetails: Object.fromEntries(userDefinedDisplay),
            originalUsertagInfoDetails: extraTableData.data || null,
          }));
        }
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setCustomAlert(true);
      setModalMessage("Failed to delete comment");
    }
  };

  const fetchLineDetails = async (tagId) => {
    try {
      const response = await getLineDetails(projectId, tagId);
      if (response.status === 200) {
        console.log(response.data);
        const lineDetail = response.data;
        if (lineDetail) {
          return lineDetail;
        }
      }

      // If not found in existing list, you might want to fetch from API
      console.log("Line not found in existing list for tagId:", tagId);
      return null;
    } catch (error) {
      console.error("Error fetching line details:", error);
      return null;
    }
  };

  const fetchEquipmentDetails = async (tagId) => {
    try {
      const response = await getEquipmentDetails(projectId, tagId);
      if (response.status === 200) {
        console.log(response.data);
        const lineDetail = response.data;
        if (lineDetail) {
          return lineDetail;
        }
      }

      // If not found in existing list, you might want to fetch from API
      console.log("Equipment not found in existing list for tagId:", tagId);
      return null;
    } catch (error) {
      console.error("Error fetching equipment details:", error);
      return null;
    }
  };

  const fetchValveDetails = async (tagId) => {
    try {
      const response = await getValveDetails(projectId, tagId);
      if (response.status === 200) {
        const lineDetail = response.data;
        if (lineDetail) {
          return lineDetail;
        }
      }

      // If not found in existing list, you might want to fetch from API
      console.log("Valve not found in existing list for tagId:", tagId);
      return null;
    } catch (error) {
      console.error("Error fetching valve details:", error);
      return null;
    }
  };

  // Helper function for merged mesh selection (fallback)
  const handleMergedMeshSelection = (pickedMesh, pickInfo) => {
    selectedMeshRef.current = pickedMesh;
    highlightMesh(pickedMesh);

    setSelectedItemName({ name: pickedMesh.name });

    const intersectionPoint = pickInfo.pickedPoint;
    commentPositionRef.current = {
      intersectionPointX: intersectionPoint._x,
      intersectionPointY: intersectionPoint._y,
      intersectionPointZ: intersectionPoint._z,
    };

    setSelectedMeshInfo({
      type: "merged",
      name: pickedMesh.name,
      nodeNumber: pickedMesh.metadata.nodeNumber,
      depth: pickedMesh.metadata.depth,
      originalMeshCount: pickedMesh.metadata.meshCount,
      totalVertices: pickedMesh.getTotalVertices(),
      totalIndices: pickedMesh.getTotalIndices(),
    });

    setTagInfo({
      filename: pickedMesh.name,
      meshname: pickedMesh.name,
    });
  };

  // Helper function for standard mesh selection
  const handleStandardMeshSelection = (pickedMesh, pickInfo) => {
    selectedMeshRef.current = pickedMesh;
    highlightMesh(pickedMesh);

    setSelectedItemName({ name: pickedMesh.name });

    // Process tag information for standard mesh
    const tagData = pickedMesh.metadata.tagNo || pickedMesh.metadata;
    const tagKey = tagData.tag || pickedMesh.name;

    if (tagKey) {
      setBackgroundColorTag({ [tagKey]: true });
    }

    if (tagData.fileDetails) {
      setFileInfoDetails(tagData.fileDetails);
    }

    setTagInfo({
      filename: tagData.tag || pickedMesh.name,
      meshname: pickedMesh.name,
    });
  };

  const getMeshBoundingBoxFromDB = useCallback(
    async (meshId) => {
      try {
        const db = await initDB();
        const transaction = db.transaction(["originalMeshes"], "readonly");
        const store = transaction.objectStore("originalMeshes");

        return new Promise((resolve, reject) => {
          const request = store.get(meshId);
          request.onsuccess = () => {
            const result = request.result;

            // Handle your specific data structure
            if (result && result.data && result.data.boundingBox) {
              const bbox = result.data.boundingBox;

              // Extract bounding box data from your format
              let min, max;

              // Use world coordinates if available, otherwise use local coordinates
              if (bbox.minimumWorld && bbox.maximumWorld) {
                min = {
                  x: bbox.minimumWorld._x,
                  y: bbox.minimumWorld._y,
                  z: bbox.minimumWorld._z,
                };
                max = {
                  x: bbox.maximumWorld._x,
                  y: bbox.maximumWorld._y,
                  z: bbox.maximumWorld._z,
                };
              } else if (bbox.minimum && bbox.maximum) {
                min = {
                  x: bbox.minimum._x,
                  y: bbox.minimum._y,
                  z: bbox.minimum._z,
                };
                max = {
                  x: bbox.maximum._x,
                  y: bbox.maximum._y,
                  z: bbox.maximum._z,
                };
              } else {
                console.warn(
                  `Invalid bounding box structure for mesh ID: ${meshId}`
                );
                resolve(null);
                return;
              }

              // Return in the format expected by our calculation functions
              resolve({ min, max });
            } else {
              console.warn(`No bounding box found for mesh ID: ${meshId}`);
              resolve(null);
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("Error getting mesh bounding box from DB:", error);
        return null;
      }
    },
    [initDB]
  );

  const getMeshParentFileName = useCallback(
    async (meshId) => {
      try {
        const db = await initDB();
        const transaction = db.transaction(["originalMeshes"], "readonly");
        const store = transaction.objectStore("originalMeshes");

        return new Promise((resolve, reject) => {
          const request = store.get(meshId);
          request.onsuccess = () => {
            const result = request.result;

            // Handle your specific data structure
            if (result && result.data && result.data.ParentFile) {
              const parentFile = result.data.ParentFile;
              resolve({ parentFile });
            } else {
              console.warn(`No bounding box found for mesh ID: ${meshId}`);
              resolve(null);
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("Error getting mesh bounding box from DB:", error);
        return null;
      }
    },
    [initDB]
  );

  // 2. Function to calculate camera position for bounding box
  const calculateCameraPositionForBounds = useCallback(
    (boundingBox, camera, padding = 1.5) => {
      if (!boundingBox || !boundingBox.min || !boundingBox.max) {
        console.warn("Invalid bounding box provided");
        return null;
      }

      const min = new BABYLON.Vector3(
        boundingBox.min.x,
        boundingBox.min.y,
        boundingBox.min.z
      );
      const max = new BABYLON.Vector3(
        boundingBox.max.x,
        boundingBox.max.y,
        boundingBox.max.z
      );

      const center = BABYLON.Vector3.Center(min, max);
      const size = max.subtract(min);
      const maxDimension = Math.max(size.x, size.y, size.z);

      // Calculate distance needed to fit bounding box in view
      const fov = camera.fov || Math.PI / 4;
      const distance = (maxDimension * padding) / (2 * Math.tan(fov / 2));

      return { center, distance, size, min, max };
    },
    []
  );

  // 3. Function to set camera position directly (no animation)
  const setCameraPosition = useCallback((targetPosition, targetCenter) => {
    if (!sceneRef.current || !cameraRef.current) return;

    const camera = cameraRef.current;

    if (camera instanceof BABYLON.ArcRotateCamera) {
      // Set orbit camera position directly
      const direction = targetPosition.subtract(targetCenter).normalize();
      const newRadius = BABYLON.Vector3.Distance(targetPosition, targetCenter);
      const newAlpha = Math.atan2(direction.x, direction.z);
      const newBeta = Math.acos(Math.max(-1, Math.min(1, direction.y)));

      camera.target = targetCenter;
      camera.alpha = newAlpha;
      camera.beta = newBeta;
      camera.radius = newRadius;
    } else if (camera instanceof BABYLON.UniversalCamera) {
      // Set fly camera position directly
      camera.position = targetPosition;
      camera.setTarget(targetCenter);
    }
  }, []);

  // 4. Zoom to selected mesh function
  const zoomToSelected = useCallback(async () => {
    if (!selectedMeshInfo || !cameraRef.current) {
      console.warn("No mesh selected or camera not available");
      return;
    }

    try {
      let boundingBox = null;

      // Get bounding box based on mesh type
      if (selectedMeshInfo.type === "individual" && selectedMeshInfo.meshId) {
        boundingBox = await getMeshBoundingBoxFromDB(selectedMeshInfo.meshId);
      } else if (
        selectedMeshInfo.type === "merged" &&
        selectedMeshRef.current
      ) {
        const mesh = selectedMeshRef.current;
        if (mesh.getBoundingInfo) {
          const bb = mesh.getBoundingInfo().boundingBox;
          boundingBox = {
            min: {
              x: bb.minimumWorld.x,
              y: bb.minimumWorld.y,
              z: bb.minimumWorld.z,
            },
            max: {
              x: bb.maximumWorld.x,
              y: bb.maximumWorld.y,
              z: bb.maximumWorld.z,
            },
          };
        }
      }

      if (!boundingBox) {
        console.warn("Could not get bounding box for selected mesh");
        return;
      }

      const camera = cameraRef.current;
      const cameraData = calculateCameraPositionForBounds(
        boundingBox,
        camera,
        2.0
      ); // 2.0 padding for zoom

      if (!cameraData) return;

      // Calculate camera position maintaining current viewing direction
      let cameraPosition;
      if (camera instanceof BABYLON.ArcRotateCamera) {
        const currentDirection = camera.position
          .subtract(camera.target)
          .normalize();
        cameraPosition = cameraData.center.add(
          currentDirection.scale(cameraData.distance)
        );
      } else {
        const currentDirection = camera
          .getTarget()
          .subtract(camera.position)
          .normalize();
        cameraPosition = cameraData.center.subtract(
          currentDirection.scale(cameraData.distance)
        );
      }

      setCameraPosition(cameraPosition, cameraData.center);
    } catch (error) {
      console.error("Error zooming to selected mesh:", error);
    }
  }, [
    selectedMeshInfo,
    getMeshBoundingBoxFromDB,
    calculateCameraPositionForBounds,
    setCameraPosition,
  ]);

  // 5. Focus on selected mesh function
  const focusOnSelected = useCallback(async () => {
    if (!selectedMeshInfo || !cameraRef.current) {
      console.warn("No mesh selected or camera not available");
      return;
    }

    try {
      let boundingBox = null;

      // Get bounding box based on mesh type
      if (selectedMeshInfo.type === "individual" && selectedMeshInfo.meshId) {
        boundingBox = await getMeshBoundingBoxFromDB(selectedMeshInfo.meshId);
      } else if (
        selectedMeshInfo.type === "merged" &&
        selectedMeshRef.current
      ) {
        const mesh = selectedMeshRef.current;
        if (mesh.getBoundingInfo) {
          const bb = mesh.getBoundingInfo().boundingBox;
          boundingBox = {
            min: {
              x: bb.minimumWorld.x,
              y: bb.minimumWorld.y,
              z: bb.minimumWorld.z,
            },
            max: {
              x: bb.maximumWorld.x,
              y: bb.maximumWorld.y,
              z: bb.maximumWorld.z,
            },
          };
        }
      }

      if (!boundingBox) {
        console.warn("Could not get bounding box for selected mesh");
        return;
      }

      const camera = cameraRef.current;
      const cameraData = calculateCameraPositionForBounds(
        boundingBox,
        camera,
        1.2
      ); // 1.2 padding for closer focus

      if (!cameraData) return;

      // Position camera for optimal viewing (front view)
      const cameraPosition = new BABYLON.Vector3(
        cameraData.center.x,
        cameraData.center.y,
        cameraData.center.z - cameraData.distance
      );

      setCameraPosition(cameraPosition, cameraData.center);
    } catch (error) {
      console.error("Error focusing on selected mesh:", error);
    }
  }, [
    selectedMeshInfo,
    getMeshBoundingBoxFromDB,
    calculateCameraPositionForBounds,
    setCameraPosition,
  ]);

  // STEP 2: Add the missing hideSelected function
  const hideSelected = useCallback(() => {
    if (!selectedMeshInfo) {
      console.warn("No mesh selected to hide");
      alert("Please select a mesh first");
      return;
    }

    try {
      if (selectedMeshInfo.type === "individual" && selectedMeshRef.current) {
        const mergedMesh = selectedMeshRef.current;
        const meshId = selectedMeshInfo.meshId;

        const mapping = mergedMesh.metadata.vertexMappings?.find(
          (m) => m.meshId === meshId
        );

        if (mapping) {
          // Use indices removal method instead of transparency
          hideByRemovingIndices(mergedMesh, mapping, meshId);
          setHiddenIndividualMeshes((prev) => new Set([...prev, meshId]));
        } else {
          console.warn("❌ No mapping found for meshId:", meshId);
        }
      } else if (
        selectedMeshInfo.type === "merged" &&
        selectedMeshRef.current
      ) {
        const mesh = selectedMeshRef.current;
        mesh.isVisible = false;
        const nodeNumber = mesh.metadata?.nodeNumber;
        if (nodeNumber) {
          setHiddenMeshes((prev) => new Set([...prev, nodeNumber]));
        }
      }
    } catch (error) {
      console.error("❌ Error hiding selected mesh:", error);
    }
  }, [selectedMeshInfo]);

  // Add this new function that actually removes the geometry
  const hideByRemovingIndices = useCallback((mergedMesh, mapping, meshId) => {
    try {
      const indices = mergedMesh.getIndices();
      if (!indices) return;

      // Store original indices
      if (!mergedMesh._originalIndices) {
        mergedMesh._originalIndices = indices.slice();
      }

      // Create new indices array excluding the hidden mesh
      const newIndices = [];
      const startIdx = mapping.startIndex;
      const endIdx = mapping.startIndex + mapping.indexCount;

      for (let i = 0; i < indices.length; i++) {
        if (i < startIdx || i >= endIdx) {
          newIndices.push(indices[i]);
        }
      }

      // Update mesh with new indices
      mergedMesh.updateIndices(new Uint32Array(newIndices));
    } catch (error) {
      console.error("❌ Error removing indices:", error);
    }
  }, []);

  const hideUnselected = useCallback(() => {
    if (!selectedMeshInfo) {
      console.warn("No mesh selected - cannot hide unselected");
      alert("Please select a mesh first");
      return;
    }

    try {
      if (lodManagerRef.current && lodManagerRef.current.activeMeshes) {
        const activeMeshes = lodManagerRef.current.activeMeshes;
        const selectedNodeNumber = selectedMeshInfo.nodeNumber;

        let hiddenCount = 0;

        // Hide all other merged meshes (different nodes)
        activeMeshes.forEach((mesh, nodeNumber) => {
          if (nodeNumber !== selectedNodeNumber) {
            mesh.isVisible = false;
            setHiddenMeshes((prev) => new Set([...prev, nodeNumber]));
            hiddenCount++;
          }
        });

        // If individual mesh is selected, hide other individual meshes in the same merged mesh
        if (selectedMeshInfo.type === "individual" && selectedMeshRef.current) {
          const mergedMesh = selectedMeshRef.current;
          const selectedMeshId = selectedMeshInfo.meshId;

          if (mergedMesh.metadata.vertexMappings) {
            // Use indices removal method to keep only the selected mesh
            hideUnselectedIndividualMeshes(mergedMesh, selectedMeshId);

            // Track all other individual meshes as hidden
            mergedMesh.metadata.vertexMappings.forEach((mapping) => {
              if (mapping.meshId !== selectedMeshId) {
                setHiddenIndividualMeshes(
                  (prev) => new Set([...prev, mapping.meshId])
                );
              }
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ Error hiding unselected meshes:", error);
    }
  }, [selectedMeshInfo]);

  // New function to hide unselected individual meshes using indices removal
  const hideUnselectedIndividualMeshes = useCallback(
    (mergedMesh, selectedMeshId) => {
      try {
        const indices = mergedMesh.getIndices();
        if (!indices) {
          console.error("❌ No indices available");
          return;
        }

        // Store original indices if not already stored
        if (!mergedMesh._originalIndices) {
          mergedMesh._originalIndices = indices.slice();
        }

        // Find the mapping for the selected mesh (the one we want to KEEP)
        const selectedMapping = mergedMesh.metadata.vertexMappings?.find(
          (m) => m.meshId === selectedMeshId
        );

        if (!selectedMapping) {
          console.error(
            "❌ No mapping found for selected mesh:",
            selectedMeshId
          );
          return;
        }

        // Create new indices array with ONLY the selected mesh
        const newIndices = [];
        const startIdx = selectedMapping.startIndex;
        const endIdx = selectedMapping.startIndex + selectedMapping.indexCount;

        // Copy only the indices belonging to the selected mesh
        for (let i = startIdx; i < endIdx; i++) {
          if (i < indices.length) {
            newIndices.push(indices[i]);
          }
        }

        // Update the mesh with new indices (only the selected mesh remains)
        mergedMesh.updateIndices(new Uint32Array(newIndices));
      } catch (error) {
        console.error("❌ Error hiding unselected individual meshes:", error);
      }
    },
    []
  );

  // Enhanced restore function that handles both methods
  const restoreAllIndividualMeshesEnhanced = useCallback((mergedMesh) => {
    try {
      // Restore indices if available (for indices removal method)
      if (mergedMesh._originalIndices) {
        mergedMesh.updateIndices(mergedMesh._originalIndices);
      }

      // Restore colors if available (for transparency method)
      if (mergedMesh._originalColors) {
        mergedMesh.setVerticesData(
          BABYLON.VertexBuffer.ColorKind,
          mergedMesh._originalColors,
          true
        );
      }

      // Reset material properties
      if (mergedMesh.material) {
        mergedMesh.material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
        mergedMesh.material.useVertexColors = false;
        mergedMesh.material.markDirty();
      }
    } catch (error) {
      console.error("❌ Error restoring individual meshes:", error);
    }
  }, []);

  // Update your unhideAllEnhanced function to use the enhanced restore
  const unhideAllEnhanced = useCallback(() => {
    try {
      let shownCount = 0;

      // Method 1: Use LOD manager if available
      if (lodManagerRef.current && lodManagerRef.current.activeMeshes) {
        lodManagerRef.current.activeMeshes.forEach((mesh, nodeNumber) => {
          mesh.isVisible = true;

          // Restore individual meshes within merged meshes using enhanced method
          if (mesh.metadata.isLodMesh && mesh.metadata.vertexMappings) {
            restoreAllIndividualMeshesEnhanced(mesh);
          }

          shownCount++;
        });
      }
      // Method 2: Fallback to scene meshes
      else if (sceneRef.current) {
        sceneRef.current.meshes.forEach((mesh) => {
          if (
            !mesh.name.includes("skyBox") &&
            !mesh.name.includes("ground") &&
            !mesh.name.includes("water") &&
            !mesh.name.includes("octreeVisBox")
          ) {
            mesh.isVisible = true;

            // Try to restore individual meshes using enhanced method
            if (mesh.metadata && mesh.metadata.isLodMesh) {
              restoreAllIndividualMeshesEnhanced(mesh);
            }

            shownCount++;
          }
        });
      }

      // Clear tracking state
      setHiddenMeshes(new Set());
      setHiddenIndividualMeshes(new Set());
    } catch (error) {
      console.error("❌ Enhanced unhide all error:", error);
    }
  }, []);

  const hideAllEnhanced = useCallback(() => {
    try {
      let hiddenCount = 0;

      // Method 1: Use LOD manager if available
      if (lodManagerRef.current && lodManagerRef.current.activeMeshes) {
        lodManagerRef.current.activeMeshes.forEach((mesh, nodeNumber) => {
          mesh.isVisible = false;
          setHiddenMeshes((prev) => new Set([...prev, nodeNumber]));
          hiddenCount++;
        });
      }
      // Method 2: Fallback to scene meshes
      else if (sceneRef.current) {
        sceneRef.current.meshes.forEach((mesh) => {
          // Skip environment meshes
          if (
            !mesh.name.includes("skyBox") &&
            !mesh.name.includes("ground") &&
            !mesh.name.includes("water") &&
            !mesh.name.includes("octreeVisBox")
          ) {
            mesh.isVisible = false;
            hiddenCount++;
          }
        });
      }

      setHiddenIndividualMeshes(new Set());
    } catch (error) {
      console.error("❌ Enhanced hide all error:", error);
    }
  }, []);

  const handleSelectTag = () => {
    if (!selectedItemName || !selectedItemName.name) {
      console.warn("No tag selected");
      return;
    }

    // Get the tag name from your tag info
    const tagName = selectedMeshInfo.parentFileName || selectedItemName.name;
    console.log("🏷️ Selecting tag (multi-node aware):", tagName);

    // Use the LOD manager to select the tag
    if (lodManagerRef.current) {
      const result = lodManagerRef.current.selectTagInLOD(tagName);

      if (result) {
        console.log("✅ Tag selected successfully:", {
          tagName: result.tagName,
          totalParts: result.totalParts,
          isMultiNode: result.isMultiNode,
          nodes: result.nodes,
          highlightedParts: result.highlightedParts,
        });

        // Update your selected mesh reference to the primary mesh
        if (selectedMeshRef) {
          selectedMeshRef.current = result.results[0].lodMesh;
        }

        // Show user feedback for multi-node tags
        if (result.isMultiNode) {
          console.log(
            `📍 Multi-node tag: "${tagName}" spans ${result.totalParts} parts across ${result.nodes.length} nodes`
          );

          // Optional: Show notification to user
          // showNotification(`Tag "${tagName}" spans multiple nodes (${result.nodes.length} nodes, ${result.totalParts} parts)`);
        }
      } else {
        console.warn("❌ Tag not found in LOD system");

        // Fallback to traditional mesh search if LOD search fails
        if (sceneRef.current) {
          const scene = sceneRef.current;
          const parentMesh = scene.meshes.find(
            (mesh) =>
              mesh.name === tagName || mesh.metadata?.tagNo?.tag === tagName
          );

          if (parentMesh) {
            console.log("📦 Found tag in traditional meshes");
            const meshesToSelect = [parentMesh, ...parentMesh.getChildMeshes()];
            dehighlightMesh();
            highlightMesh(meshesToSelect);
          }
        }
      }
    }

    // Close menu
    setIsMenuOpen(false);
  };
  // Enhanced version with focus option
  const handleSelectAndFocusTag = () => {
    if (!selectedItemName || !selectedItemName.name) {
      console.warn("No tag selected");
      return;
    }

    const tagName = selectedMeshInfo.filename || selectedItemName.name;
    console.log("🎯 Selecting and focusing tag:", tagName);

    if (lodManagerRef.current) {
      lodManagerRef.current.selectAndFocusTag(tagName, true);
    }

    setIsMenuOpen(false);
  };
  // 4. DEBUGGING FUNCTION: Check mesh states
  const debugMeshStates = useCallback(() => {
    if (lodManagerRef.current && lodManagerRef.current.activeMeshes) {
      lodManagerRef.current.activeMeshes.forEach((mesh, nodeNumber) => {});
    }

    if (sceneRef.current) {
      const visibleMeshes = sceneRef.current.meshes.filter(
        (m) => m.isVisible && m.name !== "BackgroundPlane"
      );
      const hiddenMeshes = sceneRef.current.meshes.filter(
        (m) => !m.isVisible && m.name !== "BackgroundPlane"
      );
    }
  }, [hiddenMeshes, hiddenIndividualMeshes, selectedMeshInfo]);

  const handleShowlineEqpInfo = () => {
    if (selectedMeshInfo.additionalDetails) {
      setLineEqpInfo(true);
      setIsMenuOpen(false);
    } else {
      setCustomAlert(true);
      setModalMessage("No Info availible, please select item!!!!");
      setIsMenuOpen(false);
    }
  };

  const handleTagInfo = () => {
    if (selectedMeshInfo.additionalDetails) {
      setTagInfoVisible(true);
      setIsMenuOpen(false);
    } else {
      setCustomAlert(true);
      setModalMessage("No Info availible, please select item!!!!");
      setIsMenuOpen(false);
    }
  };
  const handleShowFileInfo = () => {
    if (selectedMeshInfo.additionalDetails) {
      setShowFileInfo(true);
      setIsMenuOpen(false);
    } else {
      setCustomAlert(true);
      setModalMessage("No Info availible, please select item!!!!");
      setIsMenuOpen(false);
    }
  };
  const handleCloselineEqpInfo = () => {
    setLineEqpInfo(false);
  };
  const handleCloseTagInfo = () => {
    setTagInfoVisible(false);
  };

  const handleMenuOptionClick = useCallback(
    (option) => {
      switch (option.label) {
        case "Zoom selected":
          if (selectedMeshInfo) {
            zoomToSelected();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;

        case "Focus Selected":
          if (selectedMeshInfo) {
            focusOnSelected();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;

        case "Hide selected":
          if (selectedMeshInfo) {
            hideSelected();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;

        case "Hide unselected":
          if (selectedMeshInfo) {
            hideUnselected();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;

        case "Hide all":
          hideAllEnhanced();
          setIsMenuOpen(false);
          break;

        case "Unhide all":
          unhideAllEnhanced();
          setIsMenuOpen(false);
          break;

        case "Deselect":
          clearSelection();
          setIsMenuOpen(false);
          break;

        case "Add Comment":
          setIsModalOpen(true);
          break;

        case "Tag info":
          if (selectedMeshInfo) {
            handleShowlineEqpInfo();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;
        case "File info":
          if (selectedMeshInfo) {
            handleShowFileInfo();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;
        case "Select tag":
          if (selectedMeshInfo) {
            handleSelectTag();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;
        case "Tag GenInfo":
          if (selectedMeshInfo) {
            handleTagInfo();
          } else {
            setCustomAlert(true);
            setModalMessage("Please select a mesh first");
          }
          setIsMenuOpen(false);
          break;

        default:
          setIsMenuOpen(false);
      }
    },
    [
      selectedMeshInfo,
      zoomToSelected,
      focusOnSelected,
      hideSelected,
      hideUnselected,
      hideAllEnhanced,
      unhideAllEnhanced,
      clearSelection,
      handleShowlineEqpInfo,
    ]
  );

  const menuOptions = [
    { label: selectedItemName ? `${selectedItemName.parentFileName}` : "" },
    { label: selectedItemName ? `${selectedItemName.name}` : "" },
    {
      label: "Add Comment",
      action: () => handleMenuOptionClick({ label: "Add Comment" }),
    },
    {
      label: "Info",
      children: [
        {
          label: "Tag info",
          action: () => handleMenuOptionClick({ label: "Tag info" }),
        },
        {
          label: "Tag GenInfo",
          action: () => handleMenuOptionClick({ label: "Tag GenInfo" }),
        },
        {
          label: "File Info",
          action: () => handleMenuOptionClick({ label: "File info" }),
        },
      ],
    },
    {
      label: "Deselect",
      action: () => handleMenuOptionClick({ label: "Deselect" }),
    },
    {
      label: "Select tag",
      action: () => handleMenuOptionClick({ label: "Select tag" }),
    },
    {
      label: "Visibility",
      children: [
        {
          label: "Hide all",
          action: () => handleMenuOptionClick({ label: "Hide all" }),
        },
        {
          label: "Unhide all",
          action: () => handleMenuOptionClick({ label: "Unhide all" }),
        },
        {
          label: "Hide selected",
          action: () => handleMenuOptionClick({ label: "Hide selected" }),
        },
        {
          label: "Hide unselected",
          action: () => handleMenuOptionClick({ label: "Hide unselected" }),
        },
      ],
    },
    {
      label: "Zoom selected",
      action: () => handleMenuOptionClick({ label: "Zoom selected" }),
    },
    {
      label: "Focus Selected",
      action: () => handleMenuOptionClick({ label: "Focus Selected" }),
    },
    // Debug option
    // { label: "Debug States", action: () => { debugMeshStates(); setIsMenuOpen(false); } },
  ];

  const handleCommentInfo = (item) => {
    setcommentinfo(item);
    setcommentinfotable(true);
  };

  const handleclosecommentinfo = () => {
    setIsEditing(false);
    setcommentinfotable(false);
    setcommentinfo(null);
  };

  const handleEditButtonClick = (comment) => {
    setIsEditing(true);
    setEditedCommentData(comment);
    setCommentEdit(commentinfo.comment);
    setStatus(commentinfo.status);
    setPriority(commentinfo.priority);
  };

  const handleSaveButtonClick = async () => {
    setIsEditing(false);

    try {
      const response = await updateComment(editedCommentData);
      if (response.status === 200) {
        const updatedComment = {
          ...commentinfo,
          editedCommentData,
        };
        setcommentinfo(updatedComment);
        console.log(commentinfo);
        handleclosecommentinfo();
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      setCustomAlert(true);
      setModalMessage("Failed to update comment");
    }
  };

  const handleChange = (field, value) => {
    setEditedCommentData({
      ...editedCommentData,
      [field]: value,
    });
  };

  const handlePriorityChange = (priority) => {
    setEditedCommentData({ ...editedCommentData, priority });
  };
  // 1. Move createCommentLabel outside of component or make it stable
  const createCommentLabel = useCallback(
    (comment, index, scene, commentStatusArray, onCommentClick) => {
      // Create a simple position mesh (invisible) to anchor the label
      const position = BABYLON.MeshBuilder.CreateBox(
        `marker-position-${comment.number}`,
        { size: 0.1 },
        scene
      );
      position.position = new BABYLON.Vector3(
        comment.coOrdinateX,
        comment.coOrdinateY,
        comment.coOrdinateZ
      );

      // Make the position mesh invisible
      position.isVisible = false;

      // Create the fullscreen UI
      const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        `UI-${comment.number}`,
        true,
        scene
      );

      // Get the status color from comment status
      const statusColor =
        commentStatusArray.find(
          (status) => status.statusname === comment.status
        )?.color || "gray";

      // Create the main label (number)
      const label = new GUI.Rectangle("label");
      label.background = statusColor || "red";
      label.height = "20px";
      label.alpha = 0.8;
      label.width = "20px";
      label.thickness = 1;
      label.linkOffsetY = -10;
      label.isPointerBlocker = true;
      label.onPointerClickObservable.add(() => {
        onCommentClick(comment);
      });

      const text = new GUI.TextBlock();
      text.text = index.toString();
      text.color = "white";
      text.fontSize = 10;

      label.addControl(text);
      advancedTexture.addControl(label);

      // Add hover behavior
      position.actionManager = new BABYLON.ActionManager(scene);
      position.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOverTrigger,
          () => {
            label.isVisible = true;
          }
        )
      );

      position.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOutTrigger,
          () => {
            label.isVisible = false;
          }
        )
      );

      // Link the main label to the 3D position
      label.linkWithMesh(position);

      return {
        label: label,
        position: position,
        commentId: comment.number,
        advancedTexture: advancedTexture,
        show: () => {
          label.isVisible = true;
        },
        hide: () => {
          label.isVisible = false;
        },
        dispose: () => {
          try {
            if (label?.dispose) label.dispose();
            if (position?.dispose) position.dispose();
            if (advancedTexture?.dispose) advancedTexture.dispose();
          } catch (error) {
            console.warn("Error disposing label:", error);
          }
        },
      };
    },
    []
  ); // Empty dependency array since we pass everything as parameters

  // 2. Use refs to track previous values and prevent unnecessary updates
  const prevCommentsRef = useRef([]);
  const prevStatusRef = useRef([]);
  const prevShowCommentRef = useRef(showComment);

  // 3. Stable handler function
  const handleCommentClick = useCallback(
    (comment) => {
      handleCommentInfo(comment);
    },
    [handleCommentInfo]
  );

  // 4. Fixed useEffect with proper dependency management
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Check if we actually need to update
    const commentsChanged =
      JSON.stringify(allComments) !== JSON.stringify(prevCommentsRef.current);
    const statusChanged =
      JSON.stringify(allCommentStatus) !==
      JSON.stringify(prevStatusRef.current);
    const showCommentChanged = showComment !== prevShowCommentRef.current;

    if (!commentsChanged && !statusChanged && !showCommentChanged) {
      return; // No changes, skip update
    }

    // Update refs
    prevCommentsRef.current = allComments;
    prevStatusRef.current = allCommentStatus;
    prevShowCommentRef.current = showComment;

    // Clear existing labels
    allLabels.forEach((labelElement) => {
      if (labelElement.dispose) {
        labelElement.dispose();
      }
    });

    // Create new labels only if we have comments
    if (allComments.length === 0) {
      setAllLabels([]);
      return;
    }

    const newLabels = allComments.map((comment, index) => {
      const labelElement = createCommentLabel(
        comment,
        index + 1,
        scene,
        allCommentStatus,
        handleCommentClick
      );

      // Set visibility based on showComment state
      labelElement.label.isVisible = showComment;

      return labelElement;
    });

    setAllLabels(newLabels);
  }, [
    allComments,
    allCommentStatus,
    showComment,
    createCommentLabel,
    handleCommentClick,
  ]);

  // 6. Separate useEffect for visibility updates only
  useEffect(() => {
    allLabels.forEach((labelElement) => {
      if (labelElement.label) {
        labelElement.label.isVisible = showComment;
      }
      if (labelElement.tooltip) {
        labelElement.tooltip.isVisible = showComment;
      }
    });
  }, [showComment, allLabels]);

  const handleDeleteComment = (commentId) => {
    setCurrentDeleteNumber(commentId);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const response = await deleteComment(currentDeleteNumber);
      if (response.status === 200) {
        SetAllComments(
          allComments.filter(
            (comment) => comment.number !== currentDeleteNumber
          )
        );
        setShowConfirm(false);
        setCurrentDeleteNumber(null);
        handleclosecommentinfo();
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setCustomAlert(true);
      setModalMessage("Failed to delete comment");
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  const handleCloseFileInfo = () => {
    setShowFileInfo(false);
  };
  const handleSaveView = async () => {
    if (!saveViewName.trim()) {
      setCustomAlert(true);
      setModalMessage("Please enter a view name");
      return;
    }
    // Check if a view with the same name already exists
    const trimmedName = saveViewName.trim();
    const viewExists = allSavedViews.some(
      (view) => view.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    console.log("viewExists", viewExists);
    if (viewExists) {
      setCustomAlert(true);
      setModalMessage("A view with this name already exists");
      return;
    }

    // Get current camera data
    if (!sceneRef.current || !sceneRef.current.activeCamera) {
      setCustomAlert(true);
      setModalMessage("Cannot save view - camera not initialized");
      return;
    }

    const camera = sceneRef.current.activeCamera;

    const viewData = {
      name: saveViewName.trim(),
      projectId: projectId,
      posX: camera.position.x,
      posY: camera.position.y,
      posZ: camera.position.z,
      targX:
        camera instanceof BABYLON.ArcRotateCamera
          ? camera.target.x
          : camera.getTarget().x,
      targY:
        camera instanceof BABYLON.ArcRotateCamera
          ? camera.target.y
          : camera.getTarget().y,
      targZ:
        camera instanceof BABYLON.ArcRotateCamera
          ? camera.target.z
          : camera.getTarget().z,
      // Store additional camera properties if needed
      cameraType: camera instanceof BABYLON.ArcRotateCamera ? "arc" : "free",
      // For ArcRotate camera, store specific properties
      ...(camera instanceof BABYLON.ArcRotateCamera && {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
      }),
    };

    try {
      const response = await SaveSavedView(viewData);

      if (response.status === 200) {
        setCustomAlert(true);
        setModalMessage(`${saveViewName}" saved successfully`);
        setSavedViewDialog(false);
        setSaveViewName("");
        getAllSavedViews(projectId);

        setTimeout(() => {
          setCustomAlert(false);
        }, 2000);
      }
    } catch (error) {
      if (error.response && error.response.status === 409) {
        setCustomAlert(true);
        setModalMessage(error.response.data.message || "Duplicate view name");

        setTimeout(() => {
          setCustomAlert(false);
        }, 2000);
      } else {
        console.error("Unexpected error:", error);
        setCustomAlert(true);
        setModalMessage("Something went wrong while saving the view.");
      }
    }
  };

  const handleCloseSavedView = () => {
    setSavedViewDialog(false);
    setSaveViewName("");
  };

  const applySavedView = (view) => {
    if (!view) return;
    // setSaveViewMenu(view.name);

    // Check if the camera references exist
    if (!sceneRef.current || !sceneRef.current.activeCamera) return;

    const camera = sceneRef.current.activeCamera;
    try {
      // Create target position vector
      const targetPosition = new BABYLON.Vector3(
        view.posX,
        view.posY,
        view.posZ
      );

      // Create target point vector
      const targetPoint = new BABYLON.Vector3(
        view.targX,
        view.targY,
        view.targZ
      );

      // For ArcRotateCamera
      if (camera instanceof BABYLON.ArcRotateCamera) {
        // Set position and target directly without animation
        camera.position = targetPosition;
        camera.target = targetPoint;
      }
      // For UniversalCamera
      else if (camera instanceof BABYLON.UniversalCamera) {
        // Set position and target directly without animation
        camera.position = targetPosition;
        camera.setTarget(targetPoint);
      }
    } catch (error) {
      console.error("Error applying saved view:", error);
      setCustomAlert(true);
      setModalMessage("Error applying view");
    }
  };

  useEffect(() => {
    if (modalData) {
      applySavedView(modalData);
    }
  }, [modalData]);

  useEffect(() => {
    if (baseSettingParameter) {
      setBaseFormValues({
        measureUnit: baseSettingParameter?.measure?.unit ?? "m",
        customUnitFactor:
          Number(baseSettingParameter?.measure?.scaleValue) || 1,
        fov: baseSettingParameter?.camera?.fov ?? 45,
        nearClip: baseSettingParameter?.camera?.nearClip ?? 0.01,
        farClip: baseSettingParameter?.camera?.farClip ?? 1000,
        angularSensibility:
          baseSettingParameter?.camera?.angularSensibility ?? 2000,
        wheelSensibility: baseSettingParameter?.camera?.wheelSensibility ?? 1,
        cameraSpeed: baseSettingParameter?.camera?.cameraSpeed ?? 1,
        inertia: baseSettingParameter?.camera?.inertia ?? 0.4,
        lightIntensity: baseSettingParameter?.light?.intensity ?? 1.0,
        specularColor: baseSettingParameter?.light?.specularColor ?? "#ffffff",
        shadowsEnabled: baseSettingParameter?.light?.shadowsEnabled ?? true,
        metallic: baseSettingParameter?.material?.metallic ?? 0.5,
        roughness: baseSettingParameter?.material?.roughness ?? 0.5,
        reflectionIntensity:
          baseSettingParameter?.material?.reflectionIntensity ?? 1.0,
      });
    }
  }, [baseSettingParameter]);

  useEffect(() => {
    if (groundSettingParameter) {
      setGroundFormValues({
        level: groundSettingParameter.level ?? 0,
        color: groundSettingParameter.color ?? "#cccccc",
        opacity:
          groundSettingParameter.opacity != null
            ? groundSettingParameter.opacity * 100
            : 100,
      });
    }
  }, [groundSettingParameter]);

  useEffect(() => {
    setWaterFormValues({
      level: waterSettingParameter?.level ?? 0,
      opacity:
        waterSettingParameter?.opacity != null
          ? waterSettingParameter.opacity * 100
          : 100,
      color: waterSettingParameter?.color ?? "#1ca3ec",
      colorBlendFactor: waterSettingParameter?.colorBlendFactor ?? 0.5,
      bumpHeight: waterSettingParameter?.bumpHeight ?? 1.0,
      waveLength: waterSettingParameter?.waveLength ?? 1.0,
      windForce: waterSettingParameter?.windForce ?? 20,
    });
  }, [waterSettingParameter]);

  // Background theme change effect
  useEffect(() => {
    if (sceneRef.current) {
      applyBackgroundTheme(backgroundTheme);
    }
  }, [backgroundTheme]);

  // Apply background theme
  const applyBackgroundTheme = (themeName) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    switch (themeName) {
      case "DEFAULT":
        // Set default background (dark blue)
        scene.clearColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1);

        // Remove ground if it exists
        if (groundRef.current) {
          groundRef.current.dispose();
          groundRef.current = null;
        }

        // Remove skybox if it exists
        if (skyboxRef.current) {
          skyboxRef.current.dispose();
          skyboxRef.current = null;
        }

        // Remove water if it exists
        if (waterMeshRef.current) {
          waterMeshRef.current.dispose();
          waterMeshRef.current = null;
        }

        setWaterSettingsVisible(false);
        setGroundSettingsVisible(false);
        break;

      case "WHITE":
        // Set white background
        scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

        // Remove ground if it exists
        if (groundRef.current) {
          groundRef.current.dispose();
          groundRef.current = null;
        }

        // Remove skybox if it exists
        if (skyboxRef.current) {
          skyboxRef.current.dispose();
          skyboxRef.current = null;
        }

        // Remove water if it exists
        if (waterMeshRef.current) {
          waterMeshRef.current.dispose();
          waterMeshRef.current = null;
        }

        setWaterSettingsVisible(false);
        setGroundSettingsVisible(false);
        break;

      case "GROUND_SKY":
        // Calculate environment size based on model size - make it larger to avoid flickering
        const environmentSize = calculateEnvironmentSize() * 1.5;

        // Setup skybox
        if (skyboxRef.current) {
          skyboxRef.current.dispose();
          skyboxRef.current = null;
        }

        skyboxRef.current = BABYLON.MeshBuilder.CreateBox(
          "skyBox",
          { size: environmentSize },
          scene
        );

        // Make skybox unselectable and not pickable to avoid issues in fly mode
        skyboxRef.current.isPickable = false;

        const skyboxMaterial = new BABYLON.StandardMaterial(
          "skyBoxMaterial",
          scene
        );
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
          "https://playground.babylonjs.com/textures/TropicalSunnyDay",
          scene
        );
        skyboxMaterial.reflectionTexture.coordinatesMode =
          BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxRef.current.material = skyboxMaterial;
        skyboxRef.current.infiniteDistance = true; // Fix for fly mode

        // Setup ground
        if (groundRef.current) {
          groundRef.current.dispose();
          groundRef.current = null;
        }

        groundRef.current = BABYLON.MeshBuilder.CreateGround(
          "ground",
          {
            width: 1000,
            height: 1000,
            subdivisions: 2, // Reduce subdivisions to avoid flickering
          },
          scene
        );

        const groundMaterial = new BABYLON.StandardMaterial(
          "groundMaterial",
          scene
        );
        if (groundSettingParameter) {
          const groundColor = hexToColor3(
            groundSettingParameter?.color || "#018C01"
          );
          groundMaterial.diffuseColor = groundColor || "#018C01";
          groundMaterial.alpha = groundSettingParameter?.opacity;
        } else {
          groundMaterial.diffuseColor = new BABYLON.Color3(0.01, 0.49, 0.01);
          groundMaterial.alpha = 1.0;
        }

        groundMaterial.backFaceCulling = false;
        groundMaterial.isPickable = false;

        if (groundRef.current) {
          groundRef.current.material = groundMaterial;
          groundRef.current.isPickable = false;

          if (modelInfoRef.current.boundingBoxMin) {
            const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
            const level = groundSettingParameter?.level;
            groundRef.current.position.y = baseY + level;
          } else {
            groundRef.current.position.y = -1.0;
          }
        } else {
          // Default ground color if no settings
          groundMaterial.diffuseColor = new BABYLON.Color3(0.01, 0.49, 0.01);
          groundMaterial.alpha = 1.0;
        }
        groundMaterial.backFaceCulling = false;
        groundMaterial.isPickable = false;
        groundRef.current.material = groundMaterial;
        groundRef.current.isPickable = false;

        // Remove water if it exists
        if (waterMeshRef.current) {
          waterMeshRef.current.dispose();
          waterMeshRef.current = null;
        }

        setWaterSettingsVisible(false);
        break;

      case "SEA_SKY":
        // Calculate environment size based on model size
        const seaEnvironmentSize = calculateEnvironmentSize() * 1.5;

        // Setup skybox
        if (skyboxRef.current) {
          skyboxRef.current.dispose();
          skyboxRef.current = null;
        }

        skyboxRef.current = BABYLON.MeshBuilder.CreateBox(
          "skyBox",
          { size: seaEnvironmentSize },
          scene
        );

        // Make skybox unselectable and not pickable
        skyboxRef.current.isPickable = false;

        const seaSkyboxMaterial = new BABYLON.StandardMaterial(
          "skyBoxMaterial",
          scene
        );
        seaSkyboxMaterial.backFaceCulling = false;
        seaSkyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
          "https://playground.babylonjs.com/textures/TropicalSunnyDay",
          scene
        );
        seaSkyboxMaterial.reflectionTexture.coordinatesMode =
          BABYLON.Texture.SKYBOX_MODE;
        seaSkyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        seaSkyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxRef.current.material = seaSkyboxMaterial;
        skyboxRef.current.infiniteDistance = true; // Fix for fly mode

        // Remove ground if it exists
        if (groundRef.current) {
          groundRef.current.dispose();
          groundRef.current = null;
        }

        // Setup water
        if (waterMeshRef.current) {
          waterMeshRef.current.dispose();
          waterMeshRef.current = null;
        }

        waterMeshRef.current = BABYLON.MeshBuilder.CreateGround(
          "waterMesh",
          {
            width: seaEnvironmentSize,
            height: seaEnvironmentSize,
            subdivisions: 2, // Reduce subdivisions
          },
          scene
        );

        // Make water unselectable and not pickable
        waterMeshRef.current.isPickable = false;

        // Water material
        const waterMaterial = new WaterMaterial("water", scene);
        waterMaterial.bumpTexture = new BABYLON.Texture(
          "babylon/textures/waterbump.png",
          scene
        );
        waterMaterial.backFaceCulling = true;

        if (waterSettingParameter) {
          // Convert hex color to Babylon Color3
          const waterColor = hexToColor3(
            waterSettingParameter.color || "#000000"
          );
          waterMaterial.waterColor = waterColor;

          // Apply other water parameters
          waterMaterial.opacity =
            waterSettingParameter.opacity !== undefined
              ? waterSettingParameter.opacity
              : 0.9;
          waterMaterial.colorBlendFactor =
            waterSettingParameter.colorBlendFactor !== undefined
              ? waterSettingParameter.colorBlendFactor
              : 0.3;
          waterMaterial.bumpHeight =
            waterSettingParameter.bumpHeight !== undefined
              ? waterSettingParameter.bumpHeight
              : 0.5;

          if (waterSettingParameter.waveLength !== undefined) {
            waterMaterial.waveHeight = waterSettingParameter.waveLength;
          }

          if (waterSettingParameter.windForce !== undefined) {
            waterMaterial.windForce = waterSettingParameter.windForce;
          }
          waterMaterial.windDirection = new BABYLON.Vector2(1, 1);
        } else {
          // Default water properties
          waterMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
          waterMaterial.waveHeight = 0.2;
          waterMaterial.colorBlendFactor = 0.25;
          waterMaterial.opacity = 0.8;
          waterMaterial.windForce = 10;
        }

        sceneRef.current.meshes?.forEach((mesh) => {
          if (mesh.isVisible && mesh.isPickable)
            waterMaterial.addToRenderList(mesh);
        });
        // Add skybox to water reflections
        waterMaterial.addToRenderList(skyboxRef.current);

        // Apply water material
        waterMeshRef.current.material = waterMaterial;

        if (modelInfoRef.current.boundingBoxMin) {
          const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
          const level = waterSettingParameter?.level ?? 0; // use default 0 if not provided
          waterMeshRef.current.position.y = baseY + level;
        } else {
          const level = waterSettingParameter?.level ?? 0;
          waterMeshRef.current.position.y = level; // fallback if bounding box is unavailable
        }

        setGroundSettingsVisible(false);
        break;

      default:
        break;
    }
  };

  const hexToColor3 = (hex) => {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return new BABYLON.Color3(r, g, b);
  };

  // Calculate environment size
  const calculateEnvironmentSize = () => {
    if (! modelInfoRef.current.boundingBoxMin ||! modelInfoRef.current.boundingBoxMax ) {
      return 1000; // Default size if no models loaded
    }

    // Get model dimensions
    const min = modelInfoRef.current.boundingBoxMin;
    const max = modelInfoRef.current.boundingBoxMax;

    // If model info isn't available yet
    if (!min || !max) {
      return 1000; // Default size
    }

    // Calculate size based on model dimensions
    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Environment should be at least 10x larger than model
    // but not too small or too large
    const environmentSize = Math.max(1000, maxDimension * 20);

    return environmentSize;
  };
  return (
    <div>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", width: "100%", height: "100vh" }}
      />

      {isModalOpen && (
        <CommentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          content={commentPositionRef.current}
          setIsMenuOpen={setIsMenuOpen}
          docdetnum={selectedItemName.parentFileName}
        />
      )}

      {/* File Panel */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "1px",
        }}
      >
        <button
          style={{ zIndex: "1000" }}
          onClick={loadMergedPolyMeshesWithWorkers}
          className="btn btn-success"
        >
          open Model
        </button>

        <button onClick={clearAllPipingStores} className="btn btn-dark">
          Clear DB
        </button>

        {/* WebXR Camera Button - only show if supported */}
        {isXRSupported && (
          <button
            onClick={() => toggleCamera("webxr")}
            className={`btn ${
              cameraType === "webxr" ? "btn-success" : "btn-info"
            }`}
            disabled={!isXRSupported}
          >
            {isInXR ? "Exit VR" : "Enter VR"}
          </button>
        )}

        {/* Show XR status */}
        {cameraType === "webxr" && (
          <div
            style={{
              color: "white",
              backgroundColor: "rgba(0,0,0,0.7)",
              padding: "5px",
              borderRadius: "3px",
              fontSize: "12px",
            }}
          >
            {isInXR ? "🥽 In VR Mode" : "⏳ Starting VR..."}
          </div>
        )}
      </div>

      {/* Right click menu */}
      {isMenuOpen && (
        <div
          className="menu"
          style={{
            position: "absolute",
            maxWidth: "250px",
            top: `${menuPosition.top - 200}px`,
            left: `${menuPosition.left - 300}px`,
            fontSize: "14px",
          }}
        >
          {menuOptions.map((option, index) => (
            <div
              key={index}
              className="menu-option"
              onClick={option.action}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: option.action ? "pointer" : "default",
                paddingLeft: "10px",
                paddingRight: "10px",
                fontWeight:
                  selectedItemName && option.label === selectedItemName.name
                    ? "bold"
                    : "normal",
              }}
            >
              <span>{option.label}</span>
              {option.children && <span style={{ marginLeft: "auto" }}>▶</span>}

              {option.children && hoveredIndex === index && (
                <div
                  className="submenu"
                  style={{ position: "absolute", left: "100%", top: 0 }}
                >
                  {option.children.map((subOption, subIndex) => (
                    <div
                      key={subIndex}
                      className="menu-option"
                      onClick={subOption.action}
                      style={{
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        paddingLeft: "10px",
                        paddingRight: "10px",
                      }}
                    >
                      {subOption.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Measure details */}

      {showMeasure && (
        <>
          <div
            style={{
              position: "absolute",
              top: "33%",
              left: 0,
              display: "flex",
              flexDirection: "row",
              zIndex: 9999,
              fontSize: "13px",
            }}
          >
            {showMeasureDetails ? (
              <>
                <div className="measureInfo" style={{ left: 0, zIndex: 1 }}>
                  <table class="measureInfoTable">
                    <tbody>
                      <tr class="bottomBordered">
                        <th class="measureCornerCell left"></th>
                        <th>X</th>
                        <th>Y</th>
                        <th>Z</th>
                      </tr>
                      <tr>
                        <th class="left">
                          P<sub>1</sub>
                        </th>
                        <td>{point1 ? point1.x : ""}</td>
                        <td>{point1 ? point1.z : ""}</td>
                        <td>{point1 ? point1.y : ""}</td>
                      </tr>

                      <tr>
                        <th class="left">
                          P<sub>2</sub>
                        </th>
                        <td>{point1 ? point1.x : ""}</td>
                        <td>{point1 ? point1.z : ""}</td>
                        <td>{point1 ? point1.y : ""}</td>
                      </tr>
                      <tr>
                        <th class="left">Difference</th>
                        <td>{differences ? differences.diffX : ""}</td>
                        <td>{differences ? differences.diffZ : ""}</td>
                        <td>{differences ? differences.diffY : ""}</td>
                      </tr>
                      <tr class="topBordered">
                        <th class="left">Distance</th>
                        <td colspan="3">{distance ? distance : ""}</td>
                      </tr>
                      <tr class="topBordered">
                        <th class="left">Angle</th>
                        <td colspan="3">
                          hor:{angles ? angles.horizontalAngle : ""} &emsp; ver:
                          {angles ? angles.verticalAngle : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              ""
            )}
            <button
              onClick={handleShowMeasureDetails}
              className="vertical-button"
            >
              Measurements
            </button>
          </div>
        </>
      )}

      {/*showMeasureDetailsAbove */}

      {showMeasureDetailsAbove && (
        <div
          style={{
            position: "absolute",
            left: "20px",
            top: "50px",
            zIndex: 1,
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: "white",
            width: "80px",
          }}
        >
          {/* Top bar: total distance */}
          <div
            style={{
              backgroundColor: "orange",
              padding: "4px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {distance ? distance : ""}
          </div>

          {/* X, Y, Z labels and values */}
          <div style={{ display: "flex", flexDirection: "row" }}>
            {/* Axis labels */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  backgroundColor: "red",
                  padding: "4px",
                  textAlign: "center",
                  color: "white",
                }}
              >
                X
              </div>
              <div
                style={{
                  backgroundColor: "green",
                  padding: "4px",
                  textAlign: "center",
                  color: "white",
                }}
              >
                Y
              </div>
              <div
                style={{
                  backgroundColor: "blue",
                  padding: "4px",
                  textAlign: "center",
                  color: "white",
                }}
              >
                Z
              </div>
            </div>

            {/* Axis values */}
            <div style={{ backgroundColor: "#222", flexGrow: 1 }}>
              <div
                style={{
                  padding: "4px 6px",
                  borderBottom: "1px solid #333",
                }}
              >
                {differences ? differences.diffX : ""}
              </div>
              <div
                style={{
                  padding: "4px 6px",
                  borderBottom: "1px solid #333",
                }}
              >
                {differences ? differences.diffY : ""}
              </div>
              <div style={{ padding: "4px 6px" }}>
                {differences ? differences.diffZ : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* comment info*/}
      {showComment && commentinfotable && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "90vh",
            backgroundColor: "#272626",
            padding: "20px",
            boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            color: "#fff",
          }}
        >
          {/* Close button */}
          <div
            className="w-100"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button className="btn btn-dark" onClick={handleclosecommentinfo}>
              <i class="fa-solid fa-xmark"></i>
            </button>
            <div
              className="btn btn-dark"
              onClick={() => handleDeleteComment(commentinfo.number)}
            >
              <i class="fa-solid fa-trash"></i>
            </div>
            {commentinfo.status !== "closed" &&
              (isEditing ? (
                <div
                  className="btn btn-dark"
                  onClick={() => handleSaveButtonClick(commentinfo.number)}
                >
                  <i className="fa-solid fa-save"></i>
                </div>
              ) : (
                <div
                  className="btn btn-dark"
                  onClick={() => handleEditButtonClick(commentinfo)}
                >
                  <i className="fa-solid fa-pencil"></i>
                </div>
              ))}
          </div>
          <div>
            <h6 className="text-center">Comment Info </h6>
            <p>
              <strong>Comment No:</strong>
              {commentinfo.number}
            </p>
            <p>
              <strong>Comment:</strong>
              {isEditing ? (
                <textarea
                  value={editedCommentData.comment || ""}
                  onChange={(e) => handleChange("comment", e.target.value)}
                  style={{ width: "100%" }}
                />
              ) : (
                commentinfo.comment
              )}
            </p>
            <p>
              <strong>Date:</strong>
              {commentinfo.createddate}
            </p>
            <p>
              <strong>Created:</strong>
              {commentinfo.createdby}
            </p>
            <p>
              <strong>Status:</strong>
              {isEditing ? (
                <select
                  value={editedCommentData.status || ""}
                  onChange={(e) => handleChange("status", e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="" disabled>
                    Choose status
                  </option>
                  {allCommentStatus.map((statusOption) => (
                    <option
                      key={statusOption.statusname}
                      value={statusOption.statusname}
                    >
                      {statusOption.statusname}
                    </option>
                  ))}
                </select>
              ) : (
                commentinfo.status
              )}
            </p>
            <div>
              <strong>Priority:</strong>
              {isEditing ? (
                <div style={{ display: "flex" }}>
                  {[1, 2, 3].map((priority, index) => (
                    <div key={priority} style={{ marginRight: "15px" }}>
                      <input
                        type="radio"
                        name={`priority-${index}`}
                        id={`priority-${index}-${priority}`}
                        value={priority.toString()}
                        checked={
                          editedCommentData.priority === priority.toString()
                        }
                        onChange={() =>
                          handlePriorityChange(priority.toString())
                        }
                      />
                      <label htmlFor={`priority-${index}-${priority}`}>
                        {priority}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                commentinfo.priority
              )}
            </div>
            {commentinfo.closedBy ? (
              <p>
                <strong>Closed By:</strong>
                {commentinfo.closedBy}
              </p>
            ) : (
              ""
            )}
            {commentinfo.closedDate ? (
              <p>
                <strong>Closed By:</strong>
                {commentinfo.closedDate}
              </p>
            ) : (
              ""
            )}
          </div>
        </div>
      )}

      {/* Render tag info */}
      {lineEqpInfo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "90vh",
            backgroundColor: "#272626",
            padding: "20px",
            boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            color: "#fff",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-light" onClick={handleCloselineEqpInfo}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div>
            {/* Display your tag information here */}
            <h5 className="text-center fw-bold ">
              {selectedMeshInfo.detailsType === "Equipment"
                ? "Equipment Info"
                : selectedMeshInfo.detailsType === "Line"
                ? "Line Info"
                : selectedMeshInfo.detailsType === "Valve"
                ? "Valve Info"
                : "Asset Info"}
            </h5>

            {/* Basic mesh info */}
            <div
              style={{
                marginBottom: "20px",
                borderBottom: "1px solid #444",
                paddingBottom: "10px",
              }}
            >
              <p>
                <strong>Tag Name:</strong> {selectedMeshInfo.parentFileName}
              </p>
              {selectedMeshInfo.tagDetails && (
                <>
                  <p>
                    <strong>Type:</strong> {selectedMeshInfo.tagDetails.type}
                  </p>
                  {selectedMeshInfo.tagDetails.parenttag && (
                    <p>
                      <strong>Parent Tag:</strong>{" "}
                      {selectedMeshInfo.tagDetails.parenttag}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Equipment Details */}
            {selectedMeshInfo.detailsType === "Equipment" &&
              selectedMeshInfo.additionalDetails && (
                <div>
                  <h6 style={{ color: "#f4b740", marginBottom: "15px" }}>
                    Equipment Details
                  </h6>
                  <p>
                    <strong>Description:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.descr || "N/A"}
                  </p>
                  <p>
                    <strong>Quantity:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.qty || "N/A"}
                  </p>
                  <p>
                    <strong>Capacity:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.capacity || "N/A"}
                  </p>
                  <p>
                    <strong>Equipment Type:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.type || "N/A"}
                  </p>
                  <p>
                    <strong>Materials:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.materials || "N/A"}
                  </p>
                  <p>
                    <strong>Capacity/Duty:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.capacityDuty || "N/A"}
                  </p>
                  <p>
                    <strong>Dimensions:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.dims || "N/A"}
                  </p>
                  <p>
                    <strong>Design Pressure:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.dsgnPress || "N/A"}
                  </p>
                  <p>
                    <strong>Operating Pressure:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.opPress || "N/A"}
                  </p>
                  <p>
                    <strong>Design Temperature:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.dsgnTemp || "N/A"}
                  </p>
                  <p>
                    <strong>Operating Temperature:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.opTemp || "N/A"}
                  </p>
                  <p>
                    <strong>Dry Weight:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.dryWeight || "N/A"}
                  </p>
                  <p>
                    <strong>Operating Weight:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.opWeight || "N/A"}
                  </p>
                  <p>
                    <strong>Supplier:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.supplier || "N/A"}
                  </p>
                  <p>
                    <strong>Remarks:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.remarks || "N/A"}
                  </p>
                  <p>
                    <strong>Initial Status:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.initStatus || "N/A"}
                  </p>
                  <p>
                    <strong>Revision:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.revision || "N/A"}
                  </p>
                  <p>
                    <strong>Revision Date:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.revisionDate || "N/A"}
                  </p>
                </div>
              )}

            {/* Line Details */}
            {selectedMeshInfo.detailsType === "Line" &&
              selectedMeshInfo.additionalDetails && (
                <div>
                  <h6 style={{ color: "#17a2b8", marginBottom: "15px" }}>
                    Line Details
                  </h6>
                  <p>
                    <strong>Fluid Code:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.fluidCode || "N/A"}
                  </p>
                  <p>
                    <strong>Medium:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.medium || "N/A"}
                  </p>
                  <p>
                    <strong>Line Size (inch):</strong>{" "}
                    {selectedMeshInfo.additionalDetails.lineSizeIn || "N/A"}
                  </p>
                  <p>
                    <strong>Line Size (NB):</strong>{" "}
                    {selectedMeshInfo.additionalDetails.lineSizeNb || "N/A"}
                  </p>
                  <p>
                    <strong>Piping Spec:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.pipingSpec || "N/A"}
                  </p>
                  <p>
                    <strong>Insulation Type:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.insType || "N/A"}
                  </p>
                  <p>
                    <strong>Insulation Thickness:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.insThickness || "N/A"}
                  </p>
                  <p>
                    <strong>Heat Tracing:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.heatTrace || "N/A"}
                  </p>
                  <p>
                    <strong>Line From:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.lineFrom || "N/A"}
                  </p>
                  <p>
                    <strong>Line To:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.lineTo || "N/A"}
                  </p>
                  <p>
                    <strong>MOP:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.maxOpPress || "N/A"}
                  </p>
                  <p>
                    <strong>MOT:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.maxOpTemp || "N/A"}
                  </p>
                  <p>
                    <strong>Design Pressure:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.dsgnPress || "N/A"}
                  </p>
                  <p>
                    <strong>Min Design Temp:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.minDsgnTemp || "N/A"}
                  </p>
                  <p>
                    <strong>Max Design Temp:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.maxDsgnTemp || "N/A"}
                  </p>
                  <p>
                    <strong>Test Pressure:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.testPress || "N/A"}
                  </p>
                  <p>
                    <strong>Test Medium:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.testMedium || "N/A"}
                  </p>
                  <p>
                    <strong>Test Medium Phase:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.testMediumPhase ||
                      "N/A"}
                  </p>
                  <p>
                    <strong>Mass Flow:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.massFlow || "N/A"}
                  </p>
                  <p>
                    <strong>Volume Flow:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.volFlow || "N/A"}
                  </p>
                  <p>
                    <strong>Density:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.density || "N/A"}
                  </p>
                  <p>
                    <strong>Velocity:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.velocity || "N/A"}
                  </p>
                  <p>
                    <strong>Paint System:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.paintSystem || "N/A"}
                  </p>
                  <p>
                    <strong>NDT Group:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.ndtGroup || "N/A"}
                  </p>
                  <p>
                    <strong>Chemical Cleaning:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.chemCleaning || "N/A"}
                  </p>
                  <p>
                    <strong>PWHT:</strong>{" "}
                    {selectedMeshInfo.additionalDetails.pwht || "N/A"}
                  </p>
                </div>
              )}

            {/* Valve Details */}
            {selectedMeshInfo.detailsType === "Valve" &&
              selectedMeshInfo.additionalDetails && (
                <div>
                  <h6 style={{ color: "#28a745", marginBottom: "15px" }}>
                    Valve Details
                  </h6>
                  {/* Add valve-specific fields based on your valve data structure */}
                  {Object.entries(selectedMeshInfo.additionalDetails).map(
                    ([key, value]) => (
                      <p key={key}>
                        <strong>
                          {key.charAt(0).toUpperCase() + key.slice(1)}:
                        </strong>{" "}
                        {value || "N/A"}
                      </p>
                    )
                  )}
                </div>
              )}

            {/* No additional details available */}
            {!selectedMeshInfo.additionalDetails &&
              selectedMeshInfo.detailsType && (
                <div
                  style={{
                    marginTop: "20px",
                    textAlign: "center",
                    color: "#6c757d",
                  }}
                >
                  <p>
                    No additional {selectedMeshInfo.detailsType.toLowerCase()}{" "}
                    details available
                  </p>
                </div>
              )}

            {/* No tag details at all */}
            {!selectedMeshInfo.detailsType && (
              <div
                style={{
                  marginTop: "20px",
                  textAlign: "center",
                  color: "#6c757d",
                }}
              >
                <p>No tag information available for this mesh</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* file info */}
      {showFileInfo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100vh",
            backgroundColor: "#272626",
            padding: "20px",
            boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-light" onClick={handleCloseFileInfo}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div>
            {/* Display your tag information here */}
            <h5 className="text-center fw-bold ">File Info </h5>
            {/* <p>{taginfo.fileid}</p> */}
            <p>
              <strong>Filename:</strong>
              {selectedMeshInfo.parentFileName}
            </p>
            <p>
              <strong>Created:</strong>{" "}
              {new Date(
                selectedMeshInfo.fileMetadata.createdDate
              ).toLocaleDateString()}
            </p>
            <p>
              <strong>Modified:</strong>{" "}
              {new Date(
                selectedMeshInfo.fileMetadata.modifiedDate
              ).toLocaleDateString()}
            </p>
            <p>
              <strong>Accessed:</strong>{" "}
              {new Date(
                selectedMeshInfo.fileMetadata.accessedDate
              ).toLocaleDateString()}
            </p>
            <p>
              <strong>Size:</strong>{" "}
              {(selectedMeshInfo.fileMetadata.fileSize / (1024 * 1024)).toFixed(
                2
              )}{" "}
              MB
            </p>
          </div>
        </div>
      )}

      {/* user tag info */}
      {tagInfoVisible && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "90vh",
            backgroundColor: "#272626",
            padding: "20px",
            boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            color: "#fff",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-light" onClick={handleCloseTagInfo}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div>
            <h5 className="text-center fw-bold">General Tag Info</h5>
            <p>Filename: {selectedMeshInfo.parentFileName}</p>

            {selectedMeshInfo.extraTableData ? (
              <>
                {generalTagInfoFields.slice(0, 16).map(({ id, field }) => {
                  const key = `taginfo${id}`;
                  const originalValue =
                    selectedMeshInfo.originalUsertagInfoDetails?.[key];

                  // Display the field with unit if the value exists, otherwise show "N/A"
                  const label =
                    originalValue !== null && originalValue !== undefined
                      ? `${field} `
                      : `${field}`; // Still show the field and unit even if the value is null or undefined

                  return (
                    <p key={key}>
                      {label}:{" "}
                      {originalValue !== null && originalValue !== undefined
                        ? originalValue
                        : "N/A"}
                    </p>
                  );
                })}
              </>
            ) : (
              <p>No additional information available.</p>
            )}
          </div>
        </div>
      )}

      {speedBar}

      {/*saved view modal box */}

      <Modal
        onHide={handleCloseSavedView}
        show={savedViewDialog}
        backdrop="static"
        keyboard={false}
        dialogClassName="custom-modal"
      >
        <div className="save-dialog">
          <div className="title-dialog">
            <p className="text-light">Save view</p>
            <p className="text-light cross" onClick={handleCloseSavedView}>
              &times;
            </p>
          </div>
          <div className="dialog-input">
            <label>Name*</label>
            <input
              type="text"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
            />
          </div>
          <div
            className="dialog-button"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={handleCloseSavedView}
            >
              Cancel
            </button>
            <button className="btn btn-dark" onClick={handleSaveView}>
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* All Saved view */}
      <div className="circle-containerthree">
        {allSavedViews.length > 0 &&
          allSavedViews.map((view, index) => (
            <div
              key={view.name}
              className="circle"
              onClick={() => applySavedView(view)}
              title={view.name}
            >
              {index + 1}
            </div>
          ))}
      </div>

      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete this comment?"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default BabylonLODManager;
