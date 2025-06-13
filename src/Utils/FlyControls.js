/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */

import * as BABYLON from "@babylonjs/core";


export class FreeCameraMouseInput {
  constructor(camera) {
    this.camera = camera;
    this.buttons = [];
    this.angularSensibility = 2000.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.wheelDeltaY = 0;
    this.wheelSensibility = 1; // Reduced sensitivity for rotation
    this.direction = new BABYLON.Vector3(0, 0, 0);
    this._observer = null;
    this._wheelObserver = null;
    this._pointerInput = null;
    this.previousPosition = null;
  }

  attachControl(element, noPreventDefault) {
    const _this = this;

    if (!this._pointerInput) {
      this._pointerInput = (p, s) => {
        const evt = p.event;
        if (evt.pointerType !== "mouse") return;

        if (p.type === BABYLON.PointerEventTypes.POINTERDOWN) {
          try {
            evt.srcElement.setPointerCapture(evt.pointerId);
          } catch (e) {}

          if (_this.buttons.length === 0) _this.buttons.push(evt.button);
          _this.previousPosition = {
            x: evt.clientX,
            y: evt.clientY,
          };

          if (!noPreventDefault) {
            evt.preventDefault();
            // element.focus();
          }
        } else if (p.type === BABYLON.PointerEventTypes.POINTERUP) {
          try {
            evt.srcElement.releasePointerCapture(evt.pointerId);
          } catch (e) {}

          if (_this.buttons.length !== 0) _this.buttons.pop();
          _this.previousPosition = null;
          _this.offsetX = 0;
          _this.offsetY = 0;

          if (!noPreventDefault) evt.preventDefault();
        } else if (p.type === BABYLON.PointerEventTypes.POINTERMOVE) {
          if (!_this.previousPosition) return;

          const moveX = evt.clientX - _this.previousPosition.x;
          const moveY = evt.clientY - _this.previousPosition.y;

          const absX = Math.abs(moveX);
          const absY = Math.abs(moveY);

          const thresholdRatio = 1.5; // Adjust this value based on desired sensitivity

          if (absX > absY * thresholdRatio) {
              // Consider it horizontal
              _this.offsetX = moveX;
              _this.offsetY = 0;
          } else if (absY > absX * thresholdRatio) {
              // Consider it vertical
              _this.offsetX = 0;
              _this.offsetY = moveY;
          } else {
              // Ignore if not clearly horizontal or vertical
              _this.offsetX = 0;
              _this.offsetY = 0;
          }
          if (!noPreventDefault) evt.preventDefault();
        }
      };
    }

    // Wheel event handler using observer pattern
    this._wheelObserver = this.camera
      .getScene()
      .onPrePointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
          const wheelDelta =
            pointerInfo.event.wheelDelta || -pointerInfo.event.detail * 40;
          _this.wheelDeltaY = (wheelDelta / 120) * _this.wheelSensibility;

          if (!noPreventDefault && pointerInfo.event.preventDefault) {
            pointerInfo.event.preventDefault();
          }
        }
      }, BABYLON.PointerEventTypes.POINTERWHEEL);

    this._observer = this.camera
      .getScene()
      .onPointerObservable.add(
        this._pointerInput,
        BABYLON.PointerEventTypes.POINTERDOWN |
          BABYLON.PointerEventTypes.POINTERUP |
          BABYLON.PointerEventTypes.POINTERMOVE
      );
  }

  detachControl(element) {
    if (this._observer && element) {
      this.camera.getScene().onPointerObservable.remove(this._observer);
      this._observer = null;
      this.previousPosition = null;

      if (this._wheelObserver) {
        this.camera
          .getScene()
          .onPrePointerObservable.remove(this._wheelObserver);
        this._wheelObserver = null;
      }
    }
  }

  checkInputs() {
    const speed = this.camera.speed;

    // Process mouse movement
    if (this.previousPosition) {
      if (this.buttons.indexOf(0) !== -1) {
        if (this.camera.getScene().useRightHandedSystem)
          this.camera.cameraRotation.y -=
            this.offsetX / (20 * this.angularSensibility);
        else
          this.camera.cameraRotation.y +=
            this.offsetX / (20 * this.angularSensibility);

        this.direction.copyFromFloats(0, 0, (this.offsetY * speed) / 300);
        if (this.camera.getScene().useRightHandedSystem) this.direction.z *= 1;
      }

      if (this.buttons.indexOf(1) !== -1)
        this.direction.copyFromFloats(
          (this.offsetX * speed) / 500,
          (-this.offsetY * speed) / 500,
          0
        );
    }

    // Process wheel movement - now with adaptive sensitivity based on model size
    if (this.wheelDeltaY !== 0) {
      // Calculate sensitivity factor based on model size
      let sensitivityFactor = 1.0;

      if (
        this.modelInfoRef &&
        this.modelInfoRef.current &&
        this.modelInfoRef.current.modelRadius
      ) {
        const modelRadius = this.modelInfoRef.current.modelRadius;

        // Scale sensitivity inversely with model size
        // For large models (high radius), lower sensitivity (smaller factor)
        // For small models (low radius), higher sensitivity (larger factor)
        sensitivityFactor=300/this.modelInfoRef.current.modelRadius
      }

      // Apply the rotation with scaled sensitivity
      const scaledWheelDelta =
        this.wheelDeltaY *
        this.wheelSensibility *
        sensitivityFactor *
        speed *
        0.01;
      this.camera.cameraRotation.x += scaledWheelDelta;

      // Reset the wheel delta after applying it
      this.wheelDeltaY = 0;
    }

    // Apply combined movements if needed
    if (
      (this.buttons.indexOf(0) !== -1 || this.buttons.indexOf(1) !== -1) &&
      this.direction.length() > 0
    ) {
      this.camera
        .getViewMatrix()
        .invertToRef(this.camera._cameraTransformMatrix);
      BABYLON.Vector3.TransformNormalToRef(
        this.direction,
        this.camera._cameraTransformMatrix,
        this.camera._transformedDirection
      );
      this.camera.cameraDirection.addInPlace(this.camera._transformedDirection);
    }
  }
  getTypeName() {
    return "FreeCameraMouseInput";
  }

  getSimpleName() {
    return "mouse";
  }
}


