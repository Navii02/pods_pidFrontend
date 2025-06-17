import * as BABYLON from "@babylonjs/core";
import { initDB } from "./DbInit";

export class TilesetLODManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.maxDistance = 0;
        this.threshold30Percent = 0;
        this.threshold80Percent = 0;
        this.activeMeshes = new Map(); // nodeNumber -> mesh
        this.loadedNodeNumbers = new Set(); // Track which nodes are loaded
        this.activeDepth = 0;
        this.nodeDepths = new Map(); // nodeNumber -> depth
        this.nodeCenters = new Map(); // nodeNumber -> center Vector3
        this.currentVisibleNodes = new Set();
        this.tilesetMetadata = null;
        this.updateFrequency = 2; // Update every N frames
        this.frameCounter = 0;
        this.lastCameraPosition = null;
        this.cameraMovementThreshold = 10;
        this.isUpdating = false;
        this.lastUpdate = 0;
        this.nodeLoadingSet = new Set(); // Track nodes currently being loaded
        this.meshCache = new Map(); // Optional cache for frequently used meshes
        this.cacheLimit = 20; // Maximum number of meshes to keep in cache
    }

    setDistanceThresholds(maxDistance) {
        this.maxDistance = maxDistance;
        this.threshold30Percent = maxDistance * 0.3;
        this.threshold80Percent = maxDistance * 0.8;

        // Create tileset metadata with the distance thresholds
        this.tilesetMetadata = {
            "version": "1.0",
            "name": "OctreeTilesetManager",
            "lodLevels": [
                {
                    "depth": 2,
                    "screenSpaceError": 128,
                    "maxCameraDistance": this.maxDistance,
                    "minCameraDistance": this.threshold80Percent,
                    "transitionRange": this.maxDistance * 0.1
                },
                {
                    "depth": 3,
                    "screenSpaceError": 64,
                    "maxCameraDistance": this.threshold80Percent,
                    "minCameraDistance": this.threshold30Percent,
                    "transitionRange": this.maxDistance * 0.05
                },
                {
                    "depth": 4,
                    "screenSpaceError": 16,
                    "maxCameraDistance": this.threshold30Percent,
                    "minCameraDistance": 0,
                    "transitionRange": this.maxDistance * 0.02
                }
            ]
        };

        console.log(`Distance thresholds set: Max = ${this.maxDistance.toFixed(1)}, 30% = ${this.threshold30Percent.toFixed(1)}, 80% = ${this.threshold80Percent.toFixed(1)}`);
        return this.tilesetMetadata;
    }

    async initWithOctreeData(octreeData) {
        try {
            // Process octree without fetching it again
            await this.processOctreeNodes(octreeData.data.blockHierarchy);

            console.log(`Processed nodes: Depth 2: ${this.getNodesAtDepth(2).length}, Depth 3: ${this.getNodesAtDepth(3).length}, Depth 4: ${this.getNodesAtDepth(4).length}`);

            return true;
        } catch (error) {
            console.error("Error initializing LOD Manager:", error);
            return false;
        }
    }

    async initFromDatabase() {
        try {
            // Get IndexedDB connection
            const db = await this.getDBConnection();

            // Get octree data
            const octreeStore = db.transaction(['octree'], 'readonly').objectStore('octree');
            const octreeData = await this.getStoreItem(octreeStore, 'mainOctree');

            if (!octreeData || !octreeData.data || !octreeData.data.blockHierarchy) {
                console.error("Failed to load octree data");
                return false;
            }

            // Process octree to find nodes at depths 2, 3, and 4
            await this.processOctreeNodes(octreeData.data.blockHierarchy);

            console.log(`Processed nodes: Depth 2: ${this.getNodesAtDepth(2).length}, Depth 3: ${this.getNodesAtDepth(3).length}, Depth 4: ${this.getNodesAtDepth(4).length}`);

            return true;
        } catch (error) {
            console.error("Error initializing LOD Manager:", error);
            return false;
        }
    }

    getDBConnection() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("huldrascreen", 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const storeNames = ["octree", "originalMeshes", "mergedPoly", "mergedSkippedMeshes", "placementSummary",
                    "mergedMeshes"];

                storeNames.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName);
                    }
                });
            };
        });
    }

    getStoreItem(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async processOctreeNodes(rootBlock, depth = 0, parent = null) {
        if (!rootBlock || !rootBlock.properties) return;

        const nodeNumber = rootBlock.properties.nodeNumber;
        const nodeDepth = depth;

        // Store node depth
        this.nodeDepths.set(nodeNumber, nodeDepth);

        // Calculate and store node center
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

        // Process child nodes recursively
        if (rootBlock.relationships && rootBlock.relationships.childBlocks) {
            for (const childBlock of rootBlock.relationships.childBlocks) {
                if (childBlock) {
                    await this.processOctreeNodes(childBlock, depth + 1, nodeNumber);
                }
            }
        }
    }

    getNodesAtDepth(depth) {
        return Array.from(this.nodeDepths.entries())
            .filter(([_, nodeDepth]) => nodeDepth === depth)
            .map(([nodeNumber, _]) => nodeNumber);
    }

    async loadMeshesForDepth(depth) {
        try {
            const db = await this.getDBConnection();
            const store = db.transaction(['mergedPoly'], 'readonly').objectStore('mergedPoly');
            const nodeNumbers = this.getNodesAtDepth(depth);

            for (const nodeNumber of nodeNumbers) {
                const meshName = `merged_lowpoly_${nodeNumber}_d${depth}`;
                const meshData = await this.getStoreItem(store, meshName);

                if (meshData) {
                    await this.createMeshFromMergedData(meshData, nodeNumber, depth);
                }
            }

            console.log(`Loaded ${this.getNodesAtDepth(depth).length} meshes for depth ${depth}`);
        } catch (error) {
            console.error(`Error loading meshes for depth ${depth}:`, error);
        }
    }

    async createMeshFromMergedData(meshData, nodeNumber, depth) {
        try {
            // First check if this node is already loaded at the target depth
            const existingMesh = this.activeMeshes.get(nodeNumber);
            if (existingMesh && this.nodeDepths.get(nodeNumber) === depth) {
                console.log(`Mesh for node ${nodeNumber} at depth ${depth} already loaded`);
                return existingMesh;
            }

            // // If loaded at different depth, unload it first
            // if (existingMesh) {
            //     console.log(`Unloading mesh at incorrect depth: ${nodeNumber}`);
            //     this.unloadMesh(nodeNumber);
            // }

            // Create mesh
            const mesh = new BABYLON.Mesh(meshData.name || `lod_node_${nodeNumber}`, this.scene);

            // Create vertex data
            const vertexData = new BABYLON.VertexData();
            vertexData.positions = meshData.vertexData.positions;
            vertexData.indices = meshData.vertexData.indices;

            if (meshData.vertexData.normals) {
                vertexData.normals = meshData.vertexData.normals;
            }

            // Apply to mesh
            vertexData.applyToMesh(mesh);

            // Create material
            const material = new BABYLON.StandardMaterial(mesh.name + "_material", this.scene);

            // Set material color based on depth
            switch (depth) {
                case 2: material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); break; // Red for depth 2
                case 3: material.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2); break; // Green for depth 3
                case 4: material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.8); break; // Blue for depth 4
            }

            material.backFaceCulling = false;
            material.twoSidedLighting = true;
            mesh.material = material;

            // Store original material for highlight/unhighlight
            mesh.originalMaterial = material;

            // Store metadata
            mesh.metadata = {
                ...meshData.metadata,
                nodeNumber,
                depth,
                isLodMesh: true,
                originalMeshCount: meshData.metadata?.originalMeshCount || 0,
                originalMeshKeys: meshData.metadata?.originalMeshKeys || []
            };

            // Make mesh selectable
            mesh.isPickable = true;

            // Store in active meshes map
            this.activeMeshes.set(nodeNumber, mesh);

            // Add to loaded nodes set
            this.loadedNodeNumbers.add(nodeNumber);

            return mesh;
        } catch (error) {
            console.error(`Error creating mesh for node ${nodeNumber}:`, error);
            return null;
        }
    }

    highlightMesh(mesh) {
        if (!mesh) return;

        // Create highlight material if it doesn't exist
        if (!this.highlightMaterial) {
            this.highlightMaterial = new BABYLON.StandardMaterial("highlightMaterial", this.scene);
            this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow highlight
            this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0);
            this.highlightMaterial.backFaceCulling = false;
            this.highlightMaterial.twoSidedLighting = true;
        }

        // Remove highlight from previously highlighted mesh
        if (this.highlightedMesh && this.highlightedMesh !== mesh) {
            this.unhighlightMesh();
        }

        // Apply highlight to selected mesh
        if (mesh.originalMaterial) {
            mesh.material = this.highlightMaterial;
            this.highlightedMesh = mesh;

            // Log selection information
            console.log('Selected mesh:', {
                name: mesh.name,
                nodeNumber: mesh.metadata?.nodeNumber,
                depth: mesh.metadata?.depth,
                isLodMesh: mesh.metadata?.isLodMesh || false
            });

            if (mesh.metadata?.originalMeshKeys) {
                console.log('Original mesh components:', mesh.metadata.originalMeshKeys);
            }
        }
    }

    // Add this method to remove highlight
    unhighlightMesh() {
        if (this.highlightedMesh && this.highlightedMesh.originalMaterial) {
            this.highlightedMesh.material = this.highlightedMesh.originalMaterial;
            this.highlightedMesh = null;
        }
    }

    update() {
        // Prevent concurrent updates or too frequent updates
        const now = performance.now();
        if (this.isUpdating || (now - this.lastUpdate < 8.33 / this.updateFrequency)) {
            return;
        }

        this.isUpdating = true;
        this.lastUpdate = now;

        try {
            // Skip update if camera hasn't moved significantly and we already have nodes
            this.frameCounter++;
            if (this.frameCounter < this.updateFrequency) {
                this.isUpdating = false;
                return;
            }
            this.frameCounter = 0;

            // Check for significant camera movement
            const currentPosition = this.camera.position.clone();
            if (this.lastCameraPosition) {
                const movementDistance = BABYLON.Vector3.Distance(currentPosition, this.lastCameraPosition);
                if (movementDistance < this.cameraMovementThreshold && this.currentVisibleNodes.size > 0) {
                    this.isUpdating = false;
                    return;
                }
            }
            this.lastCameraPosition = currentPosition;

            // Track which nodes should be visible at which LOD level
            const nodesToShowByLOD = {
                2: new Set(),
                3: new Set(),
                4: new Set()
            };

            // Get all current nodes
            const allNodeNumbers = [...this.nodeCenters.keys()];

            // Add buffer zones to prevent flickering at threshold boundaries
            const bufferZone = this.maxDistance * 0.03; // 3% buffer

            // Process all nodes to determine which to show/hide/unload
            for (const nodeNumber of allNodeNumbers) {
                const depth = this.nodeDepths.get(nodeNumber);
                if (depth !== 2 && depth !== 3 && depth !== 4) continue;

                const center = this.nodeCenters.get(nodeNumber);
                if (!center) continue;

                // Calculate distance to node center
                const centerDistance = BABYLON.Vector3.Distance(this.camera.position, center);

                // Calculate distance to face (center distance minus sphere radius)
                let faceDistance = centerDistance;
                const mesh = this.activeMeshes.get(nodeNumber);
                if (mesh && mesh.getBoundingInfo && mesh.getBoundingInfo()) {
                    const boundingSphere = mesh.getBoundingInfo().boundingSphere;
                    faceDistance = Math.max(0, centerDistance - boundingSphere.radius);
                }

                // Determine which LOD level this node should be visible at, with buffer zones
                if (depth === 2 && faceDistance > (this.threshold80Percent - bufferZone)) {
                    nodesToShowByLOD[2].add(nodeNumber);
                }
                else if (depth === 3 && faceDistance <= (this.threshold80Percent + bufferZone) &&
                    faceDistance > (this.threshold30Percent - bufferZone)) {
                    nodesToShowByLOD[3].add(nodeNumber);
                }
                else if (depth === 4 && faceDistance <= (this.threshold30Percent + bufferZone)) {
                    nodesToShowByLOD[4].add(nodeNumber);
                }
            }

            // Identify meshes that need to be unloaded (not just hidden)
            const meshesToUnload = [];
            for (const nodeNumber of this.loadedNodeNumbers) {
                const depth = this.nodeDepths.get(nodeNumber);
                if (!nodesToShowByLOD[depth]?.has(nodeNumber)) {
                    meshesToUnload.push(nodeNumber);
                }
            }

            // Load the meshes that should be visible
            const loadPromises = [];

            // Process in order of detail priority (highest detail first)
            for (const depth of [4, 3, 2]) {
                for (const nodeNumber of nodesToShowByLOD[depth]) {
                    const existingMesh = this.activeMeshes.get(nodeNumber);

                    if (existingMesh) {
                        // If mesh exists, just make it visible
                        if (!existingMesh.isVisible) {
                            existingMesh.isVisible = true;
                            console.log(`Showing mesh for node ${nodeNumber} at depth ${depth}`);
                        }
                    } else if (!this.isNodeLoading(nodeNumber)) {
                        // If mesh doesn't exist and isn't being loaded, load it
                        loadPromises.push(this.loadMeshForNode(nodeNumber, depth));
                    }
                }
            }

            // Update currently visible nodes for statistics
            this.currentVisibleNodes = new Set([
                ...nodesToShowByLOD[2],
                ...nodesToShowByLOD[3],
                ...nodesToShowByLOD[4]
            ]);

            // Wait for all load operations to complete before unloading old meshes
            if (loadPromises.length > 0) {
                console.log(`Loading ${loadPromises.length} new meshes...`);
                Promise.all(loadPromises)
                    .then(() => {
                        // Now unload meshes that shouldn't be visible anymore
                        // this.unloadMeshes(meshesToUnload);
                    })
                    .catch(error => {
                        console.error("Error loading meshes:", error);
                    })
                    .finally(() => {
                        this.isUpdating = false;
                    });
            } else {
                // If no new meshes to load, proceed with unloading old meshes immediately
                // this.unloadMeshes(meshesToUnload);
                this.isUpdating = false;
            }

            // Add predictive loading for next potential LOD level
            this.predictNextLOD();

        } catch (error) {
            console.error("Error in LOD update:", error);
            this.isUpdating = false;
        }
    }

    // New method to unload meshes
    unloadMeshes(nodeNumbers) {
        for (const nodeNumber of nodeNumbers) {
            const mesh = this.activeMeshes.get(nodeNumber);
            if (mesh) {
                const depth = this.nodeDepths.get(nodeNumber);
                console.log(`Unloading mesh for node ${nodeNumber} at depth ${depth}`);

                // Optionally store mesh data in cache before disposing
                if (this.meshCache.size < this.cacheLimit) {
                    if (mesh.metadata && mesh.metadata.meshData) {
                        this.meshCache.set(nodeNumber, mesh.metadata.meshData);
                    }
                }

                if (mesh && mesh.metadata && mesh.metadata.memoryBytes) {
                    const memoryMB = (mesh.metadata.memoryBytes / (1024 * 1024)).toFixed(2);
                    console.log(`Freeing ${memoryMB} MB of memory by unloading node ${nodeNumber}`);
                }

                // Dispose the mesh and its resources
                if (mesh.material) {
                    mesh.material.dispose();
                }


                mesh.dispose();

                // Remove from active meshes map
                this.activeMeshes.delete(nodeNumber);
                // Remove from loaded nodes set
                this.loadedNodeNumbers.delete(nodeNumber);
            }
        }
    }

    isNodeLoading(nodeNumber) {
        // Initialize nodeLoadingSet if it doesn't exist yet
        if (!this.nodeLoadingSet) {
            this.nodeLoadingSet = new Set();
        }

        // Return true if the node is currently in the loading set
        return this.nodeLoadingSet.has(nodeNumber);
    }

    predictNextLOD() {
        if (!this.camera || !this.lastCameraPosition) return;

        // Calculate camera movement direction and speed
        const direction = this.camera.position.subtract(this.lastCameraPosition);
        const speed = direction.length() / 16.67; // units per millisecond

        if (speed > 0.01) { // Only predict if moving significantly
            // Predict position in next 300ms
            const predictedPosition = this.camera.position.add(direction.normalize().scale(speed * 300));

            // Find nodes that would be visible at the predicted position
            for (const [nodeNumber, center] of this.nodeCenters.entries()) {
                const depth = this.nodeDepths.get(nodeNumber);
                if (depth !== 2 && depth !== 3 && depth !== 4) continue; // Only consider main LOD depths

                const predictedDistance = BABYLON.Vector3.Distance(predictedPosition, center);

                // Check if this node should be loaded based on predicted distance and depth
                if (
                    // For depth 2 (lowest detail)
                    (depth === 2 &&
                        predictedDistance > this.threshold80Percent * 0.95 && // Within 5% of threshold
                        !this.activeMeshes.has(nodeNumber) &&
                        !this.isNodeLoading(nodeNumber)) ||

                    // For depth 3 (medium detail)
                    (depth === 3 &&
                        predictedDistance <= this.threshold80Percent * 1.05 && // Within 5% of threshold
                        predictedDistance > this.threshold30Percent * 0.95 &&
                        !this.activeMeshes.has(nodeNumber) &&
                        !this.isNodeLoading(nodeNumber)) ||

                    // For depth 4 (highest detail)
                    (depth === 4 &&
                        predictedDistance <= this.threshold30Percent * 1.05 && // Within 5% of threshold
                        !this.activeMeshes.has(nodeNumber) &&
                        !this.isNodeLoading(nodeNumber))
                ) {
                    console.log(`Predictively loading mesh for node ${nodeNumber} at depth ${depth} (distance: ${predictedDistance.toFixed(2)})`);
                    this.loadMeshForNode(nodeNumber, depth);
                }
            }
        }
    }

    async loadMeshForNode(nodeNumber, depth) {
        try {
            // Mark this node as currently loading
            this.nodeLoadingSet.add(nodeNumber);

            // First check if the mesh is in cache
            if (this.meshCache.has(nodeNumber)) {
                console.log(`Loading mesh for node ${nodeNumber} from cache`);
                const meshData = this.meshCache.get(nodeNumber);
                const mesh = await this.createMeshFromMergedData(meshData, nodeNumber, depth);
                if (mesh) {
                    mesh.isVisible = true;
                    console.log(`Successfully loaded and showing mesh for node ${nodeNumber} from cache`);
                }
                // Remove from loading set
                this.nodeLoadingSet.delete(nodeNumber);
                return mesh;
            }

            // If not in cache, load from database
             const db = await initDB();
            const store = db.transaction(['mergedMeshes'], 'readonly').objectStore('mergedMeshes');

            const key = `merged_node${nodeNumber}`;
            console.log(`Loading mesh for node ${nodeNumber} at depth ${depth} with key ${key}`);
             const meshData = await this.getStoreItem(store, key);
            console.log("meshData",meshData)

            if (meshData) {
                const mesh = await this.createMeshFromMergedData(meshData, nodeNumber, depth);
                if (mesh) {
                    mesh.isVisible = true;
                    console.log(`Successfully loaded and showing mesh for node ${nodeNumber} at depth ${depth}`);
                }
                // Remove from loading set
                this.nodeLoadingSet.delete(nodeNumber);
                return mesh;
            } else {
                console.warn(`No mesh data found for node ${nodeNumber} at depth ${depth}`);
                this.nodeLoadingSet.delete(nodeNumber);
            }
        } catch (error) {
            console.error(`Error loading mesh for node ${nodeNumber}:`, error);
            // Make sure to remove from loading set even on error
            this.nodeLoadingSet.delete(nodeNumber);
        }
        return null;
    }

    getActiveLODLevel() {
        // Calculate average face distance of visible nodes
        const distances = [];

        for (const nodeNumber of this.currentVisibleNodes) {
            const center = this.nodeCenters.get(nodeNumber);
            const mesh = this.activeMeshes.get(nodeNumber);

            if (center) {
                const centerDistance = BABYLON.Vector3.Distance(this.camera.position, center);

                // Calculate face distance
                let faceDistance = centerDistance;
                if (mesh && mesh.getBoundingInfo && mesh.getBoundingInfo()) {
                    const boundingSphere = mesh.getBoundingInfo().boundingSphere;
                    faceDistance = Math.max(0, centerDistance - boundingSphere.radius);
                }

                distances.push(faceDistance);
            }
        }

        if (distances.length === 0) return 0;

        // Use median rather than average for more stability
        distances.sort((a, b) => a - b);
        const medianDistance = distances[Math.floor(distances.length / 2)];

        if (medianDistance > this.threshold80Percent) {
            return 2;
        } else if (medianDistance > this.threshold30Percent) {
            return 3;
        } else {
            return 4;
        }
    }

    calculateMeshMemoryUsage(mesh) {
        if (!mesh) return 0;
        if (!mesh.geometry) return 0;

        let memoryBytes = 0;

        try {
            // Calculate vertex data memory
            const vertexBuffers = mesh.geometry.getVertexBuffers();
            if (vertexBuffers) {
                for (const key in vertexBuffers) {
                    const buffer = vertexBuffers[key];
                    if (buffer && buffer.getData && typeof buffer.getData === 'function') {
                        const data = buffer.getData();
                        if (data && data.length) {
                            memoryBytes += data.length * 4; // Float32Array = 4 bytes per element
                        }
                    }
                }
            }

            // Calculate index buffer memory
            const indexBuffer = mesh.geometry.getIndexBuffer();
            if (indexBuffer && indexBuffer.length) {
                memoryBytes += indexBuffer.length * 4; // Uint32Array = 4 bytes per element
            }

            // Add material textures memory (rough estimate)
            if (mesh.material) {
                if (mesh.material.diffuseTexture) memoryBytes += this.estimateTextureMemory(mesh.material.diffuseTexture);
                if (mesh.material.bumpTexture) memoryBytes += this.estimateTextureMemory(mesh.material.bumpTexture);
                if (mesh.material.ambientTexture) memoryBytes += this.estimateTextureMemory(mesh.material.ambientTexture);
                if (mesh.material.specularTexture) memoryBytes += this.estimateTextureMemory(mesh.material.specularTexture);
            }
        } catch (error) {
            console.warn(`Error calculating memory for mesh ${mesh.name || "unknown"}:`, error);
            // Return a minimum memory estimate if calculation fails
            return 1024; // 1KB as fallback
        }

        return memoryBytes;
    }

    // Improved texture memory estimation with better error handling
    estimateTextureMemory(texture) {
        if (!texture) return 0;

        try {
            // Use safe methods to get sizes
            let width = 256;  // Default fallback size
            let height = 256; // Default fallback size

            // Try to get actual size
            if (texture.getSize && typeof texture.getSize === 'function') {
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

            // Ensure we have positive numbers
            width = Math.max(1, width);
            height = Math.max(1, height);

            // Estimate based on RGBA (4 bytes per pixel)
            return width * height * 4;
        } catch (error) {
            console.warn("Error estimating texture memory:", error);
            return 262144; // 256x256x4 as fallback
        }
    }

    // Improved total memory usage calculation
    getTotalMemoryUsage() {
        let totalMemory = 0;

        try {
            // Calculate memory for each active mesh
            this.activeMeshes.forEach(mesh => {
                const meshMemory = this.calculateMeshMemoryUsage(mesh);
                if (!isNaN(meshMemory) && isFinite(meshMemory)) {
                    totalMemory += meshMemory;
                }
            });

            // Convert to MB with 2 decimal places
            const memoryInMB = totalMemory / (1024 * 1024);

            if (isNaN(memoryInMB) || !isFinite(memoryInMB)) {
                console.warn("Memory calculation resulted in NaN or Infinity:", totalMemory);
                return "0.00"; // Return a valid string if calculation fails
            }

            return memoryInMB.toFixed(2);
        } catch (error) {
            console.error("Error calculating total memory usage:", error);
            return "0.00"; // Return a valid string if calculation fails
        }
    }

    // Enhanced memory usage reporting
    getMemoryUsage() {
        const memoryMB = this.getTotalMemoryUsage();

        return {
            loadedNodes: this.loadedNodeNumbers.size || 0,
            activeMeshes: this.activeMeshes.size || 0,
            cachedMeshes: this.meshCache.size || 0,
            memoryMB: memoryMB
        };
    }



    // Optional method to manage mesh cache
    cleanupCache() {
        // Limit cache size if it gets too large
        if (this.meshCache.size > this.cacheLimit) {
            // Remove oldest entries first (simple implementation)
            const keysToRemove = Array.from(this.meshCache.keys()).slice(0, this.meshCache.size - this.cacheLimit);
            keysToRemove.forEach(key => this.meshCache.delete(key));
            console.log(`Cleaned up cache, removed ${keysToRemove.length} entries`);
        }
    }
}

