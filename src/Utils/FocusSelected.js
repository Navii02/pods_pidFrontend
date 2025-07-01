/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */
import * as BABYLON from "@babylonjs/core";

export const focusOnSelectedMesh = (scene, meshes) => {
  if (!scene || !meshes || meshes.length === 0) return;

  // Combine bounding boxes of all selected meshes
  let min = null;
  let max = null;

  meshes.forEach(mesh => {
    if (!mesh.getBoundingInfo || mesh.name==='__root__') return;
    const boundingBox = mesh.getBoundingInfo().boundingBox;
    const minBox = boundingBox.minimumWorld;
    const maxBox = boundingBox.maximumWorld;

    if (!min) {
      min = minBox.clone();
      max = maxBox.clone();
    } else {
      min = BABYLON.Vector3.Minimize(min, minBox);
      max = BABYLON.Vector3.Maximize(max, maxBox);
    }
  });

  if (!min || !max) return;
   console.log(min,max);
  const center = min.add(max).scale(0.5);
  console.log(center);
  const size = max.subtract(min);
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = maxDimension * 2;

  const camera = scene.activeCamera;

  if (camera instanceof BABYLON.ArcRotateCamera) {
    camera.setTarget(center);
  } else if (camera instanceof BABYLON.FreeCamera) {
    const direction = camera.getDirection(BABYLON.Vector3.Forward());
    const newPosition = center.subtract(direction.scale(distance));
    camera.position = newPosition;
    camera.setTarget(center);
  }
};