// export class FreeCameraMouseInput {
//   constructor(camera) {
//     this.camera = camera;
//     this.buttons = [];
//     this.angularSensibility = 2000.0;
//     this.offsetX = 0;
//     this.offsetY = 0;
//     this.wheelDeltaY = 0;
//     this.wheelSensibility = 1;
//     this.direction = new BABYLON.Vector3(0, 0, 0);
//     this._observer = null;
//     this._wheelObserver = null;
//     this._pointerInput = null;
//     this.previousPosition = null;
    
//     // Performance properties (but keeping continuous movement)
//     this.lastUpdateTime = 0;
//     this.inputThrottleMs = 8; // ~120fps max input processing
//     this.wheelBuffer = 0; // Single value instead of array for continuous feel
//     this.wheelDecay = 0.85; // Decay factor for wheel momentum
    
//     // Model info reference for adaptive sensitivity
//     this.modelInfoRef = null;
    
//     // Loading state management
//     this.isLoading = false;
//   }

//   // Set model info reference for adaptive sensitivity
//   setModelInfoRef(modelInfoRef) {
//     this.modelInfoRef = modelInfoRef;
//   }

//   // Set loading state to adjust responsiveness
//   setLoadingState(isLoading) {
//     this.isLoading = isLoading;
//     if (isLoading) {
//       // Slightly reduce responsiveness during loading to prevent stuttering
//       this.inputThrottleMs = 12; // ~83fps during loading
//     } else {
//       // Normal responsive input when not loading
//       this.inputThrottleMs = 8; // ~120fps when not loading
//     }
//   }

//   attachControl(element, noPreventDefault) {
//     const _this = this;

//     if (!this._pointerInput) {
//       this._pointerInput = (p, s) => {
//         const evt = p.event;
//         if (evt.pointerType !== "mouse") return;

//         if (p.type === BABYLON.PointerEventTypes.POINTERDOWN) {
//           try {
//             evt.srcElement.setPointerCapture(evt.pointerId);
//           } catch (e) {}

//           if (_this.buttons.length === 0) _this.buttons.push(evt.button);
//           _this.previousPosition = {
//             x: evt.clientX,
//             y: evt.clientY,
//           };

//           if (!noPreventDefault) {
//             evt.preventDefault();
//           }
//         } else if (p.type === BABYLON.PointerEventTypes.POINTERUP) {
//           try {
//             evt.srcElement.releasePointerCapture(evt.pointerId);
//           } catch (e) {}

//           if (_this.buttons.length !== 0) _this.buttons.pop();
//           _this.previousPosition = null;
//           _this.offsetX = 0;
//           _this.offsetY = 0;

//           if (!noPreventDefault) evt.preventDefault();
//         } else if (p.type === BABYLON.PointerEventTypes.POINTERMOVE) {
//           if (!_this.previousPosition) return;

//           const moveX = evt.clientX - _this.previousPosition.x;
//           const moveY = evt.clientY - _this.previousPosition.y;

//           const absX = Math.abs(moveX);
//           const absY = Math.abs(moveY);
//           const thresholdRatio = 1.5;

//           // Keep your original directional filtering logic
//           if (absX > absY * thresholdRatio) {
//             // Consider it horizontal
//             _this.offsetX = moveX;
//             _this.offsetY = 0;
//           } else if (absY > absX * thresholdRatio) {
//             // Consider it vertical
//             _this.offsetX = 0;
//             _this.offsetY = moveY;
//           } else {
//             // Use both - this maintains continuous movement
//             _this.offsetX = moveX;
//             _this.offsetY = moveY;
//           }

//           // Update previous position for next calculation
//           _this.previousPosition = {
//             x: evt.clientX,
//             y: evt.clientY
//           };

//           if (!noPreventDefault) evt.preventDefault();
//         }
//       };
//     }

//     // Enhanced wheel event handler with momentum but keeping continuous feel
//     this._wheelObserver = this.camera
//       .getScene()
//       .onPrePointerObservable.add((pointerInfo) => {
//         if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
//           const wheelDelta = pointerInfo.event.wheelDelta || -pointerInfo.event.detail * 40;
//           const normalizedDelta = (wheelDelta / 120) * _this.wheelSensibility;
          
//           // Add to existing wheel momentum for smooth continuous rotation
//           _this.wheelBuffer += normalizedDelta;

//           if (!noPreventDefault && pointerInfo.event.preventDefault) {
//             pointerInfo.event.preventDefault();
//           }
//         }
//       }, BABYLON.PointerEventTypes.POINTERWHEEL);

//     this._observer = this.camera
//       .getScene()
//       .onPointerObservable.add(
//         this._pointerInput,
//         BABYLON.PointerEventTypes.POINTERDOWN |
//           BABYLON.PointerEventTypes.POINTERUP |
//           BABYLON.PointerEventTypes.POINTERMOVE
//       );
//   }

//   detachControl(element) {
//     if (this._observer && element) {
//       this.camera.getScene().onPointerObservable.remove(this._observer);
//       this._observer = null;
//       this.previousPosition = null;

//       if (this._wheelObserver) {
//         this.camera
//           .getScene()
//           .onPrePointerObservable.remove(this._wheelObserver);
//         this._wheelObserver = null;
//       }
      
//       // Reset values on detach
//       this.offsetX = 0;
//       this.offsetY = 0;
//       this.wheelBuffer = 0;
//     }
//   }

//   checkInputs() {
//     const now = performance.now();
    
//     // Light throttling to prevent stuttering during heavy loading
//     if (this.isLoading && now - this.lastUpdateTime < this.inputThrottleMs) {
//       return;
//     }
//     this.lastUpdateTime = now;

//     const speed = this.camera.speed;

//     // Process mouse movement - EXACTLY like your original code for continuous movement
//     if (this.previousPosition) {
//       if (this.buttons.indexOf(0) !== -1) {
//         // Rotation - exactly like your original
//         if (this.camera.getScene().useRightHandedSystem)
//           this.camera.cameraRotation.y -=
//             this.offsetX / (20 * this.angularSensibility);
//         else
//           this.camera.cameraRotation.y +=
//             this.offsetX / (20 * this.angularSensibility);

//         // Forward/backward movement - exactly like your original
//         this.direction.copyFromFloats(0, 0, (this.offsetY * speed) / 300);
//         if (this.camera.getScene().useRightHandedSystem) this.direction.z *= 1;
//       }

//       // Middle mouse button panning - exactly like your original
//       if (this.buttons.indexOf(1) !== -1)
//         this.direction.copyFromFloats(
//           (this.offsetX * speed) / 500,
//           (-this.offsetY * speed) / 500,
//           0
//         );
//     }

//     // Enhanced wheel processing with continuous momentum and adaptive sensitivity
//     if (Math.abs(this.wheelBuffer) > 0.001) {
//       // Calculate sensitivity factor based on model size
//       let sensitivityFactor = 1.0;

//       if (
//         this.modelInfoRef &&
//         this.modelInfoRef.current &&
//         this.modelInfoRef.current.modelRadius
//       ) {
//         const modelRadius = this.modelInfoRef.current.modelRadius;
//         // Scale sensitivity inversely with model size
//         sensitivityFactor = Math.max(0.1, Math.min(10, 300 / modelRadius));
//       }

//       // Apply the rotation with scaled sensitivity - continuous like your original
//       const scaledWheelDelta = this.wheelBuffer * sensitivityFactor * speed * 0.01;
//       this.camera.cameraRotation.x += scaledWheelDelta;

//       // Clamp pitch to prevent over-rotation
//       const maxPitch = Math.PI / 2 - 0.1;
//       this.camera.cameraRotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.cameraRotation.x));

//       // Apply decay for momentum effect but keep it continuous
//       this.wheelBuffer *= this.wheelDecay;
      
//       // Stop very small movements to prevent jitter
//       if (Math.abs(this.wheelBuffer) < 0.001) {
//         this.wheelBuffer = 0;
//       }
//     }

//     // Apply combined movements - exactly like your original
//     if (
//       (this.buttons.indexOf(0) !== -1 || this.buttons.indexOf(1) !== -1) &&
//       this.direction.length() > 0
//     ) {
//       this.camera
//         .getViewMatrix()
//         .invertToRef(this.camera._cameraTransformMatrix);
//       BABYLON.Vector3.TransformNormalToRef(
//         this.direction,
//         this.camera._cameraTransformMatrix,
//         this.camera._transformedDirection
//       );
//       this.camera.cameraDirection.addInPlace(this.camera._transformedDirection);
//     }
//   }

//   getTypeName() {
//     return "FreeCameraMouseInput";
//   }

//   getSimpleName() {
//     return "mouse";
//   }

//   // Clear buffers (useful when camera switches)
//   clearBuffers() {
//     this.offsetX = 0;
//     this.offsetY = 0;
//     this.wheelBuffer = 0;
//     this.direction.setAll(0);
//   }
// }