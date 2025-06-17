import React, { useEffect, useRef } from 'react';
import * as BABYLON from 'babylonjs';
import './AxisIndicators.css';

// Enhanced 3D axis indicator using SVG
export const EnhancedAxisIndicator = ({ scene }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!scene || !containerRef.current) return;
    
    const container = containerRef.current;
    const svgContainer = container.querySelector('svg');
    
    // Elements to be updated
    const xAxis = container.querySelector('.x-axis');
    const yAxis = container.querySelector('.y-axis');
    const zAxis = container.querySelector('.z-axis');
    
    const xArrow1 = container.querySelector('.x-arrow-1');
    const xArrow2 = container.querySelector('.x-arrow-2');
    const yArrow1 = container.querySelector('.y-arrow-1');
    const yArrow2 = container.querySelector('.y-arrow-2');
    const zArrow1 = container.querySelector('.z-arrow-1');
    const zArrow2 = container.querySelector('.z-arrow-2');
    
    const xLabel = container.querySelector('.x-label');
    const yLabel = container.querySelector('.y-label');
    const zLabel = container.querySelector('.z-label');
    
    // Center point for all axes
    const centerX = 50;
    const centerY = 50;
    
    // Axis length
    const axisLength = 35;
    
    // Update function to adjust axes based on camera orientation
    const updateAxes = () => {
      if (!scene.activeCamera) return;
      
      // Transform world axes to screen space based on camera rotation
      const rightVector = new BABYLON.Vector3(1, 0, 0)
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      const upVector = new BABYLON.Vector3(0, 1, 0)
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      const forwardVector = new BABYLON.Vector3(0, 0, 1)
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      
      // Calculate endpoints for all axes
      const xEndX = centerX + rightVector.x * axisLength;
      const xEndY = centerY - rightVector.y * axisLength;
      
      const yEndX = centerX + upVector.x * axisLength;
      const yEndY = centerY - upVector.y * axisLength;
      
      const zEndX = centerX + forwardVector.x * axisLength;
      const zEndY = centerY - forwardVector.y * axisLength;
      
      // Update X axis and its arrows
      xAxis.setAttribute('x1', centerX);
      xAxis.setAttribute('y1', centerY);
      xAxis.setAttribute('x2', xEndX);
      xAxis.setAttribute('y2', xEndY);
      
      // Update X arrows
      const xArrowSize = 5;
      
      // Calculate perpendicular direction for arrow heads
      const xDirX = xEndX - centerX;
      const xDirY = xEndY - centerY;
      const xDirLength = Math.sqrt(xDirX * xDirX + xDirY * xDirY);
      const xNormX = xDirX / xDirLength;
      const xNormY = xDirY / xDirLength;
      const xPerpX = -xNormY;
      const xPerpY = xNormX;
      
      xArrow1.setAttribute('x1', xEndX);
      xArrow1.setAttribute('y1', xEndY);
      xArrow1.setAttribute('x2', xEndX - xNormX * xArrowSize + xPerpX * xArrowSize);
      xArrow1.setAttribute('y2', xEndY - xNormY * xArrowSize + xPerpY * xArrowSize);
      
      xArrow2.setAttribute('x1', xEndX);
      xArrow2.setAttribute('y1', xEndY);
      xArrow2.setAttribute('x2', xEndX - xNormX * xArrowSize - xPerpX * xArrowSize);
      xArrow2.setAttribute('y2', xEndY - xNormY * xArrowSize - xPerpY * xArrowSize);
      
      // Position X label
      xLabel.setAttribute('x', xEndX + xNormX * 5);
      xLabel.setAttribute('y', xEndY + xNormY * 5);
      
      // Update Y axis and its arrows
      yAxis.setAttribute('x1', centerX);
      yAxis.setAttribute('y1', centerY);
      yAxis.setAttribute('x2', yEndX);
      yAxis.setAttribute('y2', yEndY);
      
      // Update Y arrows
      const yArrowSize = 5;
      
      // Calculate perpendicular direction for arrow heads
      const yDirX = yEndX - centerX;
      const yDirY = yEndY - centerY;
      const yDirLength = Math.sqrt(yDirX * yDirX + yDirY * yDirY);
      const yNormX = yDirX / yDirLength;
      const yNormY = yDirY / yDirLength;
      const yPerpX = -yNormY;
      const yPerpY = yNormX;
      
      yArrow1.setAttribute('x1', yEndX);
      yArrow1.setAttribute('y1', yEndY);
      yArrow1.setAttribute('x2', yEndX - yNormX * yArrowSize + yPerpX * yArrowSize);
      yArrow1.setAttribute('y2', yEndY - yNormY * yArrowSize + yPerpY * yArrowSize);
      
      yArrow2.setAttribute('x1', yEndX);
      yArrow2.setAttribute('y1', yEndY);
      yArrow2.setAttribute('x2', yEndX - yNormX * yArrowSize - yPerpX * yArrowSize);
      yArrow2.setAttribute('y2', yEndY - yNormY * yArrowSize - yPerpY * yArrowSize);
      
      // Position Y label
      yLabel.setAttribute('x', yEndX + yNormX * 5);
      yLabel.setAttribute('y', yEndY + yNormY * 5);
      
      // Update Z axis and its arrows
      zAxis.setAttribute('x1', centerX);
      zAxis.setAttribute('y1', centerY);
      zAxis.setAttribute('x2', zEndX);
      zAxis.setAttribute('y2', zEndY);
      
      // Update Z arrows
      const zArrowSize = 5;
      
      // Calculate perpendicular direction for arrow heads
      const zDirX = zEndX - centerX;
      const zDirY = zEndY - centerY;
      const zDirLength = Math.sqrt(zDirX * zDirX + zDirY * zDirY);
      const zNormX = zDirX / zDirLength;
      const zNormY = zDirY / zDirLength;
      const zPerpX = -zNormY;
      const zPerpY = zNormX;
      
      zArrow1.setAttribute('x1', zEndX);
      zArrow1.setAttribute('y1', zEndY);
      zArrow1.setAttribute('x2', zEndX - zNormX * zArrowSize + zPerpX * zArrowSize);
      zArrow1.setAttribute('y2', zEndY - zNormY * zArrowSize + zPerpY * zArrowSize);
      
      zArrow2.setAttribute('x1', zEndX);
      zArrow2.setAttribute('y1', zEndY);
      zArrow2.setAttribute('x2', zEndX - zNormX * zArrowSize - zPerpX * zArrowSize);
      zArrow2.setAttribute('y2', zEndY - zNormY * zArrowSize - zPerpY * zArrowSize);
      
      // Position Z label
      zLabel.setAttribute('x', zEndX + zNormX * 5);
      zLabel.setAttribute('y', zEndY + zNormY * 5);
    };
    
    // Add observer to update axes on camera movement
    const observer = scene.onBeforeRenderObservable.add(updateAxes);
    
    // Initial update
    updateAxes();
    
    // Cleanup
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [scene]);
  
  return (
    <div ref={containerRef} className="axis-indicator">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* X axis (red) */}
        <line className="x-axis" x1="50" y1="50" x2="85" y2="50" stroke="red" strokeWidth="2" />
        <line className="x-arrow-1" x1="85" y1="50" x2="80" y2="45" stroke="red" strokeWidth="2" />
        <line className="x-arrow-2" x1="85" y1="50" x2="80" y2="55" stroke="red" strokeWidth="2" />
        <text className="x-label" x="90" y="50" fill="red" fontSize="12" dominantBaseline="middle">X</text>
        
        {/* Y axis (green) */}
        <line className="y-axis" x1="50" y1="50" x2="50" y2="15" stroke="green" strokeWidth="2" />
        <line className="y-arrow-1" x1="50" y1="15" x2="45" y2="20" stroke="green" strokeWidth="2" />
        <line className="y-arrow-2" x1="50" y1="15" x2="55" y2="20" stroke="green" strokeWidth="2" />
        <text className="y-label" x="50" y="10" fill="green" fontSize="12" textAnchor="middle">Y</text>
        
        {/* Z axis (blue) */}
        <line className="z-axis" x1="50" y1="50" x2="25" y2="75" stroke="blue" strokeWidth="2" />
        <line className="z-arrow-1" x1="25" y1="75" x2="30" y2="70" stroke="blue" strokeWidth="2" />
        <line className="z-arrow-2" x1="25" y1="75" x2="30" y2="80" stroke="blue" strokeWidth="2" />
        <text className="z-label" x="20" y="80" fill="blue" fontSize="12" dominantBaseline="middle">Z</text>
      </svg>
    </div>
  );
};

// CAD Top View Axis indicator using SVG
export const CADTopViewAxisIndicator = ({ scene }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!scene || !containerRef.current) return;
    
    const container = containerRef.current;
    
    // Elements to be updated
    const xAxis = container.querySelector('.x-axis');
    const yAxis = container.querySelector('.y-axis');
    const zAxis = container.querySelector('.z-axis');
    
    const xArrow1 = container.querySelector('.x-arrow-1');
    const xArrow2 = container.querySelector('.x-arrow-2');
    const yArrow1 = container.querySelector('.y-arrow-1');
    const yArrow2 = container.querySelector('.y-arrow-2');
    const zArrow1 = container.querySelector('.z-arrow-1');
    const zArrow2 = container.querySelector('.z-arrow-2');
    
    // Center point for all axes
    const centerX = 50;
    const centerY = 50;
    
    // Axis length
    const axisLength = 35;
    
    // Update function to adjust axes based on camera orientation
    const updateAxes = () => {
      if (!scene.activeCamera) return;
      
      // For top view, we need a special transformation
      // Assuming Y is up in world space, but for top view:
      // - X axis stays as X in screen space
      // - Z axis becomes Y in screen space (pointing down)
      // - Y axis becomes Z in screen space (pointing out of screen)
      
      // Transform world axes to screen space based on camera rotation
      const rightVector = new BABYLON.Vector3(1, 0, 0)
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      const upVector = new BABYLON.Vector3(0, 0, 1)  // This is Z in world, but up on screen
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      const forwardVector = new BABYLON.Vector3(0, -1, 0)  // This is -Y in world, but forward on screen
        .applyRotationQuaternion(scene.activeCamera.absoluteRotation);
      
      // Calculate endpoints for all axes
      const xEndX = centerX + rightVector.x * axisLength;
      const xEndY = centerY - rightVector.y * axisLength;
      
      const yEndX = centerX + upVector.x * axisLength;
      const yEndY = centerY - upVector.y * axisLength;
      
      const zEndX = centerX + forwardVector.x * axisLength * 0.7;
      const zEndY = centerY - forwardVector.y * axisLength * 0.7;
      
      // Update X axis (red, horizontal)
      xAxis.setAttribute('x1', centerX);
      xAxis.setAttribute('y1', centerY);
      xAxis.setAttribute('x2', xEndX);
      xAxis.setAttribute('y2', xEndY);
      
      // Update X arrows
      const xArrowSize = 5;
      
      // Calculate perpendicular direction for arrow heads
      const xDirX = xEndX - centerX;
      const xDirY = xEndY - centerY;
      const xDirLength = Math.sqrt(xDirX * xDirX + xDirY * xDirY);
      const xNormX = xDirX / xDirLength;
      const xNormY = xDirY / xDirLength;
      const xPerpX = -xNormY;
      const xPerpY = xNormX;
      
      xArrow1.setAttribute('x1', xEndX);
      xArrow1.setAttribute('y1', xEndY);
      xArrow1.setAttribute('x2', xEndX - xNormX * xArrowSize + xPerpX * xArrowSize);
      xArrow1.setAttribute('y2', xEndY - xNormY * xArrowSize + xPerpY * xArrowSize);
      
      xArrow2.setAttribute('x1', xEndX);
      xArrow2.setAttribute('y1', xEndY);
      xArrow2.setAttribute('x2', xEndX - xNormX * xArrowSize - xPerpX * xArrowSize);
      xArrow2.setAttribute('y2', xEndY - xNormY * xArrowSize - xPerpY * xArrowSize);
      
      // Update Y axis (green, vertical)
      yAxis.setAttribute('x1', centerX);
      yAxis.setAttribute('y1', centerY);
      yAxis.setAttribute('x2', yEndX);
      yAxis.setAttribute('y2', yEndY);
      
      // Update Y arrows
      const yArrowSize = 5;
      
      const yDirX = yEndX - centerX;
      const yDirY = yEndY - centerY;
      const yDirLength = Math.sqrt(yDirX * yDirX + yDirY * yDirY);
      const yNormX = yDirX / yDirLength;
      const yNormY = yDirY / yDirLength;
      const yPerpX = -yNormY;
      const yPerpY = yNormX;
      
      yArrow1.setAttribute('x1', yEndX);
      yArrow1.setAttribute('y1', yEndY);
      yArrow1.setAttribute('x2', yEndX - yNormX * yArrowSize + yPerpX * yArrowSize);
      yArrow1.setAttribute('y2', yEndY - yNormY * yArrowSize + yPerpY * yArrowSize);
      
      yArrow2.setAttribute('x1', yEndX);
      yArrow2.setAttribute('y1', yEndY);
      yArrow2.setAttribute('x2', yEndX - yNormX * yArrowSize - yPerpX * yArrowSize);
      yArrow2.setAttribute('y2', yEndY - yNormY * yArrowSize - yPerpY * yArrowSize);
      
      // Update Z axis (blue, at an angle)
      zAxis.setAttribute('x1', centerX);
      zAxis.setAttribute('y1', centerY);
      zAxis.setAttribute('x2', zEndX);
      zAxis.setAttribute('y2', zEndY);
      
      // Update Z arrows
      const zArrowSize = 5;
      
      const zDirX = zEndX - centerX;
      const zDirY = zEndY - centerY;
      const zDirLength = Math.sqrt(zDirX * zDirX + zDirY * zDirY);
      const zNormX = zDirX / zDirLength;
      const zNormY = zDirY / zDirLength;
      const zPerpX = -zNormY;
      const zPerpY = zNormX;
      
      zArrow1.setAttribute('x1', zEndX);
      zArrow1.setAttribute('y1', zEndY);
      zArrow1.setAttribute('x2', zEndX - zNormX * zArrowSize + zPerpX * zArrowSize);
      zArrow1.setAttribute('y2', zEndY - zNormY * zArrowSize + zPerpY * zArrowSize);
      
      zArrow2.setAttribute('x1', zEndX);
      zArrow2.setAttribute('y1', zEndY);
      zArrow2.setAttribute('x2', zEndX - zNormX * zArrowSize - zPerpX * zArrowSize);
      zArrow2.setAttribute('y2', zEndY - zNormY * zArrowSize - zPerpY * zArrowSize);
    };
    
    // Add observer to update axes on camera movement
    const observer = scene.onBeforeRenderObservable.add(updateAxes);
    
    // Initial update
    updateAxes();
    
    // Cleanup
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [scene]);
  
  return (
    <div ref={containerRef} className="cad-top-view-axis">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* X axis (red) */}
        <line className="x-axis" x1="50" y1="50" x2="85" y2="50" stroke="red" strokeWidth="2" />
        <line className="x-arrow-1" x1="85" y1="50" x2="80" y2="45" stroke="red" strokeWidth="2" />
        <line className="x-arrow-2" x1="85" y1="50" x2="80" y2="55" stroke="red" strokeWidth="2" />
        <text x="90" y="50" fill="red" fontSize="12" dominantBaseline="middle">X</text>
        
        {/* Y axis (green) - in top view, corresponds to Z world axis */}
        <line className="y-axis" x1="50" y1="50" x2="50" y2="15" stroke="green" strokeWidth="2" />
        <line className="y-arrow-1" x1="50" y1="15" x2="45" y2="20" stroke="green" strokeWidth="2" />
        <line className="y-arrow-2" x1="50" y1="15" x2="55" y2="20" stroke="green" strokeWidth="2" />
        <text x="50" y="10" fill="green" fontSize="12" textAnchor="middle">Z</text>
        
        {/* Z axis (blue) - in top view, corresponds to -Y world axis */}
        <line className="z-axis" x1="50" y1="50" x2="25" y2="75" stroke="blue" strokeWidth="2" />
        <line className="z-arrow-1" x1="25" y1="75" x2="30" y2="70" stroke="blue" strokeWidth="2" />
        <line className="z-arrow-2" x1="25" y1="75" x2="30" y2="80" stroke="blue" strokeWidth="2" />
        <text x="20" y="80" fill="blue" fontSize="12" dominantBaseline="middle">Y</text>
      </svg>
    </div>
  );
};