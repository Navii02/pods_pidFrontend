import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useContext,
} from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import Comment from "../components/CommentModal";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import { setupLighting } from "../Utils/SetUpLight";
import { focusOnSelectedMesh } from "../Utils/FocusSelected";
import * as GUI from "@babylonjs/gui";
import {
  calculateElevationAngle,
  calculatePlanAngle,
} from "../Utils/GeometryCalculation";
import { zoomOnSelectedMesh } from "../Utils/ZoomSelected";
import CADTopViewAxisIndicator from "../components/AxisIndicator";
import { WaterMaterial } from "@babylonjs/materials";
import { FreeCameraMouseInput } from "../Utils/FlyControls";
import DeleteConfirm from "../components/DeleteConfirm";
import {
  getAllTags,
  getAllTagsDetails,
  GetAllUnAssignedPath,
} from "../services/iroamer";
import {
  faArrowsToDot,
  faGear,
  faMousePointer,
  faPlane,
  faScissors,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Axis3d } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { url } from "../services/Url";
import { iroamerContext } from "../context/ContextShare";
import {
  fetchAllGentagInfo,
  fetchFromGentagInfoFields,
  getequipmentList,
  getLineList,
} from "../services/TagApi";
import { deleteComment, getAllcomments, GetStatusComment, updateComment, updateCommentField } from "../services/CommentApi";

