import * as BABYLON from "@babylonjs/core";

export class CameraMovementDetector {
    constructor(camera, onMovementStart, onMovementStop) {
        this.camera = camera;
        this.onMovementStart = onMovementStart;
        this.onMovementStop = onMovementStop;
        
        this.isMoving = false;
        this.lastPosition = null;
        this.lastRotation = null;
        this.lastRadius = null;
        this.movementThreshold = 0.01;
        this.stopDelay = 200;
        this.stopTimeout = null;
        
        this.boundCheck = this.checkMovement.bind(this);
        this.startDetection();
    }
    
    startDetection() {
        if (this.camera && this.camera.getScene()) {
            this.camera.getScene().registerBeforeRender(this.boundCheck);
            this.updateLastPosition();
        }
    }
    
    stopDetection() {
        if (this.camera && this.camera.getScene()) {
            this.camera.getScene().unregisterBeforeRender(this.boundCheck);
        }
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }
    }
    
    updateLastPosition() {
        if (this.camera instanceof BABYLON.ArcRotateCamera) {
            this.lastPosition = this.camera.target.clone();
            this.lastRadius = this.camera.radius;
            this.lastRotation = { alpha: this.camera.alpha, beta: this.camera.beta };
        } else if (this.camera instanceof BABYLON.UniversalCamera) {
            this.lastPosition = this.camera.position.clone();
            this.lastRotation = this.camera.rotation.clone();
        }
    }
    
    checkMovement() {
        let hasMovement = false;
        
        if (this.camera instanceof BABYLON.ArcRotateCamera) {
            const targetDistance = this.lastPosition ? 
                BABYLON.Vector3.Distance(this.camera.target, this.lastPosition) : 0;
            const radiusChange = this.lastRadius ? 
                Math.abs(this.camera.radius - this.lastRadius) : 0;
            const alphaChange = this.lastRotation ? 
                Math.abs(this.camera.alpha - this.lastRotation.alpha) : 0;
            const betaChange = this.lastRotation ? 
                Math.abs(this.camera.beta - this.lastRotation.beta) : 0;
            
            hasMovement = targetDistance > this.movementThreshold ||
                         radiusChange > this.movementThreshold ||
                         alphaChange > this.movementThreshold ||
                         betaChange > this.movementThreshold;
                         
        } else if (this.camera instanceof BABYLON.UniversalCamera) {
            const positionDistance = this.lastPosition ? 
                BABYLON.Vector3.Distance(this.camera.position, this.lastPosition) : 0;
            const rotationDistance = this.lastRotation ? 
                BABYLON.Vector3.Distance(this.camera.rotation, this.lastRotation) : 0;
            
            hasMovement = positionDistance > this.movementThreshold ||
                         rotationDistance > this.movementThreshold;
        }
        
        if (hasMovement) {
            if (this.stopTimeout) {
                clearTimeout(this.stopTimeout);
                this.stopTimeout = null;
            }
            
            if (!this.isMoving) {
                this.isMoving = true;
                console.log('Camera movement started');
                this.onMovementStart?.();
            }
            
            this.updateLastPosition();
            
        } else if (this.isMoving && !this.stopTimeout) {
            this.stopTimeout = setTimeout(() => {
                this.isMoving = false;
                this.stopTimeout = null;
                console.log('Camera movement stopped');
                this.onMovementStop?.();
            }, this.stopDelay);
        }
    }
    
    setMovementThreshold(threshold) {
        this.movementThreshold = threshold;
    }
    
    setStopDelay(delay) {
        this.stopDelay = delay;
    }
    
    dispose() {
        this.stopDetection();
        this.camera = null;
        this.onMovementStart = null;
        this.onMovementStop = null;
    }
}