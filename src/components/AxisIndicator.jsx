import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import * as GUI from "@babylonjs/gui";


const CADTopViewAxisIndicator = ({ scene }) => {
  const axisContainerRef = useRef(null);
  
  useEffect(() => {
    if (!scene) return;
    console.log("axis1")
    
    // Create a fullscreen UI layer
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    
    // Create a container for the axis indicator
    const axisContainer = new GUI.Rectangle();
    axisContainer.width = "100px";
    axisContainer.height = "100px";
    axisContainer.thickness = 0;
    axisContainer.horizontalAlignment =GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    axisContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    axisContainer.top = "10px";  // Distance from the top
axisContainer.right = "10px"; // Distance from the right
    axisContainer.name = "cadTopViewAxisIndicator";
    // axisContainer.background = "rgba(0.2, 0.2, 0.2, 1)";
    axisContainer.cornerRadius = 10;
    advancedTexture.addControl(axisContainer);
    
    const centerX = 50;
    const centerY = 50;
    const axisLength = 45;
    
    // Create X-axis (red)
    const xAxis = new GUI.Line();
    xAxis.x1 = centerX + "px";
    xAxis.y1 = centerY + "px";
    xAxis.x2 = (centerX + axisLength) + "px";
    xAxis.y2 = centerY + "px";
    xAxis.lineWidth = 3;
    xAxis.color = "red";
    axisContainer.addControl(xAxis);
    
    // X-axis arrow (right arrow)
    const xArrowRight = new GUI.Line();
    xArrowRight.x1 = (centerX + axisLength) + "px";
    xArrowRight.y1 = centerY + "px";
    xArrowRight.x2 = (centerX + axisLength - 10) + "px";
    xArrowRight.y2 = (centerY - 5) + "px";
    xArrowRight.lineWidth = 3;
    xArrowRight.color = "red";
    axisContainer.addControl(xArrowRight);
    
    const xArrowLeft = new GUI.Line();
    xArrowLeft.x1 = (centerX + axisLength) + "px";
    xArrowLeft.y1 = centerY + "px";
    xArrowLeft.x2 = (centerX + axisLength - 10) + "px";
    xArrowLeft.y2 = (centerY + 5) + "px";
    xArrowLeft.lineWidth = 3;
    xArrowLeft.color = "red";
    axisContainer.addControl(xArrowLeft);
    
    // Create Y-axis (green)
    const yAxis = new GUI.Line();
    yAxis.x1 = centerX + "px";
    yAxis.y1 = centerY + "px";
    yAxis.x2 = centerX + "px";
    yAxis.y2 = (centerY - axisLength) + "px";
    yAxis.lineWidth = 3;
    yAxis.color = "green";
    axisContainer.addControl(yAxis);
    
    // Y-axis arrow (up arrow)
    const yArrowUp = new GUI.Line();
    yArrowUp.x1 = centerX + "px";
    yArrowUp.y1 = (centerY - axisLength) + "px";
    yArrowUp.x2 = (centerX - 5) + "px";
    yArrowUp.y2 = (centerY - axisLength + 10) + "px";
    yArrowUp.lineWidth = 3;
    yArrowUp.color = "green";
    axisContainer.addControl(yArrowUp);
    
    const yArrowDown = new GUI.Line();
    yArrowDown.x1 = centerX + "px";
    yArrowDown.y1 = (centerY - axisLength) + "px";
    yArrowDown.x2 = (centerX + 5) + "px";
    yArrowDown.y2 = (centerY - axisLength + 10) + "px";
    yArrowDown.lineWidth = 3;
    yArrowDown.color = "green";
    axisContainer.addControl(yArrowDown);
    
    // Create Z-axis (blue)
    const zAxis = new GUI.Line();
    zAxis.x1 = centerX + "px";
    zAxis.y1 = centerY + "px";
    zAxis.x2 = (centerX - axisLength * 0.7) + "px";
    zAxis.y2 = (centerY + axisLength * 0.7) + "px";
    zAxis.lineWidth = 3;
    zAxis.color = "blue";
    axisContainer.addControl(zAxis);
    
    // Z-axis arrow
    const zArrow1 = new GUI.Line();
    zArrow1.x1 = (centerX - axisLength * 0.7) + "px";
    zArrow1.y1 = (centerY + axisLength * 0.7) + "px";
    zArrow1.x2 = (centerX - axisLength * 0.7 + 8) + "px";
    zArrow1.y2 = (centerY + axisLength * 0.7 - 8) + "px";
    zArrow1.lineWidth = 3;
    zArrow1.color = "blue";
    axisContainer.addControl(zArrow1);
    
    const zArrow2 = new GUI.Line();
    zArrow2.x1 = (centerX - axisLength * 0.7) + "px";
    zArrow2.y1 = (centerY + axisLength * 0.7) + "px";
    zArrow2.x2 = (centerX - axisLength * 0.7 - 5) + "px";
    zArrow2.y2 = (centerY + axisLength * 0.7 - 5) + "px";
    zArrow2.lineWidth = 3;
    zArrow2.color = "blue";
    axisContainer.addControl(zArrow2);

    
    
    // Store reference to the container
    axisContainerRef.current = axisContainer;
    
    // Update indicator based on camera view
    const observer = scene.onBeforeRenderObservable.add(() => {
      // Only update if the container is visible
      if (axisContainer.isVisible) {
        // Transform world axes to screen space based on camera rotation
        const rightVector = new BABYLON.Vector3(1, 0, 0).applyRotationQuaternion(scene.activeCamera.absoluteRotation);
        const upVector = new BABYLON.Vector3(0, 0, 1).applyRotationQuaternion(scene.activeCamera.absoluteRotation);
        const forwardVector = new BABYLON.Vector3(0, -1, 0).applyRotationQuaternion(scene.activeCamera.absoluteRotation);
        
        // Update X axis and arrows
        const xEndX = centerX + rightVector.x * axisLength;
        const xEndY = centerY - rightVector.y * axisLength;
        
        xAxis.x2 = xEndX + "px";
        xAxis.y2 = xEndY + "px";
        
        // Update X arrow
        xArrowRight.x1 = xEndX + "px";
        xArrowRight.y1 = xEndY + "px";
        xArrowRight.x2 = (xEndX - rightVector.x * 10 - rightVector.y * 5) + "px";
        xArrowRight.y2 = (xEndY + rightVector.y * 10 - rightVector.x * 5) + "px";
        
        xArrowLeft.x1 = xEndX + "px";
        xArrowLeft.y1 = xEndY + "px";
        xArrowLeft.x2 = (xEndX - rightVector.x * 10 + rightVector.y * 5) + "px";
        xArrowLeft.y2 = (xEndY + rightVector.y * 10 + rightVector.x * 5) + "px";
        
        // Update Y axis and arrows
        const yEndX = centerX + upVector.x * axisLength;
        const yEndY = centerY - upVector.y * axisLength;
        
        yAxis.x2 = yEndX + "px";
        yAxis.y2 = yEndY + "px";
        
        // Update Y arrow
        yArrowUp.x1 = yEndX + "px";
        yArrowUp.y1 = yEndY + "px";
        yArrowUp.x2 = (yEndX - upVector.x * 10 - upVector.y * 5) + "px";
        yArrowUp.y2 = (yEndY + upVector.y * 10 - upVector.x * 5) + "px";
        
        yArrowDown.x1 = yEndX + "px";
        yArrowDown.y1 = yEndY + "px";
        yArrowDown.x2 = (yEndX - upVector.x * 10 + upVector.y * 5) + "px";
        yArrowDown.y2 = (yEndY + upVector.y * 10 + upVector.x * 5) + "px";
        
        // Update Z axis and arrows
        const zEndX = centerX - forwardVector.x * axisLength * 0.7;
        const zEndY = centerY + forwardVector.y * axisLength * 0.7;
        
        zAxis.x2 = zEndX + "px";
        zAxis.y2 = zEndY + "px";
        
        // Update Z arrow
        zArrow1.x1 = zEndX + "px";
        zArrow1.y1 = zEndY + "px";
        zArrow1.x2 = (zEndX + forwardVector.x * 10 - forwardVector.y * 5) + "px";
        zArrow1.y2 = (zEndY - forwardVector.y * 10 - forwardVector.x * 5) + "px";
        
        zArrow2.x1 = zEndX + "px";
        zArrow2.y1 = zEndY + "px";
        zArrow2.x2 = (zEndX + forwardVector.x * 10 + forwardVector.y * 5) + "px";
        zArrow2.y2 = (zEndY - forwardVector.y * 10 + forwardVector.x * 5) + "px";
      }
    });
    
    // Cleanup function to remove observer and GUI elements when component unmounts
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
      advancedTexture.removeControl(axisContainer);
    };
  }, [scene]); // Dependency on scene ensures effect runs when scene changes
  
  return null;
};

export default CADTopViewAxisIndicator;

