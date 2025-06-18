/* eslint no-restricted-globals: off */


// ============================================================================
// frustum-culling-worker.js (NEW WORKER FOR FRUSTUM CULLING)
// ============================================================================

class FrustumCullingWorker {
    constructor() {
        this.isReady = true; // Frustum worker doesn't need database
        this.frustumPlanes = [];
        this.bufferFrustumPlanes = [];
        this.nodeStates = new Map(); // nodeNumber -> { inFrustum, inBuffer, lastUpdate }
        this.bufferMultiplier = 1.5; // Buffer zone is 1.5x larger than frustum
        
        // Signal ready immediately since no database needed
        self.postMessage({
            type: 'WORKER_READY',
            depth: 'frustum'
        });
        
        self.onmessage = (event) => {
            this.handleMessage(event);
        };
        
    }
    
    async handleMessage(event) {
        const { type, requestId, cameraData, nodeData, bufferMultiplier } = event.data;
        
        try {
            switch (type) {
                case 'UPDATE_FRUSTUM':
                    await this.updateFrustum(cameraData, requestId);
                    break;
                case 'CULL_NODES':
                    await this.cullNodes(nodeData, requestId);
                    break;
                case 'SET_BUFFER_MULTIPLIER':
                    this.setBufferMultiplier(bufferMultiplier, requestId);
                    break;
                case 'GET_CULLING_STATS':
                    this.getCullingStats(requestId);
                    break;
                case 'CLEAR_CULLING_CACHE':
                    this.clearCullingCache();
                    break;
                default:
                    console.warn('Frustum worker: Unknown message type:', type);
            }
        } catch (error) {
            self.postMessage({
                type: 'FRUSTUM_ERROR',
                requestId,
                error: error.message
            });
        }
    }
    
    async updateFrustum(cameraData, requestId) {
        const { viewMatrix, projectionMatrix, position, target, fov, aspect, near, far } = cameraData;
        
        // Calculate frustum planes from view-projection matrix
        const viewProjectionMatrix = this.multiplyMatrices(projectionMatrix, viewMatrix);
        this.frustumPlanes = this.extractFrustumPlanes(viewProjectionMatrix);
        
        // Calculate buffer frustum (expanded)
        const bufferViewProjectionMatrix = this.createBufferFrustum(cameraData);
        this.bufferFrustumPlanes = this.extractFrustumPlanes(bufferViewProjectionMatrix);
        
        self.postMessage({
            type: 'FRUSTUM_UPDATED',
            requestId,
            planesCount: this.frustumPlanes.length,
            bufferPlanesCount: this.bufferFrustumPlanes.length
        });
        
    }
    
    async cullNodes(nodeData, requestId) {
        const results = {
            visible: [], // Nodes in frustum - should be visible
            hidden: [],  // Nodes outside frustum but in buffer - hidden but loaded
            dispose: [], // Nodes outside buffer - should be disposed
            reload: []   // Previously disposed nodes now in buffer - should be reloaded
        };
        
        let visibleCount = 0;
        let hiddenCount = 0;
        let disposeCount = 0;
        let reloadCount = 0;
        
        for (const nodeInfo of nodeData) {
            const { nodeNumber, bounds, currentState } = nodeInfo; // currentState: 'visible', 'hidden', 'disposed'
            
            // Test against frustum and buffer
            const inFrustum = this.testBoundsAgainstFrustum(bounds, this.frustumPlanes);
            const inBuffer = this.testBoundsAgainstFrustum(bounds, this.bufferFrustumPlanes);
            
            // Update node state tracking
            const previousState = this.nodeStates.get(nodeNumber);
            this.nodeStates.set(nodeNumber, {
                inFrustum,
                inBuffer,
                lastUpdate: performance.now(),
                previousInFrustum: previousState?.inFrustum || false,
                previousInBuffer: previousState?.inBuffer || false
            });
            
            // Determine action based on frustum and buffer tests
            if (inFrustum) {
                // In frustum - should be visible
                results.visible.push(nodeNumber);
                visibleCount++;
            } else if (inBuffer) {
                // Outside frustum but in buffer - should be hidden but loaded
                if (currentState === 'disposed') {
                    // Was disposed but now in buffer - reload
                    results.reload.push(nodeNumber);
                    reloadCount++;
                } else {
                    // Just hide
                    results.hidden.push(nodeNumber);
                    hiddenCount++;
                }
            } else {
                // Outside buffer - should be disposed (unless it's depth 2)
                if (currentState !== 'disposed' && nodeInfo.depth !== 2) {
                    results.dispose.push(nodeNumber);
                    disposeCount++;
                }
            }
        }
        
        // Limit cache size
        if (this.nodeStates.size > 2000) {
            const toRemove = this.nodeStates.size - 1500;
            const entries = Array.from(this.nodeStates.entries());
            entries.sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);
            
            for (let i = 0; i < toRemove; i++) {
                this.nodeStates.delete(entries[i][0]);
            }
        }
        
        self.postMessage({
            type: 'CULLING_RESULTS',
            requestId,
            results,
            stats: {
                visibleCount,
                hiddenCount,
                disposeCount,
                reloadCount,
                totalNodes: nodeData.length,
                timestamp: performance.now()
            }
        });
        
    }
    
    createBufferFrustum(cameraData) {
        const { fov, aspect, near, far } = cameraData;
        
        // Expand FOV for buffer zone
        const bufferFov = fov * this.bufferMultiplier;
        const bufferAspect = aspect; // Keep aspect ratio same
        const bufferNear = near * 0.8; // Slightly closer near plane
        const bufferFar = far * 1.2; // Slightly farther far plane
        
        // Create expanded projection matrix
        const bufferProjectionMatrix = this.createProjectionMatrix(
            bufferFov, bufferAspect, bufferNear, bufferFar
        );
        
        return this.multiplyMatrices(bufferProjectionMatrix, cameraData.viewMatrix);
    }
    
    createProjectionMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov * 0.5);
        const rangeInv = 1.0 / (near - far);
        
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
    }
    
    multiplyMatrices(a, b) {
        const result = new Array(16);
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 0;
                for (let k = 0; k < 4; k++) {
                    result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
                }
            }
        }
        
        return result;
    }
    
    extractFrustumPlanes(matrix) {
        const planes = [];
        
        // Extract the 6 frustum planes from the view-projection matrix
        // Left plane
        planes.push(this.normalizePlane([
            matrix[3] + matrix[0],
            matrix[7] + matrix[4],
            matrix[11] + matrix[8],
            matrix[15] + matrix[12]
        ]));
        
        // Right plane
        planes.push(this.normalizePlane([
            matrix[3] - matrix[0],
            matrix[7] - matrix[4],
            matrix[11] - matrix[8],
            matrix[15] - matrix[12]
        ]));
        
        // Bottom plane
        planes.push(this.normalizePlane([
            matrix[3] + matrix[1],
            matrix[7] + matrix[5],
            matrix[11] + matrix[9],
            matrix[15] + matrix[13]
        ]));
        
        // Top plane
        planes.push(this.normalizePlane([
            matrix[3] - matrix[1],
            matrix[7] - matrix[5],
            matrix[11] - matrix[9],
            matrix[15] - matrix[13]
        ]));
        
        // Near plane
        planes.push(this.normalizePlane([
            matrix[3] + matrix[2],
            matrix[7] + matrix[6],
            matrix[11] + matrix[10],
            matrix[15] + matrix[14]
        ]));
        
        // Far plane
        planes.push(this.normalizePlane([
            matrix[3] - matrix[2],
            matrix[7] - matrix[6],
            matrix[11] - matrix[10],
            matrix[15] - matrix[14]
        ]));
        
        return planes;
    }
    
    normalizePlane(plane) {
        const length = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        return [
            plane[0] / length,
            plane[1] / length,
            plane[2] / length,
            plane[3] / length
        ];
    }
    
    testBoundsAgainstFrustum(bounds, planes) {
        const { min, max } = bounds;
        
        // Test bounding box against all frustum planes
        for (const plane of planes) {
            const [nx, ny, nz, d] = plane;
            
            // Find the positive vertex (furthest along plane normal)
            const px = nx > 0 ? max.x : min.x;
            const py = ny > 0 ? max.y : min.y;
            const pz = nz > 0 ? max.z : min.z;
            
            // If positive vertex is behind the plane, the box is completely outside
            if (nx * px + ny * py + nz * pz + d < 0) {
                return false;
            }
        }
        
        return true; // Box intersects or is inside the frustum
    }
    
    setBufferMultiplier(multiplier, requestId) {
        this.bufferMultiplier = Math.max(1.1, Math.min(3.0, multiplier)); // Clamp between 1.1 and 3.0
        
        self.postMessage({
            type: 'BUFFER_MULTIPLIER_SET',
            requestId,
            bufferMultiplier: this.bufferMultiplier
        });
        
    }
    
    getCullingStats(requestId) {
        const totalTracked = this.nodeStates.size;
        let inFrustumCount = 0;
        let inBufferCount = 0;
        
        for (const state of this.nodeStates.values()) {
            if (state.inFrustum) inFrustumCount++;
            else if (state.inBuffer) inBufferCount++;
        }
        
        self.postMessage({
            type: 'CULLING_STATS',
            requestId,
            stats: {
                totalTrackedNodes: totalTracked,
                inFrustumCount,
                inBufferCount,
                outsideBufferCount: totalTracked - inFrustumCount - inBufferCount,
                bufferMultiplier: this.bufferMultiplier
            }
        });
    }
    
    clearCullingCache() {
        this.nodeStates.clear();
        this.frustumPlanes.length = 0;
        this.bufferFrustumPlanes.length = 0;
        
        self.postMessage({
            type: 'CULLING_CACHE_CLEARED'
        });
        
    }
}

new FrustumCullingWorker();