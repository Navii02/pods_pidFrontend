import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

// export class BabylonVRHelper {
//   static VR = {
//     ENTER: 0,
//     EXIT: 1
//   }

//   constructor(scene, camera) {
//     this.scene = scene;
//     this.camera = camera;
//     this.engine = scene.getEngine();
//     this.xrHelper = null;
//     this.onVRChangeListener = null;
//     this.isInVR = false;

//     // Movement properties
//     this.movementSpeed = 0.05;
//     this.rotationSpeed = 0.01;
//     this.movementEnabled = true;
//     this.deadZone = 0.15;
//     this.movementMode = 'horizontal';

//     // Selection properties
//     this.selectedMesh = null;
//     this.originalMaterial = null;
//     this.highlightMaterial = null;
//     this.infoPanel = null;

//     this.directionalThreshold = 0.3;
//     this.diagonalThreshold = 0.7;
//   }

//   async initWithExistingXR(existingXRHelper) {
//     try {
//       this.xrHelper = existingXRHelper;
//       this.setupVRHandlers();
//       this.setupSelectionSystem();

//       // Setup movement controls when in XR
//       if (this.xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
//         this.setupMovementControls();
//         this.isInVR = true;
//       }

//       this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
//         if (state === BABYLON.WebXRState.IN_XR) {
//           this.setupMovementControls();
//           this.onEnterVR();
//         } else if (state === BABYLON.WebXRState.EXITING_XR) {
//           this.onExitVR();
//         }
//       });

//       console.log("VR Helper initialized with existing XR session");
//     } catch (error) {
//       console.error("Failed to initialize VR Helper with existing XR:", error);
//     }
//   }

//   setupSelectionSystem() {
//     // Create highlight material
//     this.highlightMaterial = new BABYLON.StandardMaterial("highlightMat", this.scene);
//     this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
//     this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0);
//     this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0);

//     this.setupInfoGUI();
//   }

//   setupInfoGUI() {
//     if (typeof GUI === 'undefined') {
//       console.warn("BABYLON.GUI not loaded - using console output for mesh info");
//       this.guiAvailable = false;
//       return;
//     }

//     try {
//       this.guiAvailable = true;

//       this.guiPlane = BABYLON.MeshBuilder.CreatePlane("guiPlane", {
//         size: 2,
//         sideOrientation: BABYLON.Mesh.DOUBLESIDE
//       }, this.scene);

//       this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
//       this.guiPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
//       this.guiPlane.isPickable = false;

//       const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
//         this.guiPlane,
//         1024,
//         1024,
//         true
//       );

//       this.infoPanel = new GUI.Rectangle("infoPanel");
//       this.infoPanel.widthInPixels = 950;
//       this.infoPanel.heightInPixels = 600;
//       this.infoPanel.cornerRadius = 20;
//       this.infoPanel.color = "white";
//       this.infoPanel.thickness = 4;
//       this.infoPanel.background = "rgba(0, 0, 0, 0.9)";
//       this.infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
//       this.infoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

//       this.infoText = new GUI.TextBlock("infoText");
//       this.infoText.text = "";
//       this.infoText.color = "white";
//       this.infoText.fontSize = 36;
//       this.infoText.fontFamily = "Arial";
//       this.infoText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
//       this.infoText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
//       this.infoText.paddingLeftInPixels = 40;
//       this.infoText.paddingTopInPixels = 40;
//       this.infoText.textWrapping = true;

//       this.infoPanel.addControl(this.infoText);
//       advancedTexture.addControl(this.infoPanel);
//       this.guiPlane.setEnabled(false);

//       console.log("VR-compatible GUI system initialized successfully");
//     } catch (error) {
//       console.warn("Failed to initialize VR GUI:", error);
//       this.guiAvailable = false;
//     }
//   }

//   setupVRHandlers() {
//     if (!this.xrHelper) return;

//     this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
//       if (state === BABYLON.WebXRState.ENTERING_XR) {
//         this.onEnterVR();
//       } else if (state === BABYLON.WebXRState.EXITING_XR) {
//         this.onExitVR();
//       }
//     });
//   }

//   setupMovementControls() {
//     this.xrHelper.input.onControllerAddedObservable.add((controller) => {
//       if (controller.inputSource.handedness === 'right' || controller.inputSource.handedness === 'none') {
//         this.setupControllerMovement(controller);
//       }
//     });
//   }

//   setupControllerMovement(controller) {
//     controller.onMotionControllerInitObservable.add((motionController) => {
//       const thumbstick = motionController.getComponent("xr-standard-thumbstick");
//       const aButton = motionController.getComponent("a-button");

//       if (thumbstick) {
//         console.log("Thumbstick controller found - movement enabled");

//         thumbstick.onButtonStateChangedObservable.add((component) => {
//           if (component.pressed) {
//             console.log("R3 button pressed");
//             this.onR3ButtonPressed();
//           } else {
//             console.log("R3 button released");
//             this.onR3ButtonReleased();
//           }
//         });

//         this.scene.registerBeforeRender(() => {
//           if (this.isInVR && this.movementEnabled && thumbstick.axes) {
//             this.updateMovement(thumbstick.axes);
//           }
//         });
//       }

//       if (aButton) {
//         console.log("A button found - selection enabled");

//         aButton.onButtonStateChangedObservable.add((component) => {
//           if (component.pressed) {
//             console.log("A button pressed - selecting mesh");
//             this.selectMeshAtController(controller);
//           }
//         });
//       }
//     });
//   }

//   updateMovement(axes) {
//     if (!this.xrHelper || !this.xrHelper.baseExperience.camera) return;

//     const xrCamera = this.xrHelper.baseExperience.camera;
//     const xrRig = xrCamera.parent || xrCamera;

//     const x = axes.x;
//     const y = axes.y;

