import * as BABYLON from "@babylonjs/core";

// Optimized Vector3 implementation
class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  
    add(other) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
  
    subtract(other) {
      this.x -= other.x;
      this.y -= other.y;
      this.z -= other.z;
      return this;
    }
  
    scale(factor) {
      this.x *= factor;
      this.y *= factor;
      this.z *= factor;
      return this;
    }
  
    length() {
      return Math.hypot(this.x, this.y, this.z);
    }
  
    normalize() {
      const len = this.length();
      if (len === 0) return new Vector3();
      return this.scale(1 / len);
    }
  
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
  
    static dot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }
  
    static cross(a, b) {
      return new Vector3(
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
      );
    }
  
    static distance(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return Math.hypot(dx, dy, dz);
    }
  }
  
  // Cache for vertices and computations
  const vertexCache = new Map();
  const normalCache = new Map();
  
  export function simplifyMeshData(meshData, angleThreshold, meshId) {
    // Extract the data from the mesh
    const positions = meshData.geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const normals = meshData.geometry.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    const indices = meshData.geometry.getIndices();
  
    if (!positions || !normals || !indices) {
      throw new Error("Invalid mesh data");
    }
  
    const initialFaceCount = indices.length / 3;
    if (initialFaceCount <= 64) {
      // No need to simplify very small meshes
      return {
        positions: positions,
        normals: normals,
        indices: indices
      };
    }
  
    // Use TypedArrays for better performance
    const posArray = new Float32Array(positions);
    const normArray = new Float32Array(normals);
    const idxArray = new Uint32Array(indices);
  
    // Pre-allocate arrays for better memory usage
    const faceNormals = new Array(initialFaceCount);
    const faceCenters = new Array(initialFaceCount);
  
    // Process faces in batches for better performance
    const BATCH_SIZE = 1000;
    for (let i = 0; i < indices.length; i += BATCH_SIZE * 3) {
      const endIdx = Math.min(i + BATCH_SIZE * 3, indices.length);
      processFaceBatch(
        posArray, idxArray, i, endIdx,
        faceNormals, faceCenters
      );
    }
  
    const angleThresholdRad = (angleThreshold * Math.PI) / 180;
    const positionPrecision = calculateMergingThreshold(
      faceNormals, faceCenters, angleThresholdRad
    );
  
    // Create vertex data structure using pre-allocated arrays
    const vertexCount = positions.length / 3;
    const vertices = new Array(vertexCount);
    
    for (let i = 0; i < vertexCount; i++) {
      vertices[i] = {
        position: getVertexPosition(posArray, i),
        normal: getVertexNormal(normArray, i),
        originalIndex: i
      };
    }
  
    // Optimize vertex merging
    const { mergedVertices, indexMap } = mergeVertices(
      vertices, positionPrecision, angleThresholdRad
    );
  
    // Create final buffers
    const { newPositions, newNormals, newIndices } = createFinalBuffers(
      mergedVertices, indexMap, idxArray
    );
  
    // Return the simplified mesh data
    return {
      positions: newPositions,
      normals: newNormals,
      indices: newIndices
    };
  }
  
  function processFaceBatch(positions, indices, startIdx, endIdx, faceNormals, faceCenters) {
    for (let i = startIdx; i < endIdx; i += 3) {
      const faceIdx = i / 3;
      const p1 = getVertex(positions, indices[i]);
      const p2 = getVertex(positions, indices[i + 1]);
      const p3 = getVertex(positions, indices[i + 2]);
  
      const v1 = p2.clone().subtract(p1);
      const v2 = p3.clone().subtract(p1);
      
      faceNormals[faceIdx] = Vector3.cross(v1, v2).normalize();
      faceCenters[faceIdx] = p1.clone().add(p2).add(p3).scale(1/3);
    }
  }
  
  function getVertex(positions, index) {
    const key = index.toString();
    if (!vertexCache.has(key)) {
      vertexCache.set(key, new Vector3(
        positions[index * 3],
        positions[index * 3 + 1],
        positions[index * 3 + 2]
      ));
    }
    return vertexCache.get(key);
  }
  
  function getVertexPosition(positions, index) {
    return new Vector3(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2]
    );
  }
  
  function getVertexNormal(normals, index) {
    return new Vector3(
      normals[index * 3],
      normals[index * 3 + 1],
      normals[index * 3 + 2]
    );
  }
  
  function calculateMergingThreshold(faceNormals, faceCenters, angleThresholdRad) {
    let totalDistance = 0;
    let validPairCount = 0;
  
    // Process only a subset of faces for threshold calculation
    const sampleSize = Math.min(1000, faceNormals.length);
    const step = Math.max(1, Math.floor(faceNormals.length / sampleSize));
  
    for (let i = 0; i < faceNormals.length; i += step) {
      for (let j = i + 1; j < Math.min(i + step * 10, faceNormals.length); j++) {
        const normalAngle = Math.acos(
          Math.max(-1, Math.min(1, Vector3.dot(faceNormals[i], faceNormals[j])))
        );
  
        if (normalAngle <= angleThresholdRad) {
          const distance = Vector3.distance(faceCenters[i], faceCenters[j]);
          totalDistance += distance;
          validPairCount++;
        }
      }
    }
  
    const averageDistance = validPairCount > 0 ? totalDistance / validPairCount : 0.001;
    return averageDistance * Math.tan(angleThresholdRad);
  }
  
  function mergeVertices(vertices, positionPrecision, angleThresholdRad) {
    const mergedVertices = [];
    const indexMap = new Map();
    const spatialMap = new Map(); // Simple spatial hashing
  
    for (const vertex of vertices) {
      // Create spatial hash key
      const hashKey = [
        Math.floor(vertex.position.x / positionPrecision),
        Math.floor(vertex.position.y / positionPrecision),
        Math.floor(vertex.position.z / positionPrecision)
      ].join(',');
  
      let merged = false;
      const nearbyIndices = spatialMap.get(hashKey) || [];
  
      for (const nearbyIdx of nearbyIndices) {
        const mergedVertex = mergedVertices[nearbyIdx];
        const posDist = Vector3.distance(vertex.position, mergedVertex.position);
  
        if (posDist <= positionPrecision) {
          const normalAngle = Math.acos(
            Math.max(-1, Math.min(1, Vector3.dot(vertex.normal, mergedVertex.normal)))
          );
  
          if (normalAngle <= angleThresholdRad) {
            mergedVertex.position.add(vertex.position).scale(0.5);
            mergedVertex.normal.add(vertex.normal).normalize();
            indexMap.set(vertex.originalIndex, nearbyIdx);
            merged = true;
            break;
          }
        }
      }
  
      if (!merged) {
        indexMap.set(vertex.originalIndex, mergedVertices.length);
        if (!spatialMap.has(hashKey)) {
          spatialMap.set(hashKey, []);
        }
        spatialMap.get(hashKey).push(mergedVertices.length);
        mergedVertices.push(vertex);
      }
    }
  
    return { mergedVertices, indexMap };
  }
  
  function createFinalBuffers(mergedVertices, indexMap, indices) {
    const newPositions = [];
    const newNormals = [];
    const newIndices = [];
    const processedFaces = new Set();
  
    mergedVertices.forEach(vertex => {
      newPositions.push(vertex.position.x, vertex.position.y, vertex.position.z);
      newNormals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
    });
  
    for (let i = 0; i < indices.length; i += 3) {
      const idx1 = indexMap.get(indices[i]);
      const idx2 = indexMap.get(indices[i + 1]);
      const idx3 = indexMap.get(indices[i + 2]);
  
      if (idx1 === undefined || idx2 === undefined || idx3 === undefined) continue;
      if (idx1 === idx2 || idx2 === idx3 || idx3 === idx1) continue;
  
      const faceKey = [idx1, idx2, idx3].sort().join(',');
      if (!processedFaces.has(faceKey)) {
        newIndices.push(idx1, idx2, idx3);
        processedFaces.add(faceKey);
      }
    }
  
    return { newPositions, newNormals, newIndices };
  }