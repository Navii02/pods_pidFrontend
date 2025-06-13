/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */

import * as BABYLON from "@babylonjs/core";

export const setupLighting = (scene, camera) => {
  // Top light (Hemispheric doesn't have direction, so no need to attach)
  const topLight = new BABYLON.HemisphericLight(
    "topLight",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  topLight.intensity = 0.4;
  topLight.diffuse = new BABYLON.Color3(1, 1, 1);
  topLight.specular = new BABYLON.Color3(1, 1, 1);
  topLight.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5);

  // Helper to attach directional lights to the camera
  const createDirectionalLight = (name, direction, intensity, color) => {
    const light = new BABYLON.DirectionalLight(name, direction, scene);
    light.intensity = intensity;
    if (color) {
      light.diffuse = color;
    }
    light.parent = camera; // 🔗 Attach to camera
    return light;
  };

  const frontLight = createDirectionalLight(
    "frontLight",
    new BABYLON.Vector3(0, 0, -1),
    0.3,
    new BABYLON.Color3(1, 0.9, 0.8)
  );

  const backLight = createDirectionalLight(
    "backLight",
    new BABYLON.Vector3(0, 0, 1),
    0.1,
    new BABYLON.Color3(0.8, 0.9, 1)
  );

  const leftLight = createDirectionalLight("leftLight", new BABYLON.Vector3(-1, 0, 0), 0.2);
  const rightLight = createDirectionalLight("rightLight", new BABYLON.Vector3(1, 0, 0), 0.2);
  const bottomLight = createDirectionalLight("bottomLight", new BABYLON.Vector3(0, -1, 0), 0.1);

  return {
    topLight,
    frontLight,
    backLight,
    leftLight,
    rightLight,
    bottomLight,
  };
};


// export   const setupLighting = (scene) => {
//     // Top light (white)
//     const topLight = new BABYLON.HemisphericLight(
//       "topLight",
//       new BABYLON.Vector3(0, 1, 0),
//       scene
//     );
//     topLight.intensity = 0.4;
//     topLight.diffuse = new BABYLON.Color3(1, 1, 1);
//     // topLight.specular = new BABYLON.Color3(1, 1, 1);
//     topLight.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5);

//     // Front light (warm)
//     const frontLight = new BABYLON.DirectionalLight(
//       "frontLight",
//       new BABYLON.Vector3(0, 0, -1),
//       scene
//     );
//     frontLight.intensity = 0.3;
//     frontLight.diffuse = new BABYLON.Color3(1, 0.9, 0.8);

//     // Back light (cool)
//     const backLight = new BABYLON.DirectionalLight(
//       "backLight",
//       new BABYLON.Vector3(0, 0, 1),
//       scene
//     );
//     backLight.intensity = 0.1;
//     backLight.diffuse = new BABYLON.Color3(0.8, 0.9, 1);

//     // Left light
//     const leftLight = new BABYLON.DirectionalLight(
//       "leftLight",
//       new BABYLON.Vector3(-1, 0, 0),
//       scene
//     );
//     leftLight.intensity = 0.2;

//     // Right light
//     const rightLight = new BABYLON.DirectionalLight(
//       "rightLight",
//       new BABYLON.Vector3(1, 0, 0),
//       scene
//     );
//     rightLight.intensity = 0.2;

//     // Bottom fill light (subtle)
//     const bottomLight = new BABYLON.DirectionalLight(
//       "bottomLight",
//       new BABYLON.Vector3(0, -1, 0),
//       scene
//     );
//     bottomLight.intensity = 0.1;

//     return {
//       topLight,
//       frontLight,
//       backLight,
//       leftLight,
//       rightLight,
//       bottomLight,
//     };
//   };

// export const setupLighting = (scene, camera) => {
//   // Top light (ambient)
//   const topLight = new BABYLON.HemisphericLight(
//     "topLight",
//     new BABYLON.Vector3(0, 1, 0),
//     scene
//   );
//   topLight.intensity = 0.4;
//   topLight.diffuse = new BABYLON.Color3(1, 1, 1);
//   topLight.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5);

//   // Headlight (attached to camera)
//   const headLight = new BABYLON.DirectionalLight("headLight", new BABYLON.Vector3(0, 0, -1), scene);
//   headLight.intensity = 0.6;
//   headLight.diffuse = new BABYLON.Color3(1, 1, 1);

//   // Attach headlight to camera position/direction
//   scene.registerBeforeRender(() => {
//     headLight.position = camera.position;
//     headLight.direction = camera.getForwardRay().direction;
//   });

//   // Optional: Additional fill lights
//   const backLight = new BABYLON.DirectionalLight("backLight", new BABYLON.Vector3(0, 0, 1), scene);
//   backLight.intensity = 0.1;

//   const leftLight = new BABYLON.DirectionalLight("leftLight", new BABYLON.Vector3(-1, 0, 0), scene);
//   leftLight.intensity = 0.2;

//   const rightLight = new BABYLON.DirectionalLight("rightLight", new BABYLON.Vector3(1, 0, 0), scene);
//   rightLight.intensity = 0.2;

//   const bottomLight = new BABYLON.DirectionalLight("bottomLight", new BABYLON.Vector3(0, -1, 0), scene);
//   bottomLight.intensity = 0.1;

//   return {
//     topLight,
//     headLight,
//     backLight,
//     leftLight,
//     rightLight,
//     bottomLight,
//   };
// };