const Iroamer = forwardRef(
  (
    {
      projectNo,

      viewHideThreeunassigned,
      leftNavVisible,


      allViews,

      setViewHideThreeunassigned,

      currentProjectId,

      setWaterSettingParameter,
      waterSettingParameter,
      baseSettingParameter,

      applyViewSaved,

      setshowDisc,
      setShowTag,
      setshowSys,
    },
    ref
  ) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {
      highlightedTagKey,
      setHighlightedTagKey,
      setBackgroundColorTag,
      tagsToRemove,
      setTagsToRemove,
      viewHideThree,
      setViewHideThree, iroamerfieldEmpty
    } = useContext(iroamerContext);
    const location = useLocation();
    let modalData = location.state?.modalData || [];

    const navigate = useNavigate();

    const [viewMode, setViewMode] = useState("Top View");
    const [generalTagInfoFields, setGeneralTagInfoFields] = useState([]);
    const [allLineList, setallLineList] = useState([]);
    const [allComments, setAllComments] = useState([]);
    const [allCommentStatus, setAllCommentStatus] = useState([]);
    const [allEquipementList, setallEquipementList] = useState([]);
    const [userTagInfotable, setUserTagInfotable] = useState({})
    const [mode, setMode] = useState("");
    const [orthoviewmode, setOrthoviewmode] = useState("perspective");
    const [showComment, setShowComment] = useState(false);
    const [selectedItem, setselectedItem] = useState(false);
    const [activeButton, setActiveButton] = useState(null);
    const [settingbox, setsettingbox] = useState(false);
    const [showMeasure, setShowMeasure] = useState(false);
    const [showWireFrame, setShowWireFrame] = useState(false);
    const [savedViewDialog, setSavedViewDialog] = useState(false);
    const [enableClipping, setEnableClipping] = useState(false);

    // ------------------------------------PID--------------------------

    const [showAxis, setShowAxis] = useState(true);
    const [backgroundTheme, setBackgroundTheme] = useState("DEFAULT");
    const [groundSettingsVisible, setGroundSettingsVisible] = useState(false);
    const [waterSettingsVisible, setWaterSettingsVisible] = useState(false);
    const [clippingSetting, setClippingSetting] = useState(false);

    console.log(allComments);
    console.log(allCommentStatus);

    // handel orbit control
    const handleOrbitClick = (buttonName) => {
      //console.log("Setting active button to:", buttonName);
      setMode("orbit");
      setActiveButton(buttonName);
    };

    // handel fly control
    const handleFlyClick = (buttonName) => {
      setMode("fly");
      setActiveButton(buttonName);
    };

    const handleShowAxis = (buttonName) => {
      setShowAxis(!showAxis);
      setActiveButton(buttonName);
    };
    const handleWireFrames = (buttonName) => {
      setShowWireFrame(!showWireFrame);
      setActiveButton(buttonName);
    };
    // handleorthoview
    const handleorthoview = (buttonName) => {
      setOrthoviewmode("orthographic");
      setActiveButton(buttonName);
    };
    // handleperspective

    const handleperspective = (buttonName) => {
      setOrthoviewmode("perspective");
      setActiveButton(buttonName);
    };

    const handleViewChange = (viewName, buttonName) => {
      setViewMode(""); // Reset first
      setTimeout(() => {
        setViewMode(viewName); // Then set the actual view
        setActiveButton(buttonName);
      }, 10); // Ensure state updates properly
    };

    const handleorthotop = (buttonName) =>
      handleViewChange("Top View", buttonName);
    const handleorthofront = (buttonName) =>
      handleViewChange("Front View", buttonName);
    const handleortholeft = (buttonName) =>
      handleViewChange("Left Side View", buttonName);
    const handleorthoright = (buttonName) =>
      handleViewChange("Right Side View", buttonName);
    const handleorthobottom = (buttonName) =>
      handleViewChange("Bottom View", buttonName);
    const handleorthoback = (buttonName) =>
      handleViewChange("Back View", buttonName);
    const handlezoomfit = (buttonName) =>
      handleViewChange("Fit View", buttonName);

    // handle comment
    const handlecomment = (buttonName) => {
      setShowComment((prev) => !prev);
      setActiveButton(buttonName);
    };

    // handle object selected
    const handleObjectselected = (buttonName) => {
      setselectedItem(true);
      setActiveButton(buttonName);
      setShowMeasure(false);
    };

    // handle setting
    const handleSetting = (buttonName) => {
      setsettingbox(true);
      setActiveButton(buttonName);
    };

    // const handleEnableSectioning = (buttonName) => {
    //   setActiveButton(buttonName);
    //   setEnableClipping(!enableClipping);
    // };

    const handleShowMeasure = (buttonName) => {
      setShowMeasure(!showMeasure);
      setActiveButton(buttonName);
    };

    const handleSavedView = (buttonName) => {
      setActiveButton(buttonName);
      setSavedViewDialog(true);
    };

    let camera, OrthoCamera;
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    let menuHeight = "200px";

    const sceneRef = useRef(null);
    const [showMeasureDetails, setShowMeasureDetails] = useState(false);
    const [showMeasureDetailsAbove, setshowMeasureDetailsAbove] =
      useState(false);
    const [allLabels, setAllLabels] = useState([]);

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
    const [loadedFiles, setLoadedFiles] = useState([]);
    const [selectedItemName, setSelectedItemName] = useState(null);
    const [saveViewName, setSaveViewName] = useState("");
    const [customAlert, setCustomAlert] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [saveViewMenu, setSaveViewMenu] = useState("");
    const objectVisibilityRef = useRef({});

    const [speedControlVisible, setSpeedControlVisible] = useState(false);
    const [cameraSpeed, setCameraSpeed] = useState(1.0);
    const [multiplier, setMultiplier] = useState(1);
    const loadedMeshesRef = useRef([]);
    const modelInfoRef = useRef({
      boundingBoxMin: null,
      boundingBoxMax: null,
      boundingBoxCenter: null,
      modelRadius: 10,
    });
    const selectedMeshRef = useRef([]);
    const selectionHighlightLayerRef = useRef(null);
    const groundRef = useRef(null);
    const waterMeshRef = useRef(null);
    const skyboxRef = useRef(null);
    const measurementRef = useRef({
      pointA: null,
      pointB: null,
      line: null,
      text: null,
      markers: [],
    });
    const [selectedMeshId, setSelectedMeshId] = useState(null);
    const [commentPosition, setCommentPosition] = useState(null);
    const [commentinfo, setcommentinfo] = useState("");
    const [commentinfotable, setcommentinfotable] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [commentEdit, setCommentEdit] = useState("");
    const [measureUnit, setMeasureUnit] = useState("m");
    const [unitScaleFactor, setUnitScaleFactor] = useState(1);
    const [customUnitLabel, setCustomUnitLabel] = useState("custom");

    const [showAllViews, setShowAllViews] = useState(false);
    const [selectedTags, setSelectedTags] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({
      top: 0,
      left: 0,
      bottom: "auto",
    });
    const [rightClickCoordinates, setRightClickCoordinates] = useState({
      x: 0,
      y: 0,
    });
    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const [lineEqpInfo, setLineEqpInfo] = useState(false);
    const [showFileInfo, setShowFileInfo] = useState(false);
    const [tagInfoVisible, setTagInfoVisible] = useState(false);
    const [taginfo, settaginfo] = useState("");
    const [showControls, setShowControls] = useState(false);
    const [reflectionIntensity, setReflectionIntensity] = useState(0.5);
    const [resetTheme, setResetTheme] = useState(false);
    const [reload, setReload] = useState(false);
    const [FileInfoDetails, setFileInfoDetails] = useState({});
    const [groundSettingParameter, setGroundSettingParameter] = useState(null);
    //console.log("filedetails", FileInfoDetails);

    const [groundFormValues, setGroundFormValues] = useState({
      level: groundSettingParameter?.level ?? 0,
      color: groundSettingParameter?.color ?? "#cccccc",
      opacity:
        groundSettingParameter?.opacity != null
          ? groundSettingParameter.opacity * 100
          : 100,
    });
    const [baseFormValues, setBaseFormValues] = useState({
      measureUnit: "m",
      customUnitFactor: 1,
      fov: 45,
      nearClip: 0.01,
      farClip: 1000,
      angularSensibility: 2000,
      wheelSensibility: 1,
      cameraSpeed: 1,
      inertia: 0.4,
      lightIntensity: 1.0,
      specularColor: "#ffffff",
      shadowsEnabled: true,
      metallic: 0.5,
      roughness: 0.5,
      reflectionIntensity: 1.0,
    });
    const [waterFormValues, setWaterFormValues] = useState({
      level: waterSettingParameter?.level ?? 0,
      opacity:
        waterSettingParameter?.opacity != null
          ? waterSettingParameter.opacity * 100
          : 100,
      color: waterSettingParameter?.color ?? "#1ca3ec",
      colorBlendFactor: waterSettingParameter?.colorBlendFactor ?? 0.5,
      bumpHeight: waterSettingParameter?.bumpHeight ?? 1.0,
      waveLength: waterSettingParameter?.waveLength ?? 1.0,
      windForce: waterSettingParameter?.windForce ?? 20,
    });

    const groundLevelRef = useRef();
    const groundColorRef = useRef();
    const groundOpacityRef = useRef();
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const ambientRef = useRef();
    const directionalRef = useRef();
    const pointRef = useRef();
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState("");
    const [itemToDelete, setItemToDelete] = useState(null);
    const isUpdatingFromGizmoRef = useRef(false);
    const currentClippingPlaneRef = useRef(null);

    const [clippingPosition, setClippingPosition] = useState(50); // 50% by default
    const [clippingAxis, setClippingAxis] = useState("Y"); // "X", "Y", "Z"
    const [enableBoxClipping, setEnableBoxClipping] = useState(false);

    const gizmoManagerRef = useRef(null);
    const clippingBoxMeshRef = useRef(null);
    const clippingPlaneMeshRef = useRef(null);
    const materialRef = useRef(null); // Assign this when creating material
    const lightRef = useRef(null); // Assign this when creating light

    const [metallic, setMetallic] = useState(0.5);
    const [roughness, setRoughness] = useState(0.5);
    const [intensity, setIntensity] = useState(1);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [fov, setFov] = useState(60);
    const [nearClip, setNearClip] = useState(0.1);
    const [farClip, setFarClip] = useState(1000);
    const [angularSensibility, setAngularSensibility] = useState(2000);
    const [wheelSensibility, setWheelSensibility] = useState(1);
    const [inertia, setInertia] = useState(0.9);
    const [activeSection, setActiveSection] = useState(null);

    // Light settings
    const [lightIntensity, setLightIntensity] = useState(1);
    const [lightColor, setLightColor] = useState("#ffffff");
    const [specularColor, setSpecularColor] = useState("#ffffff");
    const [lightShadowsEnabled, setLightShadowsEnabled] = useState(false);
    const projectString = sessionStorage.getItem("selectedProject");
    const project = projectString ? JSON.parse(projectString) : null;
    const projectId = project?.projectId;
    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      if (scene?.environmentTexture) {
        scene.environmentIntensity = reflectionIntensity;
      }
    }, [reflectionIntensity]);

    useEffect(() => {
      if (showWireFrame) {
        handleWireFrame();
      }
    }, [showWireFrame]);
    const lastHighlightedTagRef = useRef(null);

    useEffect(() => {
      if (
        lastHighlightedTagRef.current &&
        highlightedTagKey !== lastHighlightedTagRef.current
      ) {
        const parts = lastHighlightedTagRef.current.split("-");
        const prevTag = parts.slice(3).join("-");
        const prevMatchFilename = selectedTags?.find(
          (t) =>
            t.area === parts[0] &&
            t.disc === parts[1] &&
            t.sys === parts[2] &&
            t.tag === prevTag
        )?.filename;

        if (prevMatchFilename) {
          removeHighlightForTag(prevMatchFilename);
        }
      }

      // If tag is cleared (e.g., clicked empty space), remove all highlights
      if (!highlightedTagKey) {
        sceneRef.current?.meshes?.forEach((mesh) => {
          if (mesh.metadata?.isHighlighted && mesh.metadata.tag) {
            removeHighlightForTag(mesh.metadata.tag);
          }
        });
        lastHighlightedTagRef.current = null;
        return;
      }

      //console.log("highlightedTagKey", highlightedTagKey);

      const parts = highlightedTagKey.split("-");
      const area = parts[0];
      const disc = parts[1];
      const sys = parts[2];
      const tag = parts.slice(3).join("-");

      //console.log("Parsed:", { area, disc, sys, tag });

      const matchFilename = selectedTags?.find(
        (t) =>
          t.area === area && t.disc === disc && t.sys === sys && t.tag === tag
      )?.filename;

      //console.log("matchFilename", matchFilename);

      if (matchFilename) {
        highlightTagInScene(matchFilename);
        lastHighlightedTagRef.current = highlightedTagKey;
      }
    }, [highlightedTagKey]);

    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      scene.onPointerDown = function (evt, pickResult) {
        if (evt.button === 0 && !pickResult.hit) {
          setHighlightedTagKey(""); // Or however you're clearing it
          selectedMeshRef.current = [];
          setFileInfoDetails(null); // Clear file info
          settaginfo({
            filename: "",
            meshname: "",
            linelistDetails: null,
            equipmentlistDetails: null,
            UsertagInfoDetails: {},
            originalUsertagInfoDetails: null,
          });
          setIsMenuOpen(false);

          lastHighlightedTagRef.current = null; // Clear last highlighted tag reference
        }
      };
    });
    // useEffect for reciecve all tag

    const AllTags = async () => {
      const data = modalData;
      //console.log("data", data);

      if (!data || !Array.isArray(data) || data.length === 0) return;
      const fileDataArray = Array.isArray(data) ? data : [data];
      //console.log(fileDataArray);

      const formattedData = fileDataArray?.map((file) => ({
        tag: file.tag,
        tagId: file.tagId,
        filePath: ` ${url}/tags/${file.filename}`,
        filename: file.filename,
        area: file.area,
        disc: file.disc,
        sys: file.sys,
        fileDetails: file.file || {},
      }));
      //console.log(formattedData);
      setSelectedTags((prevTags) => {
        // Create a new array to avoid duplicates
        const newTags = formattedData?.filter(
          (newTag) =>
            !prevTags.some(
              (prevTag) =>
                prevTag.tag === newTag.tag &&
                prevTag.filename === newTag.filename &&
                prevTag.area === newTag.area &&
                prevTag.disc === newTag.disc &&
                prevTag.sys === newTag.sys
            )
        );
        // Highlight the tag in the scene
        newTags?.forEach((tag) => {
          const tagKey = `${tag.area}-${tag.disc}-${tag.sys}-${tag.tag}`;
          if (viewHideThree[tagKey] === true) {
            highlightTagInScene(tag.filename);
          }
        });
        navigate(location.pathname, { replace: true, state: {} });
        return [...prevTags, ...newTags];
      });
    };

    useEffect(() => {
      AllTags();
    }, [location.state?.timestamp]);

    // useEffect for reciecve all tag  from p &ID
    const AlltagsPID = async () => {
      const data = [];

      const fileDataArray = Array.isArray(data) ? data : [data];
      const formattedData = fileDataArray?.map((file) => ({
        tag: file.tag,
        filePath: ` ${url}/tags/${file.filePath}`,
        filename: file.filename,
        area: file.area,
        disc: file.disc,
        sys: file.sys,
        fileDetails: file.fileDetails || {},
      }));

      setSelectedTags((prevTags) => {
        // Iterate through each file in formattedData
        formattedData?.forEach((newTag) => {
          const isPresent = prevTags.some(
            (prevTag) =>
              prevTag.tag === newTag.tag &&
              prevTag.filename === newTag.filename &&
              prevTag.area === newTag.area &&
              prevTag.disc === newTag.disc &&
              prevTag.sys === newTag.sys
          );

          if (isPresent) {
            highlightTagInScene(newTag.filename);
            const tagKey = `${newTag.area}-${newTag.disc}-${newTag.sys}-${newTag.tag}`;
            setBackgroundColorTag((prevState) => ({
              ...prevState,
              [tagKey]: true, // Set visibility to true
            }));
          } else {
            // Add the new tag to selectedTags
            prevTags = [...prevTags, newTag];

            // Update the viewHideThree state to make the eye icon open
            const tagKey = `${newTag.area}-${newTag.disc}-${newTag.sys}-${newTag.tag}`;
            setViewHideThree((prevState) => ({
              ...prevState,
              [tagKey]: true, // Set visibility to true
            }));
            setBackgroundColorTag((prevState) => ({
              ...prevState,
              [tagKey]: true, // Set visibility to true
            }));

            // // Highlight the new tag in the scene
            highlightTagInScene(newTag.filename);
          }
        });

        // Return the updated tags
        return prevTags;
      });
    };

    useEffect(() => {
      AlltagsPID();
    }, []);

    // useEffect for reciecve all unassigned path
    const GetAllUnAssignedPaths = async () => {
      const data = [];
      const fileDataArray = Array.isArray(data) ? data : [data];
      const formattedData = fileDataArray?.map((file) => ({
        tag: file.number,
        filePath: file.filePath.replace(/\\/g, "/"),
        filename: file.filename,
      }));

      setSelectedTags((prevTags) => {
        // Create a new array to avoid duplicates
        const newTags = formattedData?.filter(
          (newTag) =>
            !prevTags.some(
              (prevTag) =>
                prevTag.tag === newTag.tag &&
                prevTag.filename === newTag.filename
            )
        );
        // Return the updated array
        return [...prevTags, ...newTags];
      });
    };

    useEffect(() => {
      GetAllUnAssignedPaths();
    }, []);

    // Revised applyCustomClipping function that ensures clipping works
    const applyCustomClipping = (scene, box) => {
      // Get the current world matrix of the box
      const worldMatrix = box.getWorldMatrix();

      // Extract the transformation components
      const scaling = new BABYLON.Vector3();
      const rotation = new BABYLON.Quaternion();
      const translation = new BABYLON.Vector3();
      worldMatrix.decompose(scaling, rotation, translation);

      // Define all six planes for complete box clipping
      const planes = [
        new BABYLON.Plane(1, 0, 0, 0), // +X (right face)
        new BABYLON.Plane(-1, 0, 0, 0), // -X (left face)
        new BABYLON.Plane(0, 1, 0, 0), // +Y (bottom face)
        new BABYLON.Plane(0, -1, 0, 0), // -Y (top face)
        new BABYLON.Plane(0, 0, 1, 0), // +Z (front face)
        new BABYLON.Plane(0, 0, -1, 0), // -Z (back face)
      ];

      // Transform each plane to match the box's current transform
      const transformedPlanes = planes?.map((plane) => {
        const normal = new BABYLON.Vector3(
          plane.normal.x,
          plane.normal.y,
          plane.normal.z
        );

        // Transform the normal by the world matrix (without translation)
        const rotationMatrix = new BABYLON.Matrix();
        BABYLON.Matrix.FromQuaternionToRef(rotation, rotationMatrix);
        const transformedNormal = BABYLON.Vector3.TransformNormal(
          normal,
          rotationMatrix
        );
        transformedNormal.normalize(); // Important to keep the normal normalized

        // Calculate the distance
        const scaleFactor = new BABYLON.Vector3(
          Math.abs(plane.normal.x),
          Math.abs(plane.normal.y),
          Math.abs(plane.normal.z)
        );

        const scaledSize = new BABYLON.Vector3(
          scaling.x * scaleFactor.x,
          scaling.y * scaleFactor.y,
          scaling.z * scaleFactor.z
        );

        const distance =
          BABYLON.Vector3.Dot(transformedNormal, translation) +
          plane.d * scaledSize.length() * 0.5;

        return new BABYLON.Plane(
          transformedNormal.x,
          transformedNormal.y,
          transformedNormal.z,
          -distance
        );
      });

      // Clear any existing clip planes on the scene
      scene.clipPlane = null;
      scene.clipPlane2 = null;
      scene.clipPlane3 = null;
      scene.clipPlane4 = null;
      scene.clipPlane5 = null;
      scene.clipPlane6 = null;

      // Apply clipping planes directly to the scene (more reliable than material-based clipping)
      scene.clipPlane = transformedPlanes[0];
      scene.clipPlane2 = transformedPlanes[1];
      scene.clipPlane3 = transformedPlanes[2];
      scene.clipPlane4 = transformedPlanes[3];
      scene.clipPlane5 = transformedPlanes[4];
      scene.clipPlane6 = transformedPlanes[5];

      // Also apply to materials for compatibility with different rendering modes
      scene.meshes?.forEach((mesh) => {
        if (mesh.material && mesh !== box) {
          // Ensure clipping is enabled
          mesh.material.clipPlaneEnabled = true;

          // Set clipping planes on the material
          if (!mesh.material.clippingPlanes) {
            mesh.material.clippingPlanes = transformedPlanes;
          } else {
            mesh.material.clippingPlanes.length = 0;
            transformedPlanes?.forEach((plane) => {
              mesh.material.clippingPlanes.push(plane);
            });
          }

          // Additional settings for PBR materials
          if (mesh.material.getClassName() === "PBRMaterial") {
            mesh.material.useClipPlane = true;
          }
        }
      });
    };

    // Updated cleanup function
    const cleanupClipping = (scene) => {
      // Clear scene clipping planes
      scene.clipPlane = null;
      scene.clipPlane2 = null;
      scene.clipPlane3 = null;
      scene.clipPlane4 = null;
      scene.clipPlane5 = null;
      scene.clipPlane6 = null;

      // Clear material clipping planes
      scene.meshes?.forEach((mesh) => {
        if (mesh.material) {
          mesh.material.clippingPlanes = null;
          mesh.material.clipPlaneEnabled = false;
        }
      });
    };

    // Updated box clipping effect with enhanced visibility
    useEffect(() => {
      if (!sceneRef.current || !modelInfoRef.current || !enableBoxClipping) {
        // Clean up any existing clipping when disabling
        if (sceneRef.current && !enableBoxClipping) {
          cleanupClipping(sceneRef.current);
        }
        return;
      }

      const scene = sceneRef.current;

      // Clean up any existing clipping planes
      cleanupClipping(scene);

      // Disable regular plane clipping
      if (enableBoxClipping && enableClipping) {
        setEnableClipping(false);
      }

      const { boundingBoxMin, boundingBoxMax } = modelInfoRef.current;

      // Calculate full size and center
      const fullSize = boundingBoxMax.subtract(boundingBoxMin);
      const center = boundingBoxMin.add(fullSize.scale(0.5));

      // Clean up any existing box
      if (clippingBoxMeshRef.current) {
        clippingBoxMeshRef.current.dispose();
        clippingBoxMeshRef.current = null;
      }

      // Create a box that's 3/4 of the actual size
      const box = BABYLON.MeshBuilder.CreateBox(
        "clippingBox",
        { size: 1 },
        scene
      );

      // Scale to 3/4 of the original size
      const scaleFactor = 0.75; // 3/4 of original size
      box.scaling = fullSize.scale(scaleFactor);
      box.position = center;
      box.isPickable = true;

      // Create material for the box
      const boxMaterial = new BABYLON.StandardMaterial("boxMaterial", scene);
      boxMaterial.diffuseColor = new BABYLON.Color3(0, 0.5, 1.0); // Blue color
      boxMaterial.alpha = 0.15; // Very transparent
      boxMaterial.wireframe = true; // Show wireframe
      boxMaterial.emissiveColor = new BABYLON.Color3(0, 0.5, 1.0); // Slight glow
      box.material = boxMaterial;

      // Add edge rendering for better visibility
      const edgesWidth = 2.0;
      const edgesColor = new BABYLON.Color4(0, 0.5, 1, 1.0);
      box.enableEdgesRendering();
      box.edgesWidth = edgesWidth;
      box.edgesColor = edgesColor;

      clippingBoxMeshRef.current = box;

      // Clean up any existing gizmo manager
      if (gizmoManagerRef.current) {
        gizmoManagerRef.current.dispose();
        gizmoManagerRef.current = null;
      }

      // Attach gizmo for transforming box
      const gizmoManager = new BABYLON.GizmoManager(scene);
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.scaleGizmoEnabled = true;
      gizmoManager.attachToMesh(box);

      // Set gizmo appearance
      if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.scaleRatio = 1.5;
      }
      if (gizmoManager.gizmos.rotationGizmo) {
        gizmoManager.gizmos.rotationGizmo.scaleRatio = 1.5;
      }
      if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.scaleRatio = 1.5;
      }

      gizmoManagerRef.current = gizmoManager;

      // Keep box outside clipping so it's always visible
      box.alwaysSelectAsActiveMesh = true;
      box.doNotSyncBoundingInfo = true;

      // Update clipping when box transforms - this is crucial
      box.onAfterWorldMatrixUpdateObservable.add(() => {
        applyCustomClipping(scene, box);
      });

      // Apply clipping initially
      applyCustomClipping(scene, box);

      return () => {
        // Clean up on unmount or when disabling box clipping
        if (clippingBoxMeshRef.current) {
          clippingBoxMeshRef.current.dispose();
          clippingBoxMeshRef.current = null;
        }

        if (gizmoManagerRef.current) {
          gizmoManagerRef.current.dispose();
          gizmoManagerRef.current = null;
        }

        cleanupClipping(scene);
      };
    }, [enableBoxClipping]);

    const isUserInteracting = useRef(false);

    const handleEnableSectioning = (scene, positionPercent) => {
      if (!modelInfoRef.current) return;

      const { boundingBoxMin, boundingBoxMax } = modelInfoRef.current;
      let normal = new BABYLON.Vector3(0, 0, 0);
      let clipDistance = 0;

      const isNegative = clippingAxis.startsWith("-");
      const axis = clippingAxis.replace("-", "");

      // Calculate center of the model for better positioning
      const center = new BABYLON.Vector3(
        (boundingBoxMin.x + boundingBoxMax.x) / 2,
        (boundingBoxMin.y + boundingBoxMax.y) / 2,
        (boundingBoxMin.z + boundingBoxMax.z) / 2
      );

      // Calculate model dimensions for plane sizing
      const width = Math.abs(boundingBoxMax.x - boundingBoxMin.x);
      const height = Math.abs(boundingBoxMax.y - boundingBoxMin.y);
      const depth = Math.abs(boundingBoxMax.z - boundingBoxMin.z);

      // Calculate maximum dimension for plane size
      const maxDimension = Math.max(width, height, depth) * 1.5;

      // Set up clipping plane based on selected axis
      if (axis === "X") {
        const min = boundingBoxMin.x,
          max = boundingBoxMax.x;
        clipDistance = min + ((max - min) * positionPercent) / 100;
        normal = isNegative
          ? new BABYLON.Vector3(1, 0, 0)
          : new BABYLON.Vector3(-1, 0, 0);
      } else if (axis === "Y") {
        const min = boundingBoxMin.y,
          max = boundingBoxMax.y;
        clipDistance = min + ((max - min) * positionPercent) / 100;
        normal = isNegative
          ? new BABYLON.Vector3(0, 1, 0)
          : new BABYLON.Vector3(0, -1, 0);
      } else if (axis === "Z") {
        const min = boundingBoxMin.z,
          max = boundingBoxMax.z;
        clipDistance = min + ((max - min) * positionPercent) / 100;
        normal = isNegative
          ? new BABYLON.Vector3(0, 0, 1)
          : new BABYLON.Vector3(0, 0, -1);
      }

      // Calculate plane position (origin point)
      let planePosition;
      if (axis === "X") {
        planePosition = new BABYLON.Vector3(clipDistance, center.y, center.z);
      } else if (axis === "Y") {
        planePosition = new BABYLON.Vector3(center.x, clipDistance, center.z);
      } else {
        // Z axis
        planePosition = new BABYLON.Vector3(center.x, center.y, clipDistance);
      }

      // Set actual clipping plane
      const d = -BABYLON.Vector3.Dot(normal, planePosition);
      const clippingPlane = new BABYLON.Plane(normal.x, normal.y, normal.z, d);

      // Store current plane for reference
      currentClippingPlaneRef.current = {
        normal,
        position: planePosition,
        plane: clippingPlane,
      };

      // Clear any existing clipping plane
      scene.clipPlane = null;
      // Set the new clipping plane
      scene.clipPlane = clippingPlane;

      // Clean up old mesh if it exists
      if (clippingPlaneMeshRef.current) {
        clippingPlaneMeshRef.current.dispose();
        clippingPlaneMeshRef.current = null;
      }

      // Create new plane mesh
      const planeMesh = BABYLON.MeshBuilder.CreatePlane(
        "clipPlaneVis",
        {
          size: maxDimension,
        },
        scene
      );

      // Create material for the plane
      const planeMaterial = new BABYLON.StandardMaterial("clipMat", scene);
      planeMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1.0); // Light blue color
      planeMaterial.alpha = 0.4;
      planeMaterial.backFaceCulling = false; // Show both sides of the plane
      planeMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.4, 0.8); // Slight glow effect
      planeMesh.material = planeMaterial;

      // Position the plane
      planeMesh.position = planePosition;

      // Orient the plane correctly
      if (axis === "X") {
        planeMesh.rotation.y = isNegative ? Math.PI / 2 : -Math.PI / 2;
      } else if (axis === "Y") {
        planeMesh.rotation.x = isNegative ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // Z axis
        planeMesh.rotation.y = isNegative ? Math.PI : 0;
      }

      clippingPlaneMeshRef.current = planeMesh;

      // Clean up any existing gizmo manager
      if (scene.gizmoManager) {
        scene.gizmoManager.dispose();
      }

      // Create gizmo for the plane
      const gizmoManager = new BABYLON.GizmoManager(scene);
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.rotationGizmoEnabled = false;
      gizmoManager.scaleGizmoEnabled = false;
      gizmoManager.attachToMesh(planeMesh);

      // Configure the position gizmo for smoother movement
      if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = true;
        gizmoManager.gizmos.positionGizmo.snapDistance = 0; // Disable snapping for smoother movement
        gizmoManager.gizmos.positionGizmo.scaleRatio = 1; // Adjust sensitivity if needed
      }

      // Store reference to gizmo manager
      scene.gizmoManager = gizmoManager;

      // Enhanced gizmo movement handler - directly update clipping plane
      let lastUpdateTime = 0;
      planeMesh.onAfterWorldMatrixUpdateObservable.add(() => {
        // Throttle updates to avoid performance issues
        const now = performance.now();
        if (now - lastUpdateTime < 16) {
          // ~60fps
          return;
        }
        lastUpdateTime = now;

        // Get the new position after gizmo movement
        const newPosition = planeMesh.position.clone();

        // Update the clipping plane with the new position
        const updatedD = -BABYLON.Vector3.Dot(normal, newPosition);
        const updatedPlane = new BABYLON.Plane(
          normal.x,
          normal.y,
          normal.z,
          updatedD
        );

        // Update scene's clipping plane immediately
        scene.clipPlane = updatedPlane;

        // Calculate and update the position percentage for UI slider
        let percentage = 0;
        if (axis === "X") {
          percentage =
            ((newPosition.x - boundingBoxMin.x) /
              (boundingBoxMax.x - boundingBoxMin.x)) *
            100;
        } else if (axis === "Y") {
          percentage =
            ((newPosition.y - boundingBoxMin.y) /
              (boundingBoxMax.y - boundingBoxMin.y)) *
            100;
        } else {
          // Z axis
          percentage =
            ((newPosition.z - boundingBoxMin.z) /
              (boundingBoxMax.z - boundingBoxMin.z)) *
            100;
        }

        // Keep percentage within bounds
        percentage = Math.max(0, Math.min(100, percentage));

        // Update state without triggering the useEffect cycle
        isUpdatingFromGizmoRef.current = true;
        setClippingPosition(parseFloat(percentage.toFixed(1)));
      });
    };

    // Handler for the slider control
    const handleClippingSliderChange = (event) => {
      setClippingPosition(parseFloat(event.target.value));
    };

    // Handler for the number input
    const handleClippingNumberChange = (event) => {
      const value = parseFloat(event.target.value);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        setClippingPosition(value);
      }
    };

    // Reset clipping position
    const resetClippingPosition = () => {
      setClippingPosition(50); // Reset to middle
    };

    useEffect(() => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      canvas.width = width;
      canvas.height = height;

      const engine = new BABYLON.Engine(canvasRef.current, true, {
        antialias: true,
      });
      engineRef.current = engine;
      const scene = createScene(engine, canvasRef.current);
      scene.clearColor = new BABYLON.Color4(0.2, 0.2, 0.3, 1); // RGBA format
      sceneRef.current = scene;
      canvas.addEventListener("dblclick", handleDoubleClick);

      // Engine resize handler
      const handleResize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
        engine.resize();
      };

      window.addEventListener("resize", handleResize);

      engine.runRenderLoop(() => {
        scene.render();
      });
      if (engineRef.current) {
        // Timeout gives DOM time to recalculate layout
        setTimeout(() => {
          engineRef.current.resize();
        }, 100);
      }
      return () => {
        // Cleanup scene and engine
        if (sceneRef.current) {
          sceneRef.current.dispose();
          sceneRef.current = null;
        }

        engine.dispose();

        // Remove event listeners
        window.removeEventListener("resize", handleResize);
      };
    }, [projectNo, reload]);

    const handleDoubleClick = (event) => {
      if (!sceneRef.current && !canvasRef.current) return;
      const scene = sceneRef.current;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult.hit && pickResult.pickedPoint) {
        const targetPoint = pickResult.pickedPoint;

        if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
          scene.activeCamera.setTarget(targetPoint.clone());
        } else if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
          const cameraPosition = scene.activeCamera.position.clone();
          const direction = targetPoint.subtract(cameraPosition).normalize();
          const distance = BABYLON.Vector3.Distance(
            cameraPosition,
            targetPoint
          );
          const newTarget = cameraPosition.add(direction.scale(distance));
          scene.activeCamera.setTarget(newTarget);
        }

        //console.log(
        //   "Camera target set to intersected point:",
        //   targetPoint.toString()
        // );
      }
    };
    useEffect(() => {
      const handleResize = () => {
        if (engineRef.current) {
          engineRef.current.resize();
        }
      };
      //console.log(engineRef.current.resize());

      window.addEventListener("resize", handleResize);

      // Resize after nav toggle (with slight delay to allow layout to settle)
      setTimeout(handleResize, 100);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [leftNavVisible]); // <-- make sure navVisible is passed as a prop to this component

    useEffect(() => {
      if (applyViewSaved) {
        applySavedView(applyViewSaved);
      }
    }, [applyViewSaved]);
    const removeMeshesFromScene = (scene, tagList) => {
      tagList?.forEach((tag) => {
        const mesh = scene.meshes?.find(
          (mesh) =>
            mesh.metadata?.tag === tag || mesh.metadata?.tagNo?.tag === tag
        );
        if (mesh) {
          mesh.getChildMeshes?.()?.forEach((child) => child.dispose());
          mesh.dispose(true, true);
        }
      });
    };

    const filterLoadedFiles = (modelNames) =>
      setLoadedFiles((prevFiles) =>
        prevFiles?.filter(
          (filename) => !modelNames.some((model) => model.filename === filename)
        )
      );

    const filterSelectedTags = (modelNames, mode) =>
      setSelectedTags((prevTags) =>
        prevTags?.filter((tag) => {
          return !modelNames.some((model) => {
            const match =
              tag.filename === model.filename &&
              tag.tag === model.tag &&
              tag.area === model.area;
            if (mode === "disc") {
              return match && tag.disc === model.disc;
            }
            if (mode === "sys") {
              return match && tag.disc === model.disc && tag.sys === model.sys;
            }
            if (mode === "tag") {
              return (
                match &&
                tag.disc === model.disc &&
                tag.sys === model.sys &&
                tag.tag === model.tag
              );
            }
            return match;
          });
        })
      );

    useImperativeHandle(ref, () => ({
      removeUnassignedModels: (modelNames) => {
        const scene = sceneRef.current;
        if (!scene) return;

        removeMeshesFromScene(
          scene,
          modelNames?.map((m) => m.filename)
        );

        setViewHideThreeunassigned((prevState) => {
          const updated = { ...prevState };
          modelNames?.forEach((model) => {
            delete updated[model.number];
            delete objectVisibilityRef.current[model.number];
          });
          return updated;
        });

        filterLoadedFiles(modelNames);
        setSelectedTags((prev) =>
          prev?.filter(
            (tag) =>
              !modelNames.some(
                (m) => m.filename === tag.filename && m.number === tag.tag
              )
          )
        );
      },

      removeTagModels: (modelNames) => {
        const scene = sceneRef.current;
        if (!scene) return;

        removeMeshesFromScene(
          scene,
          modelNames?.map((m) => m.tag)
        );

        setViewHideThree((prevState) => {
          const updated = { ...prevState };
          modelNames?.forEach((model) => {
            const tagKey = `${model.area}-${model.disc}-${model.sys}-${model.tag}`;
            delete updated[tagKey];
          });
          return updated;
        });

        filterLoadedFiles(modelNames);
        filterSelectedTags(modelNames, "tag");
      },

      removeSysModels: (modelNames) => {
        const scene = sceneRef.current;
        if (!scene) return;

        removeMeshesFromScene(
          scene,
          modelNames?.map((m) => m.tag)
        );

        setViewHideThree((prevState) => {
          const updated = { ...prevState };
          modelNames?.forEach((model) => {
            const tagKey = `${model.area}-${model.disc}-${model.sys}-${model.tag}`;
            delete updated[tagKey];
            const sysKey = `${model.area}-${model.disc}-${model.sys}`;
            delete updated[sysKey];
          });
          return updated;
        });

        filterLoadedFiles(modelNames);
        filterSelectedTags(modelNames, "sys");
        setShowTag({});
      },

      removeDiscModels: (modelNames) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const discTagsToRemove = [];
        const seen = new Set();

        setViewHideThree((prevState) => {
          const updated = { ...prevState };

          modelNames?.forEach((model) => {
            const discKey = `${model.area}-${model.disc}`;
            if (!seen.has(discKey)) {
              seen.add(discKey);
              Object.keys(updated || {})?.forEach((key) => {
                if (key === discKey || key.startsWith(`${discKey}-`)) {
                  const tagPart = key.split("-").slice(3).join("-");
                  discTagsToRemove.push(tagPart);
                  delete updated[key];
                }
              });
            }
          });

          removeMeshesFromScene(scene, discTagsToRemove);
          return updated;
        });

        filterLoadedFiles(modelNames);
        filterSelectedTags(modelNames, "disc");
        setShowTag({});
        setshowSys({});
      },

      removeAreaModels: (modelNames) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const areaTagsToRemove = [];
        const seen = new Set();

        setViewHideThree((prevState) => {
          const updated = { ...prevState };

          modelNames?.forEach((model) => {
            const areaKey = `${model.area}`;
            if (!seen.has(areaKey)) {
              seen.add(areaKey);
              Object.keys(updated || {})?.forEach((key) => {
                if (key === areaKey || key.startsWith(`${areaKey}-`)) {
                  const tagPart = key.split("-").slice(3).join("-");
                  areaTagsToRemove.push(tagPart);
                  delete updated[key];
                }
              });
            }
          });

          removeMeshesFromScene(scene, areaTagsToRemove);
          return updated;
        });

        filterLoadedFiles(modelNames);
        filterSelectedTags(modelNames, "area");
        setshowDisc({});
        setshowSys({});
        setShowTag({});
      },
    }));

    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      // Skip if update is being driven by gizmo movement
      if (isUpdatingFromGizmoRef.current) {
        isUpdatingFromGizmoRef.current = false;
        return;
      }

      if (enableClipping) {
        handleEnableSectioning(scene, clippingPosition);
      } else {
        // Clear the clipping plane
        scene.clipPlane = null;
        currentClippingPlaneRef.current = null;
        setClippingSetting(false);

        // Cleanup clipping plane mesh
        if (clippingPlaneMeshRef.current) {
          clippingPlaneMeshRef.current.dispose();
          clippingPlaneMeshRef.current = null;
        }

        // Cleanup gizmo manager
        if (scene.gizmoManager) {
          scene.gizmoManager.dispose();
          scene.gizmoManager = null;
        }
      }

      // Cleanup function
      return () => {
        // Only needed for component unmount - handled above for state changes
      };
    }, [enableClipping, clippingPosition, clippingAxis]);

    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      return () => {
        scene.clipPlane = null;
        if (clippingPlaneMeshRef.current) {
          clippingPlaneMeshRef.current.dispose();
          clippingPlaneMeshRef.current = null;
        }
        if (scene.gizmoManager) {
          scene.gizmoManager.dispose();
          scene.gizmoManager = null;
        }
      };
    }, [enableClipping]);

    // useEffect for show and hide
    useEffect(() => {
      Object.keys(viewHideThreeunassigned || {})?.forEach((tag) => {
        const tagDetail = selectedTags?.find(
          (selectedTag) =>
            selectedTag.tag === tag &&
            (!selectedTag.area || !selectedTag.disc || !selectedTag.sys)
        );
        if (tagDetail) {
          toggleFileVisibility(
            tagDetail.filename,
            viewHideThreeunassigned[tag]
          );
        }
      });
    }, [viewHideThreeunassigned, selectedTags]);

    // useEffect for show and hide basedon area,disc and sys
    useEffect(() => {
      const getVisibility = (area, disc, sys, tag) => {
        const tagKey = `${area}-${disc}-${sys}-${tag}`;
        const sysKey = `${area}-${disc}-${sys}`;
        const discKey = `${area}-${disc}`;
        const areaKey = area;
        if (
          viewHideThree?.[tagKey] !== undefined &&
          viewHideThree?.[tagKey] !== null
        ) {
          return viewHideThree[tagKey];
        }

        //console.log("Keys checked:", { tagKey, sysKey, discKey, areaKey });

        if (viewHideThree[tagKey] !== undefined) return viewHideThree[tagKey];
        if (viewHideThree[sysKey] !== undefined) return viewHideThree[sysKey];
        if (viewHideThree[discKey] !== undefined) return viewHideThree[discKey];
        if (viewHideThree[areaKey] !== undefined) return viewHideThree[areaKey];
        return true;
      };

      selectedTags?.forEach((tag) => {
        if (!tag.area || !tag.disc || !tag.sys || !tag.tag) return;

        const visibility = getVisibility(tag.area, tag.disc, tag.sys, tag.tag);

        //console.log(`Setting visibility for ${tag.filename} to`, visibility);

        toggleFileVisibility(tag.filename, visibility);
      });
    }, [viewHideThree, selectedTags]);

    // useEffect for load files to scnefunctionality
    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      if (selectedTags.length > 0) {
        // Filter out tags for files that haven't been loaded yet
        const newTags = selectedTags?.filter(
          (tag) => !loadedFiles.includes(tag.filename)
        );
        //console.log(newTags);
        if (newTags.length > 0) {
          //console.log("loadfile");
          // Load files sequentially
          loadFilesSequentially(scene, newTags);

          // Update loaded files state
          setLoadedFiles((prevFiles) => [
            ...prevFiles,
            ...newTags?.map((tag) => tag.filename),
          ]);
        }
      }
      selectedTags?.forEach((tag, index) => {
        const tagKey = `${tag.areaTag}-${tag.discTag}-${tag.sysTag}-${tag.tagTag}`;
        if (
          viewHideThree?.[tagKey] === false ||
          tagsToRemove.includes(tag.tagTag)
        ) {
          setLoadedFiles((prevFiles) =>
            prevFiles.filter((filename) => filename !== tag.filename)
          );
        }
      });
      if (tagsToRemove.length > 0) {
        setTagsToRemove([]);
      }
    }, [selectedTags, loadedFiles]);

    //useEffect Camera mode change effects
    useEffect(() => {
      if (!sceneRef.current) return;

      if (mode === "orbit") {
        switchToOrbitCamera(orthoviewmode);
        setSpeedControlVisible(false);
      } else if (mode === "fly") {
        switchToFlyCamera();
        setSpeedControlVisible(true);
      }
    }, [mode, orthoviewmode]);

    // useEffect for all views(top,front...) functionality
    useEffect(() => {
      applyView(viewMode);
    }, [viewMode]);

    // useEffect for allview timeout functionality
    useEffect(() => {
      return () => {
        setViewMode("");
      };
    }, []);

    // useEffect(() => {
    //   let observer = null;
    //   if (selectedItem) {
    //     if (!sceneRef.current) return;
    //     const scene = sceneRef.current;

    //     observer = scene.onPointerObservable.add((pointerInfo) => {
    //       const { event, type, pickInfo } = pointerInfo;

    //       if (type === BABYLON.PointerEventTypes.POINTERDOWN) {
    //         const isLeftClick = event.button === 0;
    //         const isRightClick = event.button === 2;

    //         if (isLeftClick) {
    //           //console.log("pickInfo.hit",pickInfo)

    //           if (pickInfo.hit && pickInfo.pickedMesh) {
    //             let mesh = pickInfo.pickedMesh;

    //             // Traverse to root mesh with metadata
    //             while (
    //               mesh.parent &&
    //               (!mesh.metadata || Object.keys(mesh.metadata).length === 0)
    //             ) {
    //               mesh = mesh.parent;
    //             }
    //             //console.log(mesh);

    //             // Skip if root has no tag metadata
    //             if (!mesh.metadata || !mesh.metadata.tagNo) {
    //               return;
    //             }

    //             // Skip environment meshes
    //             if (
    //               mesh === skyboxRef.current ||
    //               mesh === groundRef.current ||
    //               mesh === waterMeshRef.current ||
    //               mesh.name.includes("skyBox") ||
    //               mesh.name.includes("ground") ||
    //               mesh.name.includes("water")
    //             ) {
    //               return;
    //             }
    //         const tempId=mesh.metadata.tagNo.tag
    //             const tagKey = `${mesh.metadata.tagNo.area}-${mesh.metadata.tagNo.disc}-${mesh.metadata.tagNo.sys}-${mesh.metadata.tagNo.tag}`;
    //             setBackgroundColorTag({ [tagKey]: true });
    //             scene.meshes?.forEach((mesh) => {
    //               if (mesh.metadata && mesh.metadata.tagNo && mesh.metadata.tagNo.tag === tempId) {
    //                 highlightMesh(mesh);
    //               }
    //             });

    //             // highlightMesh(mesh);
    //             selectedMeshRef.current = mesh;

    //             const intersectionPoint = pointerInfo.pickInfo.pickedPoint;
    //             setSelectedItem(true);
    //             setSelectedItemName({ name: mesh.name });
    //             setCommentPosition({
    //               intersectionPointX: intersectionPoint.x,
    //               intersectionPointY: intersectionPoint.y,
    //               intersectionPointZ: intersectionPoint.z,
    //             });

    //             setFileInfoDetails(mesh.metadata.tagNo.fileDetails);
    //             const tagid = mesh.metadata.tagNo.tag;

    //             const linelistDetails = allLineList?.find((line) => line.tag === tagid);
    //             const equipmentlistDetails = allEquipementList?.find((equipment) => equipment.tag === tagid);
    //             const UsertagInfoDetails = userTagInfotable?.find((tag) => tag.tag === tagid);

    //             const tagInfoDetails = {
    //               filename: tagid,
    //               meshname: mesh.name,
    //               linelistDetails: linelistDetails || null,
    //               equipmentlistDetails: equipmentlistDetails || null,
    //               UsertagInfoDetails: UsertagInfoDetails || null,
    //             };

    //             //console.log("tagInfoDetails:", tagInfoDetails);
    //             settaginfo(tagInfoDetails);
    //           } else {
    //             // Clear selection
    //             if (selectedMeshRef.current) {
    //               dehighlightMesh();
    //               selectedMeshRef.current = null;
    //             }
    //             setBackgroundColorTag({});
    //             setSelectedItem(false);
    //             setActiveButton("");
    //             setSelectedItemName("");
    //             setIsMenuOpen(false);
    //             scene.clipPlane = null;
    //           }
    //         }

    //         if (isRightClick) {
    //           // Handle custom context menu here

    //           // Optional: you can check if mesh is hit to show mesh-specific context
    //           if (pickInfo.hit && pickInfo.pickedMesh) {
    //             const mesh = pickInfo.pickedMesh;
    //             showContextMenu(event.clientX, event.clientY, mesh);
    //           } else {
    //             showContextMenu(event.clientX, event.clientY, null);
    //           }

    //           // Prevent default browser context menu
    //           event.preventDefault();
    //         }
    //       }
    //     });

    //     return () => {
    //       if (sceneRef.current && observer) {
    //         sceneRef.current.onPointerObservable.remove(observer);
    //       }
    //     };
    //   }
    // }, [selectedItem]);
    const getGeneralTagInfoField = async (projectId) => {
      try {
        const response = await fetchFromGentagInfoFields(projectId);
        if (response.status === 200) {
          console.log(response);

          setGeneralTagInfoFields(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch status table data:", error);
      }
    };
    //console.log(generalTagInfoFields);

    const getAllLinelist = async (projectId) => {
      const response = await getLineList(projectId);
      if (response.status === 200) {
        console.log(response);

        setallLineList(response.data);
      }
    };

    const getAllEquipmentList = async (projectId) => {
      const response = await getequipmentList(projectId);
      if (response.status === 200) {
        //console.log(response);

        setallEquipementList(response.data);
      }
    };
    //console.log("linelist", allLineList);
    const getusertaginfo = async (projectId) => {
      const response = await fetchAllGentagInfo(projectId);
      if (response.status === 200) {
        //console.log(response);

        setUserTagInfotable(response.data);
      }
    };
    useEffect(() => {
      if (sessionStorage.getItem("selectedProject")) {
        getGeneralTagInfoField(projectId);
        getAllLinelist(projectId);
        getAllEquipmentList(projectId);
        getusertaginfo(projectId)
      }
    }, [projectId]);

    useEffect(() => {
      let observer = null;
      if (selectedItem) {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;

        observer = scene.onPointerObservable.add((pointerInfo) => {
          const { event, type, pickInfo } = pointerInfo;

          if (type === BABYLON.PointerEventTypes.POINTERDOWN) {
            const isLeftClick = event.button === 0;
            const isRightClick = event.button === 2;

            if (isLeftClick) {
              if (pickInfo?.hit && pickInfo?.pickedMesh) {
                let mesh = pickInfo.pickedMesh;

                // If no tag metadata, or environment mesh, return
                if (
                  !mesh.metadata?.tagNo?.tag ||
                  mesh === skyboxRef.current ||
                  mesh === groundRef.current ||
                  mesh === waterMeshRef.current ||
                  mesh.name.includes("skyBox") ||
                  mesh.name.includes("ground") ||
                  mesh.name.includes("water")
                ) {
                  return;
                }
                //console.log("mesh", mesh);
                // Clear previous highlight
                dehighlightMesh();
                selectedMeshRef.current = mesh;
                highlightMesh(mesh);

                // Set other state info
                const tagKey = `${mesh.metadata.tagNo.area}-${mesh.metadata.tagNo.disc}-${mesh.metadata.tagNo.sys}-${mesh.metadata.tagNo.tag}`;
                setBackgroundColorTag({ [tagKey]: true });

                const intersectionPoint = pointerInfo.pickInfo.pickedPoint;
                setselectedItem(true);
                setSelectedItemName({ name: mesh.name });
                setCommentPosition({
                  intersectionPointX: intersectionPoint.x,
                  intersectionPointY: intersectionPoint.y,
                  intersectionPointZ: intersectionPoint.z,
                });

                setFileInfoDetails(mesh.metadata.tagNo.fileDetails);

                // console.log(mesh.metadata);
                const tagid = mesh.metadata.tagNo.tagId;
                console.log(tagid);

                const linelistDetails = allLineList?.find(
                  (line) => line.tagId === tagid
                );
                console.log(allLineList);

                const equipmentlistDetails = allEquipementList?.find(
                  (equipment) => equipment.tagId === tagid
                );
                const UsertagInfoDetails = userTagInfotable?.find(
                  (tag) => tag.tagId === tagid
                );
                console.log(UsertagInfoDetails);

                const userDefinedDisplay = new Map();

                if (UsertagInfoDetails) {
                  generalTagInfoFields?.forEach(({ id, field, unit }) => {
                    const taginfoKey = `taginfo${id}`;
                    const value = UsertagInfoDetails[taginfoKey];

                    // Insert into Map to guarantee order
                    userDefinedDisplay.set(`${field} (${unit})`, value);
                  });
                }

                // When setting the data:
                settaginfo({
                  filename: tagid,
                  meshname: mesh.name,
                  linelistDetails: linelistDetails || null,
                  equipmentlistDetails: equipmentlistDetails || null,
                  UsertagInfoDetails: Object.fromEntries(userDefinedDisplay),
                  originalUsertagInfoDetails: UsertagInfoDetails || null,
                });
              } else {
                // Clicked on empty space, dehighlight all
                dehighlightMesh();
                settaginfo({});
                setFileInfoDetails(null);
                setCommentPosition(null);
                setBackgroundColorTag({});
                setselectedItem(false);
                setActiveButton("");
                setSelectedItemName("");
                setIsMenuOpen(false);
                scene.clipPlane = null;
              }
            }

            if (isRightClick) {
              if (pickInfo?.hit && pickInfo?.pickedMesh) {
                showContextMenu(
                  event.clientX,
                  event.clientY,
                  pickInfo.pickedMesh
                );
              } else {
                showContextMenu(event.clientX, event.clientY, null);
              }
              event.preventDefault();
            }
          }
        });

        return () => {
          if (sceneRef.current && observer) {
            sceneRef.current.onPointerObservable.remove(observer);
          }
        };
      }
    }, [selectedItem]);

    // useEffect for measurement functionality
    useEffect(() => {
      let observer = null;

      if (showMeasure) {
        let unit = baseFormValues.measureUnit
          ? baseFormValues.measureUnit
          : "m";
        let scaleValue = baseFormValues.customUnitFactor
          ? baseFormValues.customUnitFactor
          : 1;
        //console.log(unit);
        if (!sceneRef.current) return;
        const scene = sceneRef.current;

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
                mesh === skyboxRef.current ||
                mesh === groundRef.current ||
                mesh === waterMeshRef.current ||
                mesh.name.includes("skyBox") ||
                mesh.name.includes("ground") ||
                mesh.name.includes("water")
              ) {
                clearMeasurement();
                setshowMeasureDetailsAbove(false);
                return;
              }

              // Handle the measurement
              handleMeasurementPick(pointerInfo.pickInfo, unit, scaleValue);

              // Find the topmost pickable parent mesh with metadata
              let targetMesh = mesh;
              while (
                targetMesh &&
                (!targetMesh.metadata ||
                  Object.keys(targetMesh.metadata || {}).length === 0)
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
        if (sceneRef.current && observer) {
          sceneRef.current.onPointerObservable.remove(observer);
        }
      };
    }, [showMeasure]);


    const FetchAllcommentStatus = async (projectId) => {
      const response = await GetStatusComment(projectId);

      if (response.status === 200) {
        //console.log(response.data.data);
        setAllCommentStatus(response.data.data);
      }
    };

    const FetchAllcomments = async (projectId) => {
      const response = await getAllcomments(projectId);

      if (response.status === 200) {
        //console.log(response.data.data);
        setAllComments(response.data.data);
      }
    };
   const fetchAllCommentData = async () => {
  try {
    const [commentsResponse, statusResponse] = await Promise.all([
      getAllcomments(projectId),
      GetStatusComment(projectId),
    ]);

    if (commentsResponse.status === 200) {
      setAllComments(commentsResponse.data.data);
    }
    if (statusResponse.status === 200) {
      setAllCommentStatus(statusResponse.data.data);
    }
  } catch (error) {
    console.error("Failed to fetch comment data:", error);
    setCustomAlert(true);
    setModalMessage("Failed to fetch comments. Please try again.");
  }
};useEffect(() => {
  if (projectId) {
    fetchAllCommentData();
    getGeneralTagInfoField(projectId);
    getAllLinelist(projectId);
    getAllEquipmentList(projectId);
    getusertaginfo(projectId);
  }
}, [projectId,isCommentOpen]);
    // useEffect for showAll comments functionality
    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      // Track existing comment IDs
      const existingCommentIds = new Set(
        allLabels?.map((label) => label.commentId)
      );
      const currentCommentIds = new Set(
        allComments?.map((comment) => comment.number)
      );

      // Identify new comments and labels to remove
      const commentsToAdd = allComments?.filter(
        (comment) => !existingCommentIds.has(comment.number)
      );
      const labelsToRemove = allLabels?.filter(
        (label) => !currentCommentIds.has(label.commentId)
      );

      // Remove labels that no longer exist
      if (labelsToRemove.length > 0) {
        labelsToRemove?.forEach((labelElement) => {
          if (labelElement.label?.dispose) {
            labelElement.label.dispose();
          }
          if (labelElement.tooltip?.dispose) {
            labelElement.tooltip.dispose();
          }
          if (labelElement.position?.dispose) {
            labelElement.position.dispose();
          }
        });
      }

      // Update existing labels
      const updatedLabels = allLabels
        ?.filter((label) => currentCommentIds.has(label.commentId))
        ?.map((labelElement) => {
          const updatedComment = allComments?.find(
            (c) => c.number === labelElement.commentId
          );

          if (updatedComment) {
            // Update visibility
            labelElement.label.isVisible = showComment;
            if (labelElement.tooltip) {
              labelElement.tooltip.isVisible = showComment;
            }

            // Update position if changed
            const newPosition = new BABYLON.Vector3(
              updatedComment.coOrdinateX,
              updatedComment.coOrdinateY,
              updatedComment.coOrdinateZ
            );
            if (
              labelElement.position &&
              !labelElement.position.position.equals(newPosition)
            ) {
              labelElement.position.position = newPosition;
            }

            // ✅ Always update background color based on updated status
            const updatedColor =
              allCommentStatus?.find(
                (s) => s.statusname === updatedComment.status
              )?.color || "gray";
            labelElement.label.background = updatedColor;
          }

          return labelElement;
        });

      // Add new labels
      const newLabels = [];
      commentsToAdd?.forEach((comment) => {
        const labelElement = createCommentLabel(comment, scene);

        // Set background color based on status
        const labelColor =
          allCommentStatus?.find((s) => s.statusname === comment.status)
            ?.color || "gray";
        labelElement.label.background = labelColor;

        // Set visibility
        labelElement.label.isVisible = showComment;
        if (labelElement.tooltip) {
          labelElement.tooltip.isVisible = showComment;
        }

        labelElement.commentId = comment.number;

        newLabels.push(labelElement);
      });

      // Update state with combined labels
      setAllLabels([...updatedLabels, ...newLabels]);
    }, [allComments, showComment, allCommentStatus,isCommentOpen]);

    useEffect(() => {
      if (baseSettingParameter) {
        setBaseFormValues({
          measureUnit: baseSettingParameter?.measure?.unit ?? "m",
          customUnitFactor:
            Number(baseSettingParameter?.measure?.scaleValue) || 1,
          fov: baseSettingParameter?.camera?.fov ?? 45,
          nearClip: baseSettingParameter?.camera?.nearClip ?? 0.01,
          farClip: baseSettingParameter?.camera?.farClip ?? 1000,
          angularSensibility:
            baseSettingParameter?.camera?.angularSensibility ?? 2000,
          wheelSensibility: baseSettingParameter?.camera?.wheelSensibility ?? 1,
          cameraSpeed: baseSettingParameter?.camera?.cameraSpeed ?? 1,
          inertia: baseSettingParameter?.camera?.inertia ?? 0.4,
          lightIntensity: baseSettingParameter?.light?.intensity ?? 1.0,
          specularColor:
            baseSettingParameter?.light?.specularColor ?? "#ffffff",
          shadowsEnabled: baseSettingParameter?.light?.shadowsEnabled ?? true,
          metallic: baseSettingParameter?.material?.metallic ?? 0.5,
          roughness: baseSettingParameter?.material?.roughness ?? 0.5,
          reflectionIntensity:
            baseSettingParameter?.material?.reflectionIntensity ?? 1.0,
        });
      }
    }, [baseSettingParameter]);

    useEffect(() => {
      if (groundSettingParameter) {
        setGroundFormValues({
          level: groundSettingParameter.level ?? 0,
          color: groundSettingParameter.color ?? "#cccccc",
          opacity:
            groundSettingParameter.opacity != null
              ? groundSettingParameter.opacity * 100
              : 100,
        });
      }
    }, [groundSettingParameter]);

    useEffect(() => {
      setWaterFormValues({
        level: waterSettingParameter?.level ?? 0,
        opacity:
          waterSettingParameter?.opacity != null
            ? waterSettingParameter.opacity * 100
            : 100,
        color: waterSettingParameter?.color ?? "#1ca3ec",
        colorBlendFactor: waterSettingParameter?.colorBlendFactor ?? 0.5,
        bumpHeight: waterSettingParameter?.bumpHeight ?? 1.0,
        waveLength: waterSettingParameter?.waveLength ?? 1.0,
        windForce: waterSettingParameter?.windForce ?? 20,
      });
    }, [waterSettingParameter]);

    // Background theme change effect
    useEffect(() => {
      if (sceneRef.current) {
        applyBackgroundTheme(backgroundTheme);
      }
    }, [backgroundTheme]);

    // Apply background theme
    const applyBackgroundTheme = (themeName) => {
      if (!sceneRef.current) return;

      const scene = sceneRef.current;
 //console.log(themeName);
 
      switch (themeName) {
        case "DEFAULT":
          // Set default background (dark blue)
       scene.clearColor = new BABYLON.Color4(0.2, 0.2, 0.298, 1);


          // Remove ground if it exists
          if (groundRef.current) {
            groundRef.current.dispose();
            groundRef.current = null;
          }

          // Remove skybox if it exists
          if (skyboxRef.current) {
            skyboxRef.current.dispose();
            skyboxRef.current = null;
          }

          // Remove water if it exists
          if (waterMeshRef.current) {
            waterMeshRef.current.dispose();
            waterMeshRef.current = null;
          }

          setWaterSettingsVisible(false);
          setGroundSettingsVisible(false);
          break;

        case "WHITE":
          // Set white background
          scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

          // Remove ground if it exists
          if (groundRef.current) {
            groundRef.current.dispose();
            groundRef.current = null;
          }

          // Remove skybox if it exists
          if (skyboxRef.current) {
            skyboxRef.current.dispose();
            skyboxRef.current = null;
          }

          // Remove water if it exists
          if (waterMeshRef.current) {
            waterMeshRef.current.dispose();
            waterMeshRef.current = null;
          }

          setWaterSettingsVisible(false);
          setGroundSettingsVisible(false);
          break;

        case "GROUND_SKY":
          // Calculate environment size based on model size - make it larger to avoid flickering
          const environmentSize = calculateEnvironmentSize() * 1.5;

          // Setup skybox
          if (skyboxRef.current) {
            skyboxRef.current.dispose();
            skyboxRef.current = null;
          }

          skyboxRef.current = BABYLON.MeshBuilder.CreateBox(
            "skyBox",
            { size: environmentSize },
            scene
          );

          // Make skybox unselectable and not pickable to avoid issues in fly mode
          skyboxRef.current.isPickable = false;

          const skyboxMaterial = new BABYLON.StandardMaterial(
            "skyBoxMaterial",
            scene
          );
          skyboxMaterial.backFaceCulling = false;
          skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
            "https://playground.babylonjs.com/textures/TropicalSunnyDay",
            scene
          );
          skyboxMaterial.reflectionTexture.coordinatesMode =
            BABYLON.Texture.SKYBOX_MODE;
          skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
          skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
          skyboxRef.current.material = skyboxMaterial;
          skyboxRef.current.infiniteDistance = true; // Fix for fly mode

          // Setup ground
          if (groundRef.current) {
            groundRef.current.dispose();
            groundRef.current = null;
          }

          groundRef.current = BABYLON.MeshBuilder.CreateGround(
            "ground",
            {
              width: 1000,
              height: 1000,
              subdivisions: 2, // Reduce subdivisions to avoid flickering
            },
            scene
          );

          const groundMaterial = new BABYLON.StandardMaterial(
            "groundMaterial",
            scene
          );
          if (groundSettingParameter) {
            const groundColor = hexToColor3(
              groundSettingParameter?.color || "#018C01"
            );
            groundMaterial.diffuseColor = groundColor || "#018C01";
            groundMaterial.alpha = groundSettingParameter?.opacity;
          } else {
            groundMaterial.diffuseColor = new BABYLON.Color3(0.01, 0.49, 0.01);
            groundMaterial.alpha = 1.0;
          }

          groundMaterial.backFaceCulling = false;
          groundMaterial.isPickable = false;

          if (groundRef.current) {
            groundRef.current.material = groundMaterial;
            groundRef.current.isPickable = false;

            if (modelInfoRef.current.boundingBoxMin) {
              const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
              const level = groundSettingParameter?.level;
              groundRef.current.position.y = baseY + level;
            } else {
              groundRef.current.position.y = -1.0;
            }
          } else {
            // Default ground color if no settings
            groundMaterial.diffuseColor = new BABYLON.Color3(0.01, 0.49, 0.01);
            groundMaterial.alpha = 1.0;
          }
          groundMaterial.backFaceCulling = false;
          groundMaterial.isPickable = false;
          groundRef.current.material = groundMaterial;
          groundRef.current.isPickable = false;

          // Remove water if it exists
          if (waterMeshRef.current) {
            waterMeshRef.current.dispose();
            waterMeshRef.current = null;
          }

          setWaterSettingsVisible(false);
          break;

        case "SEA_SKY":
          // Calculate environment size based on model size
          const seaEnvironmentSize = calculateEnvironmentSize() * 1.5;

          // Setup skybox
          if (skyboxRef.current) {
            skyboxRef.current.dispose();
            skyboxRef.current = null;
          }

          skyboxRef.current = BABYLON.MeshBuilder.CreateBox(
            "skyBox",
            { size: seaEnvironmentSize },
            scene
          );

          // Make skybox unselectable and not pickable
          skyboxRef.current.isPickable = false;

          const seaSkyboxMaterial = new BABYLON.StandardMaterial(
            "skyBoxMaterial",
            scene
          );
          seaSkyboxMaterial.backFaceCulling = false;
          seaSkyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
            "https://playground.babylonjs.com/textures/TropicalSunnyDay",
            scene
          );
          seaSkyboxMaterial.reflectionTexture.coordinatesMode =
            BABYLON.Texture.SKYBOX_MODE;
          seaSkyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
          seaSkyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
          skyboxRef.current.material = seaSkyboxMaterial;
          skyboxRef.current.infiniteDistance = true; // Fix for fly mode

          // Remove ground if it exists
          if (groundRef.current) {
            groundRef.current.dispose();
            groundRef.current = null;
          }

          // Setup water
          if (waterMeshRef.current) {
            waterMeshRef.current.dispose();
            waterMeshRef.current = null;
          }

          waterMeshRef.current = BABYLON.MeshBuilder.CreateGround(
            "waterMesh",
            {
              width: seaEnvironmentSize,
              height: seaEnvironmentSize,
              subdivisions: 2, // Reduce subdivisions
            },
            scene
          );

          // Make water unselectable and not pickable
          waterMeshRef.current.isPickable = false;

          // Water material
          const waterMaterial = new WaterMaterial("water", scene);
          waterMaterial.bumpTexture = new BABYLON.Texture(
            "babylon/textures/waterbump.png",
            scene
          );
          waterMaterial.backFaceCulling = true;

          if (waterSettingParameter) {
            // Convert hex color to Babylon Color3
            const waterColor = hexToColor3(
              waterSettingParameter.color || "#000000"
            );
            waterMaterial.waterColor = waterColor;

            // Apply other water parameters
            waterMaterial.opacity =
              waterSettingParameter.opacity !== undefined
                ? waterSettingParameter.opacity
                : 0.9;
            waterMaterial.colorBlendFactor =
              waterSettingParameter.colorBlendFactor !== undefined
                ? waterSettingParameter.colorBlendFactor
                : 0.3;
            waterMaterial.bumpHeight =
              waterSettingParameter.bumpHeight !== undefined
                ? waterSettingParameter.bumpHeight
                : 0.5;

            if (waterSettingParameter.waveLength !== undefined) {
              waterMaterial.waveHeight = waterSettingParameter.waveLength;
            }

            if (waterSettingParameter.windForce !== undefined) {
              waterMaterial.windForce = waterSettingParameter.windForce;
            }
            waterMaterial.windDirection = new BABYLON.Vector2(1, 1);
          } else {
            // Default water properties
            waterMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            waterMaterial.waveHeight = 0.2;
            waterMaterial.colorBlendFactor = 0.25;
            waterMaterial.opacity = 0.8;
            waterMaterial.windForce = 10;
          }

          sceneRef.current.meshes?.forEach((mesh) => {
            if (mesh.isVisible && mesh.isPickable)
              waterMaterial.addToRenderList(mesh);
          });
          // Add skybox to water reflections
          waterMaterial.addToRenderList(skyboxRef.current);

          // Apply water material
          waterMeshRef.current.material = waterMaterial;

          if (modelInfoRef.current.boundingBoxMin) {
            const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
            const level = waterSettingParameter?.level ?? 0; // use default 0 if not provided
            waterMeshRef.current.position.y = baseY + level;
          } else {
            const level = waterSettingParameter?.level ?? 0;
            waterMeshRef.current.position.y = level; // fallback if bounding box is unavailable
          }

          setGroundSettingsVisible(false);
          break;

        default:
              scene.clearColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1);

          // Remove ground if it exists
          if (groundRef.current) {
            groundRef.current.dispose();
            groundRef.current = null;
          }

          // Remove skybox if it exists
          if (skyboxRef.current) {
            skyboxRef.current.dispose();
            skyboxRef.current = null;
          }

          // Remove water if it exists
          if (waterMeshRef.current) {
            waterMeshRef.current.dispose();
            waterMeshRef.current = null;
          }

          setWaterSettingsVisible(false);
          setGroundSettingsVisible(false);
      }
    };

    const hexToColor3 = (hex) => {
      hex = hex.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return new BABYLON.Color3(r, g, b);
    };

    // Calculate environment size
    const calculateEnvironmentSize = () => {
      if (!loadedMeshesRef.current || loadedMeshesRef.current.length === 0) {
        return 1000; // Default size if no models loaded
      }

      // Get model dimensions
      const min = modelInfoRef.current.boundingBoxMin;
      const max = modelInfoRef.current.boundingBoxMax;

      // If model info isn't available yet
      if (!min || !max) {
        return 1000; // Default size
      }

      // Calculate size based on model dimensions
      const size = max.subtract(min);
      const maxDimension = Math.max(size.x, size.y, size.z);

      // Environment should be at least 10x larger than model
      // but not too small or too large
      const environmentSize = Math.max(1000, maxDimension * 20);

      return environmentSize;
    };
    const calculateDistanceInUnit = (distanceInMeters, unit) => {
      switch (unit) {
        case "cm":
          return distanceInMeters * 100; // Convert to centimeters
        case "mm":
          return distanceInMeters * 1000; // Convert to millimeters
        default:
          return distanceInMeters; // Default to meters
      }
    };
    const handleMeasurementPick = (pickInfo, unit, scaleValue) => {
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

        // Raw differences (no scale)
        const rawDiffX = Math.abs(p2.x - p1.x);
        const rawDiffY = Math.abs(p2.y - p1.y);
        const rawDiffZ = Math.abs(p2.z - p1.z);

        // Apply scale
        const scaledDiffX = (rawDiffX * parseFloat(scaleValue)).toFixed(2);
        const scaledDiffY = (rawDiffY * parseFloat(scaleValue)).toFixed(2);
        const scaledDiffZ = (rawDiffZ * parseFloat(scaleValue)).toFixed(2);

        setDifferences({
          diffX: scaledDiffX,
          diffY: scaledDiffY,
          diffZ: scaledDiffZ,
        });

        const distance = BABYLON.Vector3.Distance(p1, p2).toFixed(2);
        const rawDistance = BABYLON.Vector3.Distance(p1, p2) * scaleValue;
        setDistance(`${rawDistance.toFixed(2)} ${unit}`);

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
      const scene = sceneRef.current;
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
      const scene = sceneRef.current;
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
      measurementRef.current.markers?.forEach((marker) => {
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

    // // Function to create a comment label with plane geometry instead of box
    // const createCommentLabel = (comment, scene) => {
    //   // Create a simple position mesh (invisible) to anchor the label
    //   const position = BABYLON.MeshBuilder.CreateBox(
    //     `marker-position-${comment.number}`,
    //     { size: 0.1 }, // Small invisible box
    //     scene
    //   );

    //   position.position = new BABYLON.Vector3(
    //     comment.coOrdinateX,
    //     comment.coOrdinateY,
    //     comment.coOrdinateZ
    //   );

    //   // Make the position mesh invisible
    //   position.isVisible = false;

    //   // Create the fullscreen UI
    //   const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
    //     `UI-${comment.number}`,
    //     true,
    //     scene
    //   );

    //   // Get the status color from comment status
    //   const statusColor =
    //     allCommentStatus?.find(
    //       (status) => status.statusname === comment.status
    //     )?.color || "gray";

    //   // Create the main label (number)
    //   const label = new GUI.Rectangle("label");
    //   label.background = statusColor || "red"; // Use status color or default to red
    //   label.height = "20px";
    //   label.alpha = 0.8;
    //   label.width = "20px";
    //   label.thickness = 1;
    //   label.linkOffsetY = -10;
    //   label.isPointerBlocker = true; // Make sure it can be clicked
    //   label.commentId = comment.number; // Save only the ID

    //   label.onPointerClickObservable.add(() => {
    //     const latestComment = allComments?.find(
    //       (c) => c.number === label.commentId
    //     );
    //     if (latestComment) {
    //       handleCommentInfo(latestComment); // ✅ always pass updated comment
    //     }
    //   });

    //   const text = new GUI.TextBlock();
    //   text.text = `${comment.number}`; // Fixed typo from 'numbber' to 'number'
    //   text.color = "white";
    //   text.fontSize = 10;

    //   label.addControl(text);
    //   advancedTexture.addControl(label);

    //   // // Create tooltip for comment content (hidden by default)
    //   // const tooltip = new GUI.Rectangle("tooltip");
    //   // tooltip.background = "black";
    //   // tooltip.height = "30px";
    //   // tooltip.alpha = 0.9;
    //   // tooltip.paddingLeft = "5px";
    //   // tooltip.paddingRight = "5px";
    //   // tooltip.thickness = 1;
    //   // tooltip.cornerRadius = 5;
    //   // tooltip.linkOffsetY = -45; // Position above the number label
    //   // tooltip.isVisible = false;

    //   // // Adjust width based on text length
    //   // tooltip.width = `${Math.max(
    //   //   50,
    //   //   comment.text ? comment.text.length * 8 : 50
    //   // )}px`;
    //   // advancedTexture.addControl(tooltip);

    //   // // Link the tooltip to the 3D position
    //   // tooltip.linkWithMesh(position);

    //   // Add hover behavior to the mesh
    //   position.actionManager = new BABYLON.ActionManager(scene);

    //   // Show tooltip on hover
    //   position.actionManager.registerAction(
    //     new BABYLON.ExecuteCodeAction(
    //       BABYLON.ActionManager.OnPointerOverTrigger,
    //       () => {
    //         tooltip.isVisible = true;
    //       }
    //     )
    //   );

    //   // Hide tooltip when not hovering
    //   position.actionManager.registerAction(
    //     new BABYLON.ExecuteCodeAction(
    //       BABYLON.ActionManager.OnPointerOutTrigger,
    //       () => {
    //         tooltip.isVisible = false;
    //       }
    //     )
    //   );

    //   // Store the tooltip in the label for access elsewhere
    //   label.tooltip = tooltip;

    //   // Link the main label to the 3D position
    //   label.linkWithMesh(position);

    //   // Return the label and position for future reference
    //   return {
    //     label: label,
    //     position: position,
    //     tooltip: tooltip,
    //     show: () => {
    //       label.isVisible = true;
    //     },
    //     hide: () => {
    //       label.isVisible = false;
    //       tooltip.isVisible = false;
    //     },
    //   };
    // };

    // Function to create a comment label with plane geometry instead of box
    const createCommentLabel = (comment, scene) => {
      // Create a simple position mesh (invisible) to anchor the label
      const position = BABYLON.MeshBuilder.CreateBox(
        `marker-position-${comment.number}`,
        { size: 0.1 }, // Small invisible box
        scene
      );

      position.position = new BABYLON.Vector3(
        comment.coOrdinateX,
        comment.coOrdinateY,
        comment.coOrdinateZ
      );

      // Make the position mesh invisible
      position.isVisible = false;

      // Create the fullscreen UI
      const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        `UI-${comment.number}`,
        true,
        scene
      );

      // Get the status color from comment status
      const statusColor =
        allCommentStatus?.find((status) => status.statusname === comment.status)
          ?.color || "gray";

      // Create the main label (number)
      const label = new GUI.Rectangle("label");
      label.background = statusColor || "red"; // Use status color or default to red
      label.height = "20px";
      label.alpha = 0.8;
      label.width = "20px";
      label.thickness = 1;
      label.linkOffsetY = -10;
      label.isPointerBlocker = true; // Make sure it can be clicked
      label.onPointerClickObservable.add(() => {
        handleCommentInfo(comment); // Pass the comment object to the handler
      });

      const text = new GUI.TextBlock();
      text.text = `${comment.number}`; // Fixed typo from 'numbber' to 'number'
      text.color = "white";
      text.fontSize = 10;

      label.addControl(text);
      advancedTexture.addControl(label);
      // Add hover behavior to the mesh
      position.actionManager = new BABYLON.ActionManager(scene);

      // Show tooltip on hover
      position.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOverTrigger,
          () => {
            label.isVisible = true;
          }
        )
      );

      // Hide tooltip when not hovering
      position.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOutTrigger,
          () => {
            label.isVisible = false;
          }
        )
      );

      // Link the main label to the 3D position
      label.linkWithMesh(position);

      // Return the label and position for future reference
      return {
        label: label,
        position: position,
        show: () => {
          label.isVisible = true;
        },
        hide: () => {
          label.isVisible = false;
        },
      };
    };

    const handleCommentInfo = (item) => {
      //console.log("comment info", item);
      setcommentinfo(item);
      setcommentinfotable(true);
    };

    const handleclosecommentinfo = () => {
      setIsEditing(false);
      setcommentinfotable(false);
      setcommentinfo(null);
    };

    const handleCloselineEqpInfo = () => {
      setLineEqpInfo(false);
    };

    const handleCloseFileInfo = () => {
      setShowFileInfo(false);
    };
    const handleCloseTagInfo = () => {
      setTagInfoVisible(false);
    };

    const deletecomment = async (commentNumber) => {
      const response = await deleteComment(commentNumber)
      if (response.status === 200) {
         fetchAllCommentData();
        setcommentinfotable(false);
        setcommentinfo(null);
      }
    };

    const handleEditButtonClick = (number) => {
      setIsEditing(true);
      setCommentEdit(commentinfo.comment);
      setStatus(commentinfo.status);
      setPriority(commentinfo.priority);
    };

    const handleSaveButtonClick = async (commentNumber) => {
      setIsEditing(false);
      const data = {
        number: commentNumber,
        comment: commentEdit,
        status: status,
        priority: priority,
      };

      const response = await updateCommentField(data)
      if (response.status === 200) {
        console.log(response);
        
        setCustomAlert(true);
        setModalMessage("Status updated");
      fetchAllCommentData();
        handleclosecommentinfo();
      }
    };


    const showContextMenu = (x, y, mesh) => {
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      const isSpaceBelow = y + 200 <= windowHeight;
      const isSpaceRight = x + 180 <= windowWidth;
      const top = isSpaceBelow ? y : y - 200;
      const left = isSpaceRight ? x : x - 180;

      setMenuPosition({ top, left });

      // if (selectedItem) {
      setRightClickCoordinates({ x: top, y: left });
      setIsMenuOpen(true);
      // } else {
      //   //console.log("No mesh selected for context menu");
      // }
    };

    const handleFocusSelected = () => {
      const scene = sceneRef.current;
      const selectedMeshes = selectedMeshRef.current;

      if (!scene) return;

      if (!selectedMeshes || selectedMeshes.length === 0) {
        setCustomAlert(true);
        setModalMessage("Please select object..");
        setIsMenuOpen(false);
      } else {
        focusOnSelectedMesh(scene, selectedMeshes);
        setIsMenuOpen(false);
      }
    };

    const handleColorChange = () => {
      if (!sceneRef.current || !selectedMeshRef.current) {
        console.warn("Scene or selected mesh is not available.");
        return;
      }

      const scene = sceneRef.current;
      const meshes = selectedMeshRef.current;

      // Generate random color
      const randomColor = Math.floor(Math.random() * 16777215);
      const color3 = BABYLON.Color3.FromInts(
        (randomColor >> 16) & 255,
        (randomColor >> 8) & 255,
        randomColor & 255
      );

      let material;
      meshes?.forEach((mesh) => {
        // Handle PBRMaterial
        if (mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
          // Clone material to avoid affecting others
          const originalMaterial = mesh.material;
          material = originalMaterial.clone("clonedPBR");
          material.albedoColor = color3;
          mesh.material = material;
        }
        // Handle StandardMaterial or no material
        else {
          material = new BABYLON.StandardMaterial("mat", scene);
          material.diffuseColor = color3;
          mesh.material = material;
        }

        // Store metadata
        mesh.metadata = {
          ...mesh.metadata,
          color: color3.toHexString(),
        };

        setIsMenuOpen(false);
      });
    };

    const handleSelectTag = () => {
      if (!selectedItemName || !selectedItemName.name) {
        console.warn("No tag selected");
        return;
      }

      const tagName = taginfo.filename;
      //console.log(tagName);

      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      // 1. Find the parent mesh by tag name
      const parentMesh = scene.meshes?.find(
        (mesh) => mesh.name === tagName || mesh.metadata?.tagNo?.tag === tagName
      );
      //console.log(parentMesh);

      if (!parentMesh) {
        console.warn("Parent mesh not found for tag:", tagName);
        return;
      }

      // 2. Collect all child meshes (if any)
      const meshesToSelect = [parentMesh, ...parentMesh.getChildMeshes()];
      //console.log(meshesToSelect);

      // 3. Clear previous highlights
      dehighlightMesh();
      // selectedMeshRef.current = parentMesh;
      highlightMesh(meshesToSelect);
    };

    const handleDeselect = () => {
      // Clear selected meshes
      dehighlightMesh();
      selectedMeshRef.current = [];
      setBackgroundColorTag({});
      setIsMenuOpen(false);
      setselectedItem(false);
      setActiveButton(null);
    };

    const handleZoomSelected = () => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      const selectedMeshes = selectedMeshRef.current;

      // Filter out any non-mesh objects
      const validMeshes = selectedMeshes?.filter(
        (mesh) => mesh && typeof mesh.getBoundingInfo === "function"
      );

      if (!validMeshes || validMeshes.length === 0) {
        setCustomAlert(true);
        setModalMessage("Please select a valid object..");
        setIsMenuOpen(false);
        return;
      }

      zoomOnSelectedMesh(scene, validMeshes);
      setIsMenuOpen(false);
    };

    const handleAddComment = () => {
      // Implement logic to add a comment
      setIsCommentOpen(true);
      setIsMenuOpen(false);
    };

    const handleCloseComment = () => {
      setIsCommentOpen(false);
    };

    const handleShowlineEqpInfo = () => {
      if (taginfo.filename) {
        setLineEqpInfo(true);
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      } else {
        setCustomAlert(true);
        setModalMessage("No Info availible, please select item!!!!");
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      }
    };

    const handleShowFileInfo = () => {
      if (taginfo.filename) {
        setShowFileInfo(true);
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      } else {
        setModalMessage("No Info availible, please select item!!!!");
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      }
    };

    const handleTagInfo = () => {
      if (taginfo.filename) {
        setTagInfoVisible(true);
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      } else {
        setCustomAlert(true);
        setModalMessage("No Info availible, please select item!!!!");
        setIsCommentOpen(false);
        setIsMenuOpen(false);
      }
    };

    const hideSelectedItem = () => {
      const selectedMeshes = selectedMeshRef.current;
      if (Array.isArray(selectedMeshes)) {
        selectedMeshes?.forEach((mesh) => {
          if (mesh) mesh.setEnabled(false);
        });
      }
    };

    const hideUnselectedItems = () => {
      const scene = sceneRef.current;
      const selectedMeshes = selectedMeshRef.current;
      if (!scene || !selectedMeshes) return;

      scene.meshes?.forEach((mesh) => {
        const isProtected =
          mesh.name.includes("skyBox") ||
          mesh.name.includes("ground") ||
          mesh.name.includes("water") ||
          mesh.name.includes("__root__");

        const isSelected = selectedMeshes.includes(mesh);
        if (!isSelected && !isProtected) {
          mesh.setEnabled(false);
        }
      });
    };

    const hideAllItems = () => {
      const scene = sceneRef.current;
      if (!scene) return;

      scene.meshes?.forEach((mesh) => {
        if (
          !mesh.name.includes("skyBox") &&
          !mesh.name.includes("ground") &&
          !mesh.name.includes("water")
        ) {
          mesh.setEnabled(false);
        }
      });
    };

    const unhideAllItems = () => {
      const scene = sceneRef.current;
      if (!scene) return;

      scene.meshes?.forEach((mesh) => {
        mesh.setEnabled(true);
      });
    };

    const handleReload = () => {
      // Handle reload logic here
      setReload(!reload);
      setselectedItem(false);
      setViewMode("Top View");
      setShowMeasure(false);
      setActiveButton("");
      setShowComment(false);
      setBackgroundTheme("DEFAULT");
      setBackgroundColorTag({});
      setViewHideThree({});
      setViewHideThreeunassigned({});
      setIsMenuOpen(false);
    };

    const menuOptions = [
      { label: taginfo.filename ? `${taginfo.filename}` : "" },
      { label: selectedItemName ? `${selectedItemName.name}` : "" },
      { label: "Add Comment", action: handleAddComment },
      {
        label: "Info",
        children: [
          { label: "Tag info", action: handleShowlineEqpInfo },
          { label: "Tag GenInfo", action: handleTagInfo },
          { label: "File Info", action: handleShowFileInfo },
        ],
      },
      { label: "Change Color", action: handleColorChange },
      { label: "Deselect", action: handleDeselect },
      { label: "Select tag", action: handleSelectTag },
      {
        label: "Visibility",
        children: [
          { label: "Hide all", action: hideAllItems },
          { label: "Unhide all", action: unhideAllItems },
          { label: "Hide selected", action: hideSelectedItem },
          { label: "Hide unselected", action: hideUnselectedItems },
        ],
      },
      { label: "Zoom selected", action: handleZoomSelected },
      { label: "Focus Selected", action: handleFocusSelected },
      // { label: "Reload", action: handleReload },
    ];

    const disposeScene = () => {
      if (sceneRef.current) {
        sceneRef.current.dispose(); // Disposes all scene elements and frees memory
        sceneRef.current = null;
      }
    };

    const createScene = (engine, canvas) => {
      disposeScene();
      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color3(0.95, 0.95, 0.95);
      scene.useRightHandedSystem = true;

      // Create initial camera
      camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 4,
        Math.PI / 3,
        1000,
        BABYLON.Vector3.Zero(),
        scene
      );

      camera.minZ = 0.1;
      camera.wheelDeltaPercentage = 0.01;
      camera.pinchDeltaPercentage = 0.01;
      camera.wheelPrecision = 50;
      camera.panningSensibility = 100;
      camera.angularSensibilityX = 500;
      camera.angularSensibilityY = 500;
      camera.alpha = Math.PI / 2;
      camera.beta = 0;

      // Enable camera controls
      camera.attachControl(canvasRef.current, true);

      // Additional camera behavior
      camera.useBouncingBehavior = true;
      camera.useAutoRotationBehavior = false;
      camera.panningAxis = new BABYLON.Vector3(1, 1, 0);
      camera.pinchToPanMaxDistance = 100;

      OrthoCamera = camera.clone("orbitOrtho");
      OrthoCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

      // Set orthographic bounds dynamically later based on bounding box or viewport
      OrthoCamera.orthoLeft = -500;
      OrthoCamera.orthoRight = 500;
      OrthoCamera.orthoTop = 500;
      OrthoCamera.orthoBottom = -500;

      // Setup lighting
      setupLighting(scene, camera);
      return scene;
    };

    const highlightTagInScene = (file) => {
      const filename = file.slice(0, file.lastIndexOf("."));
      //console.log(filename);
      if (!sceneRef.current) return;

      const meshesToHighlight = [];
      let min = null;
      let max = null;

      let foundTagNo = null; // For extracting tag info

      sceneRef.current.meshes?.forEach((mesh) => {
        ////console.log(mesh.metadata)
        if (mesh.name.includes("__root__") || mesh.name.includes("sky")) return;

        if (mesh.metadata && mesh.metadata.tagNo.tag === filename) {
          //console.log("sdgsd");

          meshesToHighlight.push(mesh);

          // Highlight logic
          if (!mesh.metadata.isHighlighted) {
            const yellowColor = new BABYLON.Color3(1, 1, 0);
            if (mesh.material) {
              if (mesh.material.emissiveColor) {
                mesh.material.emissiveColor = yellowColor;
              } else if (mesh.material.diffuseColor) {
                mesh.material.diffuseColor = yellowColor;
              }
            }
            mesh.metadata.isHighlighted = true;
          }

          // Bounding box
          const boundingBox = mesh.getBoundingInfo().boundingBox;
          const meshMin = boundingBox.minimumWorld;
          const meshMax = boundingBox.maximumWorld;

          if (!min || !max) {
            min = meshMin.clone();
            max = meshMax.clone();
          } else {
            min = BABYLON.Vector3.Minimize(min, meshMin);
            max = BABYLON.Vector3.Maximize(max, meshMax);
          }

          // ✅ Save tagNo for info extraction
          if (!foundTagNo && mesh.metadata?.tagNo) {
            foundTagNo = mesh.metadata.tagNo;
          }
        }
      });

      // ✅ Set selectedMeshRef
      if (meshesToHighlight.length > 0) {
        selectedMeshRef.current = meshesToHighlight;
      }

      // ✅ Set camera
      if (meshesToHighlight.length > 0 && min && max) {
        const center = min.add(max).scale(0.5);
        const size = max.subtract(min);
        const distance = Math.max(size.x, size.y, size.z) * 2;
        const offset = distance / Math.sqrt(3);

        const cam = sceneRef.current.activeCamera;
        if (cam) {
          cam.position = new BABYLON.Vector3(
            center.x + offset,
            center.y + offset,
            center.z + distance
          );
          cam.setTarget(center);
          //console.log(
          //   `Camera positioned on highlighted tag group: ${filename}`
          // );
        } else {
          console.warn("No active camera found.");
        }
      }

      // ✅ Set additional info
      if (foundTagNo) {
        setFileInfoDetails(foundTagNo.fileDetails);

        const tagid = foundTagNo.tag;
        const linelistDetails = allLineList?.find((line) => line.tag === tagid);
        const equipmentlistDetails = allEquipementList?.find(
          (equipment) => equipment.tag === tagid
        );
        const UsertagInfoDetails = userTagInfotable?.find(
          (tag) => tag.tag === tagid
        );

        const userDefinedDisplay = new Map();

        if (UsertagInfoDetails) {
          generalTagInfoFields?.forEach(({ id, field, unit }) => {
            const taginfoKey = `taginfo${id}`;
            const value = UsertagInfoDetails[taginfoKey];
            userDefinedDisplay.set(`${field} (${unit})`, value);
          });
        }

        settaginfo({
          filename: tagid,
          meshname: meshesToHighlight[0]?.name || "",
          linelistDetails: linelistDetails || null,
          equipmentlistDetails: equipmentlistDetails || null,
          UsertagInfoDetails: Object.fromEntries(userDefinedDisplay),
          originalUsertagInfoDetails: UsertagInfoDetails || null,
        });
      }
    };
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !sceneRef.current) return;

      const handleRightClick = (event) => {
        event.preventDefault(); // Prevent the default context menu

        if (highlightedTagKey) {
          showContextMenu(event.clientX, event.clientY, null);
        } else {
          setIsMenuOpen(false);
        }
      };

      canvas.addEventListener("contextmenu", handleRightClick);
      return () => canvas.removeEventListener("contextmenu", handleRightClick);
    }, [highlightedTagKey]);

    const removeHighlightForTag = (filename) => {
      if (!sceneRef.current) return;

      sceneRef.current.meshes?.forEach((mesh) => {
        if (mesh.metadata?.tag === filename && mesh.metadata.isHighlighted) {
          if (mesh.material) {
            if (mesh.material.emissiveColor) {
              mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0); // Reset
            } else if (mesh.material.diffuseColor) {
              mesh.material.diffuseColor = new BABYLON.Color3(1, 1, 1); // Reset to white
            }
          }
          mesh.metadata.isHighlighted = false;
        }
      });
    };

    // Updated highlightMesh function with toggle behavior
    const highlightMesh = (meshes) => {
      // Initialize highlight layer if not exists
      if (!selectionHighlightLayerRef.current && sceneRef.current) {
        selectionHighlightLayerRef.current = new BABYLON.HighlightLayer(
          "selectionHighlight",
          sceneRef.current
        );
      }

      const highlightLayer = selectionHighlightLayerRef.current;

      if (!highlightLayer) {
        console.error("No highlight layer available!");
        return;
      }

      // Normalize input to array
      const meshArray = Array.isArray(meshes) ? meshes : [meshes];

      // Check if we're selecting the same mesh that's already selected
      const isSameMesh =
        meshArray.length === 1 &&
        Array.isArray(selectedMeshRef.current) &&
        selectedMeshRef.current.length === 1 &&
        selectedMeshRef.current[0] &&
        (selectedMeshRef.current[0].uniqueId === meshArray[0].uniqueId ||
          selectedMeshRef.current[0].id === meshArray[0].id);

      // If same mesh selected again, just dehighlight it
      if (isSameMesh) {
        dehighlightMesh();
        return;
      }

      // Otherwise, dehighlight current and highlight new mesh
      dehighlightMesh();

      // Add new meshes to highlight layer
      meshArray?.forEach((mesh) => {
        if (mesh) {
          highlightLayer.addMesh(mesh, new BABYLON.Color3(1, 1, 0));
        }
      });

      // Update references
      selectedMeshRef.current = meshArray;
      setSelectedMeshId(
        meshArray[0]?.uniqueId || meshArray[0]?.id || Date.now()
      );
    };

    // The dehighlightMesh function remains the same
    const dehighlightMesh = () => {
      const highlightLayer = selectionHighlightLayerRef.current;

      if (!highlightLayer) {
        console.error("No highlight layer available!");
        return;
      }

      // Always assume it's an array
      const meshes = Array.isArray(selectedMeshRef.current)
        ? selectedMeshRef.current
        : [selectedMeshRef.current];
      //console.log(meshes);

      meshes?.forEach((mesh) => {
        if (mesh) {
          //console.log(mesh);
          highlightLayer.removeMesh(mesh);
        }
      });

      // Clear the reference
      selectedMeshRef.current = [];

      // Clear selected mesh ID
      setSelectedMeshId(null);
    };

    const loadFilesSequentially = async (scene, tags) => {
      const allLoadedMeshes = [];
      setIsLoading(true);
      setLoadingProgress(0);

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const { filePath, filename, tag: tagName } = tag;
        //console.log("tagdata");

        try {
          await new Promise((resolve) => {
            loadModelFromFilePath(
              scene,
              filePath,
              tagName || filename,
              tag,
              (meshes) => {
                if (Array.isArray(meshes)) {
                  allLoadedMeshes.push(...meshes);
                } else if (meshes) {
                  allLoadedMeshes.push(meshes);
                }

                resolve(); // only resolve once model is completely processed
              },
              (error) => {
                console.error(`Error loading model: ${filename}`, error);
                resolve(); // resolve anyway to continue
              }
            );
          });

          // Move this outside the Promise to ensure it's called *after* the model is fully processed
          const progress = Math.round(((i + 1) / tags.length) * 100);
          setLoadingProgress(progress);
        } catch (error) {
          console.error(`Error in loading process for ${filename}:`, error);
        }
      }

      loadedMeshesRef.current = [
        ...(loadedMeshesRef.current || []),
        ...allLoadedMeshes,
      ];

      // Add a Promise to ensure the scene is fully rendered after camera updates
      await new Promise((resolve) => {
        updateCameraAndControls(allLoadedMeshes);

        // Give the scene one more render cycle to complete
        scene.executeWhenReady(() => {
          // Additional delay to ensure all rendering is complete
          setTimeout(resolve, 100);
        });
      });

      // Now hide the progress bar when everything is truly done
      setIsLoading(false);
      setLoadingProgress(0);
    };

    const toggleFileVisibility = (file, isVisible) => {
      const filename = file.slice(0, file.lastIndexOf("."));
      //console.log(filename);

      if (sceneRef.current) {
        // Iterate through all meshes in the scene
        sceneRef.current.meshes?.forEach((mesh) => {
          // Check if the mesh has metadata and the tag matches
          const meta = mesh.metadata;
          const match =
            meta?.tag === filename ||
            meta?.tagNo?.tag === filename ||
            meta?.tagNo?.filename === file;

          if (match) {
            mesh.setEnabled(isVisible);
            mesh.isVisible = isVisible; // In Babylon.js, we use setEnabled instead of visible
          }
        });
      }
    };

    // This function will load 3D models based on file paths
    const loadModelFromFilePath = (
      scene,
      filePath,
      tag,
      tagName,
      onSuccess,
      onError
    ) => {
      // Extract file extension to determine loader type
      const fileExtension = filePath.split(".").pop().toLowerCase();

      try {
        // IMPORTANT: The ImportMeshAsync function returns a Promise,
        // but we're using the callback pattern here to match your existing code
        switch (fileExtension) {
          case "glb":
          case "gltf":
            scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3); // Add ambient light

            // // Enable anti-aliasing for sharper edges
            // scene.getEngine().setHardwareScalingLevel(1.0);

            const rootUrl = filePath;
            //console.log(rootUrl);

            const fileName = filePath;

            BABYLON.SceneLoader.ImportMeshAsync(
              "",
              "",
              rootUrl,

              scene
            ).then(
              (result) => {
                const meshes = result.meshes;
                const newMeshes = result.meshes?.filter(
                  (mesh) =>
                    mesh.name !== "__root__" && mesh.isVisible && mesh.geometry
                );

                // Set metadata on all meshes
                meshes?.forEach((mesh) => {
                  if (!mesh.metadata) mesh.metadata = {};
                  mesh.metadata.tag = fileName;
                  mesh.metadata.tagNo = tagName;
                  mesh.metadata.filePath = filePath;
                  mesh.metadata.isHighlighted = false;
                  mesh.isPickable = true;

                  // Add action manager for click events to toggle visibility
                  if (!mesh.actionManager) {
                    mesh.actionManager = new BABYLON.ActionManager(scene);
                  }

                  // Add click event handler using the ActionManager
                  mesh.actionManager.registerAction(
                    new BABYLON.ExecuteCodeAction(
                      BABYLON.ActionManager.OnPickTrigger,
                      (evt) => {
                        // Get current visibility state (from your state management)
                        const isCurrentlyVisible =
                          objectVisibilityRef.current[tag] !== undefined
                            ? objectVisibilityRef.current[tag]
                            : true;

                        // Toggle visibility (opposite of current state)
                        toggleFileVisibility(tag, !isCurrentlyVisible);
                        //console.log("isCurrentlyVisible", isCurrentlyVisible);

                        // Update your state management
                        objectVisibilityRef.current[tag] = !isCurrentlyVisible;
                      }
                    )
                  );
                });

                // Create a parent root node for all loaded meshes for easier manipulation
                if (meshes.length > 1) {
                  const rootNode = new BABYLON.TransformNode(
                    `root_${tag}`,
                    scene
                  );
                  meshes?.forEach((mesh) => {
                    if (mesh.parent === null) {
                      mesh.parent = rootNode;
                    }
                  });
                }

                // Apply initial visibility state
                const isVisible =
                  objectVisibilityRef.current[tag] !== undefined
                    ? objectVisibilityRef.current[tag]
                    : true;
                //console.log("isVisible", isVisible);

                toggleFileVisibility(tag, isVisible);
                // recalculateCumulativeBoundingBox();

                // // Update camera and controls to focus on the new model
                // updateCameraAndControls(meshes);

                // Recalculate scene bounds
                // recalculateCumulativeBoundingBox();
                //console.log("objectVisibilityRef", objectVisibilityRef.current);

                meshes?.forEach((mesh) => {
                  if (mesh.name === "__root__") return; // Skip root nodes

                  const material = mesh.material;

                  if (material) {
                    materialRef.current = material;
                    // StandardMaterial adjustments
                    // For StandardMaterial
                    if (material instanceof BABYLON.StandardMaterial) {
                      material.specularColor = new BABYLON.Color3(
                        0.3,
                        0.3,
                        0.3
                      ); // Add some shininess
                      material.specularPower = 32; // Add specular highlight
                      material.reflectionTexture = scene.environmentTexture;
                    }

                    // For PBRMaterial
                    if (material instanceof BABYLON.PBRMaterial) {
                      material.metallic = 0.3; // Allow some metallic quality
                      material.roughness = 0.4; // Less roughness makes it shinier
                      material.environmentIntensity = 0.7; // Increase environment reflection
                      // Keep clear coat if it exists
                      if (material.clearCoat && material.clearCoat.isEnabled) {
                        material.clearCoat.intensity = 0.5;
                      }
                    }
                  }
                });

                if (onSuccess) onSuccess(meshes);
              },
              null,
              (scene, message) => {
                console.error(
                  `Failed to load ${fileExtension.toUpperCase()} model: ${filePath}`,
                  message
                );
                if (onError) onError(message);
              }
            );
            break;

          case "obj":
          case "stl":
          case "fbx":
          case "babylon":
            // Similar pattern for other file types
            BABYLON.SceneLoader.ImportMesh(
              "",
              filePath.substring(0, filePath.lastIndexOf("/") + 1),
              filePath.substring(filePath.lastIndexOf("/") + 1),
              scene,
              (meshes) => {
                // Set metadata on all meshes
                meshes?.forEach((mesh) => {
                  if (!mesh.metadata) mesh.metadata = {};
                  mesh.metadata.tag = tag;
                  mesh.metadata.filePath = filePath;
                  mesh.metadata.isHighlighted = false;
                  mesh.isPickable = true;

                  // Add action manager for click events to toggle visibility
                  if (!mesh.actionManager) {
                    mesh.actionManager = new BABYLON.ActionManager(scene);
                  }

                  // Add click event handler using the ActionManager
                  mesh.actionManager.registerAction(
                    new BABYLON.ExecuteCodeAction(
                      BABYLON.ActionManager.OnPickTrigger,
                      (evt) => {
                        // Get current visibility state
                        const isCurrentlyVisible =
                          objectVisibilityRef.current[tag] !== undefined
                            ? objectVisibilityRef.current[tag]
                            : true;

                        // Toggle visibility (opposite of current state)
                        toggleFileVisibility(tag, !isCurrentlyVisible);

                        // Update your state management
                        objectVisibilityRef.current[tag] = !isCurrentlyVisible;
                      }
                    )
                  );
                });

                // Create a parent root node for all loaded meshes for easier manipulation
                if (meshes.length > 1) {
                  const rootNode = new BABYLON.TransformNode(
                    `root_${tag}`,
                    scene
                  );
                  meshes?.forEach((mesh) => {
                    if (mesh.parent === null) {
                      mesh.parent = rootNode;
                    }
                  });
                }

                // Apply initial visibility state
                const isVisible =
                  objectVisibilityRef.current[tag] !== undefined
                    ? objectVisibilityRef.current[tag]
                    : true;
                toggleFileVisibility(tag, isVisible);

                // Update camera and controls
                updateCameraAndControls(meshes);

                if (onSuccess) onSuccess(meshes);
              },
              null,
              (scene, message) => {
                console.error(
                  `Failed to load ${fileExtension.toUpperCase()} model: ${filePath}`,
                  message
                );
                if (onError) onError(message);
              }
            );
            break;

          default:
            console.warn(
              `Unsupported file extension: ${fileExtension} for file: ${filePath}`
            );
            if (onError)
              onError(`Unsupported file extension: ${fileExtension}`);
            break;
        }
      } catch (error) {
        console.error(`Error loading model from ${filePath}:`, error);
        if (onError) onError(error.toString());
      }
    };

    const saveWaterSettings = () => {
      setItemToDelete({ type: "save-water-settings" }); // You can identify it later
      setConfirmMessage("Are you sure you want to save the water settings?");
      setShowConfirm(true);
    };

    const saveGroundSettings = () => {
      setItemToDelete({ type: "save-ground-settings" });
      setConfirmMessage("Are you sure you want to save the ground settings?");
      setShowConfirm(true);
    };

    const saveBaseSettings = () => {
      setItemToDelete({ type: "save-base-settings" });
      setConfirmMessage("Are you sure you want to save the settings?");
      setShowConfirm(true);
    };

    const handleCancelDelete = () => {
      setShowConfirm(false);
      setItemToDelete(null);
    };

    const handleConfirm = () => {
      if (
        itemToDelete?.type === "save-water-settings" &&
        waterMeshRef.current
      ) {
        const {
          level,
          opacity,
          color,
          colorBlendFactor,
          bumpHeight,
          waveLength,
          windForce,
        } = waterFormValues;

        const waterSettings = {
          projectId: currentProjectId,
          level,
          opacity: opacity / 100,
          color,
          colorBlendFactor,
          bumpHeight: parseFloat(bumpHeight),
          waveLength: parseFloat(waveLength),
          windForce: parseInt(windForce),
        };

        window.api.send("save-water-settings", waterSettings);
        setWaterSettingParameter({ ...waterSettings });
        setModalMessage("Water settings saved successfully!");
        setCustomAlert(true);
      }

      if (itemToDelete?.type === "save-ground-settings" && groundRef.current) {
        const { level, color, opacity } = groundFormValues;

        const groundSettings = {
          projectId: currentProjectId,
          level,
          color,
          opacity: opacity / 100,
        };

        window.api.send("save-ground-settings", groundSettings);
        setGroundSettingParameter({ ...groundSettings });
        setModalMessage("Ground settings saved successfully!");
        setCustomAlert(true);
      }

      if (itemToDelete?.type === "save-base-settings") {
        const settingsToSave = {
          projectId: currentProjectId,
          camera: {
            fov,
            nearClip,
            farClip,
            angularSensibility,
            wheelSensibility,
            cameraSpeed,
            inertia,
          },
          light: {
            intensity: lightIntensity,
            color: lightColor,
            specularColor,
            shadowsEnabled: lightShadowsEnabled,
          },
          material: {
            metallic,
            roughness,
            reflectionIntensity,
          },
          measure: {
            unit,
            scaleValue,
          },
        };
        //console.log("settingsToSave", settingsToSave);
        window.api.send("save-base-setting", settingsToSave);
      }

      // Close the confirmation modal and reset state
      setShowConfirm(false);
      setItemToDelete(null);
    };

    // Function to reset ground settings
    const resetGroundSettings = () => {
      // Reset form state to last saved settings
      if (groundSettingParameter) {
        setGroundFormValues({
          level: groundSettingParameter.level ?? 0,
          color: groundSettingParameter.color ?? "#cccccc",
          opacity:
            groundSettingParameter.opacity != null
              ? groundSettingParameter.opacity * 100
              : 100,
        });

        // Also apply to the actual 3D ground object
        if (groundRef.current) {
          // Level
          if (modelInfoRef.current?.boundingBoxMin) {
            const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
            groundRef.current.position.y = baseY + groundSettingParameter.level;
          }

          // Color
          if (groundRef.current.material) {
            const color = BABYLON.Color3.FromHexString(
              groundSettingParameter.color
            );
            groundRef.current.material.diffuseColor = color;
          }

          // Opacity
          if (groundRef.current.material) {
            groundRef.current.material.alpha = groundSettingParameter.opacity;
          }
        }
      }
    };

    // Function to reset ground settings
    const resetWaterSettings = () => {
      const {
        level,
        color,
        opacity,
        windForce,
        waveLength,
        bumpHeight,
        colorBlendFactor,
      } = waterSettingParameter || {};

      // //console.log("Resetting to:", {
      //   level,
      //   color,
      //   opacity,
      //   windForce,
      //   waveLength,
      //   bumpHeight,
      //   colorBlendFactor,
      // });

      // Update the form state
      setWaterFormValues({
        level,
        color,
        opacity: opacity * 100, // Convert from decimal to percentage
        windForce,
        waveLength,
        bumpHeight,
        colorBlendFactor,
      });

      // Apply directly to the water mesh
      if (waterMeshRef.current && modelInfoRef.current?.boundingBoxMin) {
        const baseY = modelInfoRef.current.boundingBoxMin.y - 0.1;
        waterMeshRef.current.position.y = baseY + level;

        if (waterMeshRef.current.material) {
          waterMeshRef.current.material.waterColor =
            BABYLON.Color3.FromHexString(color);
          waterMeshRef.current.material.alpha = opacity;
          waterMeshRef.current.material.windForce = windForce;
          waterMeshRef.current.material.waveHeight = waveLength;
          waterMeshRef.current.material.bumpHeight = bumpHeight;
          waterMeshRef.current.material.colorBlendFactor = colorBlendFactor;
        }
      }
    };

    const handleCloseWatGroSetting = () => {
      setWaterSettingsVisible(false);
      setGroundSettingsVisible(false);
    };

    // Helper function to update camera and controls
    const updateCameraAndControls = (meshesOrObject) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      let boundingInfo;
      if (Array.isArray(meshesOrObject)) {
        // For Babylon.js meshes array
        if (meshesOrObject.length === 0) return;

        // Create a bounding info from all meshes
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        meshesOrObject?.forEach((mesh) => {
          if (mesh.getBoundingInfo && mesh.name !== "__root__") {
            const meshBoundingInfo = mesh.getBoundingInfo();
            const meshMin = meshBoundingInfo.boundingBox.minimumWorld;
            const meshMax = meshBoundingInfo.boundingBox.maximumWorld;

            min = BABYLON.Vector3.Minimize(min, meshMin);
            max = BABYLON.Vector3.Maximize(max, meshMax);
          }
        });

        boundingInfo = { min, max };
      } else {
        // For a single mesh or object
        if (meshesOrObject.getBoundingInfo) {
          boundingInfo = meshesOrObject.getBoundingInfo();
        } else {
          return;
        }
      }

      // Calculate center and radius for camera positioning
      const center = new BABYLON.Vector3(
        (boundingInfo.min.x + boundingInfo.max.x) / 2,
        (boundingInfo.min.y + boundingInfo.max.y) / 2,
        (boundingInfo.min.z + boundingInfo.max.z) / 2
      );

      const radius =
        BABYLON.Vector3.Distance(boundingInfo.min, boundingInfo.max) / 2;
      const size = boundingInfo.max.subtract(boundingInfo.min);
      const maxDimension = Math.max(size.x, size.y, size.z);

      // Calculate distance needed to fit bounding box into view
      const fovRadians = scene.activeCamera.fov || Math.PI / 4;
      const distanceToFit = maxDimension / Math.tan(fovRadians / 2);

      // Store model information globally
      modelInfoRef.current = {
        boundingBoxMin: boundingInfo.min.clone(),
        boundingBoxMax: boundingInfo.max.clone(),
        boundingBoxCenter: center.clone(),
        modelRadius: distanceToFit,
      };

      // // Set common camera properties
      scene.activeCamera.minZ = 0.001;
      scene.activeCamera.maxZ = distanceToFit * 100;

      // Handle different camera types
      if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
        // For orbit camera
        scene.activeCamera.setTarget(center);
        scene.activeCamera.radius = distanceToFit;
        scene.activeCamera.alpha = Math.PI / 2;
        scene.activeCamera.beta = 0;
        scene.activeCamera.wheelPrecision = 50;
      } else if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        // For fly camera - position for top view
        const direction = new BABYLON.Vector3(0, -1, 0); // Looking down from above
        const position = center.add(direction.scale(-distanceToFit)); // Negative scale to move upward
        scene.activeCamera.position = position;
        scene.activeCamera.setTarget(center);
      }
    };

    // Switch to orbit camera
    const switchToOrbitCamera = (orthoviewmode) => {
      if (!sceneRef.current) return;

      setSpeedControlVisible(false);

      const scene = sceneRef.current;

      // Store current camera position and target
      // Store current camera position and target
      const cameraPosition = scene.activeCamera.position.clone();
      //console.log("Current camera position:", cameraPosition.toString());

      // Create a temporary camera to maintain our position
      const oldCamera = scene.activeCamera;
      const forward = scene.activeCamera.getForwardRay().direction.normalize();

      const distance = modelInfoRef.current.modelRadius * 0.1;
      const targetPosition = cameraPosition.add(forward.scale(distance));
      let cameraTarget;

      if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        // const ray = scene.activeCamera.getForwardRay();
        // cameraTarget = ray.origin.add(ray.direction.scale(10)); // Adjust the 10 for "how far" you want to orbit around
        cameraTarget = targetPosition;
      } else {
        cameraTarget = scene.activeCamera.getTarget();
      }

      // Calculate distance from camera to target for radius
      const radius = BABYLON.Vector3.Distance(cameraPosition, cameraTarget);

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

      camera.mode =
        orthoviewmode === "orthographic"
          ? BABYLON.Camera.ORTHOGRAPHIC_CAMERA
          : BABYLON.Camera.PERSPECTIVE_CAMERA;

      if (orthoviewmode === "orthographic") {
        // Dynamically calculate ortho size from bounding box
        const boundingMax = modelInfoRef.current.boundingBoxMax;
        const boundingMin = modelInfoRef.current.boundingBoxMin;
        const maxDimension = Math.max(
          boundingMax.x - boundingMin.x,
          boundingMax.y - boundingMin.y,
          boundingMax.z - boundingMin.z
        );
        const orthoSize = maxDimension; // Adjust multiplier as needed

        camera.orthoLeft = -orthoSize;
        camera.orthoRight = orthoSize;
        camera.orthoTop = orthoSize;
        camera.orthoBottom = -orthoSize;

        // Match ortho bounds with aspect ratio
        const aspect = canvasRef.current.width / canvasRef.current.height;
        camera.orthoTop = orthoSize;
        camera.orthoBottom = -orthoSize;
        camera.orthoLeft = -orthoSize * aspect;
        camera.orthoRight = orthoSize * aspect;
      }
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
      camera.minZ = 0.001;
      camera.maxZ = modelInfoRef.current.modelRadius * 100;

      // Now dispose of the old camera
      oldCamera.dispose();

      // Attach control to canvas
      camera.attachControl(canvasRef.current, true);
      scene.activeCamera = camera;

      // Manually refresh the skybox position if it exists
      if (skyboxRef.current) {
        // For the skybox, we need it to follow the camera position
        if (scene.activeCamera.position) {
          skyboxRef.current.position = scene.activeCamera.position.clone();
        }
      }
      // IMPORTANT: Remove crosshair cursor from canvas
      if (canvasRef.current) {
        canvasRef.current.classList.remove("cursor-crosshair");
        canvasRef.current.classList.add("cursor-default");
      }
    };

    // // Switch to fly camera
    const switchToFlyCamera = () => {
      if (!sceneRef.current) return;

      setSpeedControlVisible(true);

      const scene = sceneRef.current;

      // Store current camera position and target
      const cameraPosition = scene.activeCamera.position.clone();
      let cameraTarget;
      cameraTarget = scene.activeCamera.getTarget();

      // Remove old camera
      scene.activeCamera.dispose();

      // Create new Free camera
      const camera = new BABYLON.UniversalCamera(
        "UniversalCamera",
        cameraPosition,
        scene
      );
      // Ensure we're looking at the right target
      camera.setTarget(cameraTarget);

      const mouseInput = new FreeCameraMouseInput(camera);

      // Set default sensitivity
      mouseInput.angularSensibility = 2000.0;
      camera.speed = cameraSpeed * multiplier;
      camera.pivotFactor = modelInfoRef.current.modelRadius;

      camera.inertia = 0.5; // Reduced inertia for more responsive control
      camera.minZ = 0.001;
      camera.maxZ = modelInfoRef.current.modelRadius * 100;
      // Apply dynamic sensitivity if models are loaded
      if (loadedMeshesRef.current.length > 0) {
        // First attach the input
        camera.inputs.clear();
        camera.inputs.add(mouseInput);

        // Then adjust sensitivity
        // adjustCameraSensitivity(loadedMeshesRef.current, camera);
      } else {
        camera.inputs.clear();
        camera.inputs.add(mouseInput);
      }
      // Add keyboard control for WASD movement
      const keysInput = new BABYLON.FreeCameraKeyboardMoveInput();
      camera.inputs.add(keysInput);

      camera.attachControl(canvasRef.current, true);
      scene.activeCamera = camera;

      // Re-add observer for visibility updates
      camera.onViewMatrixChangedObservable.add(() => {
        // If skybox exists, ensure it follows the camera in fly mode
        if (skyboxRef.current) {
          skyboxRef.current.position = camera.position.clone();
        }
      });

      // If background has skybox, refresh it to ensure it's compatible with the new camera
      // if (backgroundTheme !== "DEFAULT" && backgroundTheme !== "WHITE") {
      //   applyBackgroundTheme(backgroundTheme);
      // }

      // IMPORTANT: Apply crosshair cursor to canvas
      if (canvasRef.current) {
        canvasRef.current.classList.remove("cursor-default");
        canvasRef.current.classList.add("cursor-crosshair");
      }
    };

    // Apply view (top, front, side etc.)
    const applyView = (viewName) => {
      if (!sceneRef.current) return;

      const scene = sceneRef.current;
      const activeCamera = scene.activeCamera;

      // Step 1: Filter out unwanted meshes
      const includedMeshes = scene.meshes?.filter(
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

      includedMeshes?.forEach((mesh) => {
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

      // If in fly camera mode (UniversalCamera)
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

    const updateCameraSpeed = (speed) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      const actualSpeed = speed * multiplier;

      if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        scene.activeCamera.speed = actualSpeed;
      }

      setCameraSpeed(speed); // Store only slider value
    };

    const updateMultiplier = (value) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      const validValue = isNaN(value) || value <= 0 ? 1 : value;
      const actualSpeed = cameraSpeed * validValue;

      if (scene.activeCamera instanceof BABYLON.UniversalCamera) {
        scene.activeCamera.speed = actualSpeed;
      }

      setMultiplier(validValue); // Store only multiplier
    };

    const handleSaveView = () => {
      if (!saveViewName.trim()) {
        setCustomAlert(true);
        setModalMessage("Please enter a view name");
        return;
      }

      // Check if a view with the same name already exists
      const viewExists = allViews.some(
        (view) => view.name === saveViewName.trim()
      );
      if (viewExists) {
        setCustomAlert(true);
        setModalMessage("A view with this name already exists");
        return;
      }

      // Get current camera data
      if (!sceneRef.current || !sceneRef.current.activeCamera) {
        setCustomAlert(true);
        setModalMessage("Cannot save view - camera not initialized");
        return;
      }

      const camera = sceneRef.current.activeCamera;

      const viewData = {
        name: saveViewName.trim(),
        posX: camera.position.x,
        posY: camera.position.y,
        posZ: camera.position.z,
        targX:
          camera instanceof BABYLON.ArcRotateCamera
            ? camera.target.x
            : camera.getTarget().x,
        targY:
          camera instanceof BABYLON.ArcRotateCamera
            ? camera.target.y
            : camera.getTarget().y,
        targZ:
          camera instanceof BABYLON.ArcRotateCamera
            ? camera.target.z
            : camera.getTarget().z,
        // Store additional camera properties if needed
        cameraType: camera instanceof BABYLON.ArcRotateCamera ? "arc" : "free",
        // For ArcRotate camera, store specific properties
        ...(camera instanceof BABYLON.ArcRotateCamera && {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
        }),
      };

      // Send the view data to be saved
      window.api.send("save-camera-view", viewData);

      // Show success message
      setCustomAlert(true);
      setModalMessage(`View "${saveViewName}" saved successfully`);

      // Close dialog and reset name
      setSavedViewDialog(false);
      setSaveViewName("");

      // Hide message after a delay
      setTimeout(() => {
        setCustomAlert(false);
      }, 2000);
    };

    const handleCloseSavedView = () => {
      setSavedViewDialog(false);
      setSaveViewName("");
    };

    const applySavedView = (view) => {
      if (!view) return;
      setSaveViewMenu(view.name);

      // Check if the camera references exist
      if (!sceneRef.current || !sceneRef.current.activeCamera) return;

      const camera = sceneRef.current.activeCamera;
      try {
        // Create target position vector
        const targetPosition = new BABYLON.Vector3(
          view.posX,
          view.posY,
          view.posZ
        );

        // Create target point vector
        const targetPoint = new BABYLON.Vector3(
          view.targX,
          view.targY,
          view.targZ
        );

        // For ArcRotateCamera
        if (camera instanceof BABYLON.ArcRotateCamera) {
          // Set position and target directly without animation
          camera.position = targetPosition;
          camera.target = targetPoint;
        }
        // For UniversalCamera
        else if (camera instanceof BABYLON.UniversalCamera) {
          // Set position and target directly without animation
          camera.position = targetPosition;
          camera.setTarget(targetPoint);
        }
      } catch (error) {
        console.error("Error applying saved view:", error);
        setCustomAlert(true);
        setModalMessage("Error applying view");
      }
    };

    const handleShowMeasureDetails = () => {
      setShowMeasureDetails(!showMeasureDetails);
    };

    const formatMeasurement = (value) => {
      if (value === "" || isNaN(value)) return "";

      const numValue = parseFloat(value);
      let convertedValue = numValue;
      let unitLabel = "";

      switch (measureUnit) {
        case "mm":
          convertedValue = numValue * 1000;
          unitLabel = "mm";
          break;
        case "cm":
          convertedValue = numValue * 100;
          unitLabel = "cm";
          break;
        case "inch":
          convertedValue = numValue * 39.3701;
          unitLabel = "in";
          break;
        case "feet":
          convertedValue = numValue * 3.28084;
          unitLabel = "ft";
          break;
        case "custom":
          convertedValue = numValue * unitScaleFactor;
          unitLabel = customUnitLabel;
          break;
        default: // meters
          unitLabel = "m";
      }

      // Format with 2 decimal places
      return `${convertedValue.toFixed(2)} ${unitLabel}`;
    };

    const speedBar = mode === "fly" && (
      <div
        className="speed-bar"
        style={{
          position: "absolute",
          top: "75vh",
          left: 0,
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

    const handleclosesetting = () => {
      setsettingbox(false);
    };

    const handlecontrolsopen = () => {
      setShowControls(!showControls);
    };
    const handleWireFrame = () => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      // scene.meshes.forEach((mesh) => {
      //   if (
      //     mesh.material &&
      //     mesh.name !== "skyBox" &&
      //     mesh.name !== "waterMesh" &&
      //     mesh.name !== "ground"
      //   ) {
      //     mesh.material.wireframe = !mesh.material.wireframe;
      //   }
      // });
      scene.forceWireframe = !scene.forceWireframe;
      setShowWireFrame((prev) => !prev);
    };

    const handleResetSettings = () => {
      // === Reset State Variables ===
      setFov(45);
      setNearClip(0.1);
      setFarClip(1000);
      setInertia(0.4);
      setAngularSensibility(2000);
      setWheelSensibility(1);
      setMetallic(0.5);
      setRoughness(0.5);
      setIntensity(1.0);
      setSpecularColor("#ffffff");
      setReflectionIntensity(1.0);
      setLightColor("#ffffff");
      setLightIntensity(1.0);
      setUnit("m");
      setScaleValue(1);

      // === Reset 3D Camera ===
      const scene = sceneRef.current;
      const camera = scene?.activeCamera;
      if (camera) {
        camera.fov = BABYLON.Tools.ToRadians(45);
        camera.minZ = 0.1;
        camera.maxZ = 1000;
        camera.inertia = 0.4;
        camera.angularSensibility = 2000;
        camera.wheelPrecision = 1;
      }

      // === Reset Light ===
      if (lightRef.current) {
        lightRef.current.intensity = 1.0;
        lightRef.current.specular = BABYLON.Color3.FromHexString("#ffffff");
        lightRef.current.diffuse = BABYLON.Color3.FromHexString("#ffffff");
      }

      // === Reset Material Properties on Meshes ===
      if (scene) {
        scene.environmentIntensity = 1.0;

        scene.meshes?.forEach((mesh) => {
          const mat = mesh.material;
          if (!mat) return;

          if (mat instanceof BABYLON.PBRMaterial) {
            mat.metallic = 0.5;
            mat.roughness = 0.5;
            mat.environmentIntensity = 1.0;
          } else if (mat instanceof BABYLON.StandardMaterial) {
            mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            mat.specularPower = 64; // mid specular for metallic/roughness
          }
        });
      }

      // === Reset individual materialRef if used ===
      if (materialRef.current) {
        materialRef.current.metallic = 0.5;
        materialRef.current.roughness = 0.5;
      }
    };

    const handleCameraOpen = () =>
      setActiveSection((prev) => (prev === "camera" ? null : "camera"));

    const handleLightOpen = () =>
      setActiveSection((prev) => (prev === "light" ? null : "light"));

    const handleMaterialOpen = () =>
      setActiveSection((prev) => (prev === "material" ? null : "material"));

    const handleMeasureOpen = () =>
      setActiveSection((prev) => (prev === "measure" ? null : "measure"));

    const handleFovChange = (e) => setFov(Number(e.target.value));

    const handleMetallicChange = (e) => {
      const newMetallic = parseFloat(e.target.value);
      setMetallic(newMetallic);

      sceneRef.current?.meshes?.forEach((mesh) => {
        const mat = mesh.material;
        if (!mat) return;

        if (mat instanceof BABYLON.PBRMaterial) {
          mat.metallic = newMetallic;
        } else if (mat instanceof BABYLON.StandardMaterial) {
          // Simulate metallic by adjusting specularColor and specularPower
          mat.specularColor = new BABYLON.Color3(
            newMetallic,
            newMetallic,
            newMetallic
          );
          mat.specularPower = 64 * (1 - newMetallic); // 0 = rough, 1 = sharp
        }
      });
    };

    const handleRoughnessChange = (e) => {
      const newRoughness = parseFloat(e.target.value);
      setRoughness(newRoughness);

      sceneRef.current?.meshes?.forEach((mesh) => {
        const mat = mesh.material;
        if (!mat) return;

        if (mat instanceof BABYLON.PBRMaterial) {
          mat.roughness = newRoughness;
        } else if (mat instanceof BABYLON.StandardMaterial) {
          // Simulate roughness using specularPower (lower = rougher)
          mat.specularPower = 128 * (1 - newRoughness); // Clamp between 0–128
        }
      });
    };

    const handleReflectionIntensityChange = (e) => {
      const value = parseFloat(e.target.value);
      setReflectionIntensity(value);

      sceneRef.current?.meshes?.forEach((mesh) => {
        const mat = mesh.material;
        if (!mat) return;

        if (mat instanceof BABYLON.PBRMaterial) {
          mat.environmentIntensity = value; // Real PBR reflection control
        } else if (mat instanceof BABYLON.StandardMaterial) {
          // Simulate reflection intensity by adjusting specularPower and color
          mat.specularPower = Math.max(1, value * 128); // Reflectivity strength
          mat.specularColor = new BABYLON.Color3(value, value, value); // Reflective tint
        }
      });
    };

    const handleSpecularColorChange = (e) => {
      const hex = e.target.value;
      const color3 = BABYLON.Color3.FromHexString(hex);
      setSpecularColor(hex);
      // frontLight.specular = color3; // or any selected light
    };

    const handleLightIntensityChange = (e) =>
      setLightIntensity(Number(e.target.value));
    const handleLightColorChange = (e) => setLightColor(e.target.value);

    const [unit, setUnit] = useState("");
    const [scaleValue, setScaleValue] = useState(1);

    const handleUnitChange = (e) => {
      const newUnit = e.target.value;
      setUnit(e.target.value);
      setBaseFormValues((prevValues) => ({
        ...prevValues,
        measureUnit: newUnit,
      }));
    };

    const handleScaleChange = (e) => {
      const newScale = parseFloat(e.target.value) || 0;
      setScaleValue(newScale);
      setBaseFormValues((prevValues) => ({
        ...prevValues,
        customUnitFactor: newScale,
      }));
    };

    const handleNearClipChange = (e) => {
      const value = parseFloat(e.target.value);
      setNearClip(value);
      if (camera) camera.minZ = value;
    };

    const handleFarClipChange = (e) => {
      const value = parseFloat(e.target.value);
      setFarClip(value);
      if (camera) camera.maxZ = value;
    };

    const handleInertiaChange = (e) => {
      const value = parseFloat(e.target.value);
      setInertia(value);
      const camera = sceneRef.current.activeCamera;
      if (camera) camera.inertia = value;
    };
    const handleAngularSensibilityChange = (e) =>
      setAngularSensibility(Number(e.target.value));
    const handleWheelSensibilityChange = (e) =>
      setWheelSensibility(Number(e.target.value));
    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      const camera = scene.activeCamera;
      if (camera) {
        camera.fov = BABYLON.Tools.ToRadians(fov);
        camera.fovMode = BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
      }
    }, [fov]);

    return (
      <div className="d-flex">
        <div className="w-100">
          {/* 3D Canvas */}
          <canvas
            ref={canvasRef}
            id="renderCanvas"
            tabIndex="0"
            style={{
              overflow: "hidden",
              position: "absolute",
              zIndex: "0",
              width: "95%",
              height: "100%",
            }}
          />
          {/* progress bar */}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: "30%",
                left: "20%",
                width: "500px",
                height: "70px",
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

          {/* CAD Axis */}

          {showAxis && sceneRef.current && (
            <CADTopViewAxisIndicator scene={sceneRef.current} />
          )}

          {/* Speed bar */}
          {speedBar}
          {/* 
          {(enableClipping || enableBoxClipping) && (
  <div
    className="clipping-controls"
    style={{
      position: "absolute",
      top: "55vh",
      right: 0,
      zIndex: "100",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      padding: "10px",
      borderRadius: "8px",
      width: "220px",
      fontSize: "14px",
    }}
  >
    <div style={{ marginBottom: "15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <label style={{ fontWeight: "bold" }}>Clipping Mode:</label>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button 
          onClick={() => { 
            setEnableClipping(true); 
            setEnableBoxClipping(false); 
          }}
          style={{ 
            flex: 1, 
            padding: "5px", 
            backgroundColor: enableClipping ? "#4285f4" : "#e0e0e0",
            color: enableClipping ? "white" : "black",
            border: "none",
            borderRadius: "4px"
          }}
        >
          Plane
        </button>
        <button 
          onClick={() => { 
            setEnableBoxClipping(true); 
            setEnableClipping(false); 
          }}
          style={{ 
            flex: 1, 
            padding: "5px", 
            backgroundColor: enableBoxClipping ? "#4285f4" : "#e0e0e0",
            color: enableBoxClipping ? "white" : "black",
            border: "none",
            borderRadius: "4px"
          }}
        >
          Box
        </button>
      </div>
    </div>
    
    {enableClipping && (
      <>
        <label>Clipping Plane Axis:</label>
        <select
          value={clippingAxis}
          onChange={(e) => setClippingAxis(e.target.value)}
          style={{ width: "100%", marginBottom: "10px" }}
        >
          <option value="X">X - Negative</option>
          <option value="-X">X - Positive</option>
          <option value="Z">Z - Negative</option>
          <option value="-Z">Z - Positive</option>
          <option value="Y">Y - Negative</option>
          <option value="-Y">Y - Positive</option>
        </select>
        
        <div style={{ textAlign: "center", margin: "10px 0" }}>
          <span style={{ fontWeight: "bold" }}>Position: {clippingPosition.toFixed(0)}%</span>
        </div>
        
        <button
          onClick={() => setClippingPosition(50)}
          style={{ width: "100%", padding: "5px" }}
        >
          Reset Position
        </button>
      </>
    )}
    
    {enableBoxClipping && (
      <div style={{ textAlign: "center", margin: "10px 0" }}>
        <p>Use the gizmo handles to resize, rotate, and position the clipping box.</p>
        <button
          onClick={() => {
            // Reset box to default position and size
            if (clippingBoxMeshRef.current && modelInfoRef.current) {
              const { boundingBoxMin, boundingBoxMax } = modelInfoRef.current;
              const fullSize = boundingBoxMax.subtract(boundingBoxMin);
              const center = boundingBoxMin.add(fullSize.scale(0.5));
              
              clippingBoxMeshRef.current.position = center;
              clippingBoxMeshRef.current.scaling = fullSize.scale(0.75);
              clippingBoxMeshRef.current.rotationQuaternion = BABYLON.Quaternion.Identity();
              
              // Re-apply clipping with reset box
              applyCustomClipping(sceneRef.current, clippingBoxMeshRef.current);
            }
          }}
          style={{ width: "100%", padding: "5px" }}
        >
          Reset Box
        </button>
      </div>
    )}
    
    <button
      onClick={() => {
        setEnableClipping(false);
        setEnableBoxClipping(false);
      }}
      style={{ 
        width: "100%", 
        padding: "5px", 
        marginTop: "10px",
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        borderRadius: "4px"
      }}
    >
      Disable Clipping
    </button>
  </div>
)} */}

          {clippingSetting && (
            <div id="groundSettings" className="contextMenu">
              <div className="cm-content">
                <div className="row-narrow">
                  <label className="gray">Clipping Plane Axis</label>
                  <select
                    value={clippingAxis}
                    onChange={(e) => setClippingAxis(e.target.value)}
                    style={{ width: "100%", marginBottom: "10px" }}
                  >
                    <option value="X">Plane1(x-)</option>
                    <option value="-X">Plane2(x+)</option>
                    <option value="Z">Plane3(y-)</option>
                    <option value="-Z">Plane4(y+)</option>
                    <option value="Y">Plane5(z-)</option>
                    <option value="-Y">Plane6(z+)</option>
                  </select>
                </div>

                <div className="row-narrow">
                  <label className="gray">Clipping Position (%):</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clippingPosition}
                    onChange={handleClippingSliderChange}
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="row-narrow">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={clippingPosition}
                    onChange={handleClippingNumberChange}
                    style={{ width: "100%", marginTop: "5px" }}
                  />
                </div>

                <div className="row-narrow">
                  <i
                    className="fa-solid fa-rotate-right ms-4"
                    onClick={resetClippingPosition}
                    style={{ marginTop: "10px" }}
                  ></i>
                  <i
                    className="fa-solid fa-xmark ms-4"
                    onClick={() => setClippingSetting(false)}
                  ></i>
                </div>
              </div>
            </div>
          )}

          {/* comment */}
          {isCommentOpen && (
            <Comment
              isOpen={isCommentOpen}
              setIsMenuOpen={setIsMenuOpen}
              onClose={handleCloseComment}
              content={commentPosition}
              docdetnum={selectedItemName.name}
            />
          )}

          {/* Ground settings panel */}
          {groundSettingsVisible && (
            <div id="groundSettings" className="contextMenu">
              <div className="cm-content">
                <div className="row-narrow">
                  <label for="groundLevel" className="gray">
                    Ground level
                  </label>
                  <br />
                  <input
                    ref={groundLevelRef}
                    type="number"
                    id="groundLevel"
                    min="-10"
                    max="10"
                    step="0.5"
                    value={groundFormValues.level}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setGroundFormValues((prev) => ({
                        ...prev,
                        level: value,
                      }));
                      if (
                        groundRef.current &&
                        modelInfoRef.current.boundingBoxMin
                      ) {
                        const baseY =
                          modelInfoRef.current.boundingBoxMin.y - 0.1;
                        groundRef.current.position.y = baseY + value;
                      }
                    }}
                  />
                </div>
                <div className="row-narrow">
                  <label for="groundColor" className="gray">
                    Ground color
                  </label>
                  <br />
                  <input
                    ref={groundColorRef}
                    type="color"
                    id="groundColor"
                    value={groundFormValues.color}
                    onChange={(e) => {
                      const color = e.target.value;
                      setGroundFormValues((prev) => ({ ...prev, color }));
                      if (groundRef.current && groundRef.current.material) {
                        groundRef.current.material.diffuseColor =
                          BABYLON.Color3.FromHexString(color);
                      }
                    }}
                  />
                </div>
                <div className="row-narrow">
                  <label for="groundOpacity" className="gray">
                    Ground opacity
                  </label>
                  <br />
                  <input
                    ref={groundOpacityRef}
                    type="number"
                    id="groundOpacity"
                    min="0"
                    max="100"
                    value={groundFormValues.opacity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setGroundFormValues((prev) => ({
                        ...prev,
                        opacity: value,
                      }));
                      if (groundRef.current && groundRef.current.material) {
                        groundRef.current.material.alpha = value / 100;
                      }
                    }}
                  />
                </div>
                <div className="row-narrow">
                  <i
                    className="fa-solid fa-floppy-disk text-light"
                    onClick={saveGroundSettings}
                  ></i>
                  <i
                    className="fa-solid fa-rotate-right ms-4"
                    onClick={() => {
                      setResetTheme(!resetTheme);
                      resetGroundSettings();
                    }}
                  ></i>

                  <i
                    className="fa-solid fa-xmark ms-4"
                    onClick={handleCloseWatGroSetting}
                  ></i>
                </div>
              </div>
            </div>
          )}
          {/* Water settings panel */}

          {waterSettingsVisible && (
            <div id="seaSettingsMenu" className="contextMenuScreen">
              <div className="contextMenuBg"></div>
              <div id="seaSettings" className="contextMenu">
                <div className="cm-content">
                  <div className="row-narrow">
                    <label for="seaLevel" className="gray">
                      Sea level (m)
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaLevel"
                      min="-10"
                      max="100"
                      step="0.5"
                      value={waterFormValues.level}
                      onChange={(e) => {
                        const level = parseFloat(e.target.value);
                        setWaterFormValues((prev) => ({ ...prev, level }));

                        if (
                          waterMeshRef.current &&
                          modelInfoRef.current?.boundingBoxMin
                        ) {
                          const baseY =
                            modelInfoRef.current.boundingBoxMin.y - 0.1;
                          waterMeshRef.current.position.y = baseY + level;
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow noMargin">
                    <label for="seaOpacity" className="gray">
                      Sea opacity
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaOpacity"
                      min="0"
                      max="100"
                      value={waterFormValues.opacity}
                      onChange={(e) => {
                        const opacity = parseInt(e.target.value);
                        setWaterFormValues((prev) => ({ ...prev, opacity }));

                        if (waterMeshRef.current?.material) {
                          waterMeshRef.current.material.alpha = opacity / 100;
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <label for="seaColor" className="gray">
                      Water color
                    </label>
                    <br />
                    <input
                      type="color"
                      id="seaColor"
                      value={waterFormValues.color}
                      onChange={(e) => {
                        const color = e.target.value;
                        setWaterFormValues((prev) => ({ ...prev, color }));

                        if (waterMeshRef.current?.material) {
                          try {
                            const babylonColor =
                              BABYLON.Color3.FromHexString(color);
                            waterMeshRef.current.material.waterColor =
                              babylonColor;
                          } catch (err) {
                            console.error("Error setting water color:", err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <label for="seaColorBlendFactor" className="gray">
                      Color blend factor (%)
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaColorBlendFactor"
                      min="0"
                      max="1"
                      step="0.1"
                      value={waterFormValues.colorBlendFactor}
                      onChange={(e) => {
                        const colorBlendFactor = parseFloat(e.target.value);
                        setWaterFormValues((prev) => ({
                          ...prev,
                          colorBlendFactor,
                        }));

                        if (waterMeshRef.current?.material) {
                          try {
                            waterMeshRef.current.material.colorBlendFactor =
                              colorBlendFactor;
                          } catch (err) {
                            console.error(
                              "Error setting color blend factor:",
                              err
                            );
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <label for="seaBumpHeight" className="gray">
                      Bump height
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaBumpHeight"
                      min="0"
                      max="10"
                      step="0.1"
                      value={waterFormValues.bumpHeight}
                      onChange={(e) => {
                        const bumpHeight = parseFloat(e.target.value);
                        setWaterFormValues((prev) => ({
                          ...prev,
                          bumpHeight,
                        }));

                        if (waterMeshRef.current?.material) {
                          try {
                            waterMeshRef.current.material.bumpHeight =
                              bumpHeight;
                          } catch (err) {
                            console.error("Error setting bump height:", err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <label for="seaWaveLength" className="gray">
                      Wave length
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaWaveLength"
                      min="0"
                      max="10"
                      step="0.1"
                      value={waterFormValues.waveLength}
                      onChange={(e) => {
                        const waveLength = parseFloat(e.target.value);
                        setWaterFormValues((prev) => ({
                          ...prev,
                          waveLength,
                        }));

                        if (waterMeshRef.current?.material) {
                          try {
                            waterMeshRef.current.material.waveLength =
                              waveLength;
                          } catch (err) {
                            console.error("Error setting wave length:", err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <label for="seaWindForce" className="gray">
                      Wind force
                    </label>
                    <br />
                    <input
                      type="number"
                      id="seaWindForce"
                      min="0"
                      max="50"
                      value={waterFormValues.windForce}
                      onChange={(e) => {
                        const windForce = parseInt(e.target.value);
                        setWaterFormValues((prev) => ({
                          ...prev,
                          windForce,
                        }));

                        if (waterMeshRef.current?.material) {
                          try {
                            waterMeshRef.current.material.windForce = windForce;
                          } catch (err) {
                            console.error("Error setting wind force:", err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="row-narrow">
                    <i
                      className="fa-solid fa-floppy-disk text-light"
                      onClick={saveWaterSettings}
                    ></i>
                    <i
                      className="fa-solid fa-rotate-right ms-4"
                      onClick={() => {
                        setResetTheme(!resetTheme);
                        resetWaterSettings();
                      }}
                    ></i>

                    <i
                      className="fa-solid fa-xmark ms-4"
                      onClick={handleCloseWatGroSetting}
                    ></i>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* comment info*/}
          {commentinfotable && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                height: "90vh",
                backgroundColor: "#272626",
                padding: "20px",
                boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                color: "#fff",
              }}
            >
              {/* Close button */}
              <div
                className="w-100"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  className="btn btn-dark"
                  onClick={handleclosecommentinfo}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <div
                  className="btn btn-dark"
                  onClick={() => deletecomment(commentinfo.number)}
                >
                  <i className="fa-solid fa-trash"></i>
                </div>
                {commentinfo.status !== "closed" &&
                  (isEditing ? (
                    <div
                      className="btn btn-dark"
                      onClick={() => handleSaveButtonClick(commentinfo.number)}
                    >
                      <i className="fa-solid fa-save"></i>
                    </div>
                  ) : (
                    <div
                      className="btn btn-dark"
                      onClick={() => handleEditButtonClick(commentinfo.number)}
                    >
                      <i className="fa-solid fa-pencil"></i>
                    </div>
                  ))}
              </div>
              <div>
                <h6 className="text-center">Comment Info </h6>
                <p>
                  <strong>Comment No:</strong>
                  {commentinfo.number}
                </p>
                <p>
                  <strong>Comment:</strong>
                  {isEditing ? (
                    <textarea
                      value={commentEdit || ""}
                      onChange={(e) => setCommentEdit(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    commentinfo.comment
                  )}
                </p>
                <p>
                  <strong>Date:</strong>
                  {commentinfo.createddate}
                </p>
                <p>
                  <strong>Created:</strong>
                  {commentinfo.createdby}
                </p>
                <p>
                  <strong>Status:</strong>
                  {isEditing ? (
                    <select
                      value={status || ""}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      <option value="" disabled>
                        Choose status
                      </option>
                      {allCommentStatus?.map((statusOption) => (
                        <option
                          key={statusOption.statusname}
                          value={statusOption.statusname}
                        >
                          {statusOption.statusname}
                        </option>
                      ))}
                    </select>
                  ) : (
                    commentinfo.status
                  )}
                </p>
                <p>
                  <strong>Priority:</strong>
                  {isEditing ? (
                    <div>
                      <label>
                        <input
                          type="radio"
                          value="1"
                          checked={priority === "1"}
                          onChange={(e) => setPriority(e.target.value)}
                        />
                        1
                      </label>
                      <label>
                        <input
                          type="radio"
                          value="2"
                          checked={priority === "2"}
                          onChange={(e) => setPriority(e.target.value)}
                        />
                        2
                      </label>
                      <label>
                        <input
                          type="radio"
                          value="3"
                          checked={priority === "3"}
                          onChange={(e) => setPriority(e.target.value)}
                        />
                        3
                      </label>
                    </div>
                  ) : (
                    commentinfo.priority
                  )}
                </p>
                {commentinfo.closedBy ? (
                  <p>
                    <strong>Closed By:</strong>
                    {commentinfo.closedBy}
                  </p>
                ) : (
                  ""
                )}
                {commentinfo.closedDate ? (
                  <p>
                    <strong>Closed By:</strong>
                    {commentinfo.closedDate}
                  </p>
                ) : (
                  ""
                )}
              </div>
            </div>
          )}

          {/* Render tag info */}
          {lineEqpInfo && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                height: "90vh",
                backgroundColor: "#272626",
                padding: "20px",
                boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                color: "#fff",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-light"
                  onClick={handleCloselineEqpInfo}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div>
                {/* Display your tag information here */}
                <h5 className="text-center fw-bold ">
                  {taginfo.equipmentlistDetails
                    ? "Equipment Info"
                    : "Line info"}
                </h5>
                <p>{taginfo.filename}</p>
                {taginfo.equipmentlistDetails ? (
                  <>
                    <p>Description: {taginfo.equipmentlistDetails.descr}</p>
                    <p>Quantity: {taginfo.equipmentlistDetails.qty}</p>
                    <p>Capacity: {taginfo.equipmentlistDetails.capacity}</p>
                    <p>EquipmentType: {taginfo.equipmentlistDetails.type}</p>
                    <p>Materials: {taginfo.equipmentlistDetails.materials}</p>
                    <p>
                      Capacity/Duty: {taginfo.equipmentlistDetails.capacityDuty}
                    </p>
                    <p>Dimensions: {taginfo.equipmentlistDetails.dims}</p>
                    <p>
                      Design Pressure: {taginfo.equipmentlistDetails.dsgnPress}
                    </p>
                    <p>
                      Optimum Pressure: {taginfo.equipmentlistDetails.opPress}
                    </p>
                    <p>
                      Design Temperature:{" "}
                      {taginfo.equipmentlistDetails.dsgnTemp}
                    </p>
                    <p>Operating Temp: {taginfo.equipmentlistDetails.opTemp}</p>
                    <p>Dry Weight: {taginfo.equipmentlistDetails.dryWeight}</p>
                    <p>
                      Operating Weight: {taginfo.equipmentlistDetails.opWeight}
                    </p>
                    <p>Supplier: {taginfo.equipmentlistDetails.supplier}</p>
                    <p>Remarks: {taginfo.equipmentlistDetails.remarks}</p>
                    <p>
                      Initial Status: {taginfo.equipmentlistDetails.initStatus}
                    </p>
                    <p>Revision: {taginfo.equipmentlistDetails.revision}</p>
                    <p>
                      Revision Date: {taginfo.equipmentlistDetails.revisionDate}
                    </p>
                  </>
                ) : taginfo.linelistDetails ? (
                  <>
                    <p>Fluidcode: {taginfo.linelistDetails.fluidCode}</p>
                    <p>Medium: {taginfo.linelistDetails.medium}</p>
                    <p>
                      Line Size (inch): {taginfo.linelistDetails.lineSizeIn}
                    </p>
                    <p>Line Size (NB): {taginfo.linelistDetails.lineSizeNb}</p>
                    <p>Piping Spec: {taginfo.linelistDetails.pipingSpec}</p>
                    <p>Insulation Type: {taginfo.linelistDetails.insType}</p>
                    <p>
                      Insulation Thickness:{" "}
                      {taginfo.linelistDetails.insThickness}
                    </p>
                    <p>Heat Tracing: {taginfo.linelistDetails.heatTrace}</p>
                    <p>Line From: {taginfo.linelistDetails.lineFrom}</p>
                    <p>Line To: {taginfo.linelistDetails.lineTo}</p>
                    <p>MOP: {taginfo.linelistDetails.maxOpPress}</p>
                    <p>MOT: {taginfo.linelistDetails.maxOpTemp}</p>
                    <p>Design Pressure: {taginfo.linelistDetails.dsgnPress}</p>
                    <p>
                      Min Design Temp: {taginfo.linelistDetails.minDsgnTemp}
                    </p>
                    <p>
                      Max Design Temp: {taginfo.linelistDetails.maxDsgnTemp}
                    </p>
                    <p>Test Pressure: {taginfo.linelistDetails.testPress}</p>
                    <p>Test Medium: {taginfo.linelistDetails.testMedium}</p>
                    <p>
                      Test Medium Phase:{" "}
                      {taginfo.linelistDetails.testMediumPhase}
                    </p>
                    <p>Mass Flow: {taginfo.linelistDetails.massFlow}</p>
                    <p>Volume Flow: {taginfo.linelistDetails.volFlow}</p>
                    <p>Density: {taginfo.linelistDetails.density}</p>
                    <p>Velocity: {taginfo.linelistDetails.velocity}</p>
                    <p>Paint System: {taginfo.linelistDetails.paintSystem}</p>
                    <p>NDT Group: {taginfo.linelistDetails.ndtGroup}</p>
                    <p>
                      Chemical Cleaning: {taginfo.linelistDetails.chemCleaning}
                    </p>
                    <p>PWHT: {taginfo.linelistDetails.pwht}</p>
                  </>
                ) : (
                  <p></p>
                )}
              </div>
            </div>
          )}

          {/* file info */}
          {showFileInfo && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                height: "100vh",
                backgroundColor: "#272626",
                padding: "20px",
                boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                color: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-light" onClick={handleCloseFileInfo}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div>
                {/* Display your tag information here */}
                <h5 className="text-center fw-bold ">File Info </h5>
                {/* <p>{taginfo.fileid}</p> */}
                <p>
                  <strong>Filename:</strong>
                  {taginfo.filename}
                </p>
                <p>
                  <strong>Created:</strong>{" "}
                  {new Date(FileInfoDetails.created).toLocaleDateString()}
                </p>
                <p>
                  <strong>Modified:</strong>{" "}
                  {new Date(FileInfoDetails.modified).toLocaleDateString()}
                </p>
                <p>
                  <strong>Accessed:</strong>{" "}
                  {new Date(FileInfoDetails.accessed).toLocaleDateString()}
                </p>
                <p>
                  <strong>Size:</strong>{" "}
                  {(FileInfoDetails.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* user tag info */}
          {tagInfoVisible && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                height: "90vh",
                backgroundColor: "#272626",
                padding: "20px",
                boxShadow: "0px 0px 5px 0px rgba(0,0,0,0.75)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                color: "#fff",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-light" onClick={handleCloseTagInfo}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div>
                <h5 className="text-center fw-bold">General Tag Info</h5>
                <p>Filename: {taginfo.filename}</p>

                {taginfo.UsertagInfoDetails ? (
                  <>
                    {generalTagInfoFields.slice(0, 16)?.map(({ id, field }) => {
                      const key = `taginfo${id}`;
                      const originalValue =
                        taginfo.originalUsertagInfoDetails?.[key];

                      // Display the field with unit if the value exists, otherwise show "N/A"
                      const label =
                        originalValue !== null && originalValue !== undefined
                          ? `${field} `
                          : `${field}`; // Still show the field and unit even if the value is null or undefined

                      return (
                        <p key={key}>
                          {label}:{" "}
                          {originalValue !== null && originalValue !== undefined
                            ? originalValue
                            : "N/A"}
                        </p>
                      );
                    })}
                  </>
                ) : (
                  <p>No additional information available.</p>
                )}
              </div>
            </div>
          )}

          {/* All Saved view */}
          <div className="circle-containerthree">
            {allViews?.length > 0 &&
              allViews?.map((view, index) => (
                <div
                  key={view.name}
                  className="circle"
                  onClick={() => applySavedView(view)}
                  title={view.name}
                >
                  {index + 1}
                </div>
              ))}
          </div>

          {/* Right click menu */}
          {isMenuOpen && (
            <div
              className="menu"
              style={{
                position: "absolute",
                maxWidth: "250px",
                top: `${menuPosition.top - 200}px`,
                left: `${menuPosition.left - 300}px`,
                fontSize: "14px",
              }}
            >
              {menuOptions?.map((option, index) => (
                <div
                  key={index}
                  className="menu-option"
                  onClick={option.action}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: option.action ? "pointer" : "default",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                    fontWeight:
                      (selectedItemName &&
                        option.label === selectedItemName.name) ||
                        option.label === taginfo.filename
                        ? "bold"
                        : "normal",
                  }}
                >
                  <span>{option.label}</span>
                  {option.children && (
                    <span style={{ marginLeft: "auto" }}>▶</span>
                  )}

                  {option.children && hoveredIndex === index && (
                    <div
                      className="submenu"
                      style={{ position: "absolute", left: "100%", top: 0 }}
                    >
                      {option.children?.map((subOption, subIndex) => (
                        <div
                          key={subIndex}
                          className="menu-option"
                          onClick={subOption.action}
                          style={{
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            paddingLeft: "10px",
                            paddingRight: "10px",
                          }}
                        >
                          {subOption.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showMeasure && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: "33%",
                  left: 0,
                  display: "flex",
                  flexDirection: "row",
                  zIndex: 9999,
                  fontSize: "13px",
                }}
              >
                {showMeasureDetails ? (
                  <>
                    <div className="measureInfo" style={{ left: 0, zIndex: 1 }}>
                      <table className="measureInfoTable">
                        <tbody>
                          <tr className="bottomBordered">
                            <th className="measureCornerCell left"></th>
                            <th>X</th>
                            <th>Y</th>
                            <th>Z</th>
                          </tr>
                          <tr>
                            <th className="left">
                              P<sub>1</sub>
                            </th>
                            <td>{point1 ? point1.x : ""}</td>
                            <td>{point1 ? point1.z : ""}</td>
                            <td>{point1 ? point1.y : ""}</td>
                          </tr>

                          <tr>
                            <th className="left">
                              P<sub>2</sub>
                            </th>
                            <td>{point1 ? point1.x : ""}</td>
                            <td>{point1 ? point1.z : ""}</td>
                            <td>{point1 ? point1.y : ""}</td>
                          </tr>
                          <tr>
                            <th className="left">Difference</th>
                            <td>{differences ? differences.diffX : ""}</td>
                            <td>{differences ? differences.diffZ : ""}</td>
                            <td>{differences ? differences.diffY : ""}</td>
                          </tr>
                          <tr className="topBordered">
                            <th className="left">Distance</th>
                            <td colspan="3">{distance ? distance : ""}</td>
                          </tr>
                          <tr className="topBordered">
                            <th className="left">Angle</th>
                            <td colspan="3">
                              hor:{angles ? angles.horizontalAngle : ""} &emsp;
                              ver:{angles ? angles.verticalAngle : ""}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  ""
                )}
                <button
                  onClick={handleShowMeasureDetails}
                  className="vertical-button"
                >
                  Measurements
                </button>
              </div>
            </>
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
                {distance ? distance : ""}
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
                    {differences ? differences.diffY : ""}
                  </div>
                  <div style={{ padding: "4px 6px" }}>
                    {differences ? differences.diffZ : ""}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Render setting */}

          {settingbox && (
            <div id="seaSettingsMenu" className="contextMenuScreen">
              <div className="contextMenuBg"></div>
              <div id="seaSettings" className="contextMenuSetting">
                <div className="cm-content">
                  {/* CAMERA SETTINGS */}

                  <div className="row-narrow">
                    {activeSection === "camera" ? (
                      <>
                        <i
                          onClick={handleCameraOpen}
                          className="fa-solid fa-caret-down"
                        ></i>{" "}
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-caret-right"
                          onClick={handleCameraOpen}
                        ></i>{" "}
                      </>
                    )}
                    <label
                      className={`gray ${activeSection === "camera" ? "bold" : ""
                        }`}
                      for="seaLevel"
                      className="gray"
                    >
                      Camera Settings
                    </label>
                    <br />

                    {activeSection === "camera" && (
                      <>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            FOV
                          </label>
                          <br />
                          <input
                            type="number"
                            value={baseFormValues.fov}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                fov: Number(e.target.value),
                              })
                            }
                            step="1"
                            min="1"
                            max="180"
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Near Clipping Plane
                          </label>
                          <br />

                          <input
                            type="number"
                            value={baseFormValues.nearClip}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                nearClip: Number(e.target.value),
                              })
                            }
                            step="0.01"
                            min="0.01"
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Far Clipping Plane
                          </label>
                          <br />

                          <input
                            type="number"
                            value={baseFormValues.farClip}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                farClip: Number(e.target.value),
                              })
                            }
                            step="1"
                            min="1"
                          />
                        </div>

                        <div className="row-narrow">
                          <label className="gray">Angular Sensibility</label>
                          <br />
                          <input
                            type="number"
                            value={baseFormValues.angularSensibility}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                angularSensibility: Number(e.target.value),
                              })
                            }
                            step="1"
                            min="1"
                          />
                        </div>
                        <div className="row-narrow">
                          <label className="gray">Wheel Sensibility</label>
                          <br />
                          <input
                            type="number"
                            value={baseFormValues.wheelSensibility}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                wheelSensibility: Number(e.target.value),
                              })
                            }
                            step="1"
                            min="1"
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Camera Speed
                          </label>
                          <br />

                          <input
                            type="number"
                            min="0.1"
                            max="2"
                            step="0.1"
                            className="btn btn-dark"
                            value={baseFormValues.cameraSpeed}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                cameraSpeed: Number(e.target.value),
                              })
                            }
                            style={{ marginLeft: "10px" }}
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Inertia
                          </label>
                          <br />

                          <input
                            type="number"
                            value={baseFormValues.inertia}
                            onChange={(e) =>
                              setBaseFormValues({
                                ...baseFormValues,
                                inertia: Number(e.target.value),
                              })
                            }
                            step="0.01"
                            min="0"
                            max="1"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* LIGHT SETTINGS */}

                  <div className="row-narrow">
                    {activeSection === "light" ? (
                      <>
                        <i
                          onClick={handleLightOpen}
                          className="fa-solid fa-caret-down"
                        ></i>{" "}
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-caret-right"
                          onClick={handleLightOpen}
                        ></i>{" "}
                      </>
                    )}

                    <label
                      className={`gray ${activeSection === "light" ? "bold" : ""
                        }`}
                      for="seaLevel"
                      className="gray"
                    >
                      light Settings
                    </label>
                    <br />
                    {activeSection === "light" && (
                      <>
                        <div className="row-narrow">
                          <label className="gray">Intensity</label>
                          <br />

                          <input
                            type="number"
                            value={lightIntensity}
                            onChange={handleLightIntensityChange}
                            step="0.1"
                            min="0"
                            max="10"
                          />
                        </div>

                        <div className="row-narrow">
                          <label className="gray">Color</label>
                          <br />

                          <input
                            type="color"
                            value={lightColor}
                            onChange={handleLightColorChange}
                          />
                        </div>

                        <div className="row-narrow">
                          <label className="gray">Specular Color</label>
                          <br />

                          <input
                            type="color"
                            value={specularColor}
                            onChange={handleSpecularColorChange}
                          />
                        </div>

                        <div className="row-narrow">
                          <label className="gray">Enable Shadow</label>{" "}
                          <input
                            type="checkbox"
                            checked={lightShadowsEnabled}
                            onChange={(e) =>
                              setLightShadowsEnabled(e.target.checked)
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* MATERIAL SETTINGS */}
                  <div className="row-narrow">
                    {activeSection === "material" ? (
                      <>
                        <i
                          onClick={handleMaterialOpen}
                          className="fa-solid fa-caret-down"
                        ></i>{" "}
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-caret-right"
                          onClick={handleMaterialOpen}
                        ></i>{" "}
                      </>
                    )}

                    <label
                      className={`gray ${activeSection === "material" ? "bold" : ""
                        }`}
                      for="seaLevel"
                      className="gray"
                    >
                      Material Settings
                    </label>
                    <br />
                    {activeSection === "material" && (
                      <>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Metallic
                          </label>
                          <br />
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={metallic}
                            onChange={handleMetallicChange}
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Roughness
                          </label>
                          <br />
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={roughness}
                            onChange={handleRoughnessChange}
                          />
                        </div>
                        <div className="row-narrow">
                          <label for="seaLevel" className="gray">
                            Reflection
                          </label>
                          <br />
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={reflectionIntensity}
                            onChange={handleReflectionIntensityChange}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* MEASURE SETTINGS */}

                  <div className="row-narrow">
                    {activeSection === "measure" ? (
                      <>
                        <i
                          onClick={handleMeasureOpen}
                          className="fa-solid fa-caret-down"
                        ></i>{" "}
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-caret-right"
                          onClick={handleMeasureOpen}
                        ></i>{" "}
                      </>
                    )}

                    <label
                      className={`gray ${activeSection === "measure" ? "bold" : ""
                        }`}
                      for="seaLevel"
                      className="gray"
                    >
                      Measure Settings
                    </label>
                    <br />
                    {activeSection === "measure" && (
                      <>
                        <div className="row-narrow">
                          <label htmlFor="unit" className="gray">
                            Unit
                          </label>
                          <br />
                          <input
                            type="text"
                            id="unit"
                            value={unit}
                            onChange={handleUnitChange}
                            placeholder="e.g., m, cm, in"
                          />
                        </div>

                        <div className="row-narrow">
                          <label htmlFor="scaleValue" className="gray">
                            Scale Value
                          </label>
                          <br />
                          <input
                            type="number"
                            id="scaleValue"
                            value={scaleValue}
                            onChange={handleScaleChange}
                            placeholder="Enter scale value"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="row-narrow">
                    <i
                      className="fa-solid fa-floppy-disk text-light"
                      title="Save"
                      onClick={saveBaseSettings}
                    ></i>
                    <i
                      className="fa-solid fa-rotate-right ms-4"
                      title="Reset"
                      onClick={handleResetSettings}
                    ></i>

                    <i
                      className="fa-solid fa-xmark ms-4"
                      title="Close"
                      onClick={handleclosesetting}
                    ></i>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/*saved view modal box */}

          <Modal
            onHide={handleCloseSavedView}
            show={savedViewDialog}
            backdrop="static"
            keyboard={false}
            dialogClassName="custom-modal"
          >
            <div className="save-dialog">
              <div className="title-dialog">
                <p className="text-light">Save view</p>
                <p className="text-light cross" onClick={handleCloseSavedView}>
                  &times;
                </p>
              </div>
              <div className="dialog-input">
                <label>Name*</label>
                <input
                  type="text"
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                />
              </div>
              <div
                className="dialog-button"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={handleCloseSavedView}
                >
                  Cancel
                </button>
                <button className="btn btn-dark" onClick={handleSaveView}>
                  Save
                </button>
              </div>
            </div>
          </Modal>
          {/*Confirmation modal */}
          {showConfirm && (
            <DeleteConfirm
              message={confirmMessage}
              onConfirm={handleConfirm}
              onCancel={handleCancelDelete}
            />
          )}
        </div>

        <div className="right-sidenav" style={{ zIndex: '1' }}>
          <div className="rightSideNav">
            <ul>
              <li className={activeButton === "axis" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleShowAxis("axis")}
                    title="Show Axis"
                  >
                    <Axis3d />
                  </span>
                </div>
              </li>
              <li className={activeButton === "orbit" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleOrbitClick("orbit")}
                    title="Orbit Camera"
                  >
                    <img
                      style={{ width: "30px", height: "30px" }}
                      src="images/orbit.png"
                      alt=""
                    />{" "}
                  </span>
                </div>
              </li>
              <li className={activeButton === "fly" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleFlyClick("fly")}
                    title="Fly camera"
                  >
                    <FontAwesomeIcon icon={faPlane} size="lg" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "select" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    title="Selection"
                    onClick={() => handleObjectselected("select")}
                  >
                    <FontAwesomeIcon icon={faMousePointer} size="lg" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "clip" ? "active" : ""}>
                <div
                  className="tooltip-container"
                  onContextMenu={(e) => {
                    e.preventDefault(); // Prevent default right-click menu
                    setClippingSetting(true);
                  }}
                  onClick={() => {
                    if (sceneRef.current) {
                      handleEnableSectioning(
                        sceneRef.current,
                        clippingPosition
                      );
                    }
                  }}
                >
                  <span className="icon-tooltip" title="Enable sectioning">
                    <FontAwesomeIcon icon={faScissors} size="lg" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "fitview" ? "active" : ""}>
                <div
                  className="tooltip-container"
                  onClick={() => handlezoomfit("fitview")}
                >
                  <span className="icon-tooltip" title="Fit View">

                    <FontAwesomeIcon icon={faArrowsToDot} size="lg" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "setting" ? "active" : ""}>
                <div
                  className="tooltip-container"
                  onClick={() => handleSetting("setting")}
                >
                  <span className="icon-tooltip" title="Setting">
                    <FontAwesomeIcon icon={faGear} size="lg" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "orthographic" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthoview("orthographic")}
                    title="Orthographic View"
                  >
                    <img
                      className="button"
                      src="images/orthographic.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "perspective" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleperspective("perspective")}
                    title="Perspective View"
                  >
                    <img
                      className="button"
                      src="images/perspective.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "front" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthofront("front")}
                    title="Front View"
                  >
                    <img className="button" src="images/front.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "left" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleortholeft("left")}
                    title="Left View"
                  >
                    <img className="button" src="images/left.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "back" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthoback("back")}
                    title="Back View"
                  >
                    <img className="button" src="images/back.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "right" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthoright("right")}
                    title="Right View"
                  >
                    <img className="button" src="images/right.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "top" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthotop("top")}
                    title="Top View"
                  >
                    <img className="button" src="images/top.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "bottom" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleorthobottom("bottom")}
                    title="Bottom View"
                  >
                    <img className="button" src="images/bottom.png" alt="" />
                  </span>
                </div>
              </li>
              <li className={activeButton === "measure" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleShowMeasure("measure")}
                    title="Measure"
                  >
                    <img
                      id="measure"
                      className="button"
                      src="images/measure.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>

              <li className={activeButton === "wireframe" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleWireFrames("wireframe")}
                    title="Wireframe"
                  >
                    <img
                      id="wireframe"
                      className="button"
                      src="images/wireframe.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "savedview" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleSavedView("savedview")}
                    title="Saved view"
                  >
                    <img
                      id="measure"
                      className="button"
                      src="images/save-icon.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "Background" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    title="Default background"
                    onClick={() => {
                      // Cycle through background themes
                      switch (backgroundTheme) {
                        case "DEFAULT":
                          setBackgroundTheme("WHITE");
                          setActiveButton("Background");
                          break;
                        case "WHITE":
                          setBackgroundTheme("GROUND_SKY");
                          setActiveButton("Background");
                          break;
                        case "GROUND_SKY":
                          setBackgroundTheme("SEA_SKY");
                          setActiveButton("Background");
                          break;
                        case "SEA_SKY":
                          setBackgroundTheme("DEFAULT");
                          setActiveButton("Background");
                          break;
                        default:
                          setBackgroundTheme("DEFAULT");
                          setActiveButton("Background");
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault(); // Prevent default right-click menu

                      // Only show settings for relevant themes
                      if (backgroundTheme === "GROUND_SKY") {
                        setGroundSettingsVisible(true);
                      } else if (backgroundTheme === "SEA_SKY") {
                        setWaterSettingsVisible(true);
                      }
                    }}
                  >
                    <img
                      id="theme"
                      className="button"
                      src="images/theme.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "4dplan" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleWireFrame("4dplan")}
                    title="4D plan"
                  >
                    <img
                      id="4dplan"
                      className="button"
                      src="images/4d_plan.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "comment" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handlecomment("comment")}
                    title="Show comment"
                  >
                    <i className="fa-solid fa-comment fs-4"></i>
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
);

export default Iroamer;
