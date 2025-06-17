/* eslint no-restricted-globals: off */

class MeshLoaderWorkerDepth4 {
    constructor() {
        this.db = null;
        this.loadedMeshes = new Map();
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
            });
            console.log('Depth 4 worker: Database initialized');
        } catch (error) {
            console.error('Depth 4 worker: Database initialization failed:', error);
        }
    }
    
    async handleMessage(event) {
        const { type, nodeNumber, requestId, priority } = event.data;
        
        try {
            switch (type) {
                case 'LOAD_MESH':
                    await this.loadMesh(nodeNumber, requestId, priority);
                    break;
                case 'CLEAR_CACHE':
                    this.clearCache();
                    break;
                default:
                    console.warn('Depth 4 worker: Unknown message type:', type);
            }
        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                requestId,
                nodeNumber,
                error: error.message,
                depth: 4
            });
        }
    }
    
    async loadMesh(nodeNumber, requestId, priority = 0) {
        // Check cache first
        if (this.loadedMeshes.has(nodeNumber)) {
            self.postMessage({
                type: 'MESH_LOADED',
                requestId,
                nodeNumber,
                meshData: this.loadedMeshes.get(nodeNumber),
                depth: 4,
                fromCache: true
            });
            return;
        }
        
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
            // Cache the mesh data with LRU eviction
            this.loadedMeshes.set(nodeNumber, meshData);
            
            if (this.loadedMeshes.size > 30) {
                const firstKey = this.loadedMeshes.keys().next().value;
                this.loadedMeshes.delete(firstKey);
            }
            
            self.postMessage({
                type: 'MESH_LOADED',
                requestId,
                nodeNumber,
                meshData,
                depth: 4,
                priority
            });
        } else {
            // Skip nodes without mesh data
            console.log(`Depth 4 worker: No mesh data found for node ${nodeNumber}, skipping`);
            self.postMessage({
                type: 'MESH_SKIPPED',
                requestId,
                nodeNumber,
                depth: 4,
                reason: 'No mesh data in database'
            });
        }
    }
    
    clearCache() {
        this.loadedMeshes.clear();
        self.postMessage({
            type: 'CACHE_CLEARED',
            depth: 4
        });
    }
}

new MeshLoaderWorkerDepth4();

