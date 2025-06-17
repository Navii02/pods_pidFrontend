/* eslint no-restricted-globals: off */

class MeshDisposalWorker {
    constructor() {
        this.isReady = true; // Disposal worker doesn't need database
        this.disposalQueue = [];
        this.processingDisposal = false;
        this.disposed = new Set(); // Track disposed node numbers
        
        // Signal ready immediately since no database needed
        self.postMessage({
            type: 'WORKER_READY',
            depth: 'disposal'
        });
        
        self.onmessage = (event) => {
            this.handleMessage(event);
        };
        
        console.log('Mesh disposal worker: Ready for disposal operations');
    }
    
    async handleMessage(event) {
        const { type, nodeNumber, nodeNumbers, requestId, priority } = event.data;
        console.log(event.data);
        
        try {
            switch (type) {
                case 'DISPOSE_MESH':
                    await this.disposeMesh(nodeNumber, requestId, priority);
                    break;
                case 'DISPOSE_BATCH':
                    await this.disposeBatch(nodeNumbers, requestId);
                    break;
                case 'CLEAR_DISPOSAL_CACHE':
                    this.clearDisposalCache();
                    break;
                case 'GET_DISPOSAL_STATS':
                    this.getDisposalStats(requestId);
                    break;
                default:
                    console.warn('Disposal worker: Unknown message type:', type);
            }
        } catch (error) {
            self.postMessage({
                type: 'DISPOSAL_ERROR',
                requestId,
                nodeNumber,
                error: error.message
            });
        }
    }
    
    async disposeMesh(nodeNumber, requestId, priority = 0) {
        // Add to disposal queue with priority
        this.disposalQueue.push({
            nodeNumber,
            requestId,
            priority,
            timestamp: performance.now()
        });
        
        // Sort by priority (higher priority = lower number = dispose first)
        this.disposalQueue.sort((a, b) => a.priority - b.priority);
        
        console.log(`Disposal worker: Queued mesh ${nodeNumber} for disposal (priority: ${priority})`);
        
        // Process queue if not already processing
        if (!this.processingDisposal) {
            this.processDisposalQueue();
        }
    }
    
    async disposeBatch(nodeNumbers, requestId) {
        console.log(`Disposal worker: Batch disposal requested for ${nodeNumbers.length} meshes`);
        
        const results = [];
        let successCount = 0;
        
        for (const nodeNumber of nodeNumbers) {
            try {
                // Simulate disposal work (in real scenario, this might involve cleanup operations)
                await new Promise(resolve => setTimeout(resolve, 1)); // Small delay per mesh
                
                this.disposed.add(nodeNumber);
                results.push({ nodeNumber, success: true });
                successCount++;
                
                console.log(`Disposal worker: Disposed mesh ${nodeNumber}`);
            } catch (error) {
                results.push({ nodeNumber, success: false, error: error.message });
                console.error(`Disposal worker: Failed to dispose mesh ${nodeNumber}:`, error);
            }
        }
        
        // Limit disposed tracking size
        if (this.disposed.size > 1000) {
            const toRemove = this.disposed.size - 800;
            const iterator = this.disposed.values();
            for (let i = 0; i < toRemove; i++) {
                this.disposed.delete(iterator.next().value);
            }
        }
        
        self.postMessage({
            type: 'BATCH_DISPOSED',
            requestId,
            results,
            stats: { successCount, totalCount: nodeNumbers.length }
        });
    }
    
    async processDisposalQueue() {
        this.processingDisposal = true;
        
        while (this.disposalQueue.length > 0) {
            const item = this.disposalQueue.shift();
            
            try {
                // Simulate disposal work
                await new Promise(resolve => setTimeout(resolve, 2)); // Small delay
                
                this.disposed.add(item.nodeNumber);
                
                self.postMessage({
                    type: 'MESH_DISPOSED',
                    requestId: item.requestId,
                    nodeNumber: item.nodeNumber,
                    priority: item.priority
                });
                
                console.log(`Disposal worker: Disposed mesh ${item.nodeNumber}`);
                
                // Small break between disposals to prevent blocking
                if (this.disposalQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } catch (error) {
                self.postMessage({
                    type: 'DISPOSAL_ERROR',
                    requestId: item.requestId,
                    nodeNumber: item.nodeNumber,
                    error: error.message
                });
            }
        }
        
        this.processingDisposal = false;
    }
    
    clearDisposalCache() {
        this.disposed.clear();
        this.disposalQueue.length = 0;
        this.processingDisposal = false;
        
        self.postMessage({
            type: 'DISPOSAL_CACHE_CLEARED'
        });
        
        console.log('Disposal worker: Cache cleared');
    }
    
    getDisposalStats(requestId) {
        self.postMessage({
            type: 'DISPOSAL_STATS',
            requestId,
            stats: {
                disposedCount: this.disposed.size,
                queueLength: this.disposalQueue.length,
                isProcessing: this.processingDisposal
            }
        });
    }
}

new MeshDisposalWorker();