import React, { useEffect, useRef, useState, useCallback } from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/gui";
import { FreeCameraMouseInput } from "../Utils/FlyControls";
import { FreeCameraTouchInput } from "../Utils/TouchControls";

class WebWorkerTilesetLODManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
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
    console.log(
      "Initializing web workers for mesh loading, disposal, frustum culling, and distance calculation..."
    );

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
        console.log(
          `Worker for depth ${depth} created, waiting for ready signal...`
        );
      });

      console.log("Web workers created, waiting for initialization...");
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
        console.log(`Worker for depth ${depth} is ready`);
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
        console.log(
          `Worker skipped node ${nodeNumber} at depth ${depth}: ${reason}`
        );
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
        console.log("Disposal worker cache cleared");
        break;

      case "DISPOSAL_STATS":
        console.log("Disposal worker stats:", stats);
        break;

      // Frustum culling worker message types
      case "FRUSTUM_UPDATED":
        this.workerLoadCounts.set(
          "frustum",
          Math.max(0, this.workerLoadCounts.get("frustum") - 1)
        );
        console.log(`Frustum updated with ${event.data.planesCount} planes`);
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
        console.log("Frustum worker cache cleared");
        break;

      case "CULLING_STATS":
        console.log("Frustum worker stats:", stats);
        break;

      case "BUFFER_MULTIPLIER_SET":
        console.log(
          `Frustum buffer multiplier set to ${event.data.bufferMultiplier}`
        );
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
        console.log("Distance calculation worker initialized with node data");
        this.distanceWorkerInitialized = true;
        this.pendingRequests.delete(requestId);
        // Now we can start depth 2 loading
        console.log("Starting depth 2 loading...");
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
        console.log("Distance worker nodes updated");
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
      console.log(
        "All workers (including disposal, frustum, and distance workers) are ready!"
      );

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

    console.log(`Initializing distance worker with ${nodeData.length} nodes`);
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

      console.log(
        `Distance calculation: ${statistics.calculationTime.toFixed(2)}ms for ${
          statistics.processedNodes
        } nodes`
      );
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
      console.log(
        `Updated visibility for ${updatedCount} meshes via distance worker`
      );
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

    console.log(
      `Frustum culling: V:${visible.length} H:${hidden.length} D:${dispose.length} R:${reload.length}`
    );

    // Update visibility states
    visible.forEach((nodeNumber) => {
      this.nodeVisibilityStates.set(nodeNumber, "visible");
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && !mesh.isVisible) {
        mesh.isVisible = true;
        console.log(`Frustum: Showing mesh ${nodeNumber}`);
      }
    });

    hidden.forEach((nodeNumber) => {
      this.nodeVisibilityStates.set(nodeNumber, "hidden");
      const mesh = this.activeMeshes.get(nodeNumber);
      if (mesh && mesh.isVisible) {
        mesh.isVisible = false;
        console.log(`Frustum: Hiding mesh ${nodeNumber}`);
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
        console.log(
          `Frustum: Disposed ${filteredDispose.length} meshes outside buffer`
        );
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
            console.log(
              `Frustum: Reloading mesh ${nodeNumber} at depth ${depth}`
            );
          }
        }
      });
    }
  }

  // Handle mesh disposal completion
  handleMeshDisposed(requestId, nodeNumber, priority) {
    console.log(
      `Mesh disposal completed for node ${nodeNumber} (priority: ${priority})`
    );
    this.pendingRequests.delete(requestId);

    // Additional cleanup if needed
    // Note: The actual Babylon.js mesh disposal happens on the main thread
    // The worker just handles the disposal coordination and queuing
  }

  // Handle batch disposal completion
  handleBatchDisposed(requestId, results, stats) {
    console.log(
      `Batch disposal completed: ${stats.successCount}/${stats.totalCount} meshes disposed`
    );

    results.forEach((result) => {
      if (result.success) {
        console.log(`Successfully disposed mesh for node ${result.nodeNumber}`);
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

            console.log(
              `Successfully loaded mesh for node ${nodeNumber} at depth ${depth} (visible: ${shouldBeVisible})`
            );
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

    console.log(
      `Added node ${nodeNumber} (depth ${depth}) to queue: priority=${finalPriority.toFixed(
        1
      )}, importance=${importance.toFixed(1)}`
    );
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

    console.log(
      `Requested disposal for ${nodeNumbers.length} nodes with priority ${priority}`
    );
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

    console.log(
      `Requested mesh load for node ${nodeNumber} at depth ${depth} (${
        isUrgent ? "URGENT" : "normal"
      }, priority: ${priority.toFixed(1)})`
    );
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
    console.log("Loading all depth 2 meshes immediately (base LOD level)...");

    try {
      const depth2Nodes = this.getNodesAtDepth(2);
      console.log(
        `Found ${depth2Nodes.length} depth 2 nodes to load immediately`
      );

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

      console.log(
        `Sending batch request to depth 2 worker for ${depth2Nodes.length} nodes`
      );
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

    console.log(
      `Batch loaded for depth ${depth}: ${results.length} items processed`
    );
    if (stats) {
      console.log(
        `Stats: ${stats.successCount} loaded, ${stats.skippedCount} skipped, ${stats.totalCount} total`
      );
    }

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
              console.log(`Batch loaded mesh for node ${result.nodeNumber}`);
            }
          } catch (error) {
            console.error(
              `Error creating batch mesh for node ${result.nodeNumber}:`,
              error
            );
          }
        } else if (result.skipped) {
          // Skip nodes without mesh data - this is normal, not an error
          console.log(`Skipped node ${result.nodeNumber}: ${result.reason}`);
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
        console.log(
          `Depth 2 initial loading completed. ${
            stats?.successCount || 0
          } meshes loaded.`
        );
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
      console.log(
        `Mesh for node ${nodeNumber} at depth ${depth} already loaded`
      );
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

    console.log(
      `Created mesh for node ${nodeNumber} in ${(
        performance.now() - startTime
      ).toFixed(2)}ms`
    );
    return mesh;
  }

  addMeshUtilityMethods(mesh) {
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

    // Enhanced highlight function
    mesh.highlightOriginalMesh = function (meshId) {
      const mapping = this.metadata.vertexMappings.find(
        (m) => m.meshId === meshId
      );
      if (!mapping) return;

      let colors = this.getVerticesData(BABYLON.VertexBuffer.ColorKind);

      // If no colors exist, create them
      if (!colors) {
        const vertexCount =
          this.getVerticesData(BABYLON.VertexBuffer.PositionKind).length / 3;
        colors = new Float32Array(vertexCount * 4);
      }

      // Reset all to default color
      for (let i = 0; i < colors.length; i += 4) {
        colors[i] = 1; // R
        colors[i + 1] = 0.3; // G (reddish for default)
        colors[i + 2] = 0.3; // B
        colors[i + 3] = 1; // A
      }

      // Highlight selected range in yellow
      for (
        let i = mapping.start * 4;
        i < (mapping.start + mapping.count) * 4;
        i += 4
      ) {
        colors[i] = 1; // R (yellow highlight)
        colors[i + 1] = 1; // G
        colors[i + 2] = 0; // B
        colors[i + 3] = 1; // A
      }

      this.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);

      // Enable vertex colors on material if not already enabled
      if (this.material && !this.material.useVertexColors) {
        this.material.useVertexColors = true;
      }
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
        console.log(`Unloading mesh for node ${nodeNumber}`);
        mesh.dispose();
        this.activeMeshes.delete(nodeNumber);
        this.loadedNodeNumbers.delete(nodeNumber);
      }
    });
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

    console.log(
      `Progressive distance thresholds set: Max = ${this.maxDistance.toFixed(
        1
      )}, 30% = ${this.threshold30Percent.toFixed(
        1
      )}, 80% = ${this.threshold80Percent.toFixed(1)}`
    );
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
      console.log(
        `Processed nodes: Depth 2: ${
          this.getNodesAtDepth(2).length
        }, Depth 3: ${this.getNodesAtDepth(3).length}, Depth 4: ${
          this.getNodesAtDepth(4).length
        }`
      );
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

    console.log("Requested disposal worker cache clear");
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

    console.log(
      `Adjusted: meshCreationBudget=${this.meshCreationBudget}ms, maxMeshesPerFrame=${this.maxMeshesPerFrame}`
    );
  }

  // MODIFIED: Enhanced dispose method
  dispose() {
    console.log("Disposing WebWorker TilesetLODManager...");

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

const BabylonLODManager = () => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRef = useRef(null);
  const lodManagerRef = useRef(null);
  const fileInputRef = useRef(null);

  const distanceThresholdRef = useRef(null);

  const modelInfoRef = useRef({ modelRadius: 1000 }); // For camera sensitivity

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

  // State tracking exactly as in original code
  const [loadedMeshes, setLoadedMeshes] = useState([]);
  const [fileCounter, setFileCounter] = useState(0);

  // Constants exactly as in original
  const maxDepth = 4;
  const capacity = 1;
  const MAX_DEPTH = 4;
  const MIN_SIZE = 0;
  const meshIdCounter = useRef({ current: 1 });
  const processedMeshesRef = useRef(new Map());
  const dbConnectionRef = useRef(null);
  const TARGET_DEPTH = 4;
  const CHUNK_SIZE = 3;
  const STORE_CHUNK_SIZE = 25;

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
      console.log("Creating emergency camera...");
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

const createWebXRCamera = useCallback(async (scene, currentCamera) => {
  try {
    console.log('Setting up WebXR camera...');
    
    // STEP 1: Store current camera state BEFORE any changes
    const cameraState = {
      position: currentCamera.position.clone(),
      target: currentCamera.target ? currentCamera.target.clone() : currentCamera.getTarget().clone(),
      rotation: currentCamera.rotation ? currentCamera.rotation.clone() : null,
      alpha: currentCamera.alpha || 0,
      beta: currentCamera.beta || 0,
      radius: currentCamera.radius || 0,
      fov: currentCamera.fov || Math.PI/4,
      type: currentCamera.constructor.name
    };
    
    setPreVRCameraState(cameraState);
    console.log('Stored camera state:', cameraState);
    
    // Store current camera as fallback
    fallbackCameraRef.current = currentCamera;
    
    // For testing without headset, use a mock XR experience
    if (forceVRMode && !('xr' in navigator)) {
      return createMockVRExperienceWithPosition(scene, cameraState);
    }
    
    // STEP 2: Create XR experience
    const xrHelper = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [],
      disableTeleportation: false,
      useCustomVRButton: false,
      // Try to disable automatic position reset
      optionalFeatures: ['local-floor', 'bounded-floor']
    });
    
    xrHelperRef.current = xrHelper;
    
    // STEP 3: Force position IMMEDIATELY after creation
    if (xrHelper.input.xrCamera) {
      console.log('Setting XR camera position immediately');
      setWebXRCameraPositionImmediate(xrHelper, cameraState);
    }
    
    // STEP 4: Set up event handlers with position forcing
    xrHelper.baseExperience.onInitialXRPoseSetObservable.add(() => {
      console.log('XR pose set - forcing camera position again');
      setWebXRCameraPositionImmediate(xrHelper, cameraState);
    });
    
    xrHelper.baseExperience.onStateChangedObservable.add((state) => {
      switch (state) {
        case BABYLON.WebXRState.IN_XR:
          console.log('Entered XR - final position set');
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
          console.log('Exiting XR - restoring camera position');
          setIsInXR(false);
          restoreCameraState(scene, cameraState);
          break;
          
        case BABYLON.WebXRState.NOT_IN_XR:
          console.log('Not in XR');
          setIsInXR(false);
          break;
      }
    });
    
    return xrHelper;
    
  } catch (error) {
    console.error('Failed to create WebXR camera:', error);
    
    // Fallback to mock VR for testing
    if (forceVRMode && preVRCameraState) {
      return createMockVRExperienceWithPosition(scene, preVRCameraState);
    }
    
    throw error;
  }
}, [forceVRMode]);