//     const magnitude = Math.sqrt(x * x + y * y);
//     if (magnitude < this.deadZone) return;

//     const normalizedX = Math.abs(x) > this.deadZone ? x : 0;
//     const normalizedY = Math.abs(y) > this.deadZone ? y : 0;

//     if (this.movementMode === 'horizontal') {
//       if (Math.abs(normalizedY) > this.deadZone) {
//         const forward = xrCamera.getForwardRay().direction;
//         forward.y = 0;
//         forward.normalize();

//         const movement = forward.scale(normalizedY * this.movementSpeed);
//         xrRig.position.addInPlace(movement);
//       }

//       if (Math.abs(normalizedX) > this.deadZone) {
//         const forward = xrCamera.getForwardRay().direction;
//         forward.y = 0;
//         forward.normalize();

//         const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up());
//         right.normalize();

//         const strafeMovement = right.scale(normalizedX * this.movementSpeed);
//         xrRig.position.addInPlace(strafeMovement);
//       }
//     } else if (this.movementMode === 'vertical') {
//       if (Math.abs(normalizedY) > this.deadZone) {
//         const verticalMovement = new BABYLON.Vector3(0, -normalizedY * this.movementSpeed, 0);
//         xrRig.position.addInPlace(verticalMovement);
//       }

//       if (Math.abs(normalizedX) > this.deadZone) {
//         const rotationAmount = normalizedX * this.rotationSpeed;

//         if (xrRig.rotationQuaternion) {
//           const rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rotationAmount);
//           xrRig.rotationQuaternion = xrRig.rotationQuaternion.multiply(rotationQuaternion);
//         } else {
//           xrRig.rotation.y += rotationAmount;
//         }
//       }
//     }
//   }

//   selectMeshAtController(controller) {
//     if (!controller.pointer) return;

//     const ray = new BABYLON.Ray(controller.pointer.position, controller.pointer.forward);

//     const hit = this.scene.pickWithRay(ray, (mesh) => {
//       return mesh.name !== "ground" && mesh.material && mesh.isPickable !== false;
//     });

//     if (hit.hit && hit.pickedMesh) {
//       this.selectMesh(hit.pickedMesh);
//       console.log("Selected mesh:", hit.pickedMesh.name);
//     } else {
//       this.deselectMesh();
//       console.log("Deselected - clicked on empty space");
//     }
//   }

//   selectMesh(mesh) {
//     this.deselectMesh();

//     this.selectedMesh = mesh;
//     this.originalMaterial = mesh.material;
//     mesh.material = this.highlightMaterial;
//     this.showMeshInfo(mesh);
//   }

//   deselectMesh() {
//     if (this.selectedMesh && this.originalMaterial) {
//       this.selectedMesh.material = this.originalMaterial;
//       this.selectedMesh = null;
//       this.originalMaterial = null;
//     }
//     this.hideInfoPanel();
//   }

//   showMeshInfo(mesh) {
//     const position = mesh.position;
//     const scaling = mesh.scaling;
//     const rotation = mesh.rotation;

//     const infoText = `SELECTED MESH INFO:

// Name: ${mesh.name}
// Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})
// Scale: (${scaling.x.toFixed(2)}, ${scaling.y.toFixed(2)}, ${scaling.z.toFixed(2)})
// Rotation: (${rotation.x.toFixed(2)}, ${rotation.y.toFixed(2)}, ${rotation.z.toFixed(2)})
// Material: ${mesh.material ? mesh.material.name : 'None'}
// Pickable: ${mesh.isPickable !== false}`;

//     if (this.guiAvailable && this.infoText && this.guiPlane) {
//       this.infoText.text = infoText;

//       if (this.isInVR && this.xrHelper && this.xrHelper.baseExperience.camera) {
//         const xrCamera = this.xrHelper.baseExperience.camera;
//         const forward = xrCamera.getForwardRay().direction;
//         const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();

//         this.guiPlane.position = xrCamera.position.add(forward.scale(3))
//           .add(right.scale(-2))
//           .add(new BABYLON.Vector3(0, 0.5, 0));
//       } else {
//         this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
//       }

//       this.guiPlane.setEnabled(true);
//       console.log("Mesh info displayed in VR GUI panel");
//     } else {
//       console.log("=== MESH SELECTION INFO ===");
//       console.log(infoText);
//       console.log("============================");
//     }
//   }

//   hideInfoPanel() {
//     if (this.guiAvailable && this.guiPlane) {
//       this.guiPlane.setEnabled(false);
//     }
//     console.log("Mesh deselected - info panel hidden");
//   }

//   onR3ButtonPressed() {
//     if (this.movementMode === 'horizontal') {
//       this.movementMode = 'vertical';
//       console.log("Switched to VERTICAL mode - Up/Down: Move Up/Down, Left/Right: Rotate");
//     } else {
//       this.movementMode = 'horizontal';
//       console.log("Switched to HORIZONTAL mode - Up/Down: Forward/Back, Left/Right: Strafe");
//     }

//     console.log("Current movement mode:", this.movementMode);
//   }

//   onR3ButtonReleased() {
//     console.log("R3 button released");
//   }

//   onEnterVR() {
//     this.isInVR = true;
//     console.log("Entered VR - Movement controls active");
//     console.log("HORIZONTAL mode: Up/Down = Forward/Back, Left/Right = Strafe");
//     console.log("Press R3 to switch to VERTICAL mode: Up/Down = Move Up/Down, Left/Right = Rotate");
//     console.log("Press R3 again to switch back to HORIZONTAL mode");
//     console.log("Press A button to select/deselect objects");
    
//     if (this.onVRChangeListener) {
//       this.onVRChangeListener(BabylonVRHelper.VR.ENTER);
//     }
//   }

