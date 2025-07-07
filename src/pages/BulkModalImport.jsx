// <---Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne.
// @author Jaleela Basheer --->//
import React, { useState, useEffect, useRef } from "react";
import Alert from "../components/Alert";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import * as GUI from "@babylonjs/gui";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { simplifyMeshData } from "../Utils/Simplifier";
import CADTopViewAxisIndicator from "../components/AxisIndicatorBulk";
import {
  calculateElevationAngle,
  calculatePlanAngle,
} from "../Utils/GeometryCalculation";
import { setupLighting } from "../Utils/SetUpLight";
import { GLTF2Export } from "@babylonjs/serializers";
import FileUploadProgress from "../components/FileUploadProgress";
import { FreeCameraMouseInput } from "../Utils/FlyControls";
import {
  saveChangedUnassigned,
  saveUnassignedData,
  uploadFiles,
} from "../services/BulkImportApi";

import { url } from "../services/Url";



function BulkModelImport({ setLoading }) {
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState([]);
  const [fileNamePath, setFileNamePath] = useState([]);
  const [removeAnimation, setRemoveAnimation] = useState(false);
  const [removeMaterials, setRemoveMaterials] = useState(false);
  const [keepColor, setKeepColor] = useState(false);
  const [simplificationFactor, setSimplificationFactor] = useState(0);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [loadedModelCount, setLoadedModelCount] = useState(0);
  const [speedControlVisible, setSpeedControlVisible] = useState(false);
  const [cameraSpeed, setCameraSpeed] = useState(1.0);
  const [multiplier, setMultiplier] = useState(1);
  const [showMeasure, setShowMeasure] = useState(false);
  const [showMeasureDetails, setShowMeasureDetails] = useState(false);
  const [showMeasureDetailsAbove, setshowMeasureDetailsAbove] = useState(false);
  const [conversionsInProgress, setConversionsInProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [totalConversions, setTotalConversions] = useState(0);
  const [previewButton, setPreviewButton] = useState(false);
  const loadedModelsRef = useRef([]);
    const [isConverting, setIsConverting] = useState(false);
  const [visibleFiles, setVisibleFiles] = useState({});

  const modelInfoRef = useRef({
    boundingBoxMin: null,
    boundingBoxMax: null,
    boundingBoxCenter: null,
    modelRadius: 10,
  });
  // State for transformations (applied to all files or selected file)
  const [transformations, setTransformations] = useState({
    translateX: 0,
    translateY: 0,
    translateZ: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  });
  const [point1, setPoint1] = useState(null);
  const [point2, setPoint2] = useState(null);
  const [distance, setDistance] = useState(null);
  const [differences, setDifferences] = useState({
    diffX: null,
    diffY: null,
    diffZ: null,
  });
  const [angles, setAngles] = useState({
    horizontalAngle: null,
    verticalAngle: null,
  });

  const measurementRef = useRef({
    pointA: null,
    pointB: null,
    line: null,
    text: null,
    markers: [],
  });
  // State for apply to all files checkbox
  const [applyToAll, setApplyToAll] = useState(true);
  const originalMeshDataRef = useRef({});

  // References
  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const engineRef = useRef(null);
  const previewSceneRef = useRef(null);
  const previewCameraRef = useRef(null);
  const dropZoneRef = useRef(null);

  let Receivedfilename = null;
  let ReceivedfilePath = null;
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize preview canvas
  useEffect(() => {
    if (previewCanvasRef.current) {
      // Create engine for preview
      engineRef.current = new BABYLON.Engine(previewCanvasRef.current, true);

      // Create scene for preview
      const previewScene = new BABYLON.Scene(engineRef.current);
      previewScene.useRightHandedSystem = true;
      previewScene.clearColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1);
      previewSceneRef.current = previewScene;

      // Create camera for preview
      const camera = new BABYLON.ArcRotateCamera(
        "previewCamera",
        Math.PI / 2,
        0,
        10,
        BABYLON.Vector3.Zero(),
        previewScene
      );
      camera.alpha = Math.PI / 2;
      camera.beta = 0;

      camera.attachControl(previewCanvasRef.current, true);
      previewCameraRef.current = camera;

      setupLighting(previewScene, camera);

      // Run render loop
      engineRef.current.runRenderLoop(() => {
        previewScene.render();
      });

      // Handle resize
      window.addEventListener("resize", () => {
        engineRef.current.resize();
      });

      // Cleanup
      return () => {
        window.removeEventListener("resize", () => engineRef.current.resize());
        engineRef.current.dispose();
      };
    }
  }, []);

  // useEffect for measurement functionality
  useEffect(() => {
    let observer = null;

    if (showMeasure) {
      if (!previewSceneRef.current) return;
      const scene = previewSceneRef.current;

      // Store observer reference for measurement
      observer = scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.event.button !== 0) {
          return;
        }
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
          // Only process left mouse button clicks (button 0)
          if (pointerInfo.event.button !== 0) {
            return;
          }

          if (pointerInfo.pickInfo.hit) {
            const mesh = pointerInfo.pickInfo.pickedMesh;

            // Skip environment meshes
            if (
              mesh.name.includes("skyBox") ||
              mesh.name.includes("ground") ||
              mesh.name.includes("water")
            ) {
              clearMeasurement();
              setshowMeasureDetailsAbove(false);
              return;
            }

            // Handle the measurement
            handleMeasurementPick(pointerInfo.pickInfo);

            // Find the topmost pickable parent mesh with metadata
            let targetMesh = mesh;
            while (
              targetMesh &&
              (!targetMesh.metadata ||
                Object.keys(targetMesh.metadata).length === 0)
            ) {
              targetMesh = targetMesh.parent;
            }
          } else {
            // clearMeasurement();
            // setshowMeasureDetailsAbove(false);
          }
        }
      });
    } else {
      // Cleanup when showMeasure becomes false
      clearMeasurement();
      setshowMeasureDetailsAbove(false);
    }

    // Cleanup function to remove event listener
    return () => {
      if (previewSceneRef.current && observer) {
        previewSceneRef.current.onPointerObservable.remove(observer);
      }
    };
  }, [showMeasure]);

  const handleMeasurementPick = (pickInfo) => {
    if (!showMeasure || !pickInfo.hit || !pickInfo.pickedMesh) return;

    // Skip measurement markers themselves
    const mesh = pickInfo.pickedMesh;
    if (
      mesh.name.startsWith("measureMarker") ||
      mesh.name.startsWith("pointLabel") ||
      mesh.name.startsWith("measureTextPlane") ||
      mesh.name.startsWith("xLine") ||
      mesh.name.startsWith("yLine") ||
      mesh.name.startsWith("zLine") ||
      mesh.name.startsWith("measureLine") ||
      mesh.name === "box" ||
      mesh.name.includes("Line")
    ) {
      return;
    }

    // Get the exact position in world space
    const pickedPoint = pickInfo.pickedPoint;

    // If this is the first point
    if (!measurementRef.current.pointA) {
      // Clear any previous measurement first
      clearMeasurement();

      // Set first point
      measurementRef.current.pointA = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Update UI state
      setPoint1({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });
    }
    // If this is the second point
    else if (!measurementRef.current.pointB) {
      measurementRef.current.pointB = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Create line between points
      updateMeasurementLine();

      // Update UI state with calculated values
      setPoint2({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });

      // Calculate differences
      const p1 = measurementRef.current.pointA;
      const p2 = measurementRef.current.pointB;

      const diffX = Math.abs(p2.x - p1.x).toFixed(2);
      const diffY = Math.abs(p2.y - p1.y).toFixed(2);
      const diffZ = Math.abs(p2.z - p1.z).toFixed(2);

      setDifferences({
        diffX: diffX,
        diffY: diffY,
        diffZ: diffZ,
      });

      // Calculate distance
      const distance = BABYLON.Vector3.Distance(p1, p2).toFixed(2);
      setDistance(distance);

      // Calculate angles similar to the provided code
      const horizontalAngle = calculatePlanAngle(p1, p2).toFixed(2);
      const verticalAngle = calculateElevationAngle(p1, p2).toFixed(2);

      setAngles({
        horizontalAngle: horizontalAngle + "°",
        verticalAngle: verticalAngle + "°",
      });
      setshowMeasureDetailsAbove(true);
    }
    // If we already have two points, start a new measurement
    else {
      clearMeasurement();
      setshowMeasureDetailsAbove(false);

      // Set new first point
      measurementRef.current.pointA = pickedPoint.clone();
      createPointMarker(pickedPoint.clone());

      // Update UI state
      setPoint1({
        x: pickedPoint.x.toFixed(2),
        y: pickedPoint.y.toFixed(2),
        z: pickedPoint.z.toFixed(2),
      });
    }
  };

  // Create a point marker for measurement
  const createPointMarker = (position) => {
    const scene = previewSceneRef.current;
    if (!scene) return null;

    // Create a container for all marker elements
    const markerContainer = new BABYLON.TransformNode(
      "measureMarkerContainer",
      scene
    );
    markerContainer.position = position.clone();

    // Create invisible box as attachment point
    const box = BABYLON.MeshBuilder.CreateBox(
      "measureMarkerBox",
      { size: 0.1 },
      scene
    );
    box.isVisible = false;
    box.isPickable = false;
    box.parent = markerContainer;
    box.position = BABYLON.Vector3.Zero(); // Local position is zero relative to container

    // Create GUI for the marker (X-shaped cross)
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "MarkerUI",
      true,
      scene
    );

    // Create rectangle container
    const container = new GUI.Rectangle();
    container.width = "9px";
    container.height = "9px";
    container.color = "transparent";
    container.background = "transparent";
    advancedTexture.addControl(container);
    container.linkWithMesh(box);

    // Create diagonal line 1 (top-left to bottom-right)
    const line1 = new GUI.Line();
    line1.x1 = 0;
    line1.y1 = 0;
    line1.x2 = 8;
    line1.y2 = 8;
    line1.lineWidth = 2;
    line1.color = "#FFA500"; // Orange color
    container.addControl(line1);

    // Create diagonal line 2 (top-right to bottom-left)
    const line2 = new GUI.Line();
    line2.x1 = 8;
    line2.y1 = 0;
    line2.x2 = 0;
    line2.y2 = 8;
    line2.lineWidth = 2;
    line2.color = "#FFA500"; // Orange color
    container.addControl(line2);

    // Store elements for later cleanup
    const elem = {
      box: box,
      container: container,
      markerContainer: markerContainer,
      gui: advancedTexture,
    };

    // Add to marker array for tracking
    measurementRef.current.markers.push(elem);

    return markerContainer;
  };

  // Update measurement line
  const updateMeasurementLine = () => {
    const scene = previewSceneRef.current;
    if (!scene) return;

    const { pointA, pointB, line, text } = measurementRef.current;

    if (pointA && pointB) {
      // If a line already exists, dispose it
      if (line) {
        line.dispose();
      }

      // If a text mesh exists, dispose it
      if (text) {
        text.dispose();
      }

      // Create a new line
      const points = [pointA.clone(), pointB.clone()];

      const newLine = BABYLON.MeshBuilder.CreateLines(
        "measureLine",
        { points: points },
        scene
      );
      newLine.color = new BABYLON.Color3(1, 0.647, 0);
      measurementRef.current.line = newLine;

      // Calculate distance
      const distance = BABYLON.Vector3.Distance(pointA, pointB);

      // Create a midpoint for the text label
      const midPoint = BABYLON.Vector3.Center(pointA, pointB);

      // Create a dynamic texture for the distance text
      const textureWidth = 256;
      const textureHeight = 64;
      const dynamicTexture = new BABYLON.DynamicTexture(
        "measureTextTexture",
        { width: textureWidth, height: textureHeight },
        scene,
        false
      );
      dynamicTexture.hasAlpha = true;
    }
  };

  // Clear measurement function
  const clearMeasurement = () => {
    // Reset state variables
    setPoint1(null);
    setPoint2(null);
    setDistance(null);
    setDifferences({
      diffX: null,
      diffY: null,
      diffZ: null,
    });
    setAngles({
      horizontalAngle: null,
      verticalAngle: null,
    });

    // Remove line if it exists
    if (measurementRef.current.line) {
      measurementRef.current.line.dispose();
      measurementRef.current.line = null;
    }

    // Remove text if it exists
    if (measurementRef.current.text) {
      measurementRef.current.text.dispose();
      measurementRef.current.text = null;
    }

    // Remove all markers and their children
    measurementRef.current.markers.forEach((marker) => {
      if (marker) {
        // Clean up GUI elements first
        if (marker.container) {
          marker.container.dispose();
        }
        if (marker.gui) {
          marker.gui.dispose();
        }
        // Then dispose the mesh objects
        if (marker.box) {
          marker.box.dispose();
        }
        if (marker.markerContainer) {
          marker.markerContainer.dispose();
        }
      }
    });

    // Reset measurement state
    measurementRef.current = {
      pointA: null,
      pointB: null,
      line: null,
      text: null,
      markers: [],
    };
  };

  // Set up event listeners once when the component mounts
  useEffect(() => {
    const conversionHandlers = {
      "fbx-conversion-success": handleConversionSuccess,
      "rvm-conversion-success": handleConversionSuccess,
      "iges-conversion-success": handleConversionSuccess,
      "dae-conversion-success": handleConversionSuccess,
      "glb-conversion-success": handleConversionSuccess,
    };

    // // Set up all listeners
    // Object.entries(conversionHandlers).forEach(([channel, handler]) => {
    //   window.api.receive(channel, handler);
    // });

    // Clean up listeners when component unmounts
    return () => {
      Object.keys(conversionHandlers).forEach((channel) => {});
    };
  }, []);

  const handleConversionSuccess = (data) => {
    const { originalFilePath, convertedFileName, convertedFilePath } = data;
    console.log(data);

    setFileNamePath((prevFileNamePath) => {
      console.log(prevFileNamePath);
      return prevFileNamePath.map((file) =>
        file.path === originalFilePath
          ? { name: convertedFileName, path: convertedFilePath }
          : file
      );
    });
    setConvertedFiles((prev) => {
      // Check if this file is already in the list
      const fileExists = prev.some(
        (file) => file.convertedName === convertedFileName
      );
      if (fileExists) {
        return prev; // Don't add duplicate
      }
      setProgress(100);
      setConversionsInProgress((prev) => {
        const newInProgress = prev - 1;
        const newProgress =
          ((totalConversions - newInProgress) / totalConversions) * 100;
        setConversionProgress(newProgress);
        return newInProgress;
      });

      return [
        ...prev,
        {
          convertedFileName,
          convertedFileName,
          path: convertedFilePath || "",
        },
      ];
    });

    setConversionsInProgress((prev) => prev - 1);
  };

  // const exportSceneAsGLB = () => {
  //   if (!previewSceneRef.current) return;

  //   const scene = previewSceneRef.current;

  //   // Only export meshes that are visible and valid
  //   const exportMeshes = scene.meshes.filter(mesh => mesh.isVisible && mesh.geometry);

  //   if (exportMeshes.length === 0) {
  //     console.warn("No valid meshes to export.");
  //     return;
  //   }

  //   // Export the scene or specific meshes to GLB
  //   GLTF2Export.GLBAsync(scene, "exported_model").then((glb) => {
  //     glb.downloadFiles(); // Triggers the browser download of .glb
  //   }).catch(err => {
  //     console.error("Error exporting GLB:", err);
  //   });
  // };

  // Add this function to handle downloading the modified files
  const handleDownload = () => {
    if (!previewSceneRef.current || fileNamePath.length === 0) {
      setCustomAlert(true);
      setModalMessage("No files to download");
      return;
    }

    setLoading(true);

    // Get all meshes from the scene
    const previewScene = previewSceneRef.current;
    const meshes = previewScene.meshes;
    const rootMeshes = previewScene.getTransformNodesByTags("__root__") || [];

    // Group meshes by their original filename (using the metadata we stored)
    const fileGroups = {};

    // First, identify top-level meshes or use __root__ nodes if available
    // Each file typically has its own root node or a set of top-level meshes
    if (rootMeshes.length > 0) {
      // Group by root nodes
      rootMeshes.forEach((rootNode) => {
        const filename =
          rootNode.metadata?.filename ||
          originalMeshDataRef.current[rootNode.name]?.filename;

        if (filename) {
          if (!fileGroups[filename]) {
            fileGroups[filename] = {
              rootNode: rootNode,
              meshes: [],
            };
          }

          // Find all child meshes of this root
          meshes.forEach((mesh) => {
            if (mesh._parentNode === rootNode || isChildOf(mesh, rootNode)) {
              fileGroups[filename].meshes.push(mesh);
            }
          });
        }
      });
    } else {
      // Group by stored filename in our original mesh data
      meshes.forEach((mesh) => {
        if (mesh.geometry) {
          const filename = originalMeshDataRef.current[mesh.name]?.filename;

          if (filename) {
            if (!fileGroups[filename]) {
              fileGroups[filename] = {
                rootNode: null,
                meshes: [],
              };
            }
            fileGroups[filename].meshes.push(mesh);
          }
        }
      });
    }

    // Helper function to check if a mesh is a child of a node
    function isChildOf(mesh, possibleParent) {
      let parent = mesh.parent;
      while (parent) {
        if (parent === possibleParent) return true;
        parent = parent.parent;
      }
      return false;
    }

    // Export each group as a separate GLB file
    const downloadPromises = Object.keys(fileGroups).map((filename) => {
      return new Promise((resolve, reject) => {
        try {
          const groupMeshes = fileGroups[filename].meshes;

          if (groupMeshes.length === 0) {
            console.warn(`No meshes found for file ${filename}`);
            resolve();
            return;
          }

          // Create download name - add "_modified" suffix
          const nameParts = filename.split(".");
          const extension = nameParts.pop().toLowerCase();
          const baseName = nameParts.join(".");
          const downloadName = `${baseName}_modified.glb`;

          // Export to GLB
          GLTF2Export.GLBAsync(previewScene, downloadName, {
            shouldExportNode: (node) => {
              // Only export meshes that belong to this file group
              return (
                groupMeshes.includes(node) ||
                (node.getChildren &&
                  node
                    .getChildren()
                    .some((child) => groupMeshes.includes(child)))
              );
            },
          })
            .then((glb) => {
              // Create download link
              const blob = new Blob([glb.glTFData], {
                type: "application/octet-stream",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = downloadName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              resolve();
            })
            .catch((error) => {
              console.error(`Error exporting ${filename}:`, error);
              reject(error);
            });
        } catch (error) {
          console.error(`Error processing ${filename}:`, error);
          reject(error);
        }
      });
    });

    // Handle all downloads
    Promise.all(downloadPromises)
      .then(() => {
        setLoading(false);
        setCustomAlert(true);
        setModalMessage("All files downloaded successfully");
      })
      .catch((error) => {
        setLoading(false);
        setCustomAlert(true);
        setModalMessage(`Error downloading files: ${error.message}`);
      });
  };

  useEffect(() => {
    console.log(convertedFiles);
  }, [convertedFiles]);

  const handleFileChange = (e) => {
    e.preventDefault();
    const selectedFiles = Array.from(e.target.files);
    console.log("selectedFiles", selectedFiles);
    processFiles(selectedFiles);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const selectedFiles = [];

    const items = e.dataTransfer.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item.isDirectory) {
        readDirectory(item, selectedFiles, () => {
          processFiles(selectedFiles);
        });
      } else {
        const file = items[i].getAsFile();
        selectedFiles.push(file);
      }
    }

    // Process directly dropped files
    if (selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
  };

  const readDirectory = (directory, fileArray, callback) => {
    const reader = directory.createReader();
    reader.readEntries((entries) => {
      let entryIndex = 0;

      const readNextEntry = () => {
        if (entryIndex < entries.length) {
          const entry = entries[entryIndex++];
          if (entry.isFile) {
            entry.file((file) => {
              fileArray.push(file);
              readNextEntry();
            });
          } else if (entry.isDirectory) {
            readDirectory(entry, fileArray, readNextEntry);
          } else {
            readNextEntry();
          }
        } else {
          callback();
        }
      };

      readNextEntry();
    });
  };

  const processFiles = (selectedFiles) => {
    console.log(selectedFiles);
    const updatedFiles = [...files, ...selectedFiles];
    setFiles(updatedFiles);

    const filesWithPath = updatedFiles.map((file) => {
      return { name: file.name, path: file.path };
    });
    console.log("filesWithPath", filesWithPath);
    setFileNamePath(filesWithPath);
    // loadFiles(selectedFiles);
  };

const loadFiles = async (selectedFiles) => {
  console.log("Loading files:", selectedFiles);
  if (!selectedFiles || selectedFiles.length === 0) return;
   const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;
  setProgress(0);
  setIsConverting(true);
  setConversionsInProgress(selectedFiles.length);
  setTotalConversions(selectedFiles.length);
  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append("files", file);
  });
  formData.append("projectId", projectId);

  try {
    let responseReceived = false;

    const response = await uploadFiles(
      formData,
      {
        "Content-Type": "multipart/form-data",
      },
      (event) => {
        const percent = Math.round((event.loaded * 100) / event.total);
        setProgress(percent);

        if (percent === 100 && !responseReceived) {
          setIsConverting(true);
        }
      }
    );

    responseReceived = true;
    setIsConverting(false);

    if (response.status === 200 && response.data.convertedFiles) {
      const files = response.data.convertedFiles;


      // Create array of URLs where the files are saved
      const savedFileUrls = files.map((file) => ({
        name: file.name,
        path: `${url}/models/${projectId}/${file.name}`, 
      }));

      console.log("Saved file URLs:", savedFileUrls);

      setFileNamePath(savedFileUrls);
      setConvertedFiles(savedFileUrls);
      setCustomAlert(true);
      setModalMessage("Files loaded and processed successfully");
    }
  } catch (error) {
    setIsConverting(false);
    console.error("Error loading files:", error);
    setCustomAlert(true);
    setModalMessage(`Failed to load files: ${error.message}`);
  } finally {
    setConversionsInProgress(0);
  }
};

  const handleRemoveFbxFile = (index) => {
    const removedFile = files[index];
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
  };

  const handleRemoveFile = (index) => {
    const removedFile = fileNamePath[index];
    const updatedFiles = [...fileNamePath];
    updatedFiles.splice(index, 1);
    setFileNamePath(updatedFiles);

    removeModelFromScene(removedFile.name); // Clean up from scene
  };

  const removeModelFromScene = (fileNameToRemove) => {
    if (!previewSceneRef.current) return;

    const previewScene = previewSceneRef.current;

    // Find the root node for the file to remove
    const rootNode = previewScene.getNodeByName((nodeName) =>
      nodeName.startsWith(`root_${fileNameToRemove}`)
    );

    if (rootNode) {
      console.log(`Removing model: ${fileNameToRemove}`);

      // Dispose of all children meshes and the root node
      rootNode.getChildMeshes().forEach((mesh) => {
        mesh.dispose();
      });
      rootNode.dispose();

      // Remove reference from loadedModelsRef
      loadedModelsRef.current = loadedModelsRef.current.filter(
        (modelMeshes) => {
          return !modelMeshes.some((mesh) =>
            mesh.name.includes(fileNameToRemove)
          );
        }
      );

      // Optionally: update loaded model count
      setLoadedModelCount(loadedModelsRef.current?.length || 0);
    } else {
      console.warn(
        `Model with file name ${fileNameToRemove} not found in scene.`
      );
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setFileNamePath([]);
    setConvertedFiles([]);
    setProgress(0);
    setShowPreview(false);
    setApplyToAll(false);
    setRemoveMaterials(false);
    setKeepColor(false);
    setRemoveAnimation(false);
    setMode("");
    setShowMeasure(false);
    setTransformations({
      translateX: 0,
      translateY: 0,
      translateZ: 0,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    });
    setIsLoading(false);
    setLoadingProgress(0);

    // Clear the scene
    if (previewSceneRef.current) {
      previewSceneRef.current.meshes.slice().forEach((mesh) => {
        mesh.dispose();
      });
    }
  };

  const resetTransformations = () => {
    if (!previewSceneRef.current) return;

    const meshes = previewSceneRef.current.meshes.filter(
      (mesh) =>
        mesh.name &&
        !mesh.name.includes("__root__") &&
        !mesh.name.includes("sky")
    );

    meshes.forEach((mesh) => {
      if (!applyToAll) return;

      mesh.position = new BABYLON.Vector3(0, 0, 0);
      mesh.rotation = new BABYLON.Vector3(0, 0, 0);
      mesh.scaling = new BABYLON.Vector3(1, 1, 1);

      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
    });

    // Optionally, reset the transformations state in your UI
    setTransformations({
      translateX: 0,
      translateY: 0,
      translateZ: 0,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    });

    updateCumulativeBoundingBox1(meshes);
    console.log("Transformations reset");
  };

  let Min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
  let Max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
  // Update the cumulative bounding box and check if all files are loaded
  function updateCumulativeBoundingBox1(meshes) {
    const previewScene = previewSceneRef.current;
    // Filter to only include meshes with geometry
    const geometryMeshes = meshes.filter((mesh) => mesh.geometry);

    if (geometryMeshes.length > 0) {
      // Calculate bounding box for this model
      let modelMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
      let modelMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

      geometryMeshes.forEach((mesh) => {
        if (!mesh.getBoundingInfo) return;

        const boundingInfo = mesh.getBoundingInfo();
        const meshMin = boundingInfo.boundingBox.minimumWorld;
        const meshMax = boundingInfo.boundingBox.maximumWorld;

        modelMin = BABYLON.Vector3.Minimize(modelMin, meshMin);
        modelMax = BABYLON.Vector3.Maximize(modelMax, meshMax);
      });

      console.log(`Model  bounds:`, {
        min: modelMin,
        max: modelMax,
      });

      // Update the global bounding box
      Min = BABYLON.Vector3.Minimize(Min, modelMin);
      Max = BABYLON.Vector3.Maximize(Max, modelMax);

      console.log(`Updated cumulative bounding box:`, {
        min: Min,
        max: Max,
      });

      // Check if we have valid bounds
      if (Min.x !== Infinity && Max.x !== -Infinity) {
        const center = BABYLON.Vector3.Center(Min, Max);
        const size = Max.subtract(Min);
        const maxDimension = Math.max(size.x, size.y, size.z);

        // Add a margin to ensure all models are visible
        const margin = 1.5;
        const effectiveSize = maxDimension * margin;

        console.log("Setting camera to show all models:", {
          center,
          size: effectiveSize,
        });

        // Calculate distance needed to fit bounding box into view
        const fovRadians = previewScene.activeCamera.fov || Math.PI / 4;
        const distanceToFit = effectiveSize / (2 * Math.tan(fovRadians / 2));

        // Position the camera to show the cumulative bounding box with top view
        previewCameraRef.current.setTarget(center);
        previewCameraRef.current.radius = distanceToFit;

        // Set top view - looking down the Y axis
        previewCameraRef.current.alpha = Math.PI / 2;
        previewCameraRef.current.beta = 0;

        // Log the final camera position
        console.log("Camera positioned:", {
          target: previewCameraRef.current.target,
          radius: previewCameraRef.current.radius,
          alpha: previewCameraRef.current.alpha,
          beta: previewCameraRef.current.beta,
        });
      } else {
        console.warn(
          "Could not calculate valid bounding box for camera positioning"
        );

        // Position camera at default location with wider view to see all models
        previewCameraRef.current.setTarget(BABYLON.Vector3.Zero());
        previewCameraRef.current.radius = 50; // Increased default distance
        previewCameraRef.current.alpha = Math.PI / 2;
        previewCameraRef.current.beta = 0;
      }
    } else {
      console.warn(`No geometry meshes found in model `);
    }
  }

  // Toggle show all files
  const handleShowAll = () => {
    setShowAllFiles(!showAllFiles);
  };

  // Preview a specific file
  const handlePreviewFile = (file) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handleReset = () => {
    setRemoveAnimation(false);
    setRemoveMaterials(false);
    setKeepColor(false);
    setSimplificationFactor(0);
    console.log(originalMeshDataRef.current);

    const previewScene = previewSceneRef.current;
    if (!previewScene) return;

    previewScene.meshes.forEach((mesh) => {
      const original = originalMeshDataRef.current[mesh.name];
      if (!original || !mesh.geometry) return;

      // Restore geometry
      const vertexData = new BABYLON.VertexData();
      vertexData.positions = [...original.positions];
      vertexData.indices = [...original.indices];
      if (original.normals) vertexData.normals = [...original.normals];

      vertexData.applyToMesh(mesh);

      // Restore material
      mesh.material = original.material;

      // Restore animations
      mesh.animations = [...original.animations];

      // Refresh mesh
      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
    });

    // Optionally re-render the scene
    previewScene.render();
  };

  const handleTransformationChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;

    setTransformations((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

 const handleSave = async () => {
  if (fileNamePath.length === 0) {
    setCustomAlert(true);
    setModalMessage("Please convert files first");
    return;
  }

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  try {
    const hasModifications = checkIfModelModified(modelModificationsRef.current);

    if (!hasModifications) {
      // Save unmodified files
      const files = fileNamePath.map((file) => ({
        projectId: projectId,
        name: file.name,
        path: file.path,
      }));

      const response = await saveUnassignedData(files);
      if (response.status === 200) {
        handleClearAll();
        setCustomAlert(true);
        setModalMessage("The files saved successfully");
      }
    } else {
      // Export and save modified files
      await handleExportChanges();  // 🔁 Reuse existing export logic
    }
  } catch (error) {
    console.error("Error saving files:", error);
    setCustomAlert(true);
    setModalMessage(`Error saving files: ${error.message}`);
  }
};

  const handleCancel = () => {
    // Reset all states
    setFiles([]);
    setFileNamePath([]);
    setConvertedFiles([]);
    setProgress(0);
    setRemoveAnimation(false);
    setRemoveMaterials(false);
    setKeepColor(false);
    setSimplificationFactor(0);
    setShowPreview(false);
    setSelectedFile(null);
    setProgress(0);
  };

  const loadAllModelsInScene = () => {
    if (!previewSceneRef.current) return;

    const previewScene = previewSceneRef.current;

    // Clear existing meshes except for lights, cameras, and ground
    previewScene.meshes.slice().forEach((mesh) => {
      if (
        !(mesh instanceof BABYLON.GroundMesh) &&
        mesh.name !== "ground" &&
        mesh.name !== "skyBox" &&
        mesh.name !== "previewLight" &&
        mesh.name !== "dirLight" &&
        !mesh.name.includes("Camera")
      ) {
        mesh.dispose();
      }
    });

    // Reset loaded model references
    loadedModelsRef.current = [];

    // Only proceed if we have files to load
    if (fileNamePath.length === 0) {
      return;
    }

    // Initialize min and max for cumulative bounding box
    let globalMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let globalMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    // Track how many files have been loaded
    let loadedCount = 0;
    let loadedModels = 0;

    console.log(`Attempting to load ${fileNamePath.length} files`);

    // Load each file in the array - but only load GLB/GLTF files
    const glbFiles = fileNamePath.filter((file) => {
      const ext = file.name.split(".").pop().toLowerCase();
      return ext === "glb" || ext === "gltf";
    });

    console.log(`Found ${glbFiles.length} GLB/GLTF files to load`);

    if (glbFiles.length === 0) {
      console.log("No GLB/GLTF files found to load");
      return;
    }

    // Keep original model positions from files

    glbFiles.forEach((file, index) => {
      const fileName = file.name;
      const filePath = file.path;

      console.log(
        `Loading file ${index + 1}/${
          glbFiles.length
        }: ${fileName} from ${filePath}`
      );
      setIsLoading(true);
      setLoadingProgress(0);

      try {
        BABYLON.SceneLoader.ImportMeshAsync("", "", filePath, previewScene)
          .then((result) => {
            loadedModels++;
            console.log(
              `Successfully loaded model ${fileName} (${loadedModels}/${glbFiles.length})`
            );
            storeOriginalMeshData(result.meshes, fileName);
            updateCumulativeBoundingBox(result.meshes);
          })
          .catch((error) => {
            console.error(`Model loading error for file ${fileName}:`, error);
            handleLoadError(error, file);
            checkAllLoaded();
          });
      } catch (error) {
        console.error(`Error during file ${fileName} loading setup:`, error);
        handleLoadError(error, file);
        checkAllLoaded();
      }
    });

    // Update the cumulative bounding box and check if all files are loaded
    function updateCumulativeBoundingBox(meshes) {
      // Filter to only include meshes with geometry
      const geometryMeshes = meshes.filter((mesh) => mesh.geometry);

      if (geometryMeshes.length > 0) {
        // Calculate bounding box for this model
        let modelMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let modelMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        geometryMeshes.forEach((mesh) => {
          if (!mesh.getBoundingInfo) return;

          const boundingInfo = mesh.getBoundingInfo();
          const meshMin = boundingInfo.boundingBox.minimumWorld;
          const meshMax = boundingInfo.boundingBox.maximumWorld;

          modelMin = BABYLON.Vector3.Minimize(modelMin, meshMin);
          modelMax = BABYLON.Vector3.Maximize(modelMax, meshMax);
        });

        console.log(`Model  bounds:`, {
          min: modelMin,
          max: modelMax,
        });

        // Update the global bounding box
        globalMin = BABYLON.Vector3.Minimize(globalMin, modelMin);
        globalMax = BABYLON.Vector3.Maximize(globalMax, modelMax);

        console.log(`Updated cumulative bounding box:`, {
          min: globalMin,
          max: globalMax,
        });
      } else {
        console.warn(`No geometry meshes found in model `);
      }

      // Check if all files have been loaded
      checkAllLoaded();
    }

    // Check if all files have been loaded and update camera if so
    function checkAllLoaded() {
      loadedCount++;
      // Update loading progress percentage
      const progressPercent = Math.round((loadedCount / glbFiles.length) * 100);
      setLoadingProgress(progressPercent);
      console.log(`Processed ${loadedCount} of ${glbFiles.length} files`);
      // When all files are processed
      if (loadedCount >= glbFiles.length) {
        // Hide the loader after a brief delay
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }

      // Only adjust camera after all files are loaded AND at least one model was successfully loaded
      if (loadedCount >= glbFiles.length && loadedModels > 0) {
        console.log("All files processed, positioning camera");

        // Delay the camera positioning slightly to allow for any final scene updates
        setTimeout(() => {
          positionCameraToShowAllModels();
        }, 1000); // Increased delay for better reliability
      }
    }

    function positionCameraToShowAllModels() {
      // Force update of all world matrices to ensure bounding info is accurate
      previewScene.meshes.forEach((mesh) => {
        if (mesh.geometry) {
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo();
        }
      });

      // Check if we have valid bounds
      if (globalMin.x !== Infinity && globalMax.x !== -Infinity) {
        const center = BABYLON.Vector3.Center(globalMin, globalMax);
        const size = globalMax.subtract(globalMin);
        const maxDimension = Math.max(size.x, size.y, size.z);

        // Add a margin to ensure all models are visible
        const margin = 1.5;
        const effectiveSize = maxDimension * margin;

        console.log("Setting camera to show all models:", {
          center,
          size: effectiveSize,
        });

        // Calculate distance needed to fit bounding box into view
        const fovRadians = previewScene.activeCamera.fov || Math.PI / 4;
        const distanceToFit = effectiveSize / (2 * Math.tan(fovRadians / 2));

        // Position the camera to show the cumulative bounding box with top view
        previewCameraRef.current.setTarget(center);
        previewCameraRef.current.radius = distanceToFit;

        // Set top view - looking down the Y axis
        previewCameraRef.current.alpha = Math.PI / 2;
        previewCameraRef.current.beta = 0;

        // Store model information globally
        modelInfoRef.current = {
          boundingBoxMin: globalMin,
          boundingBoxMax: globalMax,
          boundingBoxCenter: center.clone(),
          modelRadius: distanceToFit,
        };

        // Log the final camera position
        console.log("Camera positioned:", {
          target: previewCameraRef.current.target,
          radius: previewCameraRef.current.radius,
          alpha: previewCameraRef.current.alpha,
          beta: previewCameraRef.current.beta,
        });
      } else {
        console.warn(
          "Could not calculate valid bounding box for camera positioning"
        );

        // Position camera at default location with wider view to see all models
        previewCameraRef.current.setTarget(BABYLON.Vector3.Zero());
        previewCameraRef.current.radius = 50; // Increased default distance
        previewCameraRef.current.alpha = Math.PI / 2;
        previewCameraRef.current.beta = 0;
      }
    }

    // Handler for loading errors
    function handleLoadError(error, file) {
      console.error(`Error loading file ${file.name}:`, error);
      setCustomAlert(true);
      setModalMessage(
        `Failed to load ${file.name}. Error: ${
          error.message || "Unknown error"
        }`
      );
    }
  };

  // Update scene when fileNamePath changes or convertedFiles changes
  useEffect(() => {
    // Add a slight delay to ensure all state updates have processed
    const timer = setTimeout(() => {
      if (previewButton) {
        loadAllModelsInScene();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fileNamePath.length, convertedFiles.length, previewButton]);

  const storeOriginalMeshData = (meshes, filename) => {
    if (!previewSceneRef.current) return;

    meshes.forEach((mesh) => {
      if (!mesh.geometry || originalMeshDataRef.current[mesh.name]) return;

      const positionData =
        mesh.geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind) || [];
      const normalData =
        mesh.geometry.getVerticesData(BABYLON.VertexBuffer.NormalKind) || [];
      const indicesData = mesh.geometry.getIndices() || [];

      originalMeshDataRef.current[mesh.name] = {
        positions: [...positionData],
        indices: [...indicesData],
        normals: normalData.length ? [...normalData] : null,
        material: mesh.material?.clone(mesh.material.name + "_clone") || null,
        animations: mesh.animations ? [...mesh.animations] : [],
        filename: filename, // 🟢 Add the filename here
      };
    });
  };

  const styles = {
    container: {
      padding: "6px",
      maxWidth: "100%",
      margin: 0,
    },
    section: {
      marginBottom: "5px",
    },
    heading: {
      fontSize: "12px",
      fontWeight: "bold",
      marginBottom: "6px",
    },
    inputRow: {
      display: "flex",
      justifyContent: "space-between",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
    label: {
      marginBottom: "4px",
    },
    input: {
      width: "80px",
      height: "40px",
      border: "1px solid #000",
      textAlign: "center",
    },

    checkboxContainer: {
      marginTop: "6px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    checkbox: {
      width: "16px",
      height: "16px",
    },
  };
  const [mode, setMode] = useState("");

  // Switch to orbit camera
  const switchToOrbitCamera = () => {
    if (!previewSceneRef.current) return;

    setSpeedControlVisible(false);
    setMode("");

    const scene = previewSceneRef.current;

    // Store current camera position and target
    const cameraPosition = scene.activeCamera.position.clone();

    // Get current target - for FreeCamera we need to calculate it
    let cameraTarget;
    cameraTarget = scene.activeCamera.getTarget();

    // Calculate distance from camera to target for radius
    const radius = BABYLON.Vector3.Distance(cameraPosition, cameraTarget);

    // Create a temporary camera to maintain our position
    const oldCamera = scene.activeCamera;

    // Create new ArcRotateCamera
    const camera = new BABYLON.ArcRotateCamera(
      "arcCamera",
      0,
      0,
      radius,
      cameraTarget,
      scene
    );
    camera.setPosition(cameraPosition);
    camera.setTarget(cameraTarget);

    // Configure common camera properties
    camera.minZ = 0.1;
    // camera.maxZ = calculateEnvironmentSize() * 10; // Far clip distance based on environment size
    camera.wheelDeltaPercentage = 0.01;
    camera.pinchDeltaPercentage = 0.01;

    // Use default values initially
    camera.wheelPrecision = 50;
    camera.panningSensibility = 100;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;

    camera.useBouncingBehavior = true;
    camera.useAutoRotationBehavior = false;
    camera.pinchToPanMaxDistance = 100;

    // Now dispose of the old camera
    oldCamera.dispose();

    // Attach control to canvas
    camera.attachControl(previewCanvasRef.current, true);
    scene.activeCamera = camera;

    // IMPORTANT: Remove crosshair cursor from canvas
    if (previewCanvasRef.current) {
      previewCanvasRef.current.classList.remove("cursor-crosshair");
      previewCanvasRef.current.classList.add("cursor-default");
    }
  };

  // // Switch to fly camera
  const switchToFlyCamera = () => {
    if (!previewSceneRef.current) return;

    setSpeedControlVisible(true);
    setMode("fly");
    const scene = previewSceneRef.current;

    // Store current camera position and target
    const cameraPosition = scene.activeCamera.position.clone();
    let cameraTarget;
    cameraTarget = scene.activeCamera.getTarget();

    // Remove old camera
    scene.activeCamera.dispose();

    // Create new Free camera
    const camera = new BABYLON.UniversalCamera("flyCaUniversalCameramera", cameraPosition, scene);

    // Ensure we're looking at the right target
    camera.setTarget(cameraTarget);

    const mouseInput = new FreeCameraMouseInput(camera);

    // Set default sensitivity
    mouseInput.angularSensibility = 2000.0;

    // Basic camera settings
    camera.speed = cameraSpeed;
    camera.inertia = 0.5; // Reduced inertia for more responsive control
    camera.minZ = 0.1; // Better near clipping plane
    // camera.maxZ = calculateEnvironmentSize() * 10; // Far clipping plane based on environment size

    camera.inputs.clear();
    camera.inputs.add(mouseInput);
    // Add keyboard control for WASD movement
    const keysInput = new BABYLON.FreeCameraKeyboardMoveInput();
    camera.inputs.add(keysInput);

    camera.attachControl(previewCanvasRef.current, true);
    scene.activeCamera = camera;

    // Re-add observer for visibility updates

    if (previewCanvasRef.current) {
      previewCanvasRef.current.classList.remove("cursor-default");
      previewCanvasRef.current.classList.add("cursor-crosshair");
    }
  };

  // Apply view (top, front, side etc.)
  const applyView = (viewName) => {
    if (!previewSceneRef.current) return;

    const scene = previewSceneRef.current;
    const activeCamera = scene.activeCamera;

    // // Get the model center or current target
    // const targetPoint = modelInfoRef.current.boundingBoxCenter
    //   ? modelInfoRef.current.boundingBoxCenter.clone()
    //   : activeCamera.getTarget
    //   ? activeCamera.getTarget()
    //   : activeCamera.target.clone();
    // Step 1: Filter out unwanted meshes
    const includedMeshes = scene.meshes.filter(
      (mesh) =>
        mesh.isVisible &&
        mesh.isEnabled() &&
        mesh.getTotalVertices() > 0 &&
        !mesh.name.toLowerCase().includes("root") &&
        !mesh.name.toLowerCase().includes("sky") &&
        !mesh.name.toLowerCase().includes("ground")
    );

    if (includedMeshes.length === 0) return;

    // Step 2: Compute combined bounding box
    let min = includedMeshes[0]
      .getBoundingInfo()
      .boundingBox.minimumWorld.clone();
    let max = includedMeshes[0]
      .getBoundingInfo()
      .boundingBox.maximumWorld.clone();

    includedMeshes.forEach((mesh) => {
      const bb = mesh.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
    });

    const center = BABYLON.Vector3.Center(min, max);
    const radius = BABYLON.Vector3.Distance(min, max) / 2;

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Calculate distance needed to fit bounding box into view
    const fovRadians = scene.activeCamera.fov || Math.PI / 4;
    const distanceToFit = maxDimension / Math.tan(fovRadians / 2);

    // Store in ref
    modelInfoRef.current.boundingBoxMax = max;
    modelInfoRef.current.boundingBoxMin = min;

    modelInfoRef.current.boundingBoxCenter = center;
    modelInfoRef.current.modelRadius = distanceToFit;

    const targetPoint = center.clone();

    // If in fly camera mode (FreeCamera)
    if (
      activeCamera instanceof BABYLON.UniversalCamera &&
      !(activeCamera instanceof BABYLON.ArcRotateCamera)
    ) {
      // Calculate a good distance for positioning the camera
      const distance =
        modelInfoRef.current.modelRadius ||
        BABYLON.Vector3.Distance(activeCamera.position, targetPoint);

      // Create temporary vectors for the new position calculation
      let direction = new BABYLON.Vector3(0, 0, distance);
      let upVector = new BABYLON.Vector3(0, 1, 0);

      // Set the direction based on the view type
      if (viewName === "Top View") {
        direction = new BABYLON.Vector3(0, -distance, 0);
        upVector = new BABYLON.Vector3(0, 0, 1);
      } else if (viewName === "Bottom View") {
        direction = new BABYLON.Vector3(0, distance, 0);
        upVector = new BABYLON.Vector3(0, 0, -1);
      } else if (viewName === "Front View") {
        direction = new BABYLON.Vector3(0, 0, -distance);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Back View") {
        direction = new BABYLON.Vector3(0, 0, distance);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Right Side View") {
        direction = new BABYLON.Vector3(-distance, 0, 0);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Left Side View") {
        direction = new BABYLON.Vector3(distance, 0, 0);
        upVector = new BABYLON.Vector3(0, 1, 0);
      } else if (viewName === "Fit View") {
        direction = new BABYLON.Vector3(0, -distance, 0);
        upVector = new BABYLON.Vector3(0, 0, 1);
      }

      // Calculate the new camera position
      const newPosition = targetPoint.subtract(direction);

      // Set camera position
      activeCamera.position = newPosition;

      // Set the camera's target
      activeCamera.setTarget(targetPoint);
    }
    // If in orbit camera mode (ArcRotateCamera)
    else if (activeCamera instanceof BABYLON.ArcRotateCamera) {
      // Use the stored model center and radius if available
      if (modelInfoRef.current.boundingBoxCenter) {
        activeCamera.target = modelInfoRef.current.boundingBoxCenter.clone();

        // Apply the view's camera settings
        switch (viewName) {
          case "Top View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          case "Front View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Right Side View":
            activeCamera.alpha = 0;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Left Side View":
            activeCamera.alpha = Math.PI;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Bottom View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI;
            break;
          case "Back View":
            activeCamera.alpha = -Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Fit View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          default:
            break;
        }

        // Keep the current radius or use the model radius if available
        activeCamera.radius =
          modelInfoRef.current.modelRadius || activeCamera.radius;
      } else {
        // If no model info is available, just apply the view
        const currentTarget = activeCamera.target.clone();
        const currentRadius = activeCamera.radius;

        switch (viewName) {
          case "Top View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          case "Front View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Right Side View":
            activeCamera.alpha = 0;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Left Side View":
            activeCamera.alpha = Math.PI;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Bottom View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI;
            break;
          case "Back View":
            activeCamera.alpha = -Math.PI / 2;
            activeCamera.beta = Math.PI / 2;
            break;
          case "Fit View":
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = 0;
            break;
          default:
            break;
        }

        activeCamera.target = currentTarget;
        activeCamera.radius = currentRadius;
      }
    }
  };

  const modelModificationsRef = useRef({});

  // Modify the handleConvert function to track modifications by filename
  const handleConvert = () => {
    if (!previewSceneRef.current) return;

    const previewScene = previewSceneRef.current;
    const meshes = previewScene.meshes;
    const newMeshes = originalMeshDataRef.current;

    // Group meshes by filename for processing
    const meshesByFilename = {};

    meshes.forEach((mesh) => {
      // Skip utility meshes
      if (
        !mesh.geometry ||
        mesh instanceof BABYLON.GroundMesh ||
        mesh.name === "ground" ||
        mesh.name === "skyBox" ||
        mesh.name.includes("Camera") ||
        mesh.name.includes("Light")
      ) {
        return;
      }

      // Find the filename this mesh belongs to
      const filename = originalMeshDataRef.current[mesh.name]?.filename;
      if (!filename) return;

      if (!meshesByFilename[filename]) {
        meshesByFilename[filename] = [];
      }
      meshesByFilename[filename].push(mesh);
    });

    // Process meshes by filename
    Object.entries(meshesByFilename).forEach(([filename, fileMeshes]) => {
      // Initialize the modifications tracker for this file if it doesn't exist
      if (!modelModificationsRef.current[filename]) {
        modelModificationsRef.current[filename] = {
          simplificationApplied: false,
          materialsRemoved: false,
          animationsRemoved: false,
          transformations: null,
          materialColor: null,
          meshes: [],
        };
      }

      // Record that modifications are being applied
      modelModificationsRef.current[filename].simplificationApplied =
        simplificationFactor > 0;
      modelModificationsRef.current[filename].materialsRemoved =
        removeMaterials;
      modelModificationsRef.current[filename].animationsRemoved =
        removeAnimation;
      modelModificationsRef.current[filename].meshes = fileMeshes;

      // Process each mesh in this file
      fileMeshes.forEach((mesh) => {
        const geometry = mesh.geometry;

        // Skip meshes without geometry or vertex data
        if (
          !geometry ||
          !geometry.getVerticesData ||
          !geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind)
        )
          return;

        const positions = geometry.getVerticesData(
          BABYLON.VertexBuffer.PositionKind
        );
        const normals = geometry.getVerticesData(
          BABYLON.VertexBuffer.NormalKind
        );
        const indices = geometry.getIndices();

        if (!positions || !indices) return;

        // Apply simplification if needed
        if (simplificationFactor > 0) {
          const result = simplifyMeshData(
            mesh,
            parseInt(simplificationFactor),
            mesh.name
          );

          if (result) {
            const newVertexData = new BABYLON.VertexData();
            newVertexData.positions = result.positions;
            newVertexData.indices = result.indices;
            if (result.normals) newVertexData.normals = result.normals;

            newVertexData.applyToMesh(mesh);
            mesh.refreshBoundingInfo();
            mesh.computeWorldMatrix(true);
          }
        }

        // Update transforms
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        // Helper function to dispose material textures
        const disposeMaterialTextures = (material) => {
          const textureTypes = [
            "diffuse",
            "bump",
            "ambient",
            "opacity",
            "specular",
            "emissive",
          ];
          textureTypes.forEach((type) => {
            if (material[`${type}Texture`]) {
              material[`${type}Texture`].dispose();
            }
          });

          if (material instanceof BABYLON.PBRMaterial) {
            ["albedo", "metallic", "roughness", "normal", "ao"].forEach(
              (type) => {
                if (material[`${type}Texture`]) {
                  material[`${type}Texture`].dispose();
                }
              }
            );
          }
        };

        // Handle material removal
        // Handle material removal
        if (removeMaterials) {
          let materialColor = null;

          if (mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
            const color =
              mesh.material.albedoColor || mesh.material._albedoColor;
            if (color) {
              materialColor = {
                r: color.r,
                g: color.g,
                b: color.b,
              };
            }
            modelModificationsRef.current[filename].materialColor =
              materialColor;
          }

          // Dispose existing material and its textures
          if (mesh.material) {
            disposeMaterialTextures(mesh.material);
            mesh.material.dispose();
          }

          // Assign a simple material using the stored color or fallback to grey
          const simpleMat = new BABYLON.StandardMaterial(
            `simple_${mesh.name}`,
            previewScene
          );
          // simpleMat.diffuseColor = materialColor
          //   ? new BABYLON.Color3(materialColor.r, materialColor.g, materialColor.b)
          //   : new BABYLON.Color3(0.7, 0.7, 0.7); // Default grey
          simpleMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Default grey
          simpleMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
          mesh.material = simpleMat;
        }
        // else if(removeMaterials){
        //   // Assign a simple material using the stored color or fallback to grey
        //   const simpleMat = new BABYLON.StandardMaterial(`simple_${mesh.name}`, previewScene);
        //     simpleMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Default if no original color
        //   simpleMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        //   mesh.material = simpleMat;
        // }
      });

      // Handle animation removal for this file
      if (removeAnimation && previewScene.animationGroups) {
        const meshNames = fileMeshes.map((m) => m.name);
        previewScene.animationGroups.forEach((animGroup) => {
          const isTargeted = animGroup.targetedAnimations.some((anim) =>
            meshNames.includes(anim.target.name)
          );
          if (isTargeted) {
            console.log(
              `Stopping animation group: ${animGroup.name} for ${filename}`
            );
            animGroup.stop();
            animGroup.dispose();
          }
        });

        fileMeshes.forEach((mesh) => {
          if (mesh.animations?.length > 0) {
            console.log(
              `Clearing ${mesh.animations.length} animations from ${mesh.name} in ${filename}`
            );
            mesh.animations = [];
          }
        });
      }
    });

    // Update model info after a slight delay
    setTimeout(() => {
      // optional: add any state updates or notifications
      console.log("All modifications applied and tracked by filename");
      console.log("Model modifications:", modelModificationsRef.current);
    }, 500);
  };

  // Modify the applyTransformationsToModel function to track transformations by filename
  const applyTransformationsToModel = () => {
    if (!previewSceneRef.current) return;
    if (applyToAll) {
      const {
        translateX,
        translateY,
        translateZ,
        rotateX,
        rotateY,
        rotateZ,
        scaleX,
        scaleY,
        scaleZ,
      } = transformations;

      // Convert rotation from degrees to radians
      const toRadians = (angle) => (angle * Math.PI) / 180;

      const meshes = previewSceneRef.current.meshes.filter(
        (mesh) =>
          mesh.name &&
          !mesh.name.includes("__root__") &&
          !mesh.name.includes("sky")
      );

      // Group meshes by filename
      const meshesByFilename = {};

      meshes.forEach((mesh) => {
        // Skip utility meshes
        if (
          !mesh.geometry ||
          mesh instanceof BABYLON.GroundMesh ||
          mesh.name === "ground" ||
          mesh.name === "skyBox" ||
          mesh.name.includes("Camera") ||
          mesh.name.includes("Light")
        ) {
          return;
        }

        // Find the filename this mesh belongs to
        const filename = originalMeshDataRef.current[mesh.name]?.filename;
        if (!filename) return;

        if (!meshesByFilename[filename]) {
          meshesByFilename[filename] = [];
        }
        meshesByFilename[filename].push(mesh);
      });

      // Apply and track transformations by filename
      Object.entries(meshesByFilename).forEach(([filename, fileMeshes]) => {
        // Initialize the modifications tracker for this file if it doesn't exist
        if (!modelModificationsRef.current[filename]) {
          modelModificationsRef.current[filename] = {
            simplificationApplied: false,
            materialsRemoved: false,
            animationsRemoved: false,
            transformations: null,
            meshes: [],
          };
        }

        // Store the transformation values
        modelModificationsRef.current[filename].transformations = {
          translateX,
          translateY,
          translateZ,
          rotateX,
          rotateY,
          rotateZ,
          scaleX,
          scaleY,
          scaleZ,
        };

        modelModificationsRef.current[filename].meshes = fileMeshes;

        fileMeshes.forEach((mesh) => {
          // If applyToAll is false, you can add logic to skip some meshes
          if (!applyToAll && !mesh.metadata?.isSelected) return;

          // Translation
          mesh.position = new BABYLON.Vector3(
            translateX,
            translateY,
            translateZ
          );

          // Rotation (in radians)
          mesh.rotation = new BABYLON.Vector3(
            toRadians(rotateX),
            toRadians(rotateY),
            toRadians(rotateZ)
          );

          // Scaling
          mesh.scaling = new BABYLON.Vector3(scaleX, scaleY, scaleZ);

          // Refresh mesh
          mesh.refreshBoundingInfo();
          mesh.computeWorldMatrix(true);
        });
      });

      // Update the bounding box for all meshes
      updateCumulativeBoundingBox1(meshes);
      console.log("Transformations applied and tracked by filename");
    } else {
      setCustomAlert(true);
      setModalMessage("Please tick the check box");
    }
  };

  const exportModels = async () => {
    if (!previewSceneRef.current) return;
    const scene = previewSceneRef.current;
    const filenames = Object.keys(modelModificationsRef.current);

    if (filenames.length === 0) {
      console.log("No modified models to export");
      setCustomAlert(true);
      setModalMessage("No modified models to export");
      return;
    }

    for (const filename of filenames) {
      const modelData = modelModificationsRef.current[filename];
      if (!modelData || !modelData.meshes || modelData.meshes.length === 0) {
        console.log(`No meshes to export for ${filename}`);
        continue;
      }

      const tempScene = new BABYLON.Scene(scene.getEngine());
      tempScene.useRightHandedSystem = scene.useRightHandedSystem;

      new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        tempScene
      );
      const tempCamera = new BABYLON.ArcRotateCamera(
        "tempCamera",
        Math.PI / 2,
        Math.PI / 3,
        10,
        BABYLON.Vector3.Zero(),
        tempScene
      );

      const rootNode = new BABYLON.TransformNode("__root__", tempScene);

      const simpleMaterial = new BABYLON.StandardMaterial(
        "simple_export_material",
        tempScene
      );
      simpleMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
      simpleMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      simpleMaterial.specularPower = 32;
      simpleMaterial.disableLighting = false;

      const clonedMeshes = [];
      for (const mesh of modelData.meshes) {
        if (!mesh || mesh.isDisposed()) continue;
        try {
          const clonedMesh = new BABYLON.Mesh(mesh.name + "_export", tempScene);
          clonedMesh.parent = rootNode;

          if (mesh.geometry) {
            const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);
            if (
              !vertexData.normals &&
              vertexData.positions &&
              vertexData.indices
            ) {
              vertexData.normals = [];
              BABYLON.VertexData.ComputeNormals(
                vertexData.positions,
                vertexData.indices,
                vertexData.normals
              );
            }
            vertexData.applyToMesh(clonedMesh);
          }

          clonedMesh.material = simpleMaterial;
          clonedMesh.position = mesh.position.clone();
          clonedMesh.rotation = mesh.rotation.clone();
          clonedMesh.scaling = mesh.scaling.clone();
          clonedMesh.isVisible = true;
          clonedMeshes.push(clonedMesh);
        } catch (err) {
          console.error(`Error cloning mesh: ${err.message}`);
        }
      }

      if (clonedMeshes.length === 0) {
        tempScene.dispose();
        continue;
      }

      await new Promise((resolve) => {
        tempScene.executeWhenReady(async () => {
          try {
            const baseFilename = filename.replace(/\.[^/.]+$/, "");
            const outputFilename = `${baseFilename}.glb`;

            for (const mesh of clonedMeshes) {
              const correctionMatrix = BABYLON.Matrix.RotationX(Math.PI / 2);
              mesh.bakeTransformIntoVertices(correctionMatrix);
              mesh.scaling.x *= -1;
              mesh.scaling.y *= -1;
              mesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
              mesh.computeWorldMatrix(true);
              mesh.refreshBoundingInfo();
            }

            const exportOptions = {
              shouldExportNode: () => true,
              exportWithoutWaitingForScene: false,
              exportMaterials: true,
              exportTextures: false,
              useGLTFMaterial: false,
              coordinateSystemMode: "AUTO",
            };

            const glb = await GLTF2Export.GLBAsync(
              tempScene,
              outputFilename,
              exportOptions
            );
            let blob =
              glb.glb || glb.files?.[outputFilename] || glb.glTFFiles?.glb;
            if (!blob) throw new Error("GLB blob not found");

            const finalBlob =
              blob instanceof Blob
                ? blob
                : new Blob([blob], { type: "application/octet-stream" });
            const url = URL.createObjectURL(finalBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = outputFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setCustomAlert(true);
            setModalMessage(`Exported ${outputFilename} successfully`);
          } catch (err) {
            console.error(`Export error: ${err.message}`);
            setCustomAlert(true);
            setModalMessage(`Export failed: ${err.message}`);
          } finally {
            setTimeout(() => {
              tempScene.dispose();
              resolve();
            }, 1000);
          }
        });
      });
    }
  };

  const checkIfModelModified = (modifications) => {
    return Object.values(modifications).some(
      (mod) =>
        mod.animationsRemoved === true ||
        mod.materialsRemoved === true ||
        mod.simplificationApplied === true ||
        mod.transformations !== null
    );
  };

  const handleSaveAndExport = () => {
    // Check if any models have been modified
    console.log(modelModificationsRef);
    const hasModifications = checkIfModelModified(
      modelModificationsRef.current
    );
    const hasChanges = hasModifications;

    // If no changes have been made, just send the original file paths to backend
    if (!hasChanges) {
      if (fileNamePath.length === 0) {
        setCustomAlert(true);
        setModalMessage("Please convert files first");
        return;
      }
      const data = {
        fileNamePath: fileNamePath,
      };
      setLoading(true);
      handleClearAll();
      return;
    }

    if (hasChanges) {
      handleExportChanges();
    }
  };

   const handleExportChanges = async () => {
    if (!previewSceneRef.current) return;

    const scene = previewSceneRef.current;
    const newFilePaths = [];
    const filesToProcess = Object.keys(modelModificationsRef.current);
    let processedCount = 0;

    if (filesToProcess.length === 0) {
      console.log("No modified models to export");
      setCustomAlert(true);
      setModalMessage("No modified models to export");
     
      return;
    }

 

    for (const filename of filesToProcess) {
      const modelData = modelModificationsRef.current[filename];
      if (!modelData || !modelData.meshes || modelData.meshes.length === 0) {
        console.log(`No meshes to export for ${filename}`);
        processedCount++;
        continue;
      }

      const tempScene = new BABYLON.Scene(scene.getEngine());
      tempScene.useRightHandedSystem = scene.useRightHandedSystem;

      if (scene.environmentTexture) {
        tempScene.environmentTexture = scene.environmentTexture.clone();
        tempScene.environmentIntensity = scene.environmentIntensity;
      }

      const hemiLight = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        tempScene
      );
      hemiLight.intensity = 1.0;
      hemiLight.diffuse = new BABYLON.Color3(1, 1, 1);

      const tempCamera = new BABYLON.ArcRotateCamera(
        "tempCamera",
        Math.PI / 2,
        Math.PI / 3,
        10,
        BABYLON.Vector3.Zero(),
        tempScene
      );

      const rootNode = new BABYLON.TransformNode("__root__", tempScene);
      const modelColor = modelData.materialColor;

      const simpleMaterial = new BABYLON.StandardMaterial(
        "simple_export_material",
        tempScene
      );
      simpleMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);

      const clonedMeshes = [];
      for (const mesh of modelData.meshes) {
        if (
          !mesh ||
          mesh.isDisposed() ||
          !mesh.geometry ||
          mesh.getTotalVertices() === 0
        ) {
          continue;
        }
        mesh.material = null;
        const clonedMesh = new BABYLON.Mesh(mesh.name + "_export", tempScene);
        clonedMesh.parent = rootNode;

        const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);
        if (!vertexData.normals) {
          vertexData.normals = [];
          BABYLON.VertexData.ComputeNormals(
            vertexData.positions,
            vertexData.indices,
            vertexData.normals
          );
        }
        vertexData.applyToMesh(clonedMesh);

        clonedMesh.material = simpleMaterial;
        clonedMesh.position = mesh.position.clone();
        clonedMesh.rotation = mesh.rotation.clone();
        clonedMesh.scaling = mesh.scaling.clone();
        clonedMesh.bakeCurrentTransformIntoVertices();

        if (clonedMesh.getTotalVertices() > 0) {
          clonedMeshes.push(clonedMesh);
        } else {
          clonedMesh.dispose();
        }
      }

      if (clonedMeshes.length === 0) {
        console.log(`No valid meshes to export for ${filename}`);
        tempScene.dispose();
        processedCount++;
        continue;
      }

      await new Promise((resolve) => tempScene.executeWhenReady(resolve));
      tempScene.render();

      const baseFilename = filename.replace(/\.[^/.]+$/, "");
      const outputFilename = `${baseFilename}.glb`;

      for (const mesh of clonedMeshes) {
        const correctionMatrix = BABYLON.Matrix.RotationX(Math.PI / 2);
        mesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        const unitScale = 100; // to convert from centimeters to meters or similar
        mesh.scaling.scaleInPlace(unitScale);
        mesh.scaling.x *= -1;
        mesh.scaling.y *= -1;
        mesh.bakeTransformIntoVertices(correctionMatrix);
        mesh.bakeCurrentTransformIntoVertices(); // bake once after all transforms

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
      }

      const exportOptions = {
        shouldExportNode: () => true,
        exportWithoutWaitingForScene: false,
        exportMaterials: true,
        exportTextures: false,
        useGLTFMaterial: false,
        // coordinateSystemMode: "AUTO",
        excludeUnusedComponents: true,
      };

      try {
        const glb = await GLTF2Export.GLBAsync(
          tempScene,
          outputFilename,
          exportOptions
        );
        const blob =
          glb.glb || glb.files?.[outputFilename] || glb.glTFFiles?.glb;

        if (!blob) {
          console.error("No GLB data found for export");
          processedCount++;
          continue;
        }

        const finalBlob =
          blob instanceof Blob
            ? blob
            : new Blob([blob], { type: "application/octet-stream" });
            

       const arrayBuffer = await new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(finalBlob);
});

const uint8Array = Array.from(new Uint8Array(arrayBuffer));

newFilePaths.push({
  name: `${baseFilename}.glb`,
  data: uint8Array,
});

        console.log(`Export successful: ${outputFilename}`);
        processedCount++;
      } catch (error) {
        console.error(`Export failed for ${filename}:`, error);
        processedCount++;
      }

      tempScene.dispose();
    }

 
    console.log("All exports processed");
    console.log("Exported file paths:", newFilePaths);
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

    if (newFilePaths.length > 0) {
      const data = {
        fileNamePath: newFilePaths,
        projectId,
      };
   
        const response = await saveChangedUnassigned(data);
        if(response.status===200){
      handleClearAll();
           setCustomAlert(true);
        setModalMessage("The files saved successfully");
        }
    }
  };

  const speedBar = mode === "fly" && (
    <div
      className="speed-bar"
      style={{
        position: "absolute",
        bottom: "300px",
        right: 0,
        zIndex: 100,
        padding: "10px",
        display: "flex",
        flexDirection: "row",
        gap: "4px",
        fontSize: "14px",
      }}
    >
      <div>
        <strong className="text-light">
          {(cameraSpeed * multiplier).toFixed(2)}
        </strong>
      </div>

      <input
        type="range"
        min="0.1"
        max="2"
        step="0.1"
        className="btn btn-dark"
        value={cameraSpeed}
        onChange={(e) => updateCameraSpeed(parseFloat(e.target.value))}
        style={{ marginLeft: "10px" }}
      />

      <input
        type="number"
        min="0.1"
        step="0.5"
        value={multiplier}
        onChange={(e) => updateMultiplier(parseFloat(e.target.value))}
        style={{ marginLeft: "10px", width: "60px" }}
      />
    </div>
  );

  const updateCameraSpeed = (speed) => {
    if (!previewSceneRef.current) return;
    const scene = previewSceneRef.current;

    if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
      const actualSpeed = speed * multiplier;
      scene.activeCamera.speed = actualSpeed;
      setCameraSpeed(speed);
    }
  };

  const updateMultiplier = (value) => {
    if (!previewSceneRef.current) return;
    const scene = previewSceneRef.current;

    const validValue = isNaN(value) || value <= 0 ? 1 : value;

    if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
      const actualSpeed = cameraSpeed * validValue;
      scene.activeCamera.speed = actualSpeed;
      setMultiplier(validValue);
    }
  };

  return (
    <div
      id="bulkImportDiv1"
      style={{
        position: "absolute",
        width: "100%",
        height: "90vh",
        backgroundColor: "#373a4f",
        zIndex: 1,
      }}
    >
      <section className="page-section">
        <div className="row">
          <h4>Bulk model import</h4>
        </div>
      </section>
      <div
        style={{
          display: "flex",
          flex: 1,
        }}
      >
        {/* Left Panel */}
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #ccc",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              padding: "4px",
              maxHeight: "150px",
              overflowY: "auto",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="drop-file" style={{width:'100%'}}>
              <label htmlFor="bulkImportFiles" style={{ cursor: "pointer" }}>
                Drag and drop folder or click here
              </label>
              <input
                id="bulkImportFiles"
                type="file"
                multiple
                webkitdirectory=""
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div>
                <label
                  className="mt-3"
                  htmlFor="singleFileInput"
                  style={{ cursor: "pointer" }}
                >
                  Drag and drop files or click here
                </label>
                <input
                  id="singleFileInput"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
            </div>
            {files.length > 0 && (
              <div className="row dropped-files">
                {files.map((file, index) => (
                  <div key={index} className="file">
                    <div className="file-info">
                      <i className="fa fa-file"></i> {file.name}
                    </div>
                    <div className="file-actions">
                      <i
                        className="fa fa-close"
                        onClick={() => handleRemoveFbxFile(index)}
                      ></i>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear All Button */}
          <div style={{ padding: "3px", textAlign: "center" }}>
            <button
              style={{
                color: "black",
                border: "none",
                padding: "6px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={handleClearAll}
            >
              Clear all
            </button>
            <button
              className="ms-2"
              style={{
                color: "black",
                border: "none",
                padding: "6px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={() => loadFiles(files)}
            >
              Load
            </button>
            <button
              className="ms-2"
              style={{
                color: "black",
                border: "none",
                padding: "6px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={() => setPreviewButton(!previewButton)}
            >
              Preview
            </button>
          </div>

          {/* Options Panel */}
       {/* Options Panel */}
<div
  style={{
    padding: "10px",
    borderTop: "1px solid #ccc",
    
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      marginBottom: "15px",
    }}
  >
    <input
      type="checkbox"
      id="removeAnimation"
      checked={removeAnimation}
      onChange={(e) => setRemoveAnimation(e.target.checked)}
      style={{ marginRight: "10px", width: "16px", height: "16px" }}
    />
    <label htmlFor="removeAnimation" style={{ color: "white", margin: 0 }}>
      Remove animation
    </label>
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      marginBottom: "15px",
    }}
  >
    <input
      type="checkbox"
      id="removeMaterials"
      checked={removeMaterials}
      onChange={(e) => setRemoveMaterials(e.target.checked)}
      style={{ marginRight: "10px", width: "16px", height: "16px" }}
    />
    <label htmlFor="removeMaterials" style={{ color: "white", margin: 0, }}>
      Remove Texture and material
    </label>
  </div>

  <div style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
    <input
      type="text"
      value={simplificationFactor}
      onChange={(e) => setSimplificationFactor(e.target.value)}
      style={{
        width: "50px",
        height: "35px",
        marginRight: "10px",
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: "4px"
      }}
    />
    <label style={{ color: "white", margin: 0 }}>
      Simplification angle(in degree)
    </label>
  </div>

  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
    <button
      style={{
        backgroundColor: "white",
        color: "black",
        borderRadius: "4px",
        border: "none",
        padding: "10px",
        width: "45%",
        cursor: "pointer",
        fontSize: "14px"
      }}
      onClick={handleReset}
    >
      Reset
    </button>
    <button
      style={{
        backgroundColor: "white",
        color: "black",
        borderRadius: "4px",
        border: "none",
        padding: "10px",
        width: "45%",
        cursor: "pointer",
        fontSize: "14px"
      }}
      onClick={handleConvert}
    >
      Apply
    </button>
  </div>
</div>

          {/* Model Transformation Area */}
          <div
            style={{
              padding: "5px",
              fontWeight: "bold",
              textAlign: "center",
              color: "white",
              borderTop: "1px solid #ccc",
            }}
          >
            MODEL TRANSFORMATION
          </div>

          {/* Model Transformation Section */}
          <div style={styles.container}>
            <div style={styles.section}>
              <h2 style={styles.heading}>Translation</h2>
              <div style={styles.inputRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>X</label>
                  <input
                    type="text"
                    name="translateX"
                    value={transformations.translateX}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Y</label>
                  <input
                    type="text"
                    name="translateY"
                    value={transformations.translateY}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Z</label>
                  <input
                    type="text"
                    name="translateZ"
                    value={transformations.translateZ}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h2 style={styles.heading}>Rotation</h2>
              <div style={styles.inputRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>X</label>
                  <input
                    type="text"
                    name="rotateX"
                    value={transformations.rotateX}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Y</label>
                  <input
                    type="text"
                    name="rotateY"
                    value={transformations.rotateY}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Z</label>
                  <input
                    type="text"
                    name="rotateZ"
                    value={transformations.rotateZ}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h2 style={styles.heading}>Scale</h2>
              <div style={styles.inputRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>X</label>
                  <input
                    type="text"
                    name="scaleX"
                    value={transformations.scaleX}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Y</label>
                  <input
                    type="text"
                    name="scaleY"
                    value={transformations.scaleY}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Z</label>
                  <input
                    type="text"
                    name="scaleZ"
                    value={transformations.scaleZ}
                    onChange={handleTransformationChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.checkboxContainer}>
              <input
                type="checkbox"
                checked={true}
                disabled
                style={styles.checkbox}
                id="apply-all"
              />
              <label htmlFor="apply-all">Apply to all files</label>

              {/* <button
                style={{
                  color: "black",
                  border: "none",
                  padding: "6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onClick={resetTransformations}
              >
                Reset
              </button>
              <button
                style={{
                  color: "black",
                  border: "none",
                  padding: "6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onClick={applyTransformationsToModel}
              >
                Apply
              </button> */}
            </div>
            <div
              className="mt-1"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <button
                style={{
                  backgroundColor: "white",
                  color: "black",
                  borderRadius: "4px",
                  border: "none",
                  padding: "10px",
                  width: "45%",
                  cursor: "pointer",
                }}
                onClick={resetTransformations}
              >
                Reset
              </button>
              <button
                style={{
                  backgroundColor: "white",
                  color: "black",
                  borderRadius: "4px",
                  border: "none",
                  padding: "10px",
                  width: "45%",
                  cursor: "pointer",
                }}
                onClick={applyTransformationsToModel}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
        <div style={{ width: "10px" }}></div>

        {/* Right Panel */}
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            fontSize: "12px",
          }}
        >
          {/* Converted Files Header */}
          <div
            style={{
              padding: "5px",
              fontWeight: "bold",
              textAlign: "center",
              color: "white",
            }}
          >
            CONVERTED FILE
          </div>
          {progress > 0 && (
            <div className="row z-up" style={{ paddingTop: "20px" }}>
              <div className="col">
                <FileUploadProgress progress={progress} />
              </div>
            </div>
          )}

          <div
            style={{
              padding: "10px",
              maxHeight: "150px",
              overflowY: "auto",
              borderBottom: "1px solid #ccc",
            }}
          >
            {convertedFiles.length > 0 ? (
              <div className="row dropped-files">
                {fileNamePath.map((file, index) => (
                  <div key={index} className="file">
                    <div className="file-info">
                      <i className="fa fa-file"></i> {file.name}
                    </div>
                    <div className="file-actions">
                      <i
                        className="fa fa-eye"
                        onClick={() => handlePreviewFile(file)}
                        title="Preview file"
                      ></i>
                      <i
                        className="fa fa-close"
                        onClick={() => handleRemoveFile(index)}
                        title="Close file"
                      ></i>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px" }}>
                No converted files yet
              </div>
            )}
          </div>

          <div style={{ borderBottom: "1px solid #ccc" }}>
            <div
              style={{
                position: "relative",
                backgroundColor: "#f0f0f0",
                width: "100%",
                minHeight: "400px",
              }}
            >
              <canvas
                ref={previewCanvasRef}
                style={{
                  display: "block", // Removes extra space beneath canvas
                  width: "100%",
                  minHeight: "400px",
                  maxHeight: "400px",
                  overflow: "hidden",
                }}
                className="preview-canvas"
              ></canvas>

              {/* progress bar */}
              {isLoading && (
                <div
                  style={{
                    position: "absolute",
                    top: "30%",
                    left: 0,
                    width: "100%",
                    height: "50px",
                    backgroundColor: "rgba(0, 0, 0, 0.3)", // semi-transparent black
                    borderRadius: "10px",
                    zIndex: 1000,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: "80%",
                      height: "10px",
                      backgroundColor: "#ccc", // light gray background for the slider track
                      borderRadius: "5px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${loadingProgress}%`,
                        height: "100%",
                        backgroundColor: "#2196f3", // blue progress bar
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {/*showMeasureDetailsAbove */}

              {showMeasureDetailsAbove && (
                <div
                  style={{
                    position: "absolute",
                    left: "20px",
                    top: "50px",
                    zIndex: 1,
                    fontFamily: "sans-serif",
                    fontSize: "12px",
                    color: "white",
                    width: "80px",
                  }}
                >
                  {/* Top bar: total distance */}
                  <div
                    style={{
                      backgroundColor: "orange",
                      padding: "4px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {distance ? distance : ""}m
                  </div>

                  {/* X, Y, Z labels and values */}
                  <div style={{ display: "flex", flexDirection: "row" }}>
                    {/* Axis labels */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          backgroundColor: "red",
                          padding: "4px",
                          textAlign: "center",
                          color: "white",
                        }}
                      >
                        X
                      </div>
                      <div
                        style={{
                          backgroundColor: "green",
                          padding: "4px",
                          textAlign: "center",
                          color: "white",
                        }}
                      >
                        Y
                      </div>
                      <div
                        style={{
                          backgroundColor: "blue",
                          padding: "4px",
                          textAlign: "center",
                          color: "white",
                        }}
                      >
                        Z
                      </div>
                    </div>

                    {/* Axis values */}
                    <div style={{ backgroundColor: "#222", flexGrow: 1 }}>
                      <div
                        style={{
                          padding: "4px 6px",
                          borderBottom: "1px solid #333",
                        }}
                      >
                        {differences ? differences.diffX : ""}
                      </div>
                      <div
                        style={{
                          padding: "4px 6px",
                          borderBottom: "1px solid #333",
                        }}
                      >
                        {differences ? differences.diffX : ""}
                      </div>
                      <div style={{ padding: "4px 6px" }}>
                        {differences ? differences.diffX : ""}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {fileNamePath === -1 && (
                <div className="preview-message">
                  (shall able to zoom selected file from the list)
                </div>
              )}
              {/* Navigation Controls */}
              <div className="navigation-controls">
                <button
                  onClick={switchToOrbitCamera}
                  title="orbit camera"
                  className="nav-button"
                >
                  <img
                    style={{ width: "20px", height: "20px" }}
                    src="images/orbit.png"
                    alt=""
                  />
                </button>
                <button
                  onClick={switchToFlyCamera}
                  title="Fly camera"
                  className="nav-button"
                >
                  <i class="fa-solid fa-plane fs-4"></i>{" "}
                </button>
                <button
                  onClick={() => applyView("Fit View")}
                  title="Fit view"
                  className="nav-button"
                >
                  <ZoomOutMapIcon />
                </button>
                <button
                  onClick={() => applyView("Front View")}
                  title="Front view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/front.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => applyView("Back View")}
                  title="Back view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/back.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => applyView("Top View")}
                  title="Top view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/top.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => applyView("Bottom View")}
                  title="Bottom view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/bottom.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => applyView("Left Side View")}
                  title="Left view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/left.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => applyView("Right Side View")}
                  title="Right view"
                  className="nav-button"
                >
                  <img
                    className="button"
                    src="images/right.png"
                    style={{ width: "20px", height: "20px" }}
                    alt=""
                  />
                </button>
                <button
                  onClick={() => setShowMeasure(!showMeasure)}
                  title="Measure view"
                  className="nav-button"
                >
                  <img
                    id="measure"
                    class="button"
                    src="images/measure.png"
                    style={{ width: "20px", height: "20px" }}
                  />
                </button>
              </div>

              {/* Axis Indicator */}
              {previewSceneRef.current && (
                <CADTopViewAxisIndicator scene={previewSceneRef.current} />
              )}
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "10px",
              fontWeight: "bold",
            }}
          >
            3D PREVIEW
          </div>
        </div>
      </div>
      <hr />
      {/* Bottom Action Bar */}
      <div
        style={{
          display: "flex",
          float: "right",
          padding: "7px",
          fontSize: "11px",
          gap: "50px",
        }}
      >
        <button
          style={{
            backgroundColor: "white",
            color: "black",
            borderRadius: "4px",
            border: "none",
            padding: "5px 10px",
            cursor: "pointer",
          }}
          onClick={handleCancel}
        >
          Cancel
        </button>

        <button
          style={{
            backgroundColor: "white",
            color: "black",
            borderRadius: "4px",
            border: "none",
            padding: "5px 10px",
            cursor: "pointer",
          }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      {/* Alert Modal */}
      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}
    </div>
  );
}

export default BulkModelImport;
