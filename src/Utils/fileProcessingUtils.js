// fileProcessingUtils.js - Utility functions for optimized file processing

/**
 * Memory management utilities
 */
export class MemoryManager {
  constructor() {
    this.gcInterval = null;
    this.memoryThreshold = 0.8; // 80% of available memory
    this.checkInterval = 5000; // Check every 5 seconds
  }

  startMonitoring() {
    if (this.gcInterval) return;

    this.gcInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  stopMonitoring() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }

  checkMemoryUsage() {
    if (!window.performance?.memory) return;

    const memory = window.performance.memory;
    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    if (usageRatio > this.memoryThreshold) {
      console.warn(`Memory usage high: ${Math.round(usageRatio * 100)}%`);
      this.forceCleanup();
    }
  }

  forceCleanup() {
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    // Clear any temporary objects
    if (window.tempObjects) {
      window.tempObjects.clear();
    }
  }

  getMemoryInfo() {
    if (!window.performance?.memory) {
      return { available: false };
    }

    const memory = window.performance.memory;
    return {
      available: true,
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    };
  }
}

/**
 * Progress tracking utility
 */
export class ProgressTracker {
  constructor() {
    this.phases = new Map();
    this.currentPhase = null;
    this.startTime = null;
    this.callbacks = [];
  }

  addPhase(name, totalSteps) {
    this.phases.set(name, {
      name,
      totalSteps,
      currentStep: 0,
      completed: false,
      startTime: null,
      endTime: null
    });
  }

  startPhase(name) {
    if (!this.phases.has(name)) {
      throw new Error(`Phase ${name} not found`);
    }

    this.currentPhase = name;
    const phase = this.phases.get(name);
    phase.startTime = Date.now();
    
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    this.notifyCallbacks();
  }

  updateProgress(steps = 1) {
    if (!this.currentPhase) return;

    const phase = this.phases.get(this.currentPhase);
    phase.currentStep = Math.min(phase.currentStep + steps, phase.totalSteps);
    
    if (phase.currentStep >= phase.totalSteps) {
      this.completePhase();
    }

    this.notifyCallbacks();
  }

  completePhase() {
    if (!this.currentPhase) return;

    const phase = this.phases.get(this.currentPhase);
    phase.completed = true;
    phase.endTime = Date.now();
    phase.currentStep = phase.totalSteps;

    this.notifyCallbacks();
  }

  getOverallProgress() {
    const totalPhases = this.phases.size;
    const completedPhases = Array.from(this.phases.values()).filter(p => p.completed).length;
    
    if (totalPhases === 0) return 0;
    
    // If all phases are completed
    if (completedPhases === totalPhases) return 1;

    // Calculate progress including current phase
    let totalProgress = completedPhases;
    
    if (this.currentPhase) {
      const currentPhaseData = this.phases.get(this.currentPhase);
      if (currentPhaseData.totalSteps > 0) {
        totalProgress += currentPhaseData.currentStep / currentPhaseData.totalSteps;
      }
    }

    return Math.min(totalProgress / totalPhases, 1);
  }

  getCurrentPhaseProgress() {
    if (!this.currentPhase) return 0;
    
    const phase = this.phases.get(this.currentPhase);
    return phase.totalSteps > 0 ? phase.currentStep / phase.totalSteps : 0;
  }

  getEstimatedTimeRemaining() {
    if (!this.startTime || !this.currentPhase) return null;

    const elapsed = Date.now() - this.startTime;
    const progress = this.getOverallProgress();
    
    if (progress <= 0) return null;
    
    const totalEstimated = elapsed / progress;
    return Math.max(0, totalEstimated - elapsed);
  }

  onProgress(callback) {
    this.callbacks.push(callback);
  }

  notifyCallbacks() {
    const progressData = {
      overall: this.getOverallProgress(),
      currentPhase: this.currentPhase,
      currentPhaseProgress: this.getCurrentPhaseProgress(),
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
      phases: Object.fromEntries(this.phases)
    };

    this.callbacks.forEach(callback => {
      try {
        callback(progressData);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  reset() {
    this.phases.clear();
    this.currentPhase = null;
    this.startTime = null;
  }
}

/**
 * File validation utilities
 */
export class FileValidator {
  static SUPPORTED_FORMATS = [
    '.obj', '.fbx', '.gltf', '.glb', '.3ds', '.ply', '.stl', '.dae'
  ];

  static MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
  static MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB total

  static validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File ${file.name} is too large (${Math.round(file.size / 1024 / 1024)}MB > ${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB)`);
    }

    // Check file format
    const extension = this.getFileExtension(file.name);
    if (!this.SUPPORTED_FORMATS.includes(extension)) {
      errors.push(`File ${file.name} has unsupported format: ${extension}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateFileSet(files) {
    const errors = [];
    const warnings = [];

    // Check total size
    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.MAX_TOTAL_SIZE) {
      errors.push(`Total file size too large (${Math.round(totalSize / 1024 / 1024 / 1024)}GB > ${Math.round(this.MAX_TOTAL_SIZE / 1024 / 1024 / 1024)}GB)`);
    }

    // Check individual files
    const validFiles = [];
    Array.from(files).forEach(file => {
      const validation = this.validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(...validation.errors);
      }
    });

    // Check for performance warnings
    if (files.length > 50) {
      warnings.push(`Large number of files (${files.length}). Processing may take significant time.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validFiles,
      totalSize,
      fileCount: files.length
    };
  }

  static getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.active = new Map();
  }

  start(name) {
    this.active.set(name, {
      startTime: performance.now(),
      memoryStart: this.getMemoryUsage()
    });
  }

  end(name) {
    if (!this.active.has(name)) {
      console.warn(`Performance metric ${name} was not started`);
      return null;
    }

    const start = this.active.get(name);
    const endTime = performance.now();
    const duration = endTime - start.startTime;
    const memoryEnd = this.getMemoryUsage();

    const metric = {
      name,
      duration,
      memoryDelta: memoryEnd - start.memoryStart,
      startTime: start.startTime,
      endTime
    };

    this.metrics.set(name, metric);
    this.active.delete(name);

    return metric;
  }

  getMetric(name) {
    return this.metrics.get(name);
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  getMemoryUsage() {
    if (window.performance?.memory) {
      return window.performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  logSummary() {
    console.group('Performance Summary');
    this.metrics.forEach((metric, name) => {
      console.log(`${name}: ${metric.duration.toFixed(2)}ms (Memory: ${metric.memoryDelta > 0 ? '+' : ''}${metric.memoryDelta.toFixed(2)}MB)`);
    });
    console.groupEnd();
  }

  reset() {
    this.metrics.clear();
    this.active.clear();
  }
}

/**
 * Worker pool management
 */
export class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.available = [];
    this.busy = new Set();
    this.taskQueue = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript);
      this.workers.push(worker);
      this.available.push(worker);
    }

    this.initialized = true;
  }

  async execute(task) {
    if (!this.initialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const taskWithCallbacks = {
        ...task,
        resolve,
        reject,
        timeout: task.timeout || 60000
      };

      if (this.available.length > 0) {
        this.runTask(taskWithCallbacks);
      } else {
        this.taskQueue.push(taskWithCallbacks);
      }
    });
  }

  runTask(task) {
    const worker = this.available.pop();
    this.busy.add(worker);

    const timeout = setTimeout(() => {
      this.returnWorker(worker);
      task.reject(new Error(`Task timeout: ${task.type}`));
    }, task.timeout);

    const cleanup = () => {
      clearTimeout(timeout);
      this.returnWorker(worker);
    };

    worker.onmessage = (e) => {
      cleanup();
      if (e.data.error) {
        task.reject(new Error(e.data.error));
      } else {
        task.resolve(e.data);
      }
    };

    worker.onerror = (error) => {
      cleanup();
      task.reject(error);
    };

    worker.postMessage(task);
  }

  returnWorker(worker) {
    this.busy.delete(worker);
    this.available.push(worker);

    // Process next task in queue
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      this.runTask(nextTask);
    }
  }

  getStats() {
    return {
      poolSize: this.poolSize,
      available: this.available.length,
      busy: this.busy.size,
      queued: this.taskQueue.length
    };
  }

  terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.workers.length = 0;
    this.available.length = 0;
    this.busy.clear();
    this.taskQueue.length = 0;
    this.initialized = false;
  }
}

/**
 * Main orchestrator class
 */
export class FileProcessingOrchestrator {
  constructor(options = {}) {
    this.memoryManager = new MemoryManager();
    this.progressTracker = new ProgressTracker();
    this.performanceMonitor = new PerformanceMonitor();
    this.workerPool = new WorkerPool(
      options.workerScript || './meshProcessingWorker.js',
      options.workerPoolSize
    );
    
    this.options = {
      batchSize: 5,
      maxConcurrent: 3,
      enableMemoryMonitoring: true,
      enablePerformanceMonitoring: true,
      ...options
    };
  }

  async initialize() {
    await this.workerPool.initialize();
    
    if (this.options.enableMemoryMonitoring) {
      this.memoryManager.startMonitoring();
    }
  }

  async processFiles(files, callbacks = {}) {
    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor.start('total_processing');
    }

    // Validate files
    const validation = FileValidator.validateFileSet(files);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0 && callbacks.onWarning) {
      validation.warnings.forEach(warning => callbacks.onWarning(warning));
    }

    // Setup progress tracking
    this.progressTracker.addPhase('file_processing', files.length);
    this.progressTracker.addPhase('octree_creation', 1);
    this.progressTracker.addPhase('mesh_merging', 1);

    if (callbacks.onProgress) {
      this.progressTracker.onProgress(callbacks.onProgress);
    }

    try {
      // Process files
      this.progressTracker.startPhase('file_processing');
      const meshData = await this.processFilesBatch(validation.validFiles);
      this.progressTracker.completePhase();

      // Create octree
      this.progressTracker.startPhase('octree_creation');
      const octreeData = await this.createOctree(meshData);
      this.progressTracker.completePhase();

      // Process merged meshes
      this.progressTracker.startPhase('mesh_merging');
      const mergedResult = await this.processMergedMeshes(octreeData);
      this.progressTracker.completePhase();

      if (this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.end('total_processing');
        this.performanceMonitor.logSummary();
      }

      return {
        meshData,
        octreeData,
        mergedResult,
        validation,
        performance: this.performanceMonitor.getAllMetrics()
      };

    } catch (error) {
      console.error('Error in file processing:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  async processFilesBatch(files) {
    const results = [];
    
    for (let i = 0; i < files.length; i += this.options.batchSize) {
      const batch = files.slice(i, i + this.options.batchSize);
      const batchPromises = batch.map(async (file, index) => {
        const fileId = `file_${(i + index).toString().padStart(6, '0')}`;
        
        try {
          const result = await this.workerPool.execute({
            type: 'EXTRACT_MESH_DATA',
            file: file,
            fileId: fileId,
            camera: { radius: 10 }
          });
          
          this.progressTracker.updateProgress(1);
          return result.meshData;
          
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          this.progressTracker.updateProgress(1);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Memory cleanup between batches
      this.memoryManager.forceCleanup();
    }

    return results;
  }

  async createOctree(meshData) {
    const bounds = this.calculateBounds(meshData);
    const meshInfos = meshData.map(mesh => ({
      metadata: mesh.data.metadata,
      boundingBox: mesh.data.boundingBox,
      transforms: mesh.data.transforms
    }));

    return await this.workerPool.execute({
      type: 'CREATE_OCTREE',
      bounds: bounds,
      meshInfos: meshInfos
    });
  }

  async processMergedMeshes(octreeData) {
    return await this.workerPool.execute({
      type: 'PROCESS_MERGED_MESHES',
      octreeData: octreeData
    });
  }

  calculateBounds(meshData) {
    if (meshData.length === 0) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    meshData.forEach(mesh => {
      if (mesh.data.boundingBox) {
        const min = mesh.data.boundingBox.minimumWorld;
        const max = mesh.data.boundingBox.maximumWorld;
        
        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
      }
    });

    return {
      minimum: { x: minX, y: minY, z: minZ },
      maximum: { x: maxX, y: maxY, z: maxZ }
    };
  }

  cleanup() {
    this.memoryManager.stopMonitoring();
    this.progressTracker.reset();
    this.performanceMonitor.reset();
  }

  terminate() {
    this.cleanup();
    this.workerPool.terminate();
  }
}