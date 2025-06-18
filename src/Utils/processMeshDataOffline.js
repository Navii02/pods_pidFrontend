/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */
import * as BABYLON from "@babylonjs/core";

export const processMeshDataOffline = (meshDataArray) => {
    let totalVertices = 0;
    let totalIndices = 0;
    let hasColors = false;

    // First pass to determine sizes and if any mesh uses color
    meshDataArray.forEach(mesh => {
        totalVertices += mesh.positions.length / 3;
        totalIndices += mesh.indices.length;
        if (mesh.color || mesh.colors) hasColors = true;
    });

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedIndices = new Uint32Array(totalIndices);
    const mergedNormals = new Float32Array(totalVertices * 3);
    const mergedColors = hasColors ? new Float32Array(totalVertices * 4) : null;

    let vertexOffset = 0;
    let indexOffset = 0;
    
    // NEW: Track vertex mappings for click detection
    const vertexMappings = [];
    const vertexCounts = [];

    meshDataArray.forEach((mesh, meshIndex) => {
        const vertexCount = mesh.positions.length / 3;
        
        // NEW: Store vertex mapping information
        vertexMappings.push({
            meshIndex: meshIndex,
            startVertex: vertexOffset,
            vertexCount: vertexCount,
            startIndex: indexOffset,
            indexCount: mesh.indices.length
        });
        
        // NEW: Store vertex count for this mesh
        vertexCounts.push(vertexCount);

        // Handle transforms
        if (mesh.transforms) {
            const matrix = mesh.transforms.worldMatrix
                ? BABYLON.Matrix.FromArray(mesh.transforms.worldMatrix)
                : BABYLON.Matrix.Compose(
                    new BABYLON.Vector3(...Object.values(mesh.transforms.scaling)),
                    BABYLON.Quaternion.FromEulerAngles(
                        mesh.transforms.rotation[0],
                        mesh.transforms.rotation[1],
                        mesh.transforms.rotation[2]
                    ),
                    new BABYLON.Vector3(...Object.values(mesh.transforms.position))
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

    // NEW: Return additional mapping information
    return {
        positions: mergedPositions,
        indices: mergedIndices,
        normals: mergedNormals,
        colors: mergedColors,
        vertexMappings: vertexMappings,  // NEW: For click detection
        vertexCounts: vertexCounts       // NEW: For easier access
    };
};

