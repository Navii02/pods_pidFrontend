/* eslint no-restricted-globals: off */


// distance-calculation-worker.js
class DistanceCalculationWorker {
  constructor() {
    this.nodeData = new Map(); // nodeNumber -> {center, depth, bounds}
    this.lastCameraPosition = null;
    this.cameraMovementThreshold = 5;
    this.isReady = false;
    
    // Performance tracking
    this.calculationTimes = [];
    this.maxCalculationHistory = 100;
  }

  // Initialize worker with node data
  initializeNodes(nodes) {
    this.nodeData.clear();
    
    if (!nodes || !Array.isArray(nodes)) {
      throw new Error('Invalid nodes data provided for initialization');
    }
    
    
    nodes.forEach(node => {
      if (!node.nodeNumber || !node.center || !node.depth) {
        console.warn('Distance worker: Skipping invalid node:', node);
        return;
      }
      
      this.nodeData.set(node.nodeNumber, {
        center: node.center,
        depth: node.depth,
        bounds: node.bounds,
        size: this.estimateNodeSize(node.depth, node.maxDistance || 1000)
      });
    });
    
    this.isReady = true;
  }

  // Batch calculate distances and LOD decisions
  calculateDistancesAndLOD(cameraData, thresholds, currentStates) {
    const startTime = performance.now();
    
    if (!this.isReady) {
      return { error: "Worker not initialized" };
    }

    const {
      position: cameraPosition,
      viewDirection,
      speed: cameraSpeed
    } = cameraData;

    const {
      maxDistance,
      threshold30Percent,
      threshold80Percent,
      bufferZone
    } = thresholds;

    const results = {
      nodesToLoad: { depth2: [], depth3: [], depth4: [] },
      nodesToUnload: [],
      visibilityUpdates: [],
      predictiveLoads: [],
      statistics: {}
    };

    // Process all nodes
    for (const [nodeNumber, nodeInfo] of this.nodeData.entries()) {
      const { center, depth, bounds, size } = nodeInfo;
      const currentState = currentStates[nodeNumber] || 'unloaded';
      
      // Calculate distances
      const centerDistance = this.calculateDistance(cameraPosition, center);
      const faceDistance = Math.max(0, centerDistance - size);
      
      // Calculate priority (lower = higher priority)
      const importance = this.calculateNodeImportance(
        nodeInfo, 
        cameraPosition, 
        viewDirection, 
        maxDistance
      );
      const priority = faceDistance - importance;

      // LOD decision logic
      const lodDecision = this.makeLODDecision(
        nodeNumber,
        depth,
        faceDistance,
        currentState,
        threshold30Percent,
        threshold80Percent,
        bufferZone
      );

      // Apply decision
      this.applyLODDecision(lodDecision, nodeNumber, priority, results);

      // Visibility calculation for loaded meshes
      if (currentState === 'loaded') {
        const shouldBeVisible = this.calculateVisibility(
          depth,
          faceDistance,
          threshold30Percent,
          threshold80Percent,
          bufferZone
        );
        
        results.visibilityUpdates.push({
          nodeNumber,
          shouldBeVisible,
          distance: faceDistance
        });
      }
    }

    // Predictive loading based on camera movement
    if (cameraSpeed > this.cameraMovementThreshold * 0.1) {
      results.predictiveLoads = this.calculatePredictiveLoads(
        cameraData,
        thresholds,
        currentStates
      );
    }

    // Performance statistics
    const calculationTime = performance.now() - startTime;
    this.trackPerformance(calculationTime);
    
    results.statistics = {
      calculationTime,
      processedNodes: this.nodeData.size,
      averageCalculationTime: this.getAverageCalculationTime()
    };

    return results;
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  calculateNodeImportance(nodeInfo, cameraPosition, viewDirection, maxDistance) {
    const { center, depth } = nodeInfo;
    let importance = 0;

    // 1. Camera direction alignment
    const nodeDirection = this.normalize({
      x: center.x - cameraPosition.x,
      y: center.y - cameraPosition.y,
      z: center.z - cameraPosition.z
    });
    
    const alignment = this.dotProduct(viewDirection, nodeDirection);
    importance += alignment * 50;

    // 2. Depth-based importance
    if (depth === 3) importance += 20;
    if (depth === 4) importance += 10;

    // 3. Distance from camera (closer = more important)
    const distance = this.calculateDistance(cameraPosition, center);
    const distanceScore = (1 - Math.min(distance / maxDistance, 1)) * 30;
    importance += distanceScore;

    return importance;
  }

  makeLODDecision(nodeNumber, depth, faceDistance, currentState, threshold30, threshold80, bufferZone) {
    const isLoaded = currentState === 'loaded';
    
    switch (depth) {
      case 2:
        // Depth 2: Always load if not loaded
        return !isLoaded ? 'load' : 'keep';
        
      case 3:
        const threshold3 = threshold80 + bufferZone;
        if (!isLoaded && faceDistance <= threshold3) return 'load';
        if (isLoaded && faceDistance > threshold3 * 1.2) return 'unload'; // Hysteresis
        return 'keep';
        
      case 4:
        const threshold4 = threshold30 + bufferZone;
        if (!isLoaded && faceDistance <= threshold4) return 'load';
        if (isLoaded && faceDistance > threshold4 * 1.2) return 'unload'; // Hysteresis
        return 'keep';
        
      default:
        return 'keep';
    }
  }

  applyLODDecision(decision, nodeNumber, priority, results) {
    const depth = this.nodeData.get(nodeNumber).depth;
    
    switch (decision) {
      case 'load':
        if (depth === 2) results.nodesToLoad.depth2.push({ nodeNumber, priority });
        else if (depth === 3) results.nodesToLoad.depth3.push({ nodeNumber, priority });
        else if (depth === 4) results.nodesToLoad.depth4.push({ nodeNumber, priority });
        break;
        
      case 'unload':
        if (depth !== 2) { // Never unload depth 2
          results.nodesToUnload.push(nodeNumber);
        }
        break;
    }
  }

  calculateVisibility(depth, faceDistance, threshold30, threshold80, bufferZone) {
    if (depth === 2) return true; // Always visible
    if (depth === 3) return faceDistance <= threshold80 + bufferZone;
    if (depth === 4) return faceDistance <= threshold30 + bufferZone;
    return false;
  }

  calculatePredictiveLoads(cameraData, thresholds, currentStates) {
    const { position, viewDirection, speed } = cameraData;
    const predictiveLoads = [];
    
    // Predict future position
    const futurePosition = {
      x: position.x + viewDirection.x * speed * 3,
      y: position.y + viewDirection.y * speed * 3,
      z: position.z + viewDirection.z * speed * 3
    };

    const preloadDistance = thresholds.maxDistance * 0.3;

    for (const [nodeNumber, nodeInfo] of this.nodeData.entries()) {
      if (currentStates[nodeNumber] === 'loaded') continue;
      
      const distanceToPredicted = this.calculateDistance(futurePosition, nodeInfo.center);
      
      if (distanceToPredicted < preloadDistance) {
        predictiveLoads.push({
          nodeNumber,
          depth: nodeInfo.depth,
          priority: distanceToPredicted + 1000 // Lower priority than immediate needs
        });
      }
    }

    return predictiveLoads;
  }

  // Utility functions
  estimateNodeSize(depth, maxDistance) {
    switch (depth) {
      case 2: return maxDistance * 0.3;
      case 3: return maxDistance * 0.15;
      case 4: return maxDistance * 0.07;
      default: return maxDistance * 0.1;
    }
  }

  normalize(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    return length > 0 ? {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length
    } : { x: 0, y: 0, z: 0 };
  }

  dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  trackPerformance(time) {
    this.calculationTimes.push(time);
    if (this.calculationTimes.length > this.maxCalculationHistory) {
      this.calculationTimes.shift();
    }
  }

  getAverageCalculationTime() {
    if (this.calculationTimes.length === 0) return 0;
    const sum = this.calculationTimes.reduce((a, b) => a + b, 0);
    return sum / this.calculationTimes.length;
  }

  // Update node data (for dynamic scenes)
  updateNodeData(updates) {
    updates.forEach(update => {
      if (this.nodeData.has(update.nodeNumber)) {
        Object.assign(this.nodeData.get(update.nodeNumber), update.data);
      }
    });
  }

  getStatistics() {
    return {
      nodeCount: this.nodeData.size,
      averageCalculationTime: this.getAverageCalculationTime(),
      isReady: this.isReady,
      recentCalculationTimes: this.calculationTimes.slice(-10)
    };
  }
}

// Worker message handling
const distanceWorker = new DistanceCalculationWorker();

self.onmessage = function(event) {
  const { type, data, requestId } = event.data;
  
  try {
    switch (type) {
      case 'INITIALIZE_NODES':
        try {
          distanceWorker.initializeNodes(data.nodes);
          self.postMessage({
            type: 'DISTANCE_WORKER_INITIALIZED',
            requestId
          });
        } catch (initError) {
          console.error('Distance worker initialization failed:', initError);
          self.postMessage({
            type: 'DISTANCE_INITIALIZATION_FAILED',
            requestId,
            error: initError.message
          });
        }
        break;
        
      case 'CALCULATE_DISTANCES':
        const result = distanceWorker.calculateDistancesAndLOD(
          data.cameraData,
          data.thresholds,
          data.currentStates
        );
        self.postMessage({
          type: 'DISTANCES_CALCULATED',
          requestId,
          result
        });
        break;
        
      case 'UPDATE_NODES':
        distanceWorker.updateNodeData(data.updates);
        self.postMessage({
          type: 'NODES_UPDATED',
          requestId
        });
        break;
        
      case 'GET_STATISTICS':
        const stats = distanceWorker.getStatistics();
        self.postMessage({
          type: 'DISTANCE_STATISTICS',
          requestId,
          stats
        });
        break;
        
      default:
        self.postMessage({
          type: 'DISTANCE_ERROR',
          requestId,
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'DISTANCE_ERROR',
      requestId,
      error: error.message
    });
  }
}

// Send ready signal when worker loads
self.postMessage({
  type: 'WORKER_READY'
});