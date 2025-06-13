/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */

import * as BABYLON from "@babylonjs/core";


export const calculateAngle = (a, b, c, d) => {
    const a1 = b.x - a.x;
    const b1 = b.y - a.y;
    const c1 = b.z - a.z;
    const a2 = d.x - c.x;
    const b2 = d.y - c.y;
    const c2 = d.z - c.z;
  
    const dotProduct = a1 * a2 + b1 * b2 + c1 * c2;
    const magA = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2) + Math.pow(c1, 2));
    const magB = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2) + Math.pow(c2, 2));
  
    let cosTheta = dotProduct / (magA * magB);
    if (isNaN(cosTheta)) cosTheta = 0;
    else if (cosTheta > 1) cosTheta = 1;
  
    const theta = Math.acos(cosTheta) * (180 / Math.PI);
    return theta;
  };
  
  export const calculatePlanAngle = (a, b) => {
    const c = new BABYLON.Vector3(b.x, a.y, b.z);
    const d = new BABYLON.Vector3(a.x, a.y, a.z + 1);
  
    let theta = calculateAngle(a, c, a, d);
    if (a.x > c.x) theta = 360 - theta;
    return theta;
  };
  
  export const calculateElevationAngle = (a, b) => {
    const c = new BABYLON.Vector3(b.x, b.y, a.z);
    const d = new BABYLON.Vector3(a.x, a.y + 1, a.z);
  
    let theta = calculateAngle(a, c, a, d);
    if (a.y > c.y) theta = 360 - theta;
    return theta;
  };
  

  export const calculateCumulativeBoundingBox = (meshes) => {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
  
    meshes.forEach((mesh) => {
      if (!mesh.isVisible || !mesh.getBoundingInfo) return;
  
      const boundingInfo = mesh.getBoundingInfo();
      const localMin = boundingInfo.boundingBox.minimumWorld;
      const localMax = boundingInfo.boundingBox.maximumWorld;
  
      min = BABYLON.Vector3.Minimize(min, localMin);
      max = BABYLON.Vector3.Maximize(max, localMax);
    });
  
    return { minimum: min, maximum: max };
  };
  
  export const isDateInRange = (date, start, end) => {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
  
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
  
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);
  
    return compareDate >= startDate && compareDate <= endDate;
  };
  
  export const radiansToDegrees = (radians) => {
    return radians * (180 / Math.PI);
  };
  
  export const degreesToRadians = (degrees) => {
    return degrees * (Math.PI / 180);
  };
  
  export const calculateEnvironmentSize = (modelInfo) => {
    if (!modelInfo) {
      return 2000; // Default size if no models loaded
    }
    let environmentSize = 5000; // Much larger default
    // Get model dimensions
    const min = modelInfo.boundingBoxMin;
    const max = modelInfo.boundingBoxMax;
  
    // If model info isn't available yet
    if (!min || !max) {
      return 2000; // Default size
    }
  
    // Calculate size based on model dimensions
    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);
  
    // Environment should be at least 10x larger than model
    // but not too small or too large
    environmentSize = Math.max(5000, maxDimension * 20); // Make sure it's large enough
    console.log("Environment size calculated as:", environmentSize);
  
    return environmentSize;
  };