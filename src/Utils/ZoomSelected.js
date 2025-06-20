/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */

import * as BABYLON from "@babylonjs/core";

export const zoomOnSelectedMesh = (scene, mesh) => {
  if (!scene || !mesh) return;

  const boundingInfo = mesh.getBoundingInfo();
  const center = boundingInfo.boundingBox.centerWorld;

  const size = boundingInfo.boundingBox.maximumWorld.subtract(
    boundingInfo.boundingBox.minimumWorld
  );
  const maxDimension = Math.max(size.x, size.y, size.z);

  const distance = maxDimension * 2;

  const camera = scene.activeCamera;

  if (camera instanceof BABYLON.ArcRotateCamera) {
    camera.setTarget(center);
    camera.radius = distance;
  } 
  else if (camera instanceof BABYLON.FreeCamera) {
    const direction = camera.getDirection(BABYLON.Vector3.Forward());
    const newPosition = center.subtract(direction.scale(distance));
    camera.position = newPosition;
    camera.setTarget(center);
  }
};
