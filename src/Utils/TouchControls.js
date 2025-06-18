/**
 * Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
 * @author JaleelaBasheer
 */
import * as BABYLON from "@babylonjs/core";

export class FreeCameraTouchInput {
    constructor() {
        this.pointerPressed = [];
        this.angularSensibility = 2000.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.direction = new BABYLON.Vector3(0, 0, 0);
    }

    attachControl(noPreventDefault) {
        if (!this._pointerInput) {
            this._pointerInput = (p, s) => {
                const evt = p.event;
                if (evt.pointerType !== 'touch') return;

                if (p.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                    try {
                        evt.srcElement.setPointerCapture(evt.pointerId);
                    } catch (e) {}
                    this.pointerPressed.push(evt.pointerId);
                    if (this.pointerPressed.length !== 1) return;
                    this.previousPosition = { x: evt.clientX, y: evt.clientY };
                    if (!noPreventDefault) evt.preventDefault();
                }
                else if (p.type === BABYLON.PointerEventTypes.POINTERUP) {
                    try {
                        evt.srcElement.releasePointerCapture(evt.pointerId);
                    } catch (e) {}
                    const index = this.pointerPressed.indexOf(evt.pointerId);
                    if (index === -1) return;
                    this.pointerPressed.splice(index, 1);
                    if (index !== 0) return;
                    this.previousPosition = null;
                    this.offsetX = 0;
                    this.offsetY = 0;
                    if (!noPreventDefault) evt.preventDefault();
                }
                else if (p.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                    if (!this.previousPosition) return;
                    const index = this.pointerPressed.indexOf(evt.pointerId);
                    if (index !== 0) return;
                    this.offsetX = evt.clientX - this.previousPosition.x;
                    this.offsetY = evt.clientY - this.previousPosition.y;
                    if (!noPreventDefault) evt.preventDefault();
                }
            };
        }

        this._observer = this.camera.getScene().onPointerObservable.add(
            this._pointerInput,
            BABYLON.PointerEventTypes.POINTERDOWN |
            BABYLON.PointerEventTypes.POINTERUP |
            BABYLON.PointerEventTypes.POINTERMOVE
        );

        const hostWindow = this.camera.getScene().getEngine().getHostWindow();
        if (hostWindow) {
            hostWindow.addEventListener('mousemove', this._onSearchMove, false);
        }
    }

    detachControl() {
        if (this._observer) {
            this.camera.getScene().onPointerObservable.remove(this._observer);
            const hostWindow = this.camera.getScene().getEngine().getHostWindow();
            if (hostWindow) {
                hostWindow.removeEventListener('mousemove', this._onSearchMove);
            }
            this._observer = null;
            this._onSearchMove = null;
            this.previousPosition = null;
        }
    }

    checkInputs() {
        const speed = this.camera.speed;
        if (!this.previousPosition) return;

        if (this.pointerPressed.length === 1) {
            if (this.camera.getScene().useRightHandedSystem) {
                this.camera.cameraRotation.y -= this.offsetX / (20 * this.angularSensibility);
            } else {
                this.camera.cameraRotation.y += this.offsetX / (20 * this.angularSensibility);
            }

            this.direction.copyFromFloats(0, 0, -this.offsetY * speed / 300);
            if (this.camera.getScene().useRightHandedSystem) {
                this.direction.z *= -1;
            }
        } else if (this.pointerPressed.length > 1) {
            this.direction.copyFromFloats(
                this.offsetX * speed / 500,
                -this.offsetY * speed / 500,
                0
            );
        }

        if (this.pointerPressed.length >= 1) {
            this.camera.getViewMatrix().invertToRef(this.camera._cameraTransformMatrix);
            BABYLON.Vector3.TransformNormalToRef(
                this.direction,
                this.camera._cameraTransformMatrix,
                this.camera._transformedDirection
            );
            this.camera.cameraDirection.addInPlace(this.camera._transformedDirection);
        }
    }

    getTypeName() {
        return 'FreeCameraTouchInput';
    }

    getSimpleName() {
        return 'touch';
    }
}
