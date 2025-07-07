import * as BABYLON from "@babylonjs/core";

export class WebWorkerTilesetLODManager {
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
        console.log("meshInfo",meshInfo);

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

    // // UPDATED: Enhanced highlight function with proper state tracking
    // mesh.highlightOriginalMesh = function (meshId) {
    //   console.log("🎯 Highlighting mesh:", meshId);

    //   const mapping = this.metadata.vertexMappings.find(
    //     (m) => m.meshId === meshId
    //   );

    //   if (!mapping) {
    //     console.log("❌ No mapping found for meshId:", meshId);
    //     return;
    //   }

    //   console.log("✅ Found mapping:", mapping);

    //   // Store reference to currently highlighted mesh and meshId using LOD manager refs
    //   if (lodManager.highlightRefs) {
    //     lodManager.highlightRefs.currentHighlightedMeshRef.current = this;
    //     lodManager.highlightRefs.currentHighlightedMeshIdRef.current = meshId;
    //     console.log("📝 Stored current highlighted mesh:", meshId);
    //   }

    //   // Store original material if not already stored
    //   if (!this._originalMaterial) {
    //     this._originalMaterial = this.material;
    //   }

    //   // Apply highlight using vertex colors
    //   this.highlightWithVertexColors(mapping);
    // };

    // UPDATED: Improved vertex color highlighting that preserves originals
mesh.highlightWithVertexColors = function (mapping) {
  console.log("🎨 Applying vertex color highlight to mapping:", mapping);
  
  const positionData = this.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const vertexCount = positionData.length / 3;

  // ONLY store original state on FIRST highlight of this mesh
  if (this._originalHighlightState === undefined) {
    const existingColors = this.getVerticesData(BABYLON.VertexBuffer.ColorKind);
    
    this._originalHighlightState = {
      hadVertexColors: !!existingColors,
      originalColors: existingColors ? existingColors.slice() : null,
      originalMaterial: this.material,
      useVertexColors: this.material ? this.material.useVertexColors : false
    };
    
    console.log("💾 Stored ORIGINAL state:", {
      hadVertexColors: this._originalHighlightState.hadVertexColors,
      useVertexColors: this._originalHighlightState.useVertexColors
    });
  }

  // Get current vertex colors (may be from previous highlights)
  let colors = this.getVerticesData(BABYLON.VertexBuffer.ColorKind);
  
  if (!colors) {
    // Create white vertex colors for highlighting
    colors = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      colors[i * 4 + 0] = 1.0; // R
      colors[i * 4 + 1] = 1.0; // G  
      colors[i * 4 + 2] = 1.0; // B
      colors[i * 4 + 3] = 1.0; // A
    }
  }

  // Apply yellow highlight to specific vertex range
  for (let i = mapping.start; i < mapping.start + mapping.count; i++) {
    if (i < vertexCount) {
      colors[i * 4 + 0] = 1.0; // R - Yellow
      colors[i * 4 + 1] = 1.0; // G
      colors[i * 4 + 2] = 0.0; // B
      colors[i * 4 + 3] = 1.0; // A
    }
  }

  this.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);

  if (this.material) {
    this.material.useVertexColors = true;
    this.material.markDirty();
  }

  console.log("🎨 Applied vertex color highlight successfully");
};

// COMPLETELY REWRITTEN: Robust remove highlight that properly restores original state
mesh.removeHighlight = function () {
  console.log("🧹 Removing highlight from mesh:", this.name);

  if (!this._originalHighlightState) {
    console.warn("⚠️ No original state stored, cannot restore properly");
    return;
  }

  const originalState = this._originalHighlightState;
  
  console.log("🔄 Restoring to original state:", {
    hadVertexColors: originalState.hadVertexColors,
    useVertexColors: originalState.useVertexColors
  });

  try {
    if (originalState.hadVertexColors && originalState.originalColors) {
      // Mesh originally HAD vertex colors - restore them
      console.log("🔄 Restoring original vertex colors");
      this.setVerticesData(
        BABYLON.VertexBuffer.ColorKind, 
        originalState.originalColors, 
        true
      );
      
      if (this.material) {
        this.material.useVertexColors = originalState.useVertexColors;
        this.material.markDirty();
      }
    } else {
      // Mesh originally had NO vertex colors - remove them completely
      console.log("🔄 Removing vertex colors to restore material color");
      this.removeVerticesData(BABYLON.VertexBuffer.ColorKind);
      
      if (this.material) {
        this.material.useVertexColors = false;
        this.material.markDirty();
      }
    }

    // Restore original material if it was stored
    if (originalState.originalMaterial && originalState.originalMaterial !== this.material) {
      console.log("🔄 Restoring original material");
      this.material = originalState.originalMaterial;
    }

    console.log("✅ Successfully restored original state");

  } catch (error) {
    console.error("❌ Error restoring original state:", error);
    
    // Fallback: force remove vertex colors
    this.removeVerticesData(BABYLON.VertexBuffer.ColorKind);
    if (this.material) {
      this.material.useVertexColors = false;
      this.material.markDirty();
    }
  }

  // Clean up stored state
  this._originalHighlightState = undefined;
  this._originalMaterial = undefined;

  console.log("✅ Highlight removal completed for mesh:", this.name);
};

// ENHANCED: Better highlight function with state management
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

  // Apply highlight using vertex colors
  this.highlightWithVertexColors(mapping);
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
// Enhanced getCurrentMultiNodeSelection method
getCurrentMultiNodeSelection() {
  if (this.highlightRefs && this.highlightRefs.multiNodeSelection) {
    const selection = this.highlightRefs.multiNodeSelection;
    return {
      tagName: this.highlightRefs.currentHighlightedMeshIdRef?.current,
      totalParts: selection.length,
      nodes: selection.map((r) => r.nodeNumber),
      depths: selection.map((r) => r.depth),
      meshNames: selection.map((r) => r.lodMesh.name),
      isMultiNode: selection.length > 1,
      hasActiveSelection: true,
    };
  }
  return {
    hasActiveSelection: false,
    isMultiNode: false
  };
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

  let clearedMeshes = 0;

  // Clear highlights from all LOD meshes
  for (const [nodeNumber, lodMesh] of this.activeMeshes.entries()) {
    if (lodMesh && typeof lodMesh.removeHighlight === 'function') {
      try {
        lodMesh.removeHighlight();
        clearedMeshes++;
        console.log(`🧹 Cleared highlight from mesh in node ${nodeNumber}`);
      } catch (error) {
        console.error(`❌ Error clearing highlight from node ${nodeNumber}:`, error);
      }
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

  // Clear traditional highlight as backup
  this.unhighlightMesh();

  console.log(`✅ All highlights cleared (${clearedMeshes} meshes processed)`);
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
