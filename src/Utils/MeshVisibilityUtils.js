export const addSmallMeshVisibilityMethods = (mesh) => {
    const SMALL_MESH_THRESHOLD = 0.1; // Screen coverage threshold for "small" meshes
    
    if (!mesh._originalIndices) {
        mesh._originalIndices = mesh.getIndices().slice();
    }
    
    mesh._smallMeshesHidden = false;
    mesh._hiddenMeshIds = new Set();
    
    mesh.hideSmallMeshes = function() {
        if (this._smallMeshesHidden) return;
        
        console.log(`Hiding small meshes for ${this.name}`);
        
        if (!this.metadata?.vertexMappings) {
            console.warn('No vertex mappings found for mesh', this.name);
            return;
        }
        
        const originalIndices = this._originalIndices;
        const vertexMappings = this.metadata.vertexMappings;
        
        const smallMeshMappings = vertexMappings.filter(mapping => 
            mapping.screenCoverage < SMALL_MESH_THRESHOLD
        );
        
        if (smallMeshMappings.length === 0) {
            console.log('No small meshes found to hide');
            return;
        }
        
        console.log(`Found ${smallMeshMappings.length} small meshes to hide`);
        
        const newIndices = [];
        const hiddenRanges = smallMeshMappings.map(mapping => ({
            start: mapping.startIndex,
            end: mapping.startIndex + mapping.indexCount,
            meshId: mapping.meshId
        }));
        
        this._hiddenMeshIds.clear();
        hiddenRanges.forEach(range => this._hiddenMeshIds.add(range.meshId));
        
        for (let i = 0; i < originalIndices.length; i++) {
            const isInHiddenRange = hiddenRanges.some(range => 
                i >= range.start && i < range.end
            );
            
            if (!isInHiddenRange) {
                newIndices.push(originalIndices[i]);
            }
        }
        
        console.log(`Reduced indices from ${originalIndices.length} to ${newIndices.length}`);
        
        this.updateIndices(new Uint32Array(newIndices));
        this._smallMeshesHidden = true;
        this.refreshBoundingInfo();
    };
    
    mesh.showSmallMeshes = function() {
        if (!this._smallMeshesHidden) return;
        
        console.log(`Showing small meshes for ${this.name}`);
        
        this.updateIndices(new Uint32Array(this._originalIndices));
        this._smallMeshesHidden = false;
        this._hiddenMeshIds.clear();
        this.refreshBoundingInfo();
    };
    
    mesh.areSmallMeshesHidden = function() {
        return this._smallMeshesHidden;
    };
    
    mesh.getHiddenMeshIds = function() {
        return Array.from(this._hiddenMeshIds);
    };
};

export const enableSmallMeshHiding = (scene) => {
    const mergedMeshes = scene.meshes.filter(mesh => 
        mesh.metadata?.vertexMappings
    );
    
    console.log(`Enabling small mesh hiding for ${mergedMeshes.length} merged meshes`);
    
    mergedMeshes.forEach(mesh => {
        addSmallMeshVisibilityMethods(mesh);
    });
    
    return mergedMeshes;
};

export const hideAllSmallMeshes = (scene) => {
    const mergedMeshes = scene.meshes.filter(mesh => 
        mesh.hideSmallMeshes && typeof mesh.hideSmallMeshes === 'function'
    );
    
    console.log(`Hiding small meshes in ${mergedMeshes.length} merged meshes`);
    mergedMeshes.forEach(mesh => mesh.hideSmallMeshes());
    
    return mergedMeshes.length;
};

export const showAllSmallMeshes = (scene) => {
    const mergedMeshes = scene.meshes.filter(mesh => 
        mesh.showSmallMeshes && typeof mesh.showSmallMeshes === 'function'
    );
    
    console.log(`Showing small meshes in ${mergedMeshes.length} merged meshes`);
    mergedMeshes.forEach(mesh => mesh.showSmallMeshes());
    
    return mergedMeshes.length;
};

export const getSceneVisibilityStats = (scene) => {
    const mergedMeshes = scene.meshes.filter(mesh => 
        mesh.metadata?.isLodMesh && mesh.metadata?.vertexMappings
    );
    
    const stats = {
        totalMergedMeshes: mergedMeshes.length,
        totalSmallMeshes: 0,
        totalLargeMeshes: 0,
        hiddenMeshes: 0,
        visibleMeshes: 0
    };
    
    mergedMeshes.forEach(mesh => {
        if (mesh.metadata?.vertexMappings) {
            const vertexMappings = mesh.metadata.vertexMappings;
            const smallMeshes = vertexMappings.filter(mapping => 
                mapping.screenCoverage < 0.1
            );
            const largeMeshes = vertexMappings.filter(mapping => 
                mapping.screenCoverage >= 0.1
            );
            
            stats.totalSmallMeshes += smallMeshes.length;
            stats.totalLargeMeshes += largeMeshes.length;
            
            if (mesh._smallMeshesHidden) {
                stats.hiddenMeshes += mesh._hiddenMeshIds ? mesh._hiddenMeshIds.size : 0;
            } else {
                stats.visibleMeshes += smallMeshes.length;
            }
        }
    });
    
    return stats;
};