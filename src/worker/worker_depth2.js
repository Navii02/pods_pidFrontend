/* eslint no-restricted-globals: off */


// mesh-loader-worker-depth2.js
class MeshLoaderWorkerDepth2 {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.initDB();
        
        self.onmessage = (event) => {
            this.handleMessage(event);
        };
    }
    
    async initDB() {
        try {
            this.db = await new Promise((resolve, reject) => {
                const request = indexedDB.open("piping", 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const storeNames = ["octree", "originalMeshes", "mergedPoly", "mergedSkippedMeshes", "placementSummary", "mergedMeshes"];
                    storeNames.forEach(storeName => {
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.createObjectStore(storeName);
                        }
                    });
                };
            });
            this.isReady = true;
            console.log('Depth 2 worker: Database initialized and ready');
            
            // Signal that worker is ready
            self.postMessage({
                type: 'WORKER_READY',
                depth: 2
            });
        } catch (error) {
            console.error('Depth 2 worker: Database initialization failed:', error);
            self.postMessage({
                type: 'WORKER_ERROR',
                depth: 2,
                error: error.message
            });
        }
    }
    
    async handleMessage(event) {
        const { type, nodeNumber, requestId } = event.data;
        
        // Check if worker is ready for database operations
        if (!this.isReady && (type === 'LOAD_MESH' || type === 'PRELOAD_BATCH')) {
            console.warn(`Depth 2 worker: Received ${type} request but worker not ready, queuing...`);
            // Retry after a short delay
            setTimeout(() => {
                if (this.isReady) {
                    this.handleMessage(event);
                } else {
                    console.error(`Depth 2 worker: Still not ready, sending error`);
                    self.postMessage({
                        type: 'ERROR',
                        requestId,
                        nodeNumber,
                        error: 'Worker database not initialized',
                        depth: 2
                    });
                }
            }, 100);
            return;
        }
        
        try {
            switch (type) {
                case 'LOAD_MESH':
                    await this.loadMesh(nodeNumber, requestId);
                    break;
                case 'PRELOAD_BATCH':
                    await this.preloadBatch(event.data.nodeNumbers, requestId);
                    break;
                default:
                    console.warn('Depth 2 worker: Unknown message type:', type);
            }
        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                requestId,
                nodeNumber,
                error: error.message
            });
        }
    }
    
    async loadMesh(nodeNumber, requestId) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['mergedMeshes'], 'readonly');
        const store = transaction.objectStore('mergedMeshes');
        const meshName = `merged_node${nodeNumber}`;
        
        const meshData = await new Promise((resolve, reject) => {
            const request = store.get(meshName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (meshData) {
            self.postMessage({
                type: 'MESH_LOADED',
                requestId,
                nodeNumber,
                meshData,
                depth: 2
            });
        } else {
            // Skip nodes without mesh data - don't treat as error
            console.log(`Depth 2 worker: No mesh data found for node ${nodeNumber}, skipping`);
            self.postMessage({
                type: 'MESH_SKIPPED',
                requestId,
                nodeNumber,
                depth: 2,
                reason: 'No mesh data in database'
            });
        }
    }
    
    async preloadBatch(nodeNumbers, requestId) {
        const results = [];
        let successCount = 0;
        let skippedCount = 0;
        
        for (const nodeNumber of nodeNumbers) {
            try {
                const transaction = this.db.transaction(['mergedMeshes'], 'readonly');
                const store = transaction.objectStore('mergedMeshes');
                const meshName = `merged_node${nodeNumber}`;
                
                const meshData = await new Promise((resolve, reject) => {
                    const request = store.get(meshName);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                if (meshData) {
                    results.push({ nodeNumber, meshData, success: true });
                    successCount++;
                } else {
                    // Skip nodes without mesh data
                    console.log(`Depth 2 worker: No mesh data for node ${nodeNumber}, skipping`);
                    results.push({ nodeNumber, success: false, skipped: true, reason: 'No mesh data' });
                    skippedCount++;
                }
            } catch (error) {
                results.push({ nodeNumber, success: false, skipped: false, error: error.message });
            }
        }
        
        console.log(`Depth 2 worker: Batch complete - ${successCount} loaded, ${skippedCount} skipped`);
        
        self.postMessage({
            type: 'BATCH_LOADED',
            requestId,
            results,
            depth: 2,
            stats: { successCount, skippedCount, totalCount: nodeNumbers.length }
        });
    }
}

new MeshLoaderWorkerDepth2();