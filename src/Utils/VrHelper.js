import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

export class BabylonVRHelper {
    static VR = {
        ENTER: 0,
        EXIT: 1
    }

    // Selection methods
    selectMeshAtController(controller) {
        if (!controller.pointer) return;

        // Create ray from controller position and direction
        const ray = new BABYLON.Ray(controller.pointer.position, controller.pointer.forward);

        // Pick mesh with ray
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            // Only pick meshes that are not the ground and have a material
            return mesh.name !== "ground" && mesh.material && mesh.isPickable !== false;
        });

        if (hit.hit && hit.pickedMesh) {
            // Select the mesh
            this.selectMesh(hit.pickedMesh);
            console.log("Selected mesh:", hit.pickedMesh.name);
        } else {
            // Deselect if clicking on empty space
            this.deselectMesh();
            console.log("Deselected - clicked on empty space");
        }
    }

    selectMesh(mesh) {
        // Deselect previous mesh if any
        this.deselectMesh();

        // Store selection
        this.selectedMesh = mesh;
        this.originalMaterial = mesh.material;

        // Apply highlight material
        mesh.material = this.highlightMaterial;

        // Show mesh information
        this.showMeshInfo(mesh);
    }

    deselectMesh() {
        if (this.selectedMesh && this.originalMaterial) {
            // Restore original material
            this.selectedMesh.material = this.originalMaterial;
            this.selectedMesh = null;
            this.originalMaterial = null;
        }

        // Hide info panel
        this.hideInfoPanel();
    }
    showMeshInfo(mesh) {
        // Gather mesh information
        const position = mesh.position;
        const scaling = mesh.scaling;
        const rotation = mesh.rotation;

        const infoText = `SELECTED MESH INFO:

Name: ${mesh.name}
Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})
Scale: (${scaling.x.toFixed(2)}, ${scaling.y.toFixed(2)}, ${scaling.z.toFixed(2)})
Rotation: (${rotation.x.toFixed(2)}, ${rotation.y.toFixed(2)}, ${rotation.z.toFixed(2)})
Material: ${mesh.material ? mesh.material.name : 'None'}
Pickable: ${mesh.isPickable !== false}`;

        // Display info based on GUI availability
        if (this.guiAvailable && this.infoText && this.guiPlane) {
            this.infoText.text = infoText;

            // Position GUI plane in front of camera (works for both VR and desktop)
            if (this.isInVR && this.xrHelper && this.xrHelper.baseExperience.camera) {
                // In VR: Position relative to VR camera
                const xrCamera = this.xrHelper.baseExperience.camera;
                const forward = xrCamera.getForwardRay().direction;
                const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();

                // Position panel to the left and slightly in front of the user
                this.guiPlane.position = xrCamera.position.add(forward.scale(3))
                    .add(right.scale(-2))
                    .add(new BABYLON.Vector3(0, 0.5, 0));
            } else {
                // Desktop mode: Fixed position
                this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
            }

            this.guiPlane.setEnabled(true);
            console.log("Mesh info displayed in VR GUI panel");
        } else {
            // Fallback to console output
            console.log("=== MESH SELECTION INFO ===");
            console.log(infoText);
            console.log("============================");
        }
    }

    hideInfoPanel() {
        if (this.guiAvailable && this.guiPlane) {
            this.guiPlane.setEnabled(false);
        }
        // Always log deselection
        console.log("Mesh deselected - info panel hidden");
    }

    dispose() {
        // Clean up selection
        this.deselectMesh();

        // Clean up GUI
        if (this.guiPlane) {
            this.guiPlane.dispose();
            this.guiPlane = null;
        }

        // Clean up materials
        if (this.highlightMaterial) {
            this.highlightMaterial.dispose();
            this.highlightMaterial = null;
        }

        console.log("VR Helper disposed");
    }
    // Selection utility methods
    getSelectedMesh() {
        return this.selectedMesh;
    }

    isAnyMeshSelected() {
        return this.selectedMesh !== null;
    }

    forceDeselectMesh() {
        this.deselectMesh();
        console.log("Forced deselection");
    };

    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.engine = scene.getEngine();
        this.xrHelper = null;
        this.onVRChangeListener = null;
        this.isInVR = false;

        // Movement properties
        this.movementSpeed = 0.05; // Units per frame (for translation movements)
        this.rotationSpeed = 0.01; // Radians per frame (for rotation in vertical mode)
        this.movementEnabled = true;
        this.deadZone = 0.15; // Thumbstick dead zone

        // Movement mode toggle
        this.movementMode = 'horizontal'; // 'horizontal' or 'vertical'

        // Selection properties
        this.selectedMesh = null;
        this.originalMaterial = null;
        this.highlightMaterial = null;
        this.infoPanel = null;

        // Directional thresholds
        this.directionalThreshold = 0.3; // Minimum value to register as directional input
        this.diagonalThreshold = 0.7; // Threshold for diagonal vs pure directional movement

        this.init();
    }

    async init() {
        try {
            // Create WebXR experience without teleportation
            this.xrHelper = await this.scene.createDefaultXRExperienceAsync({
                floorMeshes: [],
                pointerSelectionOptions: {
                    enablePointerSelection: false,
                    disablePointerUpOnTouchOut: true,
                    disableScenePointerVectorUpdate: true
                },
                // Disable teleportation
                teleportation: {
                    enabled: false
                }
            });

            // Setup VR session handlers
            this.setupVRHandlers();

            // Setup selection materials and GUI
            this.setupSelectionSystem();

            // Setup movement controls after XR is ready
            this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
                if (state === BABYLON.WebXRState.IN_XR) {
                    this.setupMovementControls();
                }
            });

            console.log("VR Helper initialized successfully - Dual mode movement + mesh selection system");
        } catch (error) {
            console.error("VR not supported or failed to initialize:", error);
        }
    }

    setupSelectionSystem() {
        // Create highlight material
        this.highlightMaterial = new BABYLON.StandardMaterial("highlightMat", this.scene);
        this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow highlight
        this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0);
        this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0);

        // Create GUI for mesh information
        this.setupInfoGUI();
    }

    setupInfoGUI() {
        // Check if BABYLON.GUI is available
        if (typeof GUI === 'undefined') {
            console.warn("BABYLON.GUI not loaded - using console output for mesh info");
            this.guiAvailable = false;
            return;
        }

        try {
            this.guiAvailable = true;

            // Create a 3D plane for VR-compatible GUI
            this.guiPlane = BABYLON.MeshBuilder.CreatePlane("guiPlane", {
                size: 2,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, this.scene);

            // Position the GUI plane in front of the camera
            this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
            this.guiPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; // Always face the camera

            // Make the plane non-pickable so it doesn't interfere with selection
            this.guiPlane.isPickable = false;

            // Create AdvancedDynamicTexture for the plane (this will be visible in VR)
            const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
                this.guiPlane,
                1024,
                1024,
                true
            );

            // Create info panel
            this.infoPanel = new GUI.Rectangle("infoPanel");
            this.infoPanel.widthInPixels = 950;
            this.infoPanel.heightInPixels = 600;
            this.infoPanel.cornerRadius = 20;
            this.infoPanel.color = "white";
            this.infoPanel.thickness = 4;
            this.infoPanel.background = "rgba(0, 0, 0, 0.9)";
            this.infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            this.infoPanel.verticalAlignment =  GUI.Control.VERTICAL_ALIGNMENT_CENTER;

            // Create info text
            this.infoText = new GUI.TextBlock("infoText");
            this.infoText.text = "";
            this.infoText.color = "white";
            this.infoText.fontSize = 36; // Larger font for VR readability
            this.infoText.fontFamily = "Arial";
            this.infoText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            this.infoText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
            this.infoText.paddingLeftInPixels = 40;
            this.infoText.paddingTopInPixels = 40;
            this.infoText.textWrapping = true;

            this.infoPanel.addControl(this.infoText);
            advancedTexture.addControl(this.infoPanel);

            // Initially hide the GUI plane
            this.guiPlane.setEnabled(false);

            console.log("VR-compatible GUI system initialized successfully");
        } catch (error) {
            console.warn("Failed to initialize VR GUI:", error);
            this.guiAvailable = false;
        }
    }
    setupVRHandlers() {
        if (!this.xrHelper) return;

        // Enter/Exit VR handlers
        this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
            if (state === BABYLON.WebXRState.ENTERING_XR) {
                this.onEnterVR();
            } else if (state === BABYLON.WebXRState.EXITING_XR) {
                this.onExitVR();
            }
        });
    }

    setupMovementControls() {
        // Setup controller input for movement
        this.xrHelper.input.onControllerAddedObservable.add((controller) => {
            if (controller.inputSource.handedness === 'right' || controller.inputSource.handedness === 'none') {
                this.setupControllerMovement(controller);
            }
        });
    }

    setupControllerMovement(controller) {
        // Handle joystick movement and buttons
        controller.onMotionControllerInitObservable.add((motionController) => {
            const thumbstick = motionController.getComponent("xr-standard-thumbstick");
            const aButton = motionController.getComponent("a-button");

            if (thumbstick) {
                console.log("Thumbstick controller found - movement enabled");

                // Handle R3 button (thumbstick press)
                thumbstick.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        console.log("R3 button pressed");
                        this.onR3ButtonPressed();
                    } else {
                        console.log("R3 button released");
                        this.onR3ButtonReleased();
                    }
                });

                // Register movement update in render loop
                this.scene.registerBeforeRender(() => {
                    if (this.isInVR && this.movementEnabled && thumbstick.axes) {
                        this.updateMovement(thumbstick.axes);
                    }
                });
            }

            // Handle A button for selection
            if (aButton) {
                console.log("A button found - selection enabled");

                aButton.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        console.log("A button pressed - selecting mesh");
                        this.selectMeshAtController(controller);
                    }
                });
            }
        });
    }

    updateMovement(axes) {
        if (!this.xrHelper || !this.xrHelper.baseExperience.camera) return;

        const xrCamera = this.xrHelper.baseExperience.camera;
        const xrRig = xrCamera.parent || xrCamera;

        // Get thumbstick values
        const x = axes.x; // Left/Right
        const y = axes.y; // Up/Down (forward/backward)

        // Apply dead zone
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude < this.deadZone) return;

        // Normalize values beyond dead zone
        const normalizedX = Math.abs(x) > this.deadZone ? x : 0;
        const normalizedY = Math.abs(y) > this.deadZone ? y : 0;

        if (this.movementMode === 'horizontal') {
            // HORIZONTAL MODE: Forward/Back + Strafe Left/Right

            // Handle forward/backward movement (Y axis)
            if (Math.abs(normalizedY) > this.deadZone) {
                // Get camera's forward direction
                const forward = xrCamera.getForwardRay().direction;
                forward.y = 0; // Keep movement horizontal
                forward.normalize();

                // Move forward (negative Y) or backward (positive Y)
                const movement = forward.scale(normalizedY * this.movementSpeed);
                xrRig.position.addInPlace(movement);
            }

            // Handle left/right strafing (X axis)
            if (Math.abs(normalizedX) > this.deadZone) {
                // Get camera's right direction for strafing
                const forward = xrCamera.getForwardRay().direction;
                forward.y = 0; // Keep movement horizontal
                forward.normalize();

                // Calculate right vector (perpendicular to forward)
                const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up());
                right.normalize();

                // Move right (positive X) or left (negative X)
                const strafeMovement = right.scale(normalizedX * this.movementSpeed);
                xrRig.position.addInPlace(strafeMovement);
            }

        } else if (this.movementMode === 'vertical') {
            // VERTICAL MODE: Up/Down + Rotate Left/Right

            // Handle up/down movement (Y axis)
            if (Math.abs(normalizedY) > this.deadZone) {
                // Move up (negative Y) or down (positive Y) along world Y axis
                const verticalMovement = new BABYLON.Vector3(0, -normalizedY * this.movementSpeed, 0);
                xrRig.position.addInPlace(verticalMovement);
            }

            // Handle left/right rotation (X axis)
            if (Math.abs(normalizedX) > this.deadZone) {
                // Rotate around Y axis
                const rotationAmount = normalizedX * this.rotationSpeed;

                if (xrRig.rotationQuaternion) {
                    // If using quaternions
                    const rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rotationAmount);
                    xrRig.rotationQuaternion = xrRig.rotationQuaternion.multiply(rotationQuaternion);
                } else {
                    // If using Euler angles
                    xrRig.rotation.y += rotationAmount;
                }
            }
        }
    }

    // R3 button event handlers
    onR3ButtonPressed() {
        // Toggle between movement modes
        if (this.movementMode === 'horizontal') {
            this.movementMode = 'vertical';
            console.log("Switched to VERTICAL mode - Up/Down: Move Up/Down, Left/Right: Rotate");
        } else {
            this.movementMode = 'horizontal';
            console.log("Switched to HORIZONTAL mode - Up/Down: Forward/Back, Left/Right: Strafe");
        }

        console.log("Current movement mode:", this.movementMode);
    }

    onR3ButtonReleased() {
        // Add your R3 button released logic here if needed
        console.log("R3 button released");
    }

    onEnterVR() {
        this.isInVR = true;
        console.log("Entered VR - Movement controls active");
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

    // Movement control methods
    setMovementSpeed(speed) {
        this.movementSpeed = speed;
        console.log("Movement speed set to:", speed);
    }

    setRotationSpeed(speed) {
        this.rotationSpeed = speed;
        console.log("Rotation speed set to:", speed);
    }

    setMovementEnabled(enabled) {
        this.movementEnabled = enabled;
        console.log("Movement enabled:", enabled);
    }

    setDeadZone(deadZone) {
        this.deadZone = deadZone;
        console.log("Dead zone set to:", deadZone);
    }

    // Movement mode control methods
    setMovementMode(mode) {
        if (mode === 'horizontal' || mode === 'vertical') {
            this.movementMode = mode;
            console.log("Movement mode set to:", mode);
        } else {
            console.warn("Invalid movement mode. Use 'horizontal' or 'vertical'");
        }
    }

    getMovementMode() {
        return this.movementMode;
    }

    toggleMovementMode() {
        this.movementMode = this.movementMode === 'horizontal' ? 'vertical' : 'horizontal';
        console.log("Movement mode toggled to:", this.movementMode);
        return this.movementMode;
    }

    // Threshold control methods
    setDirectionalThreshold(threshold) {
        this.directionalThreshold = Math.max(0.1, Math.min(1.0, threshold));
        console.log("Directional threshold set to:", this.directionalThreshold);
    }

    setDiagonalThreshold(threshold) {
        this.diagonalThreshold = Math.max(0.1, Math.min(1.0, threshold));
        console.log("Diagonal threshold set to:", this.diagonalThreshold);
    }

    // Get current direction info (useful for debugging)
    getCurrentDirection(x, y) {
        return this.getDirection(x, y);
    }

    // Additional utility methods
    resetPosition() {
        if (this.xrHelper && this.xrHelper.baseExperience.camera) {
            const xrCamera = this.xrHelper.baseExperience.camera;
            const xrRig = xrCamera.parent || xrCamera;
            xrRig.position = new BABYLON.Vector3(0, 1.8, 5);
            console.log("Position reset to origin");
        }
    }
}