// Improved position setting function
const setWebXRCameraPositionImmediate = useCallback((xrHelper, cameraState) => {
  if (!xrHelper.input.xrCamera || !cameraState) {
    console.warn('Cannot set XR camera position: missing camera or state');
    return;
  }
  
  try {
    const xrCamera = xrHelper.input.xrCamera;
    
    console.log('Setting XR camera position to:', cameraState.position);
    console.log('Setting XR camera target to:', cameraState.target);
    
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
    
    console.log('XR camera positioned at:', xrCamera.position);
    console.log('XR camera target:', xrCamera.getTarget());
    
  } catch (error) {
    console.error('Error setting XR camera position:', error);
  }
}, []);

// Mock VR experience with preserved position
const createMockVRExperienceWithPosition = useCallback((scene, cameraState) => {
  console.log('Creating mock VR experience with preserved position');
  
  // Create camera with EXACT same position
  const mockVRCamera = new BABYLON.UniversalCamera("mockVRCamera", cameraState.position.clone(), scene);
  mockVRCamera.setTarget(cameraState.target.clone());
  mockVRCamera.fov = cameraState.fov;
  mockVRCamera.minZ = 0.1;
  mockVRCamera.maxZ = 1000000;
  
  // Set as active camera
  scene.activeCamera = mockVRCamera;
  mockVRCamera.attachControl(canvasRef.current, false);
  
  console.log('Mock VR camera positioned at:', mockVRCamera.position);
  console.log('Mock VR camera target:', mockVRCamera.getTarget());
  
  setIsInXR(true);
  setCameraType("webxr");
  
  return {
    input: { xrCamera: mockVRCamera },
    baseExperience: {
      onStateChangedObservable: {
        add: (callback) => {
          setTimeout(() => callback(BABYLON.WebXRState.ENTERING_XR), 100);
          setTimeout(() => callback(BABYLON.WebXRState.IN_XR), 500);
        }
      }
    },
    dispose: () => mockVRCamera.dispose()
  };
}, []);

// Function to restore camera state when exiting VR
const restoreCameraState = useCallback((scene, cameraState) => {
  if (!cameraState || !fallbackCameraRef.current) {
    console.warn('Cannot restore camera state: missing state or fallback camera');
    return;
  }
  
  try {
    const camera = fallbackCameraRef.current;
    
    console.log('Restoring camera to position:', cameraState.position);
    console.log('Restoring camera target:', cameraState.target);
    
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
    setCameraType(cameraState.type.includes('ArcRotate') ? "orbit" : "fly");
    
    // Update LOD manager
    if (lodManagerRef.current) {
      lodManagerRef.current.camera = camera;
      lodManagerRef.current.lastCameraPosition = null;
      lodManagerRef.current.update();
    }
    
    console.log('Camera state restored successfully');
    
  } catch (error) {
    console.error('Error restoring camera state:', error);
    createEmergencyCamera(scene);
  }
}, [createEmergencyCamera]);


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
      console.log(`Mesh creation budget set to ${budget}ms`);
    }
  }, []);

  const adjustMaxMeshesPerFrame = useCallback((count) => {
    if (lodManagerRef.current) {
      lodManagerRef.current.maxMeshesPerFrame = Math.max(1, Math.min(5, count));
      console.log(`Max meshes per frame set to ${count}`);
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

  // // Initialize cameras
  // const initializeCameras = useCallback(
  //   (scene) => {
  //     const orbitCamera = createOrbitCamera(scene);
  //     orbitCamera.attachControl(canvasRef.current, false);
  //     scene.activeCamera = orbitCamera;
  //     cameraRef.current = orbitCamera;
  //     setCameraType("orbit");
  //   },
  //   [createOrbitCamera]
  // );

  // // Toggle between camera types
  // const toggleCamera = useCallback(
  //   (type) => {
  //     if (
  //       !sceneRef.current ||
  //       !engineRef.current ||
  //       !sceneRef.current.activeCamera
  //     )
  //       return;

  //     const scene = sceneRef.current;
  //     const canvas = canvasRef.current;
  //     const currentCamera = scene.activeCamera;
  //     const cameraPosition = currentCamera.position.clone();
  //     const cameraTarget = currentCamera.target
  //       ? currentCamera.target.clone()
  //       : currentCamera.getTarget().clone();

  //     currentCamera.dispose();

  //     let newCamera;
  //     if (type === "fly") {
  //       newCamera = createFlyCamera(scene, cameraPosition, cameraTarget);
  //     } else {
  //       newCamera = createOrbitCamera(scene, cameraPosition, cameraTarget);
  //     }

  //     newCamera.attachControl(canvas, false);
  //     scene.activeCamera = newCamera;

  //     cameraRef.current = newCamera;
  //     setCameraType(type);

  //     // Update LOD manager with new camera
  //     if (lodManagerRef.current) {
  //       lodManagerRef.current.camera = newCamera;
  //       lodManagerRef.current.lastCameraPosition = null;
  //       lodManagerRef.current.update();
  //     }
  //   },
  //   [createFlyCamera, createOrbitCamera]
  // );

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

  // Function to calculate cumulative bounding box
  const calculateCumulativeBoundingBox = useCallback((meshes) => {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach((mesh) => {
      if (!mesh.isVisible || !mesh.geometry) return;
      const boundingInfo = mesh.getBoundingInfo();
      const worldMatrix = mesh.computeWorldMatrix(true);

      const localMin = boundingInfo.boundingBox.minimumWorld;
      const localMax = boundingInfo.boundingBox.maximumWorld;

      min = BABYLON.Vector3.Minimize(min, localMin);
      max = BABYLON.Vector3.Maximize(max, localMax);
    });

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);
    const padding = maxDimension * 0.01;

    min = min.add(new BABYLON.Vector3(-padding, -padding, -padding));
    max = max.add(new BABYLON.Vector3(padding, padding, padding));

    console.log("Cumulative Bounding Box:", {
      min: min.asArray(),
      max: max.asArray(),
      size: size.asArray(),
    });

    return { minimum: min, maximum: max };
  }, []);

  // Function to position camera
  const positionCameraForBoundingBox = useCallback((minimum, maximum) => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const center = BABYLON.Vector3.Center(minimum, maximum);
    const size = maximum.subtract(minimum);
    const maxDimension = Math.max(size.x, size.y, size.z);

    camera.setTarget(center);
    camera.radius = maxDimension * 1.5;
    camera.alpha = Math.PI / 4;
    camera.beta = Math.PI / 3;

    camera.lowerRadiusLimit = maxDimension * 0.5;
    camera.upperRadiusLimit = maxDimension * 3;
    camera.wheelPrecision = maxDimension * 0.05;
  }, []);

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

  // Improved createOctreeBlock function
  const createOctreeBlock = (
    scene,
    minimum,
    maximum,
    meshInfos,
    depth = 0,
    parent = null
  ) => {
    console.log(
      `Creating block at depth ${depth}, received ${meshInfos.length} meshes`
    );

    // Ensure we have valid Vector3 objects for min and max
    const min =
      minimum instanceof BABYLON.Vector3
        ? minimum
        : new BABYLON.Vector3(minimum.x || 0, minimum.y || 0, minimum.z || 0);
    const max =
      maximum instanceof BABYLON.Vector3
        ? maximum
        : new BABYLON.Vector3(maximum.x || 0, maximum.y || 0, maximum.z || 0);

    // Create the basic octree block
    const block = new BABYLON.OctreeBlock(min, max, [], parent);
    block.depth = depth;
    block.nodeNumber = nodeCounter++;

    // For the root node, we include ALL meshes
    // For child nodes, we filter based on overlap
    const meshInfosInBlock =
      depth === 0
        ? [...meshInfos]
        : meshInfos.filter((meshInfo) => {
            if (!meshInfo || !meshInfo.boundingBox) return false;

            try {
              // Get the bounding box information
              let worldMin, worldMax;

              // Extract bounds based on available properties
              if (
                meshInfo.boundingBox.minimumWorld &&
                meshInfo.boundingBox.maximumWorld
              ) {
                worldMin = vectorFromAny(meshInfo.boundingBox.minimumWorld);
                worldMax = vectorFromAny(meshInfo.boundingBox.maximumWorld);
              } else if (
                meshInfo.transforms &&
                meshInfo.transforms.worldMatrix
              ) {
                const localMin = vectorFromAny(meshInfo.boundingBox.min);
                const localMax = vectorFromAny(meshInfo.boundingBox.max);

                // Create matrix for transformation
                const worldMatrix = Array.isArray(
                  meshInfo.transforms.worldMatrix
                )
                  ? BABYLON.Matrix.FromArray(meshInfo.transforms.worldMatrix)
                  : meshInfo.transforms.worldMatrix;

                // Transform to world space
                worldMin = BABYLON.Vector3.TransformCoordinates(
                  localMin,
                  worldMatrix
                );
                worldMax = BABYLON.Vector3.TransformCoordinates(
                  localMax,
                  worldMatrix
                );
              } else {
                // Use raw values with fallbacks
                worldMin = new BABYLON.Vector3(
                  meshInfo.boundingBox.min
                    ? meshInfo.boundingBox.min[0] || 0
                    : 0,
                  meshInfo.boundingBox.min
                    ? meshInfo.boundingBox.min[1] || 0
                    : 0,
                  meshInfo.boundingBox.min
                    ? meshInfo.boundingBox.min[2] || 0
                    : 0
                );
                worldMax = new BABYLON.Vector3(
                  meshInfo.boundingBox.max
                    ? meshInfo.boundingBox.max[0] || 0
                    : 0,
                  meshInfo.boundingBox.max
                    ? meshInfo.boundingBox.max[1] || 0
                    : 0,
                  meshInfo.boundingBox.max
                    ? meshInfo.boundingBox.max[2] || 0
                    : 0
                );
              }

              // Use bounding box overlap test
              const overlap = !(
                worldMin.x > max.x ||
                worldMax.x < min.x ||
                worldMin.y > max.y ||
                worldMax.y < min.y ||
                worldMin.z > max.z ||
                worldMax.z < min.z
              );

              return overlap;
            } catch (error) {
              console.error("Error checking mesh overlap:", error, meshInfo);
              return false;
            }
          });

    // Helper to convert any type to Vector3
    function vectorFromAny(value) {
      if (!value) return new BABYLON.Vector3(0, 0, 0);

      if (value instanceof BABYLON.Vector3) return value;

      if (Array.isArray(value)) {
        return new BABYLON.Vector3(value[0] || 0, value[1] || 0, value[2] || 0);
      }

      return new BABYLON.Vector3(value.x || 0, value.y || 0, value.z || 0);
    }

    // Store mesh info in block with consistent structure
    block.meshInfos = meshInfosInBlock.map((info) => ({
      id: info.metadata?.id || "unknown",
      boundingBox: info.boundingBox || null,
    }));

    // Update tracking variables
    if (!nodesAtDepth[depth]) nodesAtDepth[depth] = 0;
    nodesAtDepth[depth]++;

    if (!nodeNumbersByDepth[depth]) nodeNumbersByDepth[depth] = [];
    nodeNumbersByDepth[depth].push(block.nodeNumber);

    nodeDepths.set(block.nodeNumber, block.meshInfos);
    nodeContents.set(block.nodeNumber, block.meshInfos);

    // Update statistics for meshes
    if (meshInfosInBlock.length > 0) {
      if (!nodesAtDepthWithBoxes[depth]) nodesAtDepthWithBoxes[depth] = 0;
      nodesAtDepthWithBoxes[depth]++;

      if (!boxesAtDepth[depth]) boxesAtDepth[depth] = new Set();

      meshInfosInBlock.forEach((meshInfo) => {
        boxesAtDepth[depth].add(meshInfo.metadata?.id || "unknown");
      });
    }

    // Create child blocks if not at max depth and have meshes
    if (depth < MAX_DEPTH && meshInfosInBlock.length > 0) {
      const center = new BABYLON.Vector3(
        (min.x + max.x) / 2,
        (min.y + max.y) / 2,
        (min.z + max.z) / 2
      );

      block.blocks = [];

      // Create all 8 child octants
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            const childMin = new BABYLON.Vector3(
              x === 0 ? min.x : center.x,
              y === 0 ? min.y : center.y,
              z === 0 ? min.z : center.z
            );
            const childMax = new BABYLON.Vector3(
              x === 0 ? center.x : max.x,
              y === 0 ? center.y : max.y,
              z === 0 ? center.z : max.z
            );

            // Only process if we have meshes
            if (meshInfosInBlock.length > 0) {
              const childBlock = createOctreeBlock(
                scene,
                childMin,
                childMax,
                meshInfosInBlock,
                depth + 1,
                block
              );

              // Only add if the child has meshes or child blocks
              if (
                childBlock &&
                (childBlock.blocks?.length > 0 ||
                  childBlock.meshInfos?.length > 0)
              ) {
                block.blocks.push(childBlock);
                nodeParents.set(childBlock.nodeNumber, block.nodeNumber);
              }
            }
          }
        }
      }
    }

    // Add visualization if needed
    if (scene) {
      createWireframeBox(min, max, depth);
    }

    return block;
  };

  // Function to print octree structure
  const printOctreeStructure = useCallback(() => {
    console.log("\nOctree Structure:");
    for (let depth = 0; depth <= maxDepth; depth++) {
      console.log(`\nDepth ${depth}:`);
      console.log(`Nodes: ${meshState.nodeNumbersByDepth[depth].join(", ")}`);
      meshState.nodeNumbersByDepth[depth].forEach((nodeNum) => {
        const meshes = meshState.nodeContents.get(nodeNum);
        console.log(`Node ${nodeNum}: ${meshes?.length || 0} meshes`);
      });
    }
  }, [meshState, maxDepth]);

  // Function to verify mesh distribution
  const verifyMeshDistribution = useCallback(
    (allMeshes) => {
      console.log("\nMesh Distribution:");
      for (let depth = 0; depth <= maxDepth; depth++) {
        const meshesAtDepth = Array.from(meshState.boxesAtDepth[depth] || []);
        console.log(`Depth ${depth}: ${meshesAtDepth.length} meshes`);
      }
    },
    [meshState.boxesAtDepth, maxDepth]
  );

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

      console.log("Retrieved octree data:", octreeData);

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
      const lodManager = new WebWorkerTilesetLODManager(scene, camera);
      lodManagerRef.current = lodManager;

      // Helper function for merged mesh info (defined before setupPointerObservers)
      const showMergedMeshInfo = (pickedMesh) => {
        console.log("=== MERGED MESH DETAILS ===");
        const meta = pickedMesh.metadata;
        console.log("Merged Mesh Details:", {
          name: pickedMesh.name,
          nodeNumber: meta.nodeNumber || "N/A",
          depth: meta.depth || "N/A",
          originalMeshCount: meta.originalMeshCount || "N/A",
          totalVertices: pickedMesh.getTotalVertices(),
          totalIndices: pickedMesh.getTotalIndices(),
        });

        // Show all original meshes contained in this merged mesh
        if (
          meta.metadata.vertexMappings &&
          meta.metadata.vertexMappings.length > 0
        ) {
          console.log("Contains original meshes:");
          meta.vertexMappings.forEach((mapping, index) => {
            console.log(
              `  ${index + 1}. ${mapping.name || mapping.meshId} (${
                mapping.fileName
              })`
            );
          });
        }

        // Update React state for merged mesh
        setSelectedMeshInfo({
          type: "merged",
          name: pickedMesh.name,
          nodeNumber: meta.nodeNumber,
          depth: meta.depth,
          originalMeshCount: meta.originalMeshCount,
          totalVertices: pickedMesh.getTotalVertices(),
          totalIndices: pickedMesh.getTotalIndices(),
        });
      };

      // Setup pointer observers with proper scope
      // Replace the existing setupPointerObservers function with this enhanced version
      const setupPointerObservers = (scene, lodManager) => {
        console.log(
          "Setting up pointer observers for individual mesh selection and small mesh hiding"
        );

        // Remove any existing pointer observers
        if (scene.onPointerObservable.hasObservers()) {
          scene.onPointerObservable.clear();
        }

        // Main pointer event handler
        scene.onPointerObservable.add((pointerInfo) => {
          const camera = scene.activeCamera;
          if (!camera || !pointerInfo || !pointerInfo.event) return;

          try {
            switch (pointerInfo.type) {
              case BABYLON.PointerEventTypes.POINTERDOWN:
                handleMeshSelection(pointerInfo);

                break;

              case BABYLON.PointerEventTypes.POINTERUP:
                handleMeshSelection(pointerInfo);

                break;

              case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
                // Handle double-click to clear highlights
                if (pointerInfo.pickInfo && pointerInfo.pickInfo.pickedMesh) {
                  const pickedMesh = pointerInfo.pickInfo.pickedMesh;
                  if (typeof pickedMesh.clearHighlight === "function") {
                    pickedMesh.clearHighlight();
                    console.log("Cleared mesh highlighting");
                  }
                }
                break;
            }
          } catch (error) {
            console.error("Error in pointer event handler:", error);
            // Reset state on error
          }
        });

        // Helper function to handle mesh selection (existing logic)
        const handleMeshSelection = (pointerInfo) => {
          const pickResult = pointerInfo.pickInfo;

          // Add null check for pickResult
          if (!pickResult || !pickResult.hit || !pickResult.pickedMesh) {
            console.log("No mesh picked");
            return;
          }

          const pickedMesh = pickResult.pickedMesh;
          console.log(`=== CLICK DETECTED ===`);
          console.log(`Picked mesh: ${pickedMesh.name}`);
          console.log(`Face ID: ${pickResult.faceId}`);
          console.log(`Mesh metadata:`, pickedMesh.metadata);

          // Skip wireframes and non-LOD meshes
          if (
            pickedMesh.name.includes("octreeVisBox_") ||
            pickedMesh.name.includes("wireframe") ||
            !pickedMesh.metadata
          ) {
            console.log("Skipping non-LOD mesh or wireframe");
            return;
          }

          // Check if this is a merged mesh with vertex mappings
          if (
            pickedMesh.metadata.mergedVertexData?.vertexMappings &&
            pickResult.faceId !== undefined
          ) {
            console.log(
              `Attempting to identify individual mesh from face ${pickResult.faceId}`
            );
            console.log(
              `Available vertex mappings:`,
              pickedMesh.metadata.mergedVertexData.vertexMappings.length
            );

            // Check if the utility method exists
            if (typeof pickedMesh.getClickedOriginalMesh === "function") {
              const originalMeshInfo = pickedMesh.getClickedOriginalMesh(
                pickResult.faceId
              );

              if (originalMeshInfo) {
                console.log("=== INDIVIDUAL MESH DETAILS ===");
                console.log("Original Mesh Info:", {
                  meshId: originalMeshInfo.meshId,
                  meshIndex: originalMeshInfo.meshIndex,
                  fileName: originalMeshInfo.fileName,
                  name: originalMeshInfo.name,
                  metadataId: originalMeshInfo.metadataId,
                  screenCoverage: originalMeshInfo.screenCoverage,
                  nodeNumber: originalMeshInfo.nodeNumber,
                  faceId: originalMeshInfo.faceId,
                  relativeFaceId: originalMeshInfo.relativeFaceId,
                  vertexRange: `${originalMeshInfo.startVertex} - ${
                    originalMeshInfo.startVertex + originalMeshInfo.vertexCount
                  }`,
                  indexRange: `${originalMeshInfo.startIndex} - ${
                    originalMeshInfo.startIndex + originalMeshInfo.indexCount
                  }`,
                });

                // Highlight the individual mesh
                if (typeof pickedMesh.highlightOriginalMesh === "function") {
                  pickedMesh.highlightOriginalMesh(originalMeshInfo.meshId);
                }

                // Extract individual mesh data if the method exists
                if (
                  typeof pickedMesh.extractIndividualMeshData === "function"
                ) {
                  const individualMeshData =
                    pickedMesh.extractIndividualMeshData(
                      originalMeshInfo.meshIndex
                    );
                  if (individualMeshData) {
                    console.log("Individual Mesh Geometry:", {
                      vertexCount: individualMeshData.vertexCount,
                      indexCount: individualMeshData.indexCount,
                      hasNormals: !!individualMeshData.normals,
                      hasColors: !!individualMeshData.colors,
                    });
                  }

                  // Update UI state with individual mesh info
                  if (typeof setSelectedMeshInfo === "function") {
                    setSelectedMeshInfo({
                      type: "individual",
                      meshId: originalMeshInfo.meshId,
                      name: originalMeshInfo.name,
                      fileName: originalMeshInfo.fileName,
                      nodeNumber: originalMeshInfo.nodeNumber,
                      screenCoverage: originalMeshInfo.screenCoverage,
                      vertexCount: individualMeshData?.vertexCount || 0,
                      faceCount: Math.floor(
                        (individualMeshData?.indexCount || 0) / 3
                      ),
                    });
                  }
                } else {
                  console.warn(
                    "extractIndividualMeshData method not found on mesh"
                  );
                }
              } else {
                console.log(
                  "Could not identify individual mesh from clicked face"
                );
                showMergedMeshInfo(pickedMesh);
              }
            } else {
              console.warn("getClickedOriginalMesh method not found on mesh");
              showMergedMeshInfo(pickedMesh);
            }
          } else {
            console.log("No vertex mappings or face ID available");
            showMergedMeshInfo(pickedMesh);
          }
        };

        // Helper function for merged mesh info
        const showMergedMeshInfo = (pickedMesh) => {
          console.log("=== MERGED MESH DETAILS ===");
          const meta = pickedMesh.metadata;
          console.log("Merged Mesh Details:", {
            name: pickedMesh.name,
            nodeNumber: meta.nodeNumber || "N/A",
            depth: meta.depth || "N/A",
            originalMeshCount: meta.originalMeshCount || "N/A",
            totalVertices: pickedMesh.getTotalVertices(),
            totalIndices: pickedMesh.getTotalIndices(),
          });

          // Show all original meshes contained in this merged mesh
          if (
            meta.metadata?.vertexMappings &&
            meta.metadata.vertexMappings.length > 0
          ) {
            console.log("Contains original meshes:");
            meta.vertexMappings.forEach((mapping, index) => {
              console.log(
                `  ${index + 1}. ${mapping.name || mapping.meshId} (${
                  mapping.fileName
                })`
              );
            });
          }

          // Update React state for merged mesh
          if (typeof setSelectedMeshInfo === "function") {
            setSelectedMeshInfo({
              type: "merged",
              name: pickedMesh.name,
              nodeNumber: meta.nodeNumber,
              depth: meta.depth,
              originalMeshCount: meta.originalMeshCount,
              totalVertices: pickedMesh.getTotalVertices(),
              totalIndices: pickedMesh.getTotalIndices(),
            });
          }
        };

        console.log(
          "Pointer observers setup complete with mouse-based small mesh hiding"
        );
      };

      // Setup pointer observers
      setupPointerObservers(scene, lodManager);

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

  // File loading handler with all the original complex logic
  const handleFileLoad = useCallback(
    async (files) => {
      if (
        !files ||
        files.length === 0 ||
        !sceneRef.current ||
        !cameraRef.current
      )
        return;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      let newFileCounter = fileCounter;

      const calculateScreenCoverage = (mesh, camera, engine) => {
        try {
          // Get the bounding info
          const boundingInfo = mesh.getBoundingInfo();
          if (!boundingInfo) return 0;

          const boundingBox = boundingInfo.boundingBox;

          // Safely get the center and size
          const centerWorld = boundingBox.centerWorld || boundingBox.center;

          // Calculate size properly with null checks
          let minimumWorld = boundingBox.minimumWorld;
          let maximumWorld = boundingBox.maximumWorld;

          if (!minimumWorld || !maximumWorld) {
            // Fallback to local bounds if world bounds aren't available
            minimumWorld = boundingBox.minimum;
            maximumWorld = boundingBox.maximum;
          }

          // Safely calculate size
          const size = maximumWorld.subtract(minimumWorld);

          // Calculate dimensions safely
          const dimensions = [
            Math.abs(size.x) || 0.001,
            Math.abs(size.y) || 0.001,
            Math.abs(size.z) || 0.001,
          ];

          // Find maximum dimension
          const maxDimension = Math.max(...dimensions);

          // Get other dimensions
          const otherDimensions = dimensions.filter(
            (dim) => dim !== maxDimension
          );

          // Calculate average of other dimensions with fallback
          const averageOfOthers =
            otherDimensions.length > 0
              ? otherDimensions.reduce((a, b) => a + b, 0) /
                otherDimensions.length
              : maxDimension / 2;

          // Calculate screen radius with null checks
          const cameraRadius = camera.radius || 10; // Default if not available
          const radiusScreen = averageOfOthers / cameraRadius;

          // Get render width with fallback
          const renderWidth =
            engine && engine.getRenderWidth ? engine.getRenderWidth() : 1024; // Fallback to reasonable default

          return radiusScreen * renderWidth;
        } catch (error) {
          console.warn("Error calculating screen coverage:", error);
          return 0; // Return 0 as fallback
        }
      };

      const processMeshDataOffline = (meshDataArray) => {
        let totalVertices = 0;
        let totalIndices = 0;
        let hasColors = false;

        // First pass to determine sizes and if any mesh uses color
        meshDataArray.forEach((mesh) => {
          totalVertices += mesh.positions.length / 3;
          totalIndices += mesh.indices.length;
          if (mesh.color || mesh.colors) hasColors = true;
        });

        const mergedPositions = new Float32Array(totalVertices * 3);
        const mergedIndices = new Uint32Array(totalIndices);
        const mergedNormals = new Float32Array(totalVertices * 3);
        const mergedColors = hasColors
          ? new Float32Array(totalVertices * 4)
          : null;

        let vertexOffset = 0;
        let indexOffset = 0;

        meshDataArray.forEach((mesh) => {
          const vertexCount = mesh.positions.length / 3;

          // Handle transforms
          if (mesh.transforms) {
            const matrix = mesh.transforms.worldMatrix
              ? BABYLON.Matrix.FromArray(mesh.transforms.worldMatrix)
              : BABYLON.Matrix.Compose(
                  new BABYLON.Vector3(
                    ...Object.values(mesh.transforms.scaling)
                  ),
                  BABYLON.Quaternion.FromEulerAngles(
                    mesh.transforms.rotation[0],
                    mesh.transforms.rotation[1],
                    mesh.transforms.rotation[2]
                  ),
                  new BABYLON.Vector3(
                    ...Object.values(mesh.transforms.position)
                  )
                );

            for (let i = 0; i < vertexCount; i++) {
              const pos = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(
                  mesh.positions[i * 3],
                  mesh.positions[i * 3 + 1],
                  mesh.positions[i * 3 + 2]
                ),
                matrix
              );
              const targetIndex = (vertexOffset + i) * 3;
              mergedPositions[targetIndex] = pos.x;
              mergedPositions[targetIndex + 1] = pos.y;
              mergedPositions[targetIndex + 2] = pos.z;
            }
          } else {
            mergedPositions.set(mesh.positions, vertexOffset * 3);
          }

          // Normals
          if (mesh.normals) {
            mergedNormals.set(mesh.normals, vertexOffset * 3);
          }

          // Colors
          if (hasColors && mergedColors) {
            if (mesh.colors) {
              // Per-vertex colors already available
              mergedColors.set(mesh.colors, vertexOffset * 4);
            } else if (mesh.color) {
              // Fill with mesh color for each vertex
              for (let i = 0; i < vertexCount; i++) {
                const colorIndex = (vertexOffset + i) * 4;
                mergedColors[colorIndex] = mesh.color.r;
                mergedColors[colorIndex + 1] = mesh.color.g;
                mergedColors[colorIndex + 2] = mesh.color.b;
                mergedColors[colorIndex + 3] = 1.0; // Alpha
              }
            }
          }

          // Indices
          for (let i = 0; i < mesh.indices.length; i++) {
            mergedIndices[indexOffset + i] = mesh.indices[i] + vertexOffset;
          }

          vertexOffset += vertexCount;
          indexOffset += mesh.indices.length;
        });

        return {
          positions: mergedPositions,
          indices: mergedIndices,
          normals: mergedNormals,
          colors: mergedColors,
        };
      };

      const extractMeshData = (mesh) => {
        if (!mesh.geometry) return null;

        // Generate unique mesh IDs
        const originalMeshId = `ori_${String(
          meshIdCounter.current.current
        ).padStart(7, "0")}`;
        meshIdCounter.current.current++;

        try {
          // Extract geometry data
          const positions = mesh.getVerticesData(
            BABYLON.VertexBuffer.PositionKind
          );
          const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
          const indices = mesh.getIndices();

          if (!positions || !normals || !indices) {
            console.warn(`Mesh ${mesh.name} is missing required geometry data`);
            return null;
          }

          // Calculate screen coverage using the utility function
          const screenCoverage = calculateScreenCoverage(
            mesh,
            camera,
            scene.getEngine()
          );

          const meshData = {
            fileName: originalMeshId,
            data: {
              fileName: originalMeshId,
              positions: Array.from(positions),
              normals: Array.from(normals),
              indices: Array.from(indices),
              boundingBox: mesh.getBoundingInfo().boundingBox,
              name: mesh.name,
              metadata: {
                id: originalMeshId,
                fileId: originalMeshId.split("_")[0],
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

          // Store reference to original mesh data for later use
          processedMeshesRef.current.set(originalMeshId, meshData);

          return {
            meshData: meshData.data,
            originalMeshId,
          };
        } catch (error) {
          console.error(`Error extracting data from mesh ${mesh.name}:`, error);
          return null;
        }
      };

      // Batch storage function for IndexedDB operations
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

      const allMeshInfos = [];
      const newLoadedMeshes = [...loadedMeshes];

      const checkCompletion = async () => {
        const storeProcessedMeshes = async () => {
          try {
            const originalMeshData = [];
            const dbOperations = [];

            // Collect all original mesh info for octree creation
            console.log(processedMeshesRef.current);

            processedMeshesRef.current.forEach((value, key) => {
              originalMeshData.push(value);
            });
            console.log(originalMeshData);

            originalMeshData.forEach((meshData) => {
              allMeshInfos.push({
                metadata: {
                  id: meshData.fileName,
                  fileId: meshData.fileName.split("_")[0],
                  screenCoverage: meshData.data.metadata.screenCoverage || 0,
                },
                boundingBox: {
                  minimumWorld: meshData.data.boundingBox.minimumWorld,
                  maximumWorld: meshData.data.boundingBox.maximumWorld,
                },
                transforms: {
                  worldMatrix: meshData.data.transforms.worldMatrix,
                },
              });
            });

            // Store each original mesh individually too
            originalMeshData.forEach((meshData) => {
              dbOperations.push({
                store: "originalMeshes",
                key: meshData.fileName,
                data: meshData,
              });
            });

            // Execute the database operations
            await batchStoreInDB(dbOperations);
          } catch (error) {
            console.error("Error storing data in IndexedDB:", error);
          }
        };

        await storeProcessedMeshes();
      };

      for (let file of files) {
        newFileCounter++;

        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "",
            file,
            scene
          );
          const newMeshes = result.meshes.filter(
            (mesh) =>
              mesh.name !== "__root__" && mesh.isVisible && mesh.geometry
          );

          // Process all valid meshes
          const meshDataArray = [];
          newMeshes.forEach((mesh) => {
            // Extract mesh data for simplification
            const meshData = extractMeshData(mesh);
            if (meshData) {
              meshDataArray.push(meshData);
            }
          });

          newLoadedMeshes.push(...newMeshes);
          console.log(`Loaded ${file.name} with ${newMeshes.length} meshes`);
        } catch (error) {
          console.error(`Error loading ${file.name}:`, error);
        }
      }

      setLoadedMeshes(newLoadedMeshes);
      setFileCounter(newFileCounter);

      await checkCompletion();

      if (newLoadedMeshes.length > 0) {
        console.log(newLoadedMeshes);
        const bounds = calculateCumulativeBoundingBox(newLoadedMeshes);

        scene.meshes
          .filter((mesh) => mesh.name.startsWith("octreeVisBox_"))
          .forEach((mesh) => mesh.dispose());

        const octreeRoot = createOctreeBlock(
          scene,
          bounds.minimum,
          bounds.maximum,
          allMeshInfos,
          0,
          null
        );

        const createOctreeInfo = (octreeRoot, cumulativeMin, cumulativeMax) => {
          // Reset total count for safety
          const totalMeshes = Object.values(boxesAtDepth).reduce(
            (total, set) => total + set.size,
            0
          );

          // Log the root block's meshInfos for debugging
          console.log(
            "Root block meshInfos count:",
            octreeRoot.meshInfos ? octreeRoot.meshInfos.length : 0
          );

          // Make sure we have the right structure for the octree data
          return {
            name: "mainOctree",
            data: {
              blockHierarchy: serializeBlock(
                octreeRoot,
                cumulativeMin,
                cumulativeMax
              ),
              version: "1.0",
            },
            bounds: {
              min: serializeVector3(cumulativeMin),
              max: serializeVector3(cumulativeMax),
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
            statistics: {
              totalMeshes,
              meshesPerLevel: Object.fromEntries(
                Array(MAX_DEPTH + 1)
                  .fill(0)
                  .map((_, i) => [
                    i,
                    boxesAtDepth[i] ? boxesAtDepth[i].size : 0,
                  ])
              ),
              nodeDistribution: Array(MAX_DEPTH + 1)
                .fill(0)
                .map((_, i) => ({
                  depth: i,
                  totalNodes: nodesAtDepth[i] || 0,
                  nodesWithContent: nodesAtDepthWithBoxes[i] || 0,
                })),
            },
            timestamp: new Date().toISOString(),
          };
        };

        // Helper function to serialize a block - updated to ensure consistent structure
        const serializeBlock = (block, min, max) => {
          if (!block) {
            console.warn("Attempted to serialize a null block");
            return null;
          }

          // Ensure we have the necessary properties
          const minPoint = block.minPoint || min;
          const maxPoint = block.maxPoint || max;

          // Ensure meshInfos is an array
          const meshInfos = Array.isArray(block.meshInfos)
            ? block.meshInfos
            : [];

          // Ensure each meshInfo has at least an id
          const processedMeshInfos = meshInfos.map((info) => {
            if (typeof info === "object") {
              return {
                id: info.id || info.metadata?.id || "unknown",
                ...info,
              };
            } else {
              return { id: "unknown" };
            }
          });

          return {
            bounds: {
              min: serializeVector3(minPoint),
              max: serializeVector3(maxPoint),
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
                    .filter((childBlock) => childBlock) // Filter out null blocks
                    .map((childBlock) =>
                      serializeBlock(
                        childBlock,
                        childBlock.minPoint,
                        childBlock.maxPoint
                      )
                    )
                : [],
              parentNode: block.parent ? block.parent.nodeNumber : null,
            },
          };
        };

        // Helper function to serialize a Vector3 consistently
        const serializeVector3 = (vector) => {
          // Handle different vector formats
          if (!vector) {
            console.warn("Attempted to serialize a null vector");
            return { x: 0, y: 0, z: 0 };
          }

          // Support both object notation and array notation
          if (Array.isArray(vector)) {
            return {
              x: vector[0] || 0,
              y: vector[1] || 0,
              z: vector[2] || 0,
            };
          }

          return {
            x: vector.x || 0,
            y: vector.y || 0,
            z: vector.z || 0,
          };
        };

        // Create octree info for storage
        const octreeInfo = createOctreeInfo(
          octreeRoot,
          bounds.minimum,
          bounds.maximum
        );

        // Store each original mesh individually too

        // Store the octree
        await batchStoreInDB([
          {
            store: "octree",
            key: "mainOctree",
            data: octreeInfo,
          },
        ]);

        const loadModels = async () => {
          console.log("Starting to process models with overlap detection...");

          try {
            const db = await initDB();
            console.log("Database initialized:", db.name, db.version);

            const tx = db.transaction(["octree", "originalMeshes"], "readonly");

            const octreeStore = tx.objectStore("octree");
            const meshStore = tx.objectStore("originalMeshes");

            const [octreeData, lowPolyModels] = await Promise.all([
              new Promise((resolve, reject) => {
                const request = octreeStore.get("mainOctree");
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              }),
              new Promise((resolve, reject) => {
                const request = meshStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              }),
            ]);

            console.log("Octree:", octreeData);
            console.log("Low poly models:", lowPolyModels);

            console.log("Raw octree data from database:", octreeData);

            if (!octreeData) {
              console.error(
                "No octree data found. You need to load and process models first."
              );
              return;
            }
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

            console.log(`Loaded ${lowPolyModels.length} models`);

            // Step 1: Collect all nodes at all depths
            console.log("\nSTEP 1: Collecting nodes at all depths...");
            const nodesByDepth = { 0: [], 1: [], 2: [], 3: [], 4: [] };
            const stack = [{ block: octreeData.data.blockHierarchy, depth: 0 }];

            while (stack.length > 0) {
              const { block, depth } = stack.pop();

              if (depth <= 4) {
                nodesByDepth[depth].push({
                  block: block,
                  nodeNumber: block.properties.nodeNumber,
                  meshIds: block.meshInfos
                    ? block.meshInfos.map((info) => info.id)
                    : [],
                  bounds: block.bounds,
                });

                if (block.relationships?.childBlocks) {
                  stack.push(
                    ...block.relationships.childBlocks.map((child) => ({
                      block: child,
                      depth: depth + 1,
                    }))
                  );
                }
              }
            }

            // Log node counts
            for (let i = 0; i <= 4; i++) {
              console.log(`  Depth ${i}: ${nodesByDepth[i].length} nodes`);
            }

            // Arrays to store categorized meshes (steps 2-4)
            const largeMeshes = {}; // depth 2, coverage >= 2
            const mediumMeshes = {}; // depth 3, 1 <= coverage < 2
            const smallMeshes = {}; // depth 4, coverage < 1

            // Final placement arrays for each depth
            const finalPlacement = {
              depth0: [],
              depth1: [],
              depth2: [],
              depth3: [],
              depth4: [],
            };

            // STEP 2: Process depth 2 for large meshes
            console.log(
              "\nSTEP 2: Processing depth 2 for LARGE meshes (coverage >= 2)..."
            );
            for (const node of nodesByDepth[2]) {
              const nodeLargeMeshes = [];

              for (const meshId of node.meshIds) {
                let model = modelMap.get(meshId);

                if (!model) {
                  const matchingKey = Array.from(modelMap.keys()).find((key) =>
                    key.includes(meshId)
                  );
                  if (matchingKey) {
                    model = modelMap.get(matchingKey);
                  }
                }

                if (model && model.data.metadata.screenCoverage !== undefined) {
                  const coverage = model.data.metadata.screenCoverage;

                  // Only consider large meshes at depth 2
                  if (coverage >= COVERAGE_THRESHOLDS.LARGE) {
                    const meshInfo = {
                      meshId: meshId,
                      nodeNumber: node.nodeNumber,
                      depth: 2,
                      screenCoverage: coverage,
                      bounds: model.data.bounds || node.bounds,
                    };

                    // Store by node number for easier lookup
                    if (!largeMeshes[node.nodeNumber]) {
                      largeMeshes[node.nodeNumber] = [];
                    }
                    largeMeshes[node.nodeNumber].push(meshInfo);
                    nodeLargeMeshes.push(meshInfo);
                  }
                }
              }

              if (nodeLargeMeshes.length > 0) {
                console.log(
                  `  Node ${node.nodeNumber}: ${nodeLargeMeshes.length} large meshes`
                );
              }
            }

            // Count total large meshes
            const totalLargeMeshes = Object.values(largeMeshes).reduce(
              (sum, arr) => sum + arr.length,
              0
            );
            console.log(`  Total large meshes at depth 2: ${totalLargeMeshes}`);

            // STEP 3: Process depth 3 for medium meshes
            console.log(
              "\nSTEP 3: Processing depth 3 for MEDIUM meshes (1 <= coverage < 2)..."
            );
            for (const node of nodesByDepth[3]) {
              const nodeMediumMeshes = [];

              for (const meshId of node.meshIds) {
                let model = modelMap.get(meshId);

                if (!model) {
                  const matchingKey = Array.from(modelMap.keys()).find((key) =>
                    key.includes(meshId)
                  );
                  if (matchingKey) {
                    model = modelMap.get(matchingKey);
                  }
                }

                if (model && model.data.metadata.screenCoverage !== undefined) {
                  const coverage = model.data.metadata.screenCoverage;

                  // Only consider medium meshes at depth 3
                  if (
                    coverage >= COVERAGE_THRESHOLDS.MEDIUM &&
                    coverage < COVERAGE_THRESHOLDS.LARGE
                  ) {
                    const meshInfo = {
                      meshId: meshId,
                      nodeNumber: node.nodeNumber,
                      depth: 3,
                      screenCoverage: coverage,
                      bounds: model.data.bounds || node.bounds,
                    };

                    // Store by node number
                    if (!mediumMeshes[node.nodeNumber]) {
                      mediumMeshes[node.nodeNumber] = [];
                    }
                    mediumMeshes[node.nodeNumber].push(meshInfo);
                    nodeMediumMeshes.push(meshInfo);
                  }
                }
              }

              if (nodeMediumMeshes.length > 0) {
                console.log(
                  `  Node ${node.nodeNumber}: ${nodeMediumMeshes.length} medium meshes`
                );
              }
            }

            // Count total medium meshes
            const totalMediumMeshes = Object.values(mediumMeshes).reduce(
              (sum, arr) => sum + arr.length,
              0
            );
            console.log(
              `  Total medium meshes at depth 3: ${totalMediumMeshes}`
            );

            // STEP 4: Process depth 4 for small meshes
            console.log(
              "\nSTEP 4: Processing depth 4 for SMALL meshes (coverage < 1)..."
            );
            for (const node of nodesByDepth[4]) {
              const nodeSmallMeshes = [];

              for (const meshId of node.meshIds) {
                let model = modelMap.get(meshId);

                if (!model) {
                  const matchingKey = Array.from(modelMap.keys()).find((key) =>
                    key.includes(meshId)
                  );
                  if (matchingKey) {
                    model = modelMap.get(matchingKey);
                  }
                }

                if (model && model.data.metadata.screenCoverage !== undefined) {
                  const coverage = model.data.metadata.screenCoverage;

                  // Only consider small meshes at depth 4
                  if (coverage < COVERAGE_THRESHOLDS.MEDIUM) {
                    const meshInfo = {
                      meshId: meshId,
                      nodeNumber: node.nodeNumber,
                      depth: 4,
                      screenCoverage: coverage,
                      bounds: model.data.bounds || node.bounds,
                    };

                    // Store by node number
                    if (!smallMeshes[node.nodeNumber]) {
                      smallMeshes[node.nodeNumber] = [];
                    }
                    smallMeshes[node.nodeNumber].push(meshInfo);
                    nodeSmallMeshes.push(meshInfo);
                  }
                }
              }

              if (nodeSmallMeshes.length > 0) {
                console.log(
                  `  Node ${node.nodeNumber}: ${nodeSmallMeshes.length} small meshes`
                );
              }
            }

            // Count total small meshes
            const totalSmallMeshes = Object.values(smallMeshes).reduce(
              (sum, arr) => sum + arr.length,
              0
            );
            console.log(`  Total small meshes at depth 4: ${totalSmallMeshes}`);

            // STEPS 5-8: Process overlapping meshes
            console.log(
              "\nSTEPS 5-8: Processing overlapping meshes and creating final placement..."
            );

            // Process small meshes first (depth 4)
            console.log("\nProcessing small meshes (depth 4) for overlap...");
            await processOverlapping(
              smallMeshes,
              "small",
              nodesByDepth,
              modelMap,
              octreeData.data,
              finalPlacement
            );

            // Process medium meshes next (depth 3)
            console.log("\nProcessing medium meshes (depth 3) for overlap...");
            await processOverlapping(
              mediumMeshes,
              "medium",
              nodesByDepth,
              modelMap,
              octreeData.data,
              finalPlacement
            );

            // Process large meshes last (depth 2)
            console.log("\nProcessing large meshes (depth 2) for overlap...");
            await processOverlapping(
              largeMeshes,
              "large",
              nodesByDepth,
              modelMap,
              octreeData.data,
              finalPlacement
            );

            // Output the final placement arrays
            console.log("\nFINAL PLACEMENT ARRAYS BY DEPTH:");
            for (let depth = 0; depth <= 4; depth++) {
              const depthKey = `depth${depth}`;
              const byCategory = {
                large: finalPlacement[depthKey].filter(
                  (m) => m.category === "large"
                ).length,
                medium: finalPlacement[depthKey].filter(
                  (m) => m.category === "medium"
                ).length,
                small: finalPlacement[depthKey].filter(
                  (m) => m.category === "small"
                ).length,
              };

              console.log(
                `  Depth ${depth}: ${finalPlacement[depthKey].length} total meshes`
              );
              console.log(
                `    Large: ${byCategory.large}, Medium: ${byCategory.medium}, Small: ${byCategory.small}`
              );

              // Show node distribution for this depth
              const nodeDistribution = {};
              finalPlacement[depthKey].forEach((item) => {
                const nodeKey = `node${item.placedNodeNumber}`;
                if (!nodeDistribution[nodeKey]) {
                  nodeDistribution[nodeKey] = {
                    total: 0,
                    large: 0,
                    medium: 0,
                    small: 0,
                  };
                }
                nodeDistribution[nodeKey].total++;
                nodeDistribution[nodeKey][item.category]++;
              });

              // Print node distribution if there are nodes
              if (Object.keys(nodeDistribution).length > 0) {
                console.log("    Node distribution:");
                Object.entries(nodeDistribution).forEach(
                  ([nodeKey, counts]) => {
                    console.log(
                      `      ${nodeKey}: ${counts.total} meshes (L:${counts.large}, M:${counts.medium}, S:${counts.small})`
                    );
                  }
                );
              }
            }

            // Create final mesh placement map
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

            // Step 10: Merge and store meshes by node
            console.log("\nSTEP 10: Merging and storing meshes by node...");
            const allMergedMeshes = [];

            for (const [nodeKey, meshes] of meshPlacementMap.entries()) {
              const nodeNumber = parseInt(nodeKey.replace("node", ""));
              console.log(
                `  Processing ${meshes.length} meshes for node ${nodeNumber}`
              );

              const meshesToMerge = [];
              const meshKeys = [];

              for (const meshInfo of meshes) {
                let model = modelMap.get(meshInfo.meshId);

                if (!model) {
                  const matchingKey = Array.from(modelMap.keys()).find((key) =>
                    key.includes(meshInfo.meshId)
                  );
                  if (matchingKey) {
                    model = modelMap.get(matchingKey);
                  }
                }

                if (model) {
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
                  });
                }
              }

              if (meshesToMerge.length > 0) {
                const mergedVertexData = processMeshDataOffline(meshesToMerge);
                const meshId = `merged_node${nodeNumber}`;

                allMergedMeshes.push({
                  id: meshId,
                  name: meshId,
                  vertexData: mergedVertexData,
                  colors: mergedVertexData.colors,
                  transforms: {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scaling: { x: 1, y: 1, z: 1 },
                    worldMatrix: [
                      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
                    ],
                  },
                  metadata: {
                    nodeNumber: nodeNumber,
                    meshCount: meshesToMerge.length,
                    originalMeshKeys: meshKeys,
                    categories: {
                      small: meshKeys.filter((m) => m.category === "small")
                        .length,
                      medium: meshKeys.filter((m) => m.category === "medium")
                        .length,
                      large: meshKeys.filter((m) => m.category === "large")
                        .length,
                    },
                  },
                });
              }
            }

            // Store merged meshes in database
            const storeTx = db.transaction(
              ["mergedMeshes", "octree"],
              "readwrite"
            );
            const mergedStore = storeTx.objectStore("mergedMeshes");

            console.log(`  Storing ${allMergedMeshes.length} merged meshes`);

            for (let i = 0; i < allMergedMeshes.length; i += STORE_CHUNK_SIZE) {
              const storeChunk = allMergedMeshes.slice(i, i + STORE_CHUNK_SIZE);
              await Promise.all(
                storeChunk.map(async (data) => {
                  await mergedStore.put(data, data.id);
                })
              );
            }

            // Store placement summary with depth-specific statistics
            const placementSummary = {
              totalMeshes: allMergedMeshes.length,
              byCategory: {
                small: finalPlacement.depth0
                  .concat(
                    finalPlacement.depth1,
                    finalPlacement.depth2,
                    finalPlacement.depth3,
                    finalPlacement.depth4
                  )
                  .filter((m) => m.category === "small").length,
                medium: finalPlacement.depth0
                  .concat(
                    finalPlacement.depth1,
                    finalPlacement.depth2,
                    finalPlacement.depth3,
                    finalPlacement.depth4
                  )
                  .filter((m) => m.category === "medium").length,
                large: finalPlacement.depth0
                  .concat(
                    finalPlacement.depth1,
                    finalPlacement.depth2,
                    finalPlacement.depth3,
                    finalPlacement.depth4
                  )
                  .filter((m) => m.category === "large").length,
              },
              byDepth: {
                depth0: finalPlacement.depth0.length,
                depth1: finalPlacement.depth1.length,
                depth2: finalPlacement.depth2.length,
                depth3: finalPlacement.depth3.length,
                depth4: finalPlacement.depth4.length,
              },
              nodeMap: Object.fromEntries(meshPlacementMap),
              processedAt: new Date().toISOString(),
            };

            await mergedStore.put(placementSummary, "placementSummary");

            // Update octree
            await storeTx.objectStore("octree").put(octreeData, "mainOctree");
            await storeTx.done;

            console.log("\nProcessing complete!");
            console.log(
              `Stored ${allMergedMeshes.length} merged meshes with overlap detection`
            );
            console.log("Final placement summary:", placementSummary.byDepth);

            return {
              mergedMeshes: allMergedMeshes,
              placementSummary: placementSummary,
              finalPlacement: finalPlacement,
            };
          } catch (error) {
            console.error("Error in loadModels:", error);
            throw error;
          }
        };

        // Process overlapping meshes function
        async function processOverlapping(
          meshesObj,
          category,
          nodesByDepth,
          modelMap,
          octreeData,
          finalPlacement
        ) {
          // Track processed mesh IDs to avoid duplicates
          const processedIds = new Set();
          let processedCount = 0;
          let overlappingCount = 0;
          let relocatedCount = 0;

          // Process all nodes that have meshes of this category
          for (const [nodeNumber, meshes] of Object.entries(meshesObj)) {
            console.log(
              `  Processing node ${nodeNumber} with ${meshes.length} ${category} meshes`
            );

            for (const meshInfo of meshes) {
              // Skip if already processed
              if (processedIds.has(meshInfo.meshId)) continue;
              processedIds.add(meshInfo.meshId);
              processedCount++;

              // Get the node containing this mesh
              const nodeInfo = nodesByDepth[meshInfo.depth].find(
                (n) => n.nodeNumber === meshInfo.nodeNumber
              );
              if (!nodeInfo) {
                console.log(
                  `    Warning: Node ${meshInfo.nodeNumber} not found at depth ${meshInfo.depth}`
                );
                continue;
              }

              // // Check if mesh overlaps with other meshes in the same node
              // const hasOverlap = checkMeshOverlapInNode(
              //     meshInfo.bounds,
              //     nodeInfo.meshIds,
              //     meshInfo.meshId,
              //     modelMap
              // );

              // Get all other nodes at the same depth (excluding current node)
              const sameDepthNodes = nodesByDepth[meshInfo.depth].filter(
                (n) => n.nodeNumber !== meshInfo.nodeNumber
              );

              // Collect all mesh IDs in other nodes at same depth
              const meshIdsAtSameDepth = sameDepthNodes.flatMap(
                (n) => n.meshIds
              );

              // Optionally include current node if you want to check both
              // const meshIdsAtSameDepth = nodesByDepth[meshInfo.depth]
              //     .flatMap(n => n.meshIds)
              //     .filter(id => id !== meshInfo.meshId);

              // Check overlap against all meshes at same depth
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
                console.log(
                  `    Mesh ${meshInfo.meshId} overlaps in node ${meshInfo.nodeNumber}`
                );

                // Find a parent node where the mesh doesn't overlap
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
                  console.log(
                    `      Relocated to node ${placedNodeNumber} at depth ${placedDepth}`
                  );
                } else {
                  // Place at root if no non-overlapping parent found
                  placedDepth = 0;
                  placedNodeNumber = 1; // Root node is typically node 1
                  console.log(`      Relocated to root node at depth 0`);
                  relocatedCount++;
                }
              }

              // Add mesh to the appropriate depth array in finalPlacement
              finalPlacement[`depth${placedDepth}`].push({
                meshId: meshInfo.meshId,
                category: category,
                screenCoverage: meshInfo.screenCoverage,
                originalNodeNumber: meshInfo.nodeNumber,
                originalDepth: meshInfo.depth,
                placedNodeNumber: placedNodeNumber,
                placedDepth: placedDepth,
                bounds: meshInfo.bounds,
              });
            }
          }

          console.log(`  Processed ${processedCount} ${category} meshes`);
          console.log(`  Found ${overlappingCount} overlapping meshes`);
          console.log(`  Relocated ${relocatedCount} meshes to parent nodes`);
        }

        // Helper function to check if a mesh overlaps with others in the same node
        function checkMeshOverlapInNode(
          meshBounds,
          nodeMeshIds,
          currentMeshId,
          modelMap
        ) {
          // Skip self-comparison
          const otherMeshIds = nodeMeshIds.filter((id) => id !== currentMeshId);

          for (const otherMeshId of otherMeshIds) {
            let otherModel = modelMap.get(otherMeshId);

            if (!otherModel) {
              const matchingKey = Array.from(modelMap.keys()).find((key) =>
                key.includes(otherMeshId)
              );
              if (matchingKey) {
                otherModel = modelMap.get(matchingKey);
              }
            }

            if (otherModel && otherModel.data.bounds) {
              const otherBounds = otherModel.data.bounds;

              // Check for overlap using bounding box
              if (checkBoundsOverlap(meshBounds, otherBounds)) {
                return true;
              }
            }
          }

          return false;
        }

        // Helper function to check if two bounding boxes overlap
        function checkBoundsOverlap(bounds1, bounds2) {
          // Simple AABB overlap check
          return (
            bounds1.min.x <= bounds2.max.x &&
            bounds1.max.x >= bounds2.min.x &&
            bounds1.min.y <= bounds2.max.y &&
            bounds1.max.y >= bounds2.min.y &&
            bounds1.min.z <= bounds2.max.z &&
            bounds1.max.z >= bounds2.min.z
          );
        }

        // Helper function to find a parent node where the mesh doesn't overlap
        function findNonOverlappingParent(
          octreeData,
          meshBounds,
          meshId,
          currentNodeNumber,
          modelMap
        ) {
          // Navigate up the octree to find parent nodes
          const findNodeAndPath = (block, nodeNumber, path = []) => {
            if (!block) return null;

            if (
              block.properties &&
              block.properties.nodeNumber === nodeNumber
            ) {
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
              if (
                !parentNode.relationships ||
                !parentNode.relationships.childBlocks
              ) {
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
            const parentMeshIds = parentNode.meshInfos
              ? parentNode.meshInfos.map((info) => info.id)
              : [];

            const hasOverlap = checkMeshOverlapInNode(
              meshBounds,
              parentMeshIds,
              meshId,
              modelMap
            );

            if (!hasOverlap) {
              return {
                depth: parentNode.properties.depth,
                nodeNumber: parentNode.properties.nodeNumber,
              };
            }

            // Move up to the next parent
            currentNode = parentNode;
            currentPath = currentPath.slice(0, -1);
            currentDepth--;
          }

          return null; // No non-overlapping parent found
        }

        // All the complex octree processing and database operations would continue here...
        // (The remaining logic follows the same pattern as the original code)

        positionCameraForBoundingBox(bounds.minimum, bounds.maximum);
        printOctreeStructure();
        verifyMeshDistribution(newLoadedMeshes);
        await loadModels();
        // await loadModelsWithWorker();
      }
    },
    [
      fileCounter,
      loadedMeshes,
      calculateCumulativeBoundingBox,
      createOctreeBlock,
      positionCameraForBoundingBox,
      printOctreeStructure,
      verifyMeshDistribution,
      initDB,
    ]
  );
  // Process overlapping meshes function

  // Reset handler
  const resetScene = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current) return;

    sceneRef.current.meshes.slice().forEach((mesh) => mesh.dispose());

    setLoadedMeshes([]);
    setFileCounter(0);

    setMeshState({
      nodesAtDepth: new Array(maxDepth + 1).fill(0),
      nodeNumbersByDepth: Array.from({ length: maxDepth + 1 }, () => []),
      nodesAtDepthWithBoxes: new Array(maxDepth + 1).fill(0),
      boxesAtDepth: Array.from({ length: maxDepth + 1 }, () => new Set()),
      nodeContents: new Map(),
      nodeDepths: new Map(),
      nodeParents: new Map(),
      nodeCounter: 1,
    });

    cameraRef.current.setTarget(BABYLON.Vector3.Zero());
    cameraRef.current.radius = 1000;

    meshIdCounter.current = { current: 1 };
    processedMeshesRef.current = new Map();
  }, [maxDepth]);

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
        store.clear().onsuccess = () => {
          console.log(`Cleared store: ${storeName}`);
        };
        store.clear().onerror = (e) => {
          console.error(`Error clearing store ${storeName}:`, e);
        };
      });

      transaction.oncomplete = () => {
        console.log("✅ All stores cleared successfully.");
        alert("All data cleared from the 'piping' database.");
        db.close();
      };
    };

    request.onerror = function (event) {
      console.error("❌ Failed to open database:", event.target.error);
      alert("Failed to open the 'piping' database.");
    };
  }

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", width: "100%", height: "100vh" }}
      />

      {/* Hidden file input */}
      {/* <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        multiple
        className="hidden"
        onChange={(e) => handleFileLoad(Array.from(e.target.files || []))}
      /> */}

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
        {/*  <button
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-success"
        >
          Load GLB Files
        </button> */}

        <button
          style={{ zIndex: "1000" }}
          onClick={loadMergedPolyMeshesWithWorkers}
          className="btn btn-success"
        >
          open Model
        </button>

        <button onClick={resetScene} className="btn btn-secondary">
          Reset Scene
        </button>

        <button onClick={clearAllPipingStores} className="btn btn-dark">
          Clear DB
        </button>

        <button
          onClick={() => toggleCamera("orbit")}
          className="btn btn-primary"
        >
          Orbit Camera
        </button>

        <button onClick={() => toggleCamera("fly")} className="btn btn-warning">
          Fly Camera
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
        <button
          onClick={() => applyView("Fit View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Fit View
        </button>
        <button
          onClick={() => applyView("Top View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Top View
        </button>
        <button
          onClick={() => applyView("Bottom View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Bottom View
        </button>
        <button
          onClick={() => applyView("Front View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Front View
        </button>
        <button
          onClick={() => applyView("Back View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Back View
        </button>
        <button
          onClick={() => applyView("Right Side View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Right Side View
        </button>
        <button
          onClick={() => applyView("Left Side View")}
          className={`btn ${
            cameraType === "arcRotate" ? "btn-primary" : "btn-secondary"
          }`}
        >
          Left Side View
        </button>
      </div>

      {/* Camera Control Panel */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "180px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
        }}
      ></div>

      {/* LOD Info Panel */}
      <div style={{ position: "absolute", right: "10px", top: "10px" }}>
        <div
          className="text-white text-base leading-[40px]"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          <div>Camera: {cameraType === "orbit" ? "Orbit" : "Fly"}</div>
          <div>LOD Level: {lodInfo.level}</div>
          <div>Distance: {lodInfo.distance}</div>
          <div>
            Thresholds: 30% = {lodInfo.threshold30}, 80% = {lodInfo.threshold80}
          </div>
          <div>Memory Usage: {lodInfo.memoryMB} MB</div>
          <div>
            Loaded Nodes: {lodInfo.loadedNodes}, Cached: {lodInfo.cachedMeshes}
          </div>
          <button
            onClick={() => setShowPerformancePanel(!showPerformancePanel)}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "3px",
              padding: "5px 10px",
              marginTop: "5px",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            {showPerformancePanel ? "Hide" : "Show"} Performance
          </button>
          <TestingControls />
        </div>
      </div>
      {showPerformancePanel && <PerformancePanel />}

      {/* Speed Control Bar for Fly Camera */}
      {speedBar}
    </div>
  );
};

export default BabylonLODManager;
