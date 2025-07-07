import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

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
    this.movementMode = 'horizontal';

    // Selection properties
    this.selectedMesh = null;
    this.originalMaterial = null;
    this.highlightMaterial = null;
    this.infoPanel = null;

    this.directionalThreshold = 0.3;
    this.diagonalThreshold = 0.7;
  }

  async initWithExistingXR(existingXRHelper) {
    try {
      this.xrHelper = existingXRHelper;
      this.setupVRHandlers();
      this.setupSelectionSystem();

      // Setup movement controls when in XR
      if (this.xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
        this.setupMovementControls();
        this.isInVR = true;
      }

      this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        if (state === BABYLON.WebXRState.IN_XR) {
          this.setupMovementControls();
          this.onEnterVR();
        } else if (state === BABYLON.WebXRState.EXITING_XR) {
          this.onExitVR();
        }
      });

      console.log("VR Helper initialized with existing XR session");
    } catch (error) {
      console.error("Failed to initialize VR Helper with existing XR:", error);
    }
  }

  setupSelectionSystem() {
    // Create highlight material
    this.highlightMaterial = new BABYLON.StandardMaterial("highlightMat", this.scene);
    this.highlightMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
    this.highlightMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0);
    this.highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0);

    this.setupInfoGUI();
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

      this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
      this.guiPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.guiPlane.isPickable = false;

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

      console.log("VR-compatible GUI system initialized successfully");
    } catch (error) {
      console.warn("Failed to initialize VR GUI:", error);
      this.guiAvailable = false;
    }
  }

  setupVRHandlers() {
    if (!this.xrHelper) return;

    this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
      if (state === BABYLON.WebXRState.ENTERING_XR) {
        this.onEnterVR();
      } else if (state === BABYLON.WebXRState.EXITING_XR) {
        this.onExitVR();
      }
    });
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

      if (thumbstick) {
        console.log("Thumbstick controller found - movement enabled");

        thumbstick.onButtonStateChangedObservable.add((component) => {
          if (component.pressed) {
            console.log("R3 button pressed");
            this.onR3ButtonPressed();
          } else {
            console.log("R3 button released");
            this.onR3ButtonReleased();
          }
        });

        this.scene.registerBeforeRender(() => {
          if (this.isInVR && this.movementEnabled && thumbstick.axes) {
            this.updateMovement(thumbstick.axes);
          }
        });
      }

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

    const x = axes.x;
    const y = axes.y;

    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude < this.deadZone) return;

    const normalizedX = Math.abs(x) > this.deadZone ? x : 0;
    const normalizedY = Math.abs(y) > this.deadZone ? y : 0;

    if (this.movementMode === 'horizontal') {
      if (Math.abs(normalizedY) > this.deadZone) {
        const forward = xrCamera.getForwardRay().direction;
        forward.y = 0;
        forward.normalize();

        const movement = forward.scale(normalizedY * this.movementSpeed);
        xrRig.position.addInPlace(movement);
      }

      if (Math.abs(normalizedX) > this.deadZone) {
        const forward = xrCamera.getForwardRay().direction;
        forward.y = 0;
        forward.normalize();

        const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up());
        right.normalize();

        const strafeMovement = right.scale(normalizedX * this.movementSpeed);
        xrRig.position.addInPlace(strafeMovement);
      }
    } else if (this.movementMode === 'vertical') {
      if (Math.abs(normalizedY) > this.deadZone) {
        const verticalMovement = new BABYLON.Vector3(0, -normalizedY * this.movementSpeed, 0);
        xrRig.position.addInPlace(verticalMovement);
      }

      if (Math.abs(normalizedX) > this.deadZone) {
        const rotationAmount = normalizedX * this.rotationSpeed;

        if (xrRig.rotationQuaternion) {
          const rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rotationAmount);
          xrRig.rotationQuaternion = xrRig.rotationQuaternion.multiply(rotationQuaternion);
        } else {
          xrRig.rotation.y += rotationAmount;
        }
      }
    }
  }

  selectMeshAtController(controller) {
    if (!controller.pointer) return;

    const ray = new BABYLON.Ray(controller.pointer.position, controller.pointer.forward);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.name !== "ground" && mesh.material && mesh.isPickable !== false;
    });

    if (hit.hit && hit.pickedMesh) {
      this.selectMesh(hit.pickedMesh);
      console.log("Selected mesh:", hit.pickedMesh.name);
    } else {
      this.deselectMesh();
      console.log("Deselected - clicked on empty space");
    }
  }

  selectMesh(mesh) {
    this.deselectMesh();

    this.selectedMesh = mesh;
    this.originalMaterial = mesh.material;
    mesh.material = this.highlightMaterial;
    this.showMeshInfo(mesh);
  }

  deselectMesh() {
    if (this.selectedMesh && this.originalMaterial) {
      this.selectedMesh.material = this.originalMaterial;
      this.selectedMesh = null;
      this.originalMaterial = null;
    }
    this.hideInfoPanel();
  }

  showMeshInfo(mesh) {
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

    if (this.guiAvailable && this.infoText && this.guiPlane) {
      this.infoText.text = infoText;

      if (this.isInVR && this.xrHelper && this.xrHelper.baseExperience.camera) {
        const xrCamera = this.xrHelper.baseExperience.camera;
        const forward = xrCamera.getForwardRay().direction;
        const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();

        this.guiPlane.position = xrCamera.position.add(forward.scale(3))
          .add(right.scale(-2))
          .add(new BABYLON.Vector3(0, 0.5, 0));
      } else {
        this.guiPlane.position = new BABYLON.Vector3(-3, 2, 0);
      }

      this.guiPlane.setEnabled(true);
      console.log("Mesh info displayed in VR GUI panel");
    } else {
      console.log("=== MESH SELECTION INFO ===");
      console.log(infoText);
      console.log("============================");
    }
  }

  hideInfoPanel() {
    if (this.guiAvailable && this.guiPlane) {
      this.guiPlane.setEnabled(false);
    }
    console.log("Mesh deselected - info panel hidden");
  }

  onR3ButtonPressed() {
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
    console.log("R3 button released");
  }

  onEnterVR() {
    this.isInVR = true;
    console.log("Entered VR - Movement controls active");
    console.log("HORIZONTAL mode: Up/Down = Forward/Back, Left/Right = Strafe");
    console.log("Press R3 to switch to VERTICAL mode: Up/Down = Move Up/Down, Left/Right = Rotate");
    console.log("Press R3 again to switch back to HORIZONTAL mode");
    console.log("Press A button to select/deselect objects");
    
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

  resetPosition() {
    if (this.xrHelper && this.xrHelper.baseExperience.camera) {
      const xrCamera = this.xrHelper.baseExperience.camera;
      const xrRig = xrCamera.parent || xrCamera;
      xrRig.position = new BABYLON.Vector3(0, 1.8, 5);
      console.log("Position reset to origin");
    }
  }

  dispose() {
    this.deselectMesh();

    if (this.guiPlane) {
      this.guiPlane.dispose();
      this.guiPlane = null;
    }

    if (this.highlightMaterial) {
      this.highlightMaterial.dispose();
      this.highlightMaterial = null;
    }

    console.log("VR Helper disposed");
  }
}