//   onExitVR() {
//     this.isInVR = false;
//     console.log("Exited VR");
//     if (this.onVRChangeListener) {
//       this.onVRChangeListener(BabylonVRHelper.VR.EXIT);
//     }
//   }

//   setVRChangeListener(listener) {
//     this.onVRChangeListener = listener;
//   }

//   setMovementSpeed(speed) {
//     this.movementSpeed = speed;
//     console.log("Movement speed set to:", speed);
//   }

//   setRotationSpeed(speed) {
//     this.rotationSpeed = speed;
//     console.log("Rotation speed set to:", speed);
//   }

//   setMovementEnabled(enabled) {
//     this.movementEnabled = enabled;
//     console.log("Movement enabled:", enabled);
//   }

//   setDeadZone(deadZone) {
//     this.deadZone = deadZone;
//     console.log("Dead zone set to:", deadZone);
//   }

//   setMovementMode(mode) {
//     if (mode === 'horizontal' || mode === 'vertical') {
//       this.movementMode = mode;
//       console.log("Movement mode set to:", mode);
//     } else {
//       console.warn("Invalid movement mode. Use 'horizontal' or 'vertical'");
//     }
//   }

//   getMovementMode() {
//     return this.movementMode;
//   }

//   toggleMovementMode() {
//     this.movementMode = this.movementMode === 'horizontal' ? 'vertical' : 'horizontal';
//     console.log("Movement mode toggled to:", this.movementMode);
//     return this.movementMode;
//   }

//   resetPosition() {
//     if (this.xrHelper && this.xrHelper.baseExperience.camera) {
//       const xrCamera = this.xrHelper.baseExperience.camera;
//       const xrRig = xrCamera.parent || xrCamera;
//       xrRig.position = new BABYLON.Vector3(0, 1.8, 5);
//       console.log("Position reset to origin");
//     }
//   }

//   dispose() {
//     this.deselectMesh();

//     if (this.guiPlane) {
//       this.guiPlane.dispose();
//       this.guiPlane = null;
//     }

//     if (this.highlightMaterial) {
//       this.highlightMaterial.dispose();
//       this.highlightMaterial = null;
//     }

//     console.log("VR Helper disposed");
//   }
// }

// BabylonVRHelper.js - VR Navigation and Menu System for Iroamer



export class BabylonVRHelper {
    static VR = {
        ENTER: 0,
        EXIT: 1
    }

    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.engine = scene.getEngine();
        this.xrHelper = null;
        this.onVRChangeListener = null;
        this.isInVR = false;

        // Movement properties
        this.movementSpeed = 0.05;
        this.rotationSpeed = 0.01;
        this.movementEnabled = true;
        this.deadZone = 0.15;
        this.movementMode = 'horizontal'; // 'horizontal' or 'vertical'

        // Selection properties
        this.selectedMesh = null;
        this.originalMaterial = null;
        this.highlightMaterial = null;

        // Menu and info properties
        this.menuPlane = null;
        this.infoPanel = null;
        this.guiPlane = null;
        this.infoText = null;
        this.guiAvailable = false;

        // Model bounds for positioning
        this.modelBounds = null;

        // Boundary properties
        this.boundaryEnabled = true;
        this.boundaryMinX = -500;
        this.boundaryMaxX = 500;
        this.boundaryMinZ = -500;
        this.boundaryMaxZ = 500;
        this.boundaryMinY = 0.1;
        this.boundaryMaxY = 100;
        this.boundaryBuffer = 2.0;
        this.boundaryWarningDistance = 10.0;
        this.boundaryMargin = 10.0;
        this.boundaryPlanes = [];

        // Render handlers
        this.renderHandlers = [];

        this.init();
    }

    async init() {
        try {
            // Create WebXR experience
            this.xrHelper = await this.scene.createDefaultXRExperienceAsync({
                floorMeshes: [],
                pointerSelectionOptions: {
                    enablePointerSelection: false,
                    disablePointerUpOnTouchOut: true,
                    disableScenePointerVectorUpdate: true
                },
                teleportation: {
                    enabled: false
                },
                inputOptions: {
                    doNotLoadControllerMeshes: false,
                    disableControllerAnimation: false
                },
                locomotion: {
                    teleportation: {
                        enabled: false
                    },
                    turning: {
                        enabled: false
                    }
                },
                optionalFeatures: true,
                disableTeleportation: true,
                disableDefaultUI: false,
                disableNearInteraction: false,
                disablePointerSelection: true,
            });

            // Setup VR handlers
            this.setupVRHandlers();
            this.setupSelectionSystem();
            this.setupBoundaryEnforcement();

            console.log("VR Helper initialized successfully");
        } catch (error) {
            console.error("VR not supported or failed to initialize:", error);
        }
    }

    setupVRHandlers() {
        if (!this.xrHelper) return;

        this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
            if (state === BABYLON.WebXRState.ENTERING_XR) {
                this.onEnterVR();
            } else if (state === BABYLON.WebXRState.EXITING_XR) {
                this.onExitVR();
            } else if (state === BABYLON.WebXRState.IN_XR) {
                this.disableAllLocomotionFeatures();
                this.enableXRCameraCollisions();
                this.setupMovementControls();
            }
        });
    }

    disableAllLocomotionFeatures() {
        try {
            if (this.xrHelper.locomotion) {
                if (this.xrHelper.locomotion.teleportation) {
                    this.xrHelper.locomotion.teleportation.dispose();
                }
                if (this.xrHelper.locomotion.snapTurning) {
                    this.xrHelper.locomotion.snapTurning.dispose();
                }
                if (this.xrHelper.locomotion.smoothTurning) {
                    this.xrHelper.locomotion.smoothTurning.dispose();
                }
            }

            if (this.xrHelper.featuresManager) {
                const locomotionFeatures = [
                    BABYLON.WebXRFeatureName.TELEPORTATION,
                    BABYLON.WebXRFeatureName.MOVEMENT,
                    "xr-locomotion-teleportation",
                    "xr-locomotion-movement"
                ];

                locomotionFeatures.forEach(featureName => {
                    try {
                        const feature = this.xrHelper.featuresManager.getEnabledFeature(featureName);
                        if (feature) {
                            feature.dispose();
                        }
                    } catch (e) {
                        // Feature might not exist
                    }
                });
            }

            if (this.xrHelper.input) {
                this.xrHelper.input.onControllerAddedObservable.clear();
            }

            console.log("All locomotion features disabled successfully");
        } catch (error) {
            console.warn("Some locomotion features couldn't be disabled:", error);
        }
    }

    setupMovementControls() {
        this.xrHelper.input.onControllerAddedObservable.add((controller) => {
            if (controller.inputSource.handedness === 'right' || controller.inputSource.handedness === 'none') {
                this.setupControllerMovement(controller);
            }
        });
    }

    setupControllerMovement(controller) {
        controller.onMotionControllerInitObservable.add((motionController) => {
            const thumbstick = motionController.getComponent("xr-standard-thumbstick");
            const aButton = motionController.getComponent("a-button");
            const bButton = motionController.getComponent("b-button");

            if (thumbstick) {
                console.log("Thumbstick controller found - setting up custom movement");

                // Clear existing handlers
                if (thumbstick.changes && thumbstick.changes.axes) {
                    thumbstick.changes.axes.clear();
                }

                // Handle thumbstick press for mode switching
                thumbstick.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        this.toggleMovementMode();
                    }
                });

                // Custom movement handler
                const customMovementHandler = () => {
                    if (this.isInVR && this.movementEnabled && thumbstick.axes) {
                        this.updateMovementWithStrictBoundaries(thumbstick.axes);
                    }
                };

                const renderHandler = this.scene.registerBeforeRender(customMovementHandler);
                this.renderHandlers.push(renderHandler);
            }

            // A button for selection
            if (aButton) {
                aButton.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        this.selectMeshAtController(controller);
                    }
                });
            }

            // B button for menu
            if (bButton) {
                bButton.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        if (this.selectedMesh) {
                            this.showMenu();
                        } else {
                            console.log("No mesh selected - select a mesh first with A button");
                        }
                    }
                });
            }
        });
    }

    selectMeshAtController(controller) {
        if (!controller.pointer) return;

        const ray = new BABYLON.Ray(controller.pointer.position, controller.pointer.forward);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.name !== "ground" && 
                   mesh.name !== "skyBox" && 
                   mesh.name !== "waterMesh" && 
                   !mesh.name.includes("boundary") &&
                   mesh.material && 
                   mesh.isPickable !== false;
        });

        if (hit.hit && hit.pickedMesh) {
            this.selectMesh(hit.pickedMesh);
        } else {
            this.deselectMesh();
        }
    }

    selectMesh(mesh) {
        this.deselectMesh();
        this.selectedMesh = mesh;
        this.originalMaterial = mesh.material;
        mesh.material = this.highlightMaterial;
        this.showMeshInfo(mesh, 'full');
    }

    deselectMesh() {
        if (this.selectedMesh && this.originalMaterial) {
            this.selectedMesh.material = this.originalMaterial;
            this.selectedMesh = null;
            this.originalMaterial = null;
        }
        this.hideInfoPanel();
        this.hideMenu();
    }

    showMeshInfo(mesh, type = 'full') {
        let infoText = '';

        switch (type) {
            case 'name':
                infoText = `MESH NAME:\n\n${mesh.name}`;
                break;
            case 'full':
                const position = mesh.position;
                const scaling = mesh.scaling;
                const rotation = mesh.rotation;
                
                infoText = `SELECTED MESH INFO:

Name: ${mesh.name}
Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})
Scale: (${scaling.x.toFixed(2)}, ${scaling.y.toFixed(2)}, ${scaling.z.toFixed(2)})
Rotation: (${rotation.x.toFixed(2)}, ${rotation.y.toFixed(2)}, ${rotation.z.toFixed(2)})
Material: ${mesh.material ? mesh.material.name : 'None'}
Pickable: ${mesh.isPickable !== false}`;
                break;
            case 'tag':
                const tagData = mesh.metadata?.tagNo || {};
                infoText = `TAG INFO:\n\nTag: ${tagData.tag || 'N/A'}\nArea: ${tagData.area || 'N/A'}\nDisc: ${tagData.disc || 'N/A'}\nSys: ${tagData.sys || 'N/A'}`;
                break;
            case 'file':
                const fileData = mesh.metadata?.tagNo?.fileDetails || {};
                infoText = `FILE INFO:\n\nFilename: ${mesh.metadata?.tag || mesh.name}\nSize: ${fileData.size ? (fileData.size / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'}\nType: 3D Model`;
                break;
        }

        if (this.guiAvailable && this.infoText && this.guiPlane) {
            this.infoText.text = infoText;
            const panelPosition = this.calculateOptimalPanelPosition(mesh, 3.0, 'info');
            this.guiPlane.position = panelPosition;
            this.guiPlane.setEnabled(true);
        } else {
            console.log("=== MESH INFORMATION ===");
            console.log(infoText);
            console.log("========================");
        }
    }

    calculateOptimalPanelPosition(mesh, heightOffset, panelType = 'info') {
        const camera = this.xrHelper && this.xrHelper.baseExperience.camera
            ? this.xrHelper.baseExperience.camera
            : this.camera;

        const cameraPosition = camera.position.clone();
        const cameraForward = camera.getForwardRay().direction.clone();
        cameraForward.normalize();

        let basePosition;

        if (mesh && mesh.getBoundingInfo) {
            const meshBounds = mesh.getBoundingInfo();
            const meshCenter = meshBounds.boundingBox.centerWorld.clone();
            basePosition = meshCenter.clone();
            basePosition.y += heightOffset;
        } else if (this.modelBounds) {
            const modelCenter = new BABYLON.Vector3(
                (this.modelBounds.minX + this.modelBounds.maxX) / 2,
                (this.modelBounds.minY + this.modelBounds.maxY) / 2,
                (this.modelBounds.minZ + this.modelBounds.maxZ) / 2
            );
            basePosition = modelCenter.clone();
            basePosition.y = this.modelBounds.maxY + heightOffset;
        } else {
            basePosition = cameraPosition.add(cameraForward.scale(3));
            basePosition.y += 1;
        }

        const toCameraDirection = cameraPosition.subtract(basePosition);
        toCameraDirection.y = 0;
        toCameraDirection.normalize();

        const finalPosition = basePosition.add(toCameraDirection.scale(2));

        const distanceFromCamera = BABYLON.Vector3.Distance(finalPosition, cameraPosition);
        if (distanceFromCamera < 1.5) {
            const directionFromCamera = finalPosition.subtract(cameraPosition).normalize();
            finalPosition.copyFrom(cameraPosition.add(directionFromCamera.scale(1.5)));
        }

        return finalPosition;
    }

    showMenu() {
        if (!this.guiAvailable || !this.menuPlane) {
            this.showConsoleMenu();
            return;
        }

        this.hideInfoPanel();
        const menuPosition = this.calculateOptimalPanelPosition(this.selectedMesh, 4.0, 'menu');
        this.menuPlane.position = menuPosition;
        this.menuPlane.setEnabled(true);
    }

    hideMenu() {
        if (this.guiAvailable && this.menuPlane) {
            this.menuPlane.setEnabled(false);
        }
    }

    showConsoleMenu() {
        if (!this.selectedMesh) {
            console.log("No mesh selected - select a mesh first with A button");
            return;
        }

        console.log("=== VR MENU ===");
        console.log("Selected mesh:", this.selectedMesh.name);
        console.log("Available options:");
        console.log("1. Mesh Info");
        console.log("2. Tag Info");
        console.log("3. File Info");
        console.log("4. Close Menu");
        console.log("===============");
    }

    handleMenuSelection(option) {
        if (!this.selectedMesh) return;

        this.hideMenu();

        switch (option) {
            case 'Tag info':
                this.showMeshInfo(this.selectedMesh, 'name');
                break;
            case 'Tag GenInfo':
                this.showMeshInfo(this.selectedMesh, 'tag');
                break;
            case 'File info':
                this.showMeshInfo(this.selectedMesh, 'file');
                break;
            case 'close':
                this.hideInfoPanel();
                break;
        }
    }

    hideInfoPanel() {
        if (this.guiAvailable && this.guiPlane) {
            this.guiPlane.setEnabled(false);
        }
    }

    setupSelectionSystem() {
        this.highlightMaterial = new BABYLON.StandardMaterial("highlightMat", this.scene);
        this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
        this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0);
        this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0);

        this.setupInfoGUI();
        this.setupMenuGUI();
    }

    setupInfoGUI() {
        if (typeof GUI === 'undefined') {
            console.warn("BABYLON.GUI not loaded - using console output for mesh info");
            this.guiAvailable = false;
            return;
        }

        try {
            this.guiAvailable = true;

            this.guiPlane = BABYLON.MeshBuilder.CreatePlane("guiPlane", {
                size: 2,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, this.scene);

            this.guiPlane.position = new BABYLON.Vector3(0, 3, 0);
            this.guiPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            this.guiPlane.isPickable = false;
            this.guiPlane.renderingGroupId = 3;

            const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
                this.guiPlane,
                1024,
                1024,
                true
            );

            this.infoPanel = new GUI.Rectangle("infoPanel");
            this.infoPanel.widthInPixels = 950;
            this.infoPanel.heightInPixels = 600;
            this.infoPanel.cornerRadius = 20;
            this.infoPanel.color = "white";
            this.infoPanel.thickness = 4;
            this.infoPanel.background = "rgba(0, 0, 0, 0.9)";
            this.infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            this.infoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

            this.infoText = new GUI.TextBlock("infoText");
            this.infoText.text = "";
            this.infoText.color = "white";
            this.infoText.fontSize = 36;
            this.infoText.fontFamily = "Arial";
            this.infoText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            this.infoText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
            this.infoText.paddingLeftInPixels = 40;
            this.infoText.paddingTopInPixels = 40;
            this.infoText.textWrapping = true;

            this.infoPanel.addControl(this.infoText);
            advancedTexture.addControl(this.infoPanel);

            this.guiPlane.setEnabled(false);

            console.log("VR-compatible info GUI system initialized successfully");
        } catch (error) {
            console.warn("Failed to initialize VR GUI:", error);
            this.guiAvailable = false;
        }
    }

    setupMenuGUI() {
        if (!this.guiAvailable) return;

        try {
            this.menuPlane = BABYLON.MeshBuilder.CreatePlane("menuPlane", {
                size: 2.5,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, this.scene);

            this.menuPlane.position = new BABYLON.Vector3(0, 4, 0);
            this.menuPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            this.menuPlane.isPickable = false;
            this.menuPlane.renderingGroupId = 3;

            const menuTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
                this.menuPlane,
                1024,
                1024,
                true
            );

            this.menuPanel = new GUI.Rectangle("menuPanel");
            this.menuPanel.widthInPixels = 900;
            this.menuPanel.heightInPixels = 700;
            this.menuPanel.cornerRadius = 20;
            this.menuPanel.color = "cyan";
            this.menuPanel.thickness = 4;
            this.menuPanel.background = "rgba(0, 20, 40, 0.95)";
            this.menuPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            this.menuPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

            const menuTitle = new GUI.TextBlock("menuTitle");
            menuTitle.text = "VR MENU";
            menuTitle.color = "cyan";
            menuTitle.fontSize = 48;
            menuTitle.fontWeight = "bold";
            menuTitle.height = "80px";
            menuTitle.top = "-250px";
            menuTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

            const buttonSpacing = 120;
            const startY = -100;

            const meshInfoButton = GUI.Button.CreateSimpleButton("meshInfoBtn", "MESH INFO");
            meshInfoButton.widthInPixels = 300;
            meshInfoButton.heightInPixels = 80;
            meshInfoButton.color = "white";
            meshInfoButton.cornerRadius = 10;
            meshInfoButton.background = "rgba(0, 150, 255, 0.8)";
            meshInfoButton.fontSize = 28;
            meshInfoButton.top = `${startY}px`;
            meshInfoButton.onPointerUpObservable.add(() => {
                this.handleMenuSelection('meshinfo');
            });

            const tagInfoButton = GUI.Button.CreateSimpleButton("tagInfoBtn", "TAG INFO");
            tagInfoButton.widthInPixels = 300;
            tagInfoButton.heightInPixels = 80;
            tagInfoButton.color = "white";
            tagInfoButton.cornerRadius = 10;
            tagInfoButton.background = "rgba(255, 150, 0, 0.8)";
            tagInfoButton.fontSize = 28;
            tagInfoButton.top = `${startY + buttonSpacing}px`;
            tagInfoButton.onPointerUpObservable.add(() => {
                this.handleMenuSelection('taginfo');
            });

            const fileInfoButton = GUI.Button.CreateSimpleButton("fileInfoBtn", "FILE INFO");
            fileInfoButton.widthInPixels = 300;
            fileInfoButton.heightInPixels = 80;
            fileInfoButton.color = "white";
            fileInfoButton.cornerRadius = 10;
            fileInfoButton.background = "rgba(150, 255, 0, 0.8)";
            fileInfoButton.fontSize = 28;
            fileInfoButton.top = `${startY + buttonSpacing * 2}px`;
            fileInfoButton.onPointerUpObservable.add(() => {
                this.handleMenuSelection('fileinfo');
            });

            const closeButton = GUI.Button.CreateSimpleButton("closeBtn", "CLOSE");
            closeButton.widthInPixels = 300;
            closeButton.heightInPixels = 80;
            closeButton.color = "white";
            closeButton.cornerRadius = 10;
            closeButton.background = "rgba(255, 50, 50, 0.8)";
            closeButton.fontSize = 28;
            closeButton.top = `${startY + buttonSpacing * 3}px`;
            closeButton.onPointerUpObservable.add(() => {
                this.handleMenuSelection('close');
            });

            this.menuPanel.addControl(menuTitle);
            this.menuPanel.addControl(meshInfoButton);
            this.menuPanel.addControl(tagInfoButton);
            this.menuPanel.addControl(fileInfoButton);
            this.menuPanel.addControl(closeButton);

            menuTexture.addControl(this.menuPanel);
            this.menuPlane.setEnabled(false);

            console.log("VR menu GUI initialized successfully");
        } catch (error) {
            console.warn("Failed to initialize menu GUI:", error);
        }
    }

    // Boundary methods
    setBoundariesFromModelBounds(minX, minY, minZ, maxX, maxY, maxZ, margin = 10.0) {
        this.boundaryMargin = margin;
        this.boundaryMinX = minX - margin;
        this.boundaryMaxX = maxX + margin;
        this.boundaryMinZ = minZ - margin;
        this.boundaryMaxZ = maxZ + margin;
        this.boundaryMinY = Math.max(0.1, minY - 1);
        this.boundaryMaxY = maxY + margin;

        this.modelBounds = { minX, minY, minZ, maxX, maxY, maxZ };

        this.createBoundaryCollisionPlanes();
        console.log(`VR boundaries set from model bounds with ${margin}m margin`);
    }

    createBoundaryCollisionPlanes() {
        this.disposeBoundaryCollisionPlanes();
        this.boundaryPlanes = [];

        const planeHeight = this.boundaryMaxY - this.boundaryMinY + 10;
        const planeWidth = Math.max(this.boundaryMaxX - this.boundaryMinX, this.boundaryMaxZ - this.boundaryMinZ) + 20;
        const planeThickness = 1.0;

        const boundaryConfigs = [
            {
                name: "boundaryWall_Left",
                position: new BABYLON.Vector3(this.boundaryMinX - planeThickness / 2, (this.boundaryMinY + this.boundaryMaxY) / 2, (this.boundaryMinZ + this.boundaryMaxZ) / 2),
                size: { width: planeThickness, height: planeHeight, depth: this.boundaryMaxZ - this.boundaryMinZ + 10 }
            },
            {
                name: "boundaryWall_Right",
                position: new BABYLON.Vector3(this.boundaryMaxX + planeThickness / 2, (this.boundaryMinY + this.boundaryMaxY) / 2, (this.boundaryMinZ + this.boundaryMaxZ) / 2),
                size: { width: planeThickness, height: planeHeight, depth: this.boundaryMaxZ - this.boundaryMinZ + 10 }
            },
            {
                name: "boundaryWall_Back",
                position: new BABYLON.Vector3((this.boundaryMinX + this.boundaryMaxX) / 2, (this.boundaryMinY + this.boundaryMaxY) / 2, this.boundaryMinZ - planeThickness / 2),
                size: { width: this.boundaryMaxX - this.boundaryMinX + 10, height: planeHeight, depth: planeThickness }
            },
            {
                name: "boundaryWall_Front",
                position: new BABYLON.Vector3((this.boundaryMinX + this.boundaryMaxX) / 2, (this.boundaryMinY + this.boundaryMaxY) / 2, this.boundaryMaxZ + planeThickness / 2),
                size: { width: this.boundaryMaxX - this.boundaryMinX + 10, height: planeHeight, depth: planeThickness }
            },
            {
                name: "boundaryWall_Floor",
                position: new BABYLON.Vector3((this.boundaryMinX + this.boundaryMaxX) / 2, this.boundaryMinY - planeThickness / 2, (this.boundaryMinZ + this.boundaryMaxZ) / 2),
                size: { width: this.boundaryMaxX - this.boundaryMinX + 10, height: planeThickness, depth: this.boundaryMaxZ - this.boundaryMinZ + 10 }
            },
            {
                name: "boundaryWall_Ceiling",
                position: new BABYLON.Vector3((this.boundaryMinX + this.boundaryMaxX) / 2, this.boundaryMaxY + planeThickness / 2, (this.boundaryMinZ + this.boundaryMaxZ) / 2),
                size: { width: this.boundaryMaxX - this.boundaryMinX + 10, height: planeThickness, depth: this.boundaryMaxZ - this.boundaryMinZ + 10 }
            }
        ];

        boundaryConfigs.forEach(config => {
            const wall = BABYLON.MeshBuilder.CreateBox(config.name, {
                width: config.size.width,
                height: config.size.height,
                depth: config.size.depth
            }, this.scene);

            wall.position = config.position;
            wall.isVisible = false;
            wall.checkCollisions = true;
            wall.isPickable = false;

            const wallMaterial = new BABYLON.StandardMaterial(config.name + "_mat", this.scene);
            wallMaterial.alpha = 0;
            wallMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
            wall.material = wallMaterial;

            this.boundaryPlanes.push(wall);
        });

        console.log("Physical boundary collision planes created");
    }

    disposeBoundaryCollisionPlanes() {
        if (this.boundaryPlanes) {
            this.boundaryPlanes.forEach(plane => {
                if (plane.material) plane.material.dispose();
                plane.dispose();
            });
            this.boundaryPlanes = [];
        }
    }

    enableXRCameraCollisions() {
        if (!this.xrHelper || !this.xrHelper.baseExperience.camera) {
            return;
        }

        const xrCamera = this.xrHelper.baseExperience.camera;
        const xrRig = xrCamera.parent || xrCamera;

        xrCamera.checkCollisions = true;
        if (xrRig && xrRig !== xrCamera) {
            xrRig.checkCollisions = true;
        }

        const collisionRadius = 0.5;
        const collisionHeight = 1.8;

        xrCamera.ellipsoid = new BABYLON.Vector3(collisionRadius, collisionRadius, collisionRadius);
        this.scene.gravity = new BABYLON.Vector3(0, -0.98, 0);
        xrCamera.applyGravity = false;
        this.scene.collisionsEnabled = true;

        console.log("XR Camera collision detection enabled");
    }

    setupBoundaryEnforcement() {
        this.scene.registerBeforeRender(() => {
            if (this.isInVR && this.boundaryEnabled) {
                this.enforceBoundaries();
            }
        });
    }

    checkBoundaries(newPosition) {
        if (!this.boundaryEnabled) return newPosition;

        const clampedPosition = newPosition.clone();
        let hitBoundary = false;

        if (clampedPosition.x < this.boundaryMinX + this.boundaryBuffer) {
            clampedPosition.x = this.boundaryMinX + this.boundaryBuffer;
            hitBoundary = true;
        } else if (clampedPosition.x > this.boundaryMaxX - this.boundaryBuffer) {
            clampedPosition.x = this.boundaryMaxX - this.boundaryBuffer;
            hitBoundary = true;
        }

        if (clampedPosition.z < this.boundaryMinZ + this.boundaryBuffer) {
            clampedPosition.z = this.boundaryMinZ + this.boundaryBuffer;
            hitBoundary = true;
        } else if (clampedPosition.z > this.boundaryMaxZ - this.boundaryBuffer) {
            clampedPosition.z = this.boundaryMaxZ - this.boundaryBuffer;
            hitBoundary = true;
        }

        if (clampedPosition.y < this.boundaryMinY) {
            clampedPosition.y = this.boundaryMinY;
            hitBoundary = true;
        } else if (clampedPosition.y > this.boundaryMaxY) {
            clampedPosition.y = this.boundaryMaxY;
            hitBoundary = true;
        }

        if (hitBoundary) {
            console.log("Boundary violation detected and corrected");
        }

        return clampedPosition;
    }

    enforceBoundaries() {
        if (!this.boundaryEnabled || !this.xrHelper || !this.xrHelper.baseExperience.camera) {
            return;
        }

        const xrCamera = this.xrHelper.baseExperience.camera;
        const xrRig = xrCamera.parent || xrCamera;
        const currentPosition = xrRig.position;

        const clampedPosition = this.checkBoundaries(currentPosition);

        if (!currentPosition.equals(clampedPosition)) {
            xrRig.position = clampedPosition;
            this.triggerBoundaryHapticFeedback();
        }
    }

    triggerBoundaryHapticFeedback() {
        if (this.xrHelper && this.xrHelper.input) {
            this.xrHelper.input.controllers.forEach(controller => {
                if (controller.gamepad && controller.gamepad.hapticActuators) {
                    controller.gamepad.hapticActuators[0].pulse(0.6, 200);
                }
            });
        }
    }

    updateMovementWithStrictBoundaries(axes) {
        if (!this.xrHelper || !this.xrHelper.baseExperience.camera) return;

        const xrCamera = this.xrHelper.baseExperience.camera;
        const xrRig = xrCamera.parent || xrCamera;

        const originalPosition = xrRig.position.clone();
        let newPosition = originalPosition.clone();

        const rawX = axes.x;
        const rawY = axes.y;

        const magnitude = Math.sqrt(rawX * rawX + rawY * rawY);
        if (magnitude < this.deadZone) return;

        const normalizedX = Math.abs(rawX) > this.deadZone ? rawX : 0;
        const normalizedY = Math.abs(rawY) > this.deadZone ? rawY : 0;

        if (this.movementMode === 'horizontal') {
            // Forward/backward movement
            if (Math.abs(normalizedY) > this.deadZone) {
                const forward = xrCamera.getForwardRay().direction;
                forward.y = 0;
                forward.normalize();

                const movement = forward.scale(normalizedY * this.movementSpeed);
                const testPosition = originalPosition.add(movement);

                if (this.isPositionWithinBoundariesStrict(testPosition)) {
                    newPosition = testPosition;
                }
            }

            // Left/right strafing
            if (Math.abs(normalizedX) > this.deadZone) {
                const forward = xrCamera.getForwardRay().direction;
                forward.y = 0;
                forward.normalize();

                const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up());
                right.normalize();

                const strafeMovement = right.scale(normalizedX * this.movementSpeed);
                const testPosition = newPosition.add(strafeMovement);

                if (this.isPositionWithinBoundariesStrict(testPosition)) {
                    newPosition = testPosition;
                }
            }

        } else if (this.movementMode === 'vertical') {
            // Up/down movement
            if (Math.abs(normalizedY) > this.deadZone) {
                const verticalMovement = new BABYLON.Vector3(0, -normalizedY * this.movementSpeed, 0);
                const testPosition = originalPosition.add(verticalMovement);

                if (testPosition.y >= this.boundaryMinY && testPosition.y <= this.boundaryMaxY) {
                    newPosition = testPosition;
                }
            }

            // Rotation
            if (Math.abs(normalizedX) > this.deadZone) {
                const rotationAmount = normalizedX * this.rotationSpeed;

                if (xrRig.rotationQuaternion) {
                    const yRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rotationAmount);
                    xrRig.rotationQuaternion = xrRig.rotationQuaternion.multiply(yRotation);
                } else {
                    if (!xrRig.rotation) {
                        xrRig.rotation = new BABYLON.Vector3(0, 0, 0);
                    }
                    xrRig.rotation.y += rotationAmount;
                }

                xrRig.computeWorldMatrix(true);
            }
        }

        if (!newPosition.equals(originalPosition)) {
            xrRig.position = newPosition;
        }
    }

    isPositionWithinBoundariesStrict(position) {
        if (!this.boundaryEnabled) return true;

        return (
            position.x >= this.boundaryMinX + this.boundaryBuffer &&
            position.x <= this.boundaryMaxX - this.boundaryBuffer &&
            position.z >= this.boundaryMinZ + this.boundaryBuffer &&
            position.z <= this.boundaryMaxZ - this.boundaryBuffer &&
            position.y >= this.boundaryMinY &&
            position.y <= this.boundaryMaxY
        );
    }

    toggleMovementMode() {
        this.movementMode = this.movementMode === 'horizontal' ? 'vertical' : 'horizontal';
        console.log("Movement mode toggled to:", this.movementMode);
        return this.movementMode;
    }

    onEnterVR() {
        this.isInVR = true;
        console.log("Entered VR - Movement controls active");
        console.log("CONTROLS:");
        console.log("  • A button: Select/deselect meshes");
        console.log("  • B button: Show menu (when mesh is selected)");
        console.log("  • R3 (thumbstick press): Toggle movement mode");
        console.log("  • Menu options: Mesh Info, Tag Info, File Info");

        if (this.onVRChangeListener) {
            this.onVRChangeListener(BabylonVRHelper.VR.ENTER);
        }
    }

    onExitVR() {
        this.isInVR = false;
        console.log("Exited VR");
        if (this.onVRChangeListener) {
            this.onVRChangeListener(BabylonVRHelper.VR.EXIT);
        }
    }

    setVRChangeListener(listener) {
        this.onVRChangeListener = listener;
    }

    // Utility methods
    setMovementSpeed(speed) {
        this.movementSpeed = speed;
    }

    setRotationSpeed(speed) {
        this.rotationSpeed = speed;
    }

    setBoundaryEnabled(enabled) {
        this.boundaryEnabled = enabled;
    }

    resetPosition() {
        if (this.xrHelper && this.xrHelper.baseExperience.camera) {
            const xrCamera = this.xrHelper.baseExperience.camera;
            const xrRig = xrCamera.parent || xrCamera;

            const centerX = (this.boundaryMinX + this.boundaryMaxX) / 2;
            const centerZ = (this.boundaryMinZ + this.boundaryMaxZ) / 2;
            const resetPosition = new BABYLON.Vector3(centerX, 1.8, centerZ);

            const clampedPosition = this.checkBoundaries(resetPosition);
            xrRig.position = clampedPosition;

            console.log("Position reset to boundary center:", clampedPosition);
        }
    }

    dispose() {
        this.deselectMesh();

        if (this.renderHandlers) {
            this.renderHandlers.forEach(handler => {
                if (handler) {
                    this.scene.unregisterBeforeRender(handler);
                }
            });
            this.renderHandlers = [];
        }

        if (this.guiPlane) {
            this.guiPlane.dispose();
            this.guiPlane = null;
        }

        if (this.menuPlane) {
            this.menuPlane.dispose();
            this.menuPlane = null;
        }

        if (this.highlightMaterial) {
            this.highlightMaterial.dispose();
            this.highlightMaterial = null;
        }

        this.disposeBoundaryCollisionPlanes();

        console.log("VR Helper disposed");
    }
}