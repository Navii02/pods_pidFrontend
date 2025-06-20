/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */
import * as BABYLON from "@babylonjs/core";

export   const focusOnSelectedMesh = (scene,mesh) => {
    if (!scene || !mesh) return;

    // Calculate bounding info
    const boundingInfo = mesh.getBoundingInfo();
    const center = boundingInfo.boundingBox.centerWorld;

    // Calculate size for appropriate distance
    const size = boundingInfo.boundingBox.maximumWorld.subtract(
      boundingInfo.boundingBox.minimumWorld
    );
    const maxDimension = Math.max(size.x, size.y, size.z);

    // If Arc Rotate camera, set target and radius
    if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
      scene.activeCamera.setTarget(center);
      scene.activeCamera.radius = maxDimension * 2; // Position at a reasonable distance
    }
    // If FreeCamera, move to position in front of the mesh
    else if (scene.activeCamera instanceof BABYLON.FreeCamera) {
      // Calculate position in front of the object
      const distance = maxDimension * 2;
      const direction = scene.activeCamera.getDirection(
        BABYLON.Vector3.Forward()
      );
      const newPosition = center.subtract(direction.scale(-distance));

      // Set position and target
      scene.activeCamera.position = newPosition;
      scene.activeCamera.setTarget(center);
    }
  };