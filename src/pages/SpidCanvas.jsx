import React, { useRef, useEffect, useState, useCallback } from "react";
import paper from "paper";
import "../styles/Spidcanvas.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { debounce } from "lodash";
import TagAssign from "../components/spid/TagAssign";
import { useParams, useOutletContext, useSearchParams } from "react-router-dom";

// Regular icons
import {
  faCircle,
  faFloppyDisk,
  faHandPaper,
  faSquare,
  faTrashAlt,
} from "@fortawesome/free-regular-svg-icons";

// Solid icons
import {
  faMousePointer,
  faPencilAlt,
  faRulerHorizontal,
  faSearch,
  faSlash,
  faVectorSquare,
  faUndo,
  faRedo,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faTags,
  faFont,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  getAssignedFlags,
  GetSpidDocument,
  getSpidElements,
  saveElementswithUniqueId,
  UpdateSpidData,
} from "../services/SpidApi";
import { getAssignedTags } from "../services/TagApi";
import FlagAssign from "../components/spid/FlagAssign";

const SpidCanvas = ({ initialZoom = 1, maxZoom = 10, minZoom = 0.5 }) => {
  const canvasRef = useRef(null);
  const drawingLayer = useRef(null);
  const backgroundLayer = useRef(null);
  const pathRef = useRef(null);
  const startPointRef = useRef(null);
  const selectionShape = useRef(null);
  const selectionLineRef = useRef(null);
  const dragStartPoint = useRef(null);
  const itemCounter = useRef(0);
  const paperScopeRef = useRef(null);
  const mainContainerRef = useRef(null);
  const temarrRef = useRef([]);
  const selectionRectangle = useRef(null);
  const lastMousePosition = useRef(null);
  const isPanningRef = useRef(false);
  const viewRef = useRef(null);
  const viewStateRef = useRef({ center: null, zoom: null, bounds: null });

  const { id } = useParams();
  const fileId = id;
  const [searchParams] = useSearchParams();
  const tagId = searchParams.get("tagId");
  console.log(tagId);

  const { isSidebarCollapsed } = useOutletContext();

  const [mode, setMode] = useState("select");
  const [selectedItems, setSelectedItems] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [panonoff, setPanonoff] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
  });
  const [tagPosition, setTagPosition] = useState({ x: 0, y: 0 });
  const [textBoxes, setTextBoxes] = useState([]);
  const [itemTags, setItemTags] = useState({});
  const [tagAssign, setTagAssign] = useState("");
  const [showTagsList, setShowTagsList] = useState(false);
  const [FlagText, setFlagText] = useState({});
  const [flagdata, setFlagData] = useState([]);
  const [displayedTag, setDisplayedTag] = useState(null);
  const [isCanvasLoaded, setIsCanvasLoaded] = useState(false);
  const [isTagSelectionActive, setIsTagSelectionActive] = useState(false);
  //console.log(flagdata);

  const MIN_SELECTION_LENGTH = 10;
  const selectionMode = "contain";

  const generateUniqueId = useCallback(() => {
    return `item-${Date.now()}-${itemCounter.current++}`;
  }, []);

  const updateSelectedItems = useCallback(() => {
    if (!paperScopeRef.current) return;

    // Get all currently selected items (including text items)
    const selectedItems = paperScopeRef.current.project.getItems({
      selected: true,
      match: (item) => item.data?.selectable !== false,
    });

    // If no items are selected, clear selection and return
    if (selectedItems.length === 0) {
      setSelectedItems([]);
      temarrRef.current = [];
      return;
    }

    const selectedUniqueIds = selectedItems
      .map((item) => item.data?.uniqueId)
      .filter(Boolean);

    const selectedIdSet = new Set(selectedUniqueIds);

    // ----- Tag Association Check -----
    let associatedTagIds = [];
    let hasTagAssociations = false;

    Object.entries(itemTags).forEach(([tagId, tagData]) => {
      const tagUniqueIds = (tagData?.uniqueIds || [])
        .map((entry) => entry.unique_id)
        .filter(Boolean);

      const match = tagUniqueIds.some((id) => selectedIdSet.has(id));
      if (match) {
        associatedTagIds.push(tagId);
        hasTagAssociations = true;
      }
    });

    // ----- Flag Association Check (only if no tag match) -----
    let associatedFlags = [];
    let hasFlagAssociations = false;

    if (!hasTagAssociations && flagdata?.length > 0) {
      flagdata.forEach((flag) => {
        const flagUniqueIds = (flag?.uniqueIds || []).filter(Boolean);
        const match = flagUniqueIds.some((id) => selectedIdSet.has(id));
        if (match) {
          associatedFlags.push(flag);
          hasFlagAssociations = true;
        }
      });
    }

    // ----- Aggregate Items to Select -----
    const allMatchingUniqueIds = new Set(selectedUniqueIds);

    if (hasTagAssociations) {
      associatedTagIds.forEach((tagId) => {
        itemTags[tagId]?.uniqueIds.forEach((entry) => {
          if (entry?.unique_id) {
            allMatchingUniqueIds.add(entry.unique_id);
          }
        });
      });
    } else if (hasFlagAssociations) {
      associatedFlags.forEach((flag) => {
        flag.uniqueIds?.forEach((id) => {
          if (id) {
            allMatchingUniqueIds.add(id);
          }
        });
      });
    }

    // ----- Apply Selection -----
    const allItems = paperScopeRef.current.project.getItems({
      recursive: true,
      match: (item) => item.data?.selectable !== false,
    });

    allItems.forEach((item) => {
      const uid = item.data?.uniqueId;
      item.selected = uid ? allMatchingUniqueIds.has(uid) : false;
    });

    const updatedSelected = paperScopeRef.current.project.getItems({
      selected: true,
      match: (item) => item.data?.selectable !== false,
    });

    setSelectedItems(updatedSelected);
    temarrRef.current = updatedSelected.map((item) => item.data.uniqueId);

    // Debug log
    console.log("Selection Update:", {
      selectedItems: selectedItems.map((i) => ({
        id: i.data?.uniqueId,
        type: i.className,
        isText: i instanceof paper.PointText || i.data?.isText,
      })),
      hasTagAssociations,
      tagAssociations: associatedTagIds,
      hasFlagAssociations,
      flagAssociations: associatedFlags.map((f) => f.flagText),
      finalSelection: updatedSelected.map((i) => i.data?.uniqueId),
    });
  }, [itemTags, flagdata]);

const saveToHistory = useCallback((force = false) => {
  if (!paperScopeRef.current) return;

  try {
    const projectJSON = paperScopeRef.current.project.exportJSON();
    const historyState = {
      project: projectJSON,
      textBoxes: [...textBoxes],
      viewState: {
        center: paperScopeRef.current.view.center.clone(),
        zoom: paperScopeRef.current.view.zoom,
      },
    };

    const prevState = history[historyIndex];
    const sameState = prevState && 
      JSON.stringify(prevState.project) === JSON.stringify(historyState.project) && 
      JSON.stringify(prevState.textBoxes) === JSON.stringify(historyState.textBoxes);

    if (!sameState || force) {
      const newHistory = history.slice(0, historyIndex + 1); // trim redo only if a real change
      newHistory.push(historyState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      console.log("🟢 Saved to history", newHistory.length - 1);
    }
  } catch (err) {
    console.error("🔴 History save error:", err);
  }
}, [history, historyIndex, textBoxes]);
  const processImportedItem = useCallback(
    (item, parentName = "") => {
      try {
        item.data = item.data || {};

        if (!item.data.uniqueId) {
          item.data.uniqueId = generateUniqueId();
        }

        if (!item.data.uniqueId || typeof item.data.uniqueId !== "string") {
          console.warn(`Skipping item at ${parentName}: Invalid uniqueId`);
          return false;
        }

        item.data.selectable = true;
        item.data.movable = false; // SVG-imported items are non-movable
        item.data.originalFill = item.fillColor ? item.fillColor.clone() : null;
        item.data.originalStroke = item.strokeColor
          ? item.strokeColor.clone()
          : null;
        item.data.originalStrokeWidth = item.strokeWidth || 1;
        item.data.elementType = item.className || item.constructor.name;

        if (!item.data.originalMatrix) {
          item.data.originalMatrix = item.matrix.clone();
        }

        if (
          item instanceof paper.PathItem &&
          !item.strokeColor &&
          !item.fillColor
        ) {
          item.strokeColor = "black";
          item.strokeWidth = 1;
        }

        if (item instanceof paper.Group) {
          item.data.isGroup = true;
          const validChildren = item.children
            .map((child, i) =>
              processImportedItem(child, `${parentName}.child${i}`)
            )
            .filter((valid) => valid !== false);
          if (validChildren.length === 0) {
            console.warn(`Group ${item.data.uniqueId} has no valid children`);
            return false;
          }
        } else if (item instanceof paper.CompoundPath) {
          item.data.isCompoundPath = true;
          item.children.forEach((child, i) => {
            child.data = child.data || {};
            if (!child.data.uniqueId) {
              child.data.uniqueId = `${item.data.uniqueId}-path${i}`;
            }
            child.data.selectable = true;
            child.data.movable = false; // Ensure children of compound paths are non-movable
          });
        } else if (item instanceof paper.TextItem) {
          item.data.isText = true;
          item.data.textContent = item.content;
        } else if (item instanceof paper.Raster) {
          item.data.isImage = true;
        }

        return true;
      } catch (err) {
        console.error(`Error processing item at ${parentName}:`, err);
        return false;
      }
    },
    [generateUniqueId]
  );
  const getOrCreateLayer = (name) => {
  const found = paperScopeRef.current.project.getItems({
    name,
  }).find(item => item instanceof paperScopeRef.current.Layer);

  if (found) return found;
  return new paperScopeRef.current.Layer({ name });
};


const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    try {
      const prevState = history[historyIndex - 1];
      paperScopeRef.current.project.clear();

      // Restore project state
      paperScopeRef.current.project.importJSON(prevState.project);

      // Restore layers
 

backgroundLayer.current = getOrCreateLayer("background");
drawingLayer.current = getOrCreateLayer("drawing");
      drawingLayer.current.activate();

      // Process imported items and restore selection
      paperScopeRef.current.project
        .getItems({ recursive: true })
        .forEach((item) => {
          if (processImportedItem(item)) {
            if (item.data?.wasSelected) {
              item.selected = true;
            }
          } else {
            item.remove();
          }
        });

      // Restore text boxes
      setTextBoxes(prevState.textBoxes || []);

      // Restore view state
      if (prevState.viewState) {
        paperScopeRef.current.view.center = new paper.Point(
          prevState.viewState.center
        );
        paperScopeRef.current.view.zoom = prevState.viewState.zoom;
        setZoomLevel(prevState.viewState.zoom);
      }

      setHistoryIndex(historyIndex - 1);
      updateSelectedItems();
      console.log("Undo to history index:", historyIndex - 1);
    } catch (err) {
      console.error("Error during undo:", err);
    }
  }, [history, historyIndex, updateSelectedItems, processImportedItem]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    try {
      const nextState = history[historyIndex + 1];
      paperScopeRef.current.project.clear();

      // Restore project state
      paperScopeRef.current.project.importJSON(nextState.project);

      // Restore layers
 drawingLayer.current = getOrCreateLayer("drawing");
backgroundLayer.current = getOrCreateLayer("background");
drawingLayer.current.activate();
      drawingLayer.current.activate();

      // Process imported items and restore selection
      paperScopeRef.current.project
        .getItems({ recursive: true })
        .forEach((item) => {
          if (processImportedItem(item)) {
            if (item.data?.wasSelected) {
              item.selected = true;
            }
          } else {
            item.remove();
          }
        });

      // Restore text boxes
      setTextBoxes(nextState.textBoxes || []);

      // Restore view state
      if (nextState.viewState) {
        paperScopeRef.current.view.center = new paper.Point(
          nextState.viewState.center
        );
        paperScopeRef.current.view.zoom = nextState.viewState.zoom;
        setZoomLevel(nextState.viewState.zoom);
      }

      setHistoryIndex(historyIndex + 1);
      updateSelectedItems();
      console.log("Redo to history index:", historyIndex + 1);
    } catch (err) {
      console.error("Error during redo:", err);
    }
  }, [history, historyIndex, updateSelectedItems, processImportedItem]);


  const zoomIn = useCallback(() => {
    if (!paperScopeRef.current) return;
    const center = paperScopeRef.current.view.center;
    const newZoom = Math.min(zoomLevel * 1.2, maxZoom);
    paperScopeRef.current.view.zoom = newZoom;
    paperScopeRef.current.view.center = center;
    setZoomLevel(newZoom);
  }, [zoomLevel, maxZoom]);

  const zoomOut = useCallback(() => {
    if (!paperScopeRef.current) return;
    const center = paperScopeRef.current.view.center;
    const newZoom = Math.max(zoomLevel / 1.2, minZoom);
    paperScopeRef.current.view.zoom = newZoom;
    paperScopeRef.current.view.center = center;
    setZoomLevel(newZoom);
  }, [zoomLevel, minZoom]);

  const cleanupPaper = useCallback(() => {
    if (paperScopeRef.current) {
      paperScopeRef.current.remove();
      paperScopeRef.current = null;
    }
  }, []);

  const initializePaper = useCallback(() => {
    try {
      if (!canvasRef.current) return;

      cleanupPaper();

      paperScopeRef.current = new paper.PaperScope();
      paperScopeRef.current.setup(canvasRef.current);
      viewRef.current = paperScopeRef.current.view;

   drawingLayer.current = getOrCreateLayer("drawing");
backgroundLayer.current = getOrCreateLayer("background");
drawingLayer.current.activate();
      drawingLayer.current.activate();

      const initialProjectJSON = paperScopeRef.current.project.exportJSON();
      setHistory([initialProjectJSON]);
      setHistoryIndex(0);

      return paperScopeRef.current;
    } catch (err) {
      console.error("Paper.js initialization error:", err);
      setError("Failed to initialize drawing canvas");
      return null;
    }
  }, [cleanupPaper]);

  const handleViewTransform = useCallback(
    (delta, mousePosition) => {
      if (!paperScopeRef.current) return;

      const oldZoom = paperScopeRef.current.view.zoom;
      const newZoom = delta > 0 ? oldZoom * 0.9 : oldZoom * 1.1;
      const clampedZoom = Math.min(Math.max(newZoom, minZoom), maxZoom);

      const viewPosition =
        paperScopeRef.current.view.viewToProject(mousePosition);
      paperScopeRef.current.view.zoom = clampedZoom;
      const newViewPosition =
        paperScopeRef.current.view.viewToProject(mousePosition);
      paperScopeRef.current.view.center = paperScopeRef.current.view.center.add(
        viewPosition.subtract(newViewPosition)
      );
      setZoomLevel(clampedZoom);
    },
    [minZoom, maxZoom]
  );

  const handleResize = useCallback(
    debounce(() => {
      if (
        !paperScopeRef.current ||
        !canvasRef.current ||
        !mainContainerRef.current
      )
        return;

      const container = mainContainerRef.current;
      const canvas = canvasRef.current;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.setAttribute("width", rect.width);
      canvas.setAttribute("height", rect.height);

      paperScopeRef.current.view.viewSize = new paperScopeRef.current.Size(
        rect.width,
        rect.height
      );

      const allItems = paperScopeRef.current.project.getItems({
        match: (item) =>
          !item.name?.includes("selection-") &&
          !item.name?.includes("drawing-item") &&
          item.visible !== false,
      });

      if (allItems.length > 0) {
        let combinedBounds = allItems[0].bounds.clone();
        for (let i = 1; i < allItems.length; i++) {
          combinedBounds = combinedBounds.unite(allItems[i].bounds);
        }

        if (!combinedBounds.isEmpty()) {
          const padding =
            Math.max(combinedBounds.width, combinedBounds.height) * 0.1;
          combinedBounds = combinedBounds.expand(padding);

          const scale = Math.min(
            rect.width / combinedBounds.width,
            rect.height / combinedBounds.height
          );

          const clampedZoom = Math.min(Math.max(scale, minZoom), maxZoom);
          paperScopeRef.current.view.zoom = clampedZoom;
          paperScopeRef.current.view.center = combinedBounds.center;
          setZoomLevel(clampedZoom);
          return;
        }
      }

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      paperScopeRef.current.view.center = new paperScopeRef.current.Point(
        centerX,
        centerY
      );
      paperScopeRef.current.view.zoom = initialZoom;
      setZoomLevel(initialZoom);
    }, 50),
    [initialZoom, minZoom, maxZoom, isSidebarCollapsed]
  );

  const setupEventListeners = useCallback(() => {
    if (!canvasRef.current) return;

    const handleWheel = (event) => {
      event.preventDefault();
      handleViewTransform(
        event.deltaY,
        new paper.Point(event.offsetX, event.offsetY)
      );
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("wheel", handleWheel);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleViewTransform]);

  const enablePanning = useCallback(() => {
    if (!canvasRef.current || !paperScopeRef.current) return;

    const phandleMouseDown = (event) => {
      isPanningRef.current = true;
      lastMousePosition.current = new paperScopeRef.current.Point(
        event.offsetX,
        event.offsetY
      );
    };

    const phandleMouseMove = (event) => {
      if (isPanningRef.current && paperScopeRef.current) {
        const delta = new paperScopeRef.current.Point(
          event.offsetX,
          event.offsetY
        ).subtract(lastMousePosition.current);
        viewRef.current.center = viewRef.current.center.subtract(delta);
        lastMousePosition.current = new paperScopeRef.current.Point(
          event.offsetX,
          event.offsetY
        );
      }
    };

    const phandleMouseUp = () => {
      isPanningRef.current = false;
    };

    const phandleMouseLeave = () => {
      isPanningRef.current = false;
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("mousedown", phandleMouseDown);
    canvas.addEventListener("mousemove", phandleMouseMove);
    canvas.addEventListener("mouseup", phandleMouseUp);
    canvas.addEventListener("mouseleave", phandleMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", phandleMouseDown);
      canvas.removeEventListener("mousemove", phandleMouseMove);
      canvas.removeEventListener("mouseup", phandleMouseUp);
      canvas.removeEventListener("mouseleave", phandleMouseLeave);
    };
  }, []);

  const disablePanning = useCallback(() => {
    if (!canvasRef.current) return;

    const phandleMouseDown = () => {};
    const phandleMouseMove = () => {};
    const phandleMouseUp = () => {};
    const phandleMouseLeave = () => {};

    const canvas = canvasRef.current;
    canvas.removeEventListener("mousedown", phandleMouseDown);
    canvas.removeEventListener("mousemove", phandleMouseMove);
    canvas.removeEventListener("mouseup", phandleMouseUp);
    canvas.removeEventListener("mouseleave", phandleMouseLeave);
  }, []);

  const handlepan = useCallback(() => {
    setPanonoff(true);
    setMode("pan");
  }, []);

  const dlayerremove = useCallback(() => {
    if (drawingLayer.current) {
      drawingLayer.current.removeChildren();
    }
  }, []);

  useEffect(() => {
    if (panonoff) {
      dlayerremove();
      const cleanup = enablePanning();
      return cleanup;
    }
    disablePanning();
  }, [panonoff, enablePanning, disablePanning, dlayerremove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paperScope = initializePaper();
    if (!paperScope) return;

    const cleanupListeners = setupEventListeners();

    return () => {
      cleanupListeners?.();
      cleanupPaper();
    };
  }, [initializePaper, setupEventListeners, cleanupPaper]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (mainContainerRef.current) {
      resizeObserver.observe(mainContainerRef.current);
    }

    const sidebarEl = document.querySelector(".bg-dark");
    const onTransitionEnd = () => handleResize();

    if (sidebarEl) {
      sidebarEl.addEventListener("transitionend", onTransitionEnd);
    }

    return () => {
      resizeObserver.disconnect();
      handleResize.cancel();
      if (sidebarEl) {
        sidebarEl.removeEventListener("transitionend", onTransitionEnd);
      }
    };
  }, [handleResize, isSidebarCollapsed]);

  function captureSnapshot() {
    if (!paperScopeRef.current) return;
    const snapshot = {};
    paperScopeRef.current.project
      .getItems({ recursive: true })
      .forEach((item) => {
        if (item.data?.uniqueId) {
          snapshot[item.data.uniqueId] = item.exportJSON({ asString: true });
        }
      });
  }

  const loadSvgFromBackend = useCallback(
    async (fileId) => {
      if (!fileId) {
        setError("No file ID provided");
        return;
      }

      try {
        console.log("Loading SVG for fileId:", fileId);

        if (typeof fileId !== "string" || fileId.trim() === "") {
          throw new Error("Invalid fileId format");
        }

        paperScopeRef.current.project.clear();
        backgroundLayer.current = new paperScopeRef.current.Layer({
          name: "background",
        });
        drawingLayer.current = new paperScopeRef.current.Layer({
          name: "drawing",
        });
        drawingLayer.current.activate();

        const loadedUniqueIds = new Set();

        const itemsRes = await getSpidElements(fileId);
        console.log("getSpidElements response:", itemsRes);

        if (itemsRes.data.success && itemsRes.data.items.length > 0) {
          for (const { uniqueId, json } of itemsRes.data.items) {
            if (!uniqueId || !json) {
              console.warn(`Skipping item with missing uniqueId or json`);
              continue;
            }

            if (loadedUniqueIds.has(uniqueId)) {
              console.warn(`Duplicate uniqueId ${uniqueId} skipped`);
              continue;
            }

            try {
              const parsedJson =
                typeof json === "string" ? JSON.parse(json) : json;
              const imported =
                paperScopeRef.current.project.importJSON(parsedJson);
              const items = Array.isArray(imported) ? imported : [imported];

              items.forEach((item) => {
                item.data = item.data || {};
                item.data.uniqueId = uniqueId;
                item.data.selectable = true;
                item.data.movable = false; // Ensure imported items are non-movable

                if (!processImportedItem(item)) {
                  console.warn(`Skipping invalid item ${uniqueId}`);
                  item.remove();
                  return;
                }

                if (item.data.isText || item.data.isImage) {
                  const layerName = `${item.data.elementType}-layer`;
                  let specialLayer = paperScopeRef.current.project.getItems({
                    name: layerName,
                  })[0];
                  if (!specialLayer) {
                    specialLayer = new paperScopeRef.current.Layer({
                      name: layerName,
                    });
                    specialLayer.data.isSpecialLayer = true;
                  }
                  specialLayer.addChild(item);
                } else {
                  backgroundLayer.current.addChild(item);
                }

                loadedUniqueIds.add(uniqueId);
              });
            } catch (err) {
              console.error(`Failed to import item ${uniqueId}:`, err);
            }
          }

          console.log(`Loaded ${loadedUniqueIds.size} items from DB`);
          setIsCanvasLoaded(true);
          setMode("select");
          setPanonoff(false);

          if (viewStateRef.current.center) {
            paperScopeRef.current.view.center = viewStateRef.current.center;
            paperScopeRef.current.view.zoom = viewStateRef.current.zoom;
            setZoomLevel(viewStateRef.current.zoom);
          } else {
            handleResize();
          }

          saveToHistory();
          captureSnapshot();
          return;
        }

        const response = await GetSpidDocument(fileId);
        console.log("GetSpidDocument response type:", response.type);

        if (!(response instanceof Blob)) {
          throw new Error("Expected a Blob response for SVG");
        }

        const svgText = await response.text();
        console.log("SVG content preview:", svgText.slice(0, 200));

        if (!svgText.includes("<svg")) {
          throw new Error("Invalid SVG content received");
        }

        const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        paperScopeRef.current.project.importSVG(url, {
          expandShapes: true,
          insert: false,
          onLoad: (item) => {
            try {
              const importedGroup =
                item instanceof paperScopeRef.current.Group
                  ? item
                  : new paperScopeRef.current.Group([item]);

              if (!importedGroup.matrix.isIdentity()) {
                importedGroup.data = importedGroup.data || {};
                importedGroup.data.originalMatrix =
                  importedGroup.matrix.clone();
              }

              if (!processImportedItem(importedGroup)) {
                console.error("Failed to process imported SVG group");
                setError("Failed to process SVG items");
                URL.revokeObjectURL(url);
                return;
              }

              const itemsToSave = [];

              importedGroup.removeChildren().forEach((child) => {
                if (!child.data?.uniqueId) {
                  console.warn(
                    "Skipping item without uniqueId during SVG import"
                  );
                  child.remove();
                  return;
                }

                if (loadedUniqueIds.has(child.data.uniqueId)) {
                  console.warn(
                    `Duplicate uniqueId ${child.data.uniqueId} skipped`
                  );
                  child.remove();
                  return;
                }

                if (child.data.isImage || child.data.isText) {
                  const specialLayer = new paperScopeRef.current.Layer({
                    name: `${child.data.elementType}-layer`,
                  });
                  specialLayer.addChild(child);
                  specialLayer.data.isSpecialLayer = true;
                } else {
                  backgroundLayer.current.addChild(child);
                }

                try {
                  const jsonData = child.exportJSON({ asString: false });
                  const jsonString = JSON.stringify(jsonData);
                  itemsToSave.push({
                    uniqueId: child.data.uniqueId,
                    json: jsonString,
                  });
                  loadedUniqueIds.add(child.data.uniqueId);
                } catch (err) {
                  console.error(
                    `Failed to export item ${child.data.uniqueId} for saving:`,
                    err
                  );
                }
              });

              drawingLayer.current.bringToFront();
              drawingLayer.current.activate();
              setIsCanvasLoaded(true);
              setMode("select");
              setPanonoff(false);
              setError(null);

              if (itemsToSave.length > 0) {
                console.log("Saving items to backend:", itemsToSave);
                saveElementswithUniqueId(itemsToSave, fileId);
              }

              console.log(
                `Imported and saved ${itemsToSave.length} items from SVG`
              );

              setTimeout(() => {
                handleResize();
                saveToHistory();
                captureSnapshot();
              }, 100);

              URL.revokeObjectURL(url);
            } catch (err) {
              console.error("SVG processing error:", err);
              setError("Failed to process SVG file");
              URL.revokeObjectURL(url);
            }
          },
          onError: (err) => {
            console.error("SVG import error:", err);
            setError("Failed to import SVG");
            URL.revokeObjectURL(url);
          },
        });
      } catch (err) {
        console.error("Error loading SVG from backend:", {
          fileId,
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        });
        setError(
          `Failed to load SVG: ${err.response?.data?.message || err.message}`
        );
      }
    },
    [processImportedItem, saveToHistory, handleResize, initialZoom, fileId]
  );

  useEffect(() => {
    if (fileId) {
      console.log("Starting SVG load for fileId:", fileId);
      loadSvgFromBackend(fileId);
    } else {
      setError("No file ID provided");
    }
  }, []);

  const transformBoundsToView = useCallback((item, paperScope) => {
    const bounds = item.internalBounds || item.bounds;
    const matrix = item.globalMatrix;
    const topLeft = matrix.transform(bounds.topLeft);
    const bottomRight = matrix.transform(bounds.bottomRight);
    return new paperScope.Rectangle(topLeft, bottomRight);
  }, []);

  const onMouseDown = useCallback(
    (event) => {
      if (mode !== "select-rect" || event.button !== 0) return;

      try {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const point = new paper.Point(
          event.clientX - rect.left,
          event.clientY - rect.top
        );
        const projectPoint = paperScopeRef.current.view.viewToProject(point);
        startPointRef.current = new paper.Point(projectPoint.x, projectPoint.y);

        selectionRectangle.current = new paperScopeRef.current.Path.Rectangle(
          startPointRef.current,
          startPointRef.current
        );
        selectionRectangle.current.strokeColor = "black";
        selectionRectangle.current.strokeWidth = 1;
        selectionRectangle.current.name = "selection-rect";
      } catch (err) {
        console.error("Window selection mouse down error:", err);
      }
    },
    [mode]
  );

  const onMouseDrag = useCallback(
    (event) => {
      if (
        mode !== "select-rect" ||
        event.button !== 0 ||
        !selectionRectangle.current
      )
        return;

      try {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const point = new paper.Point(
          event.clientX - rect.left,
          event.clientY - rect.top
        );
        const projectPoint = paperScopeRef.current.view.viewToProject(point);
        const endPoint = new paper.Point(projectPoint.x, projectPoint.y);

        selectionRectangle.current.remove();
        selectionRectangle.current = new paperScopeRef.current.Path.Rectangle(
          startPointRef.current,
          endPoint
        );
        selectionRectangle.current.strokeColor = "blue";
        selectionRectangle.current.strokeWidth = 2;
        selectionRectangle.current.dashArray = [4, 4];
        selectionRectangle.current.name = "selection-rect";
      } catch (err) {
        console.error("Window selection mouse drag error:", err);
      }
    },
    [mode]
  );

  const onMouseUp = useCallback(
    (event) => {
      if (
        mode !== "select-rect" ||
        event.button !== 0 ||
        !selectionRectangle.current
      )
        return;

      try {
        const selectionBounds = selectionRectangle.current.bounds;

        const itemsToSelect = paperScopeRef.current.project.getItems({
          recursive: true,
          match: (item) => {
            if (
              item.data?.selectable === false ||
              item.name?.startsWith("selection-")
            ) {
              return false;
            }
            const itemBounds = transformBoundsToView(
              item,
              paperScopeRef.current
            );
            const isContained = selectionBounds.contains(itemBounds);
            return isContained;
          },
        });

        if (itemsToSelect.length > 0) {
          if (event.shiftKey) {
            itemsToSelect.forEach((item) => {
              item.selected = !item.selected;
            });
          } else {
            paperScopeRef.current.project.deselectAll();
            itemsToSelect.forEach((item) => {
              item.selected = true;
            });
          }
          updateSelectedItems();
        } else if (!event.shiftKey) {
          paperScopeRef.current.project.deselectAll();
          updateSelectedItems();
        }

        selectionRectangle.current.remove();
        selectionRectangle.current = null;
        saveToHistory();
      } catch (err) {
        console.error("Window selection mouse up error:", err);
      }
    },
    [mode, updateSelectedItems, saveToHistory, transformBoundsToView]
  );
  const onLineMouseDown = useCallback(
    (event) => {
      if (mode !== "select-line" || event.button !== 0) return;

      try {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const point = new paper.Point(
          event.clientX - rect.left,
          event.clientY - rect.top
        );
        const projectPoint = paperScopeRef.current.view.viewToProject(point);
        dragStartPoint.current = new paper.Point(
          projectPoint.x,
          projectPoint.y
        );

        selectionShape.current = new paperScopeRef.current.Path.Line({
          from: dragStartPoint.current,
          to: dragStartPoint.current,
          strokeColor: new paperScopeRef.current.Color(0, 0.5, 1),
          strokeWidth: 2,
          dashArray: [4, 4],
          name: "selection-line",
        });
      } catch (err) {
        console.error("Line selection mouse down error:", err);
      }
    },
    [mode]
  );

  const onLineMouseDrag = useCallback(
    (event) => {
      if (
        mode !== "select-line" ||
        event.button !== 0 ||
        !selectionShape.current
      )
        return;

      try {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const point = new paper.Point(
          event.clientX - rect.left,
          event.clientY - rect.top
        );
        const projectPoint = paperScopeRef.current.view.viewToProject(point);

        selectionShape.current.lastSegment.point = projectPoint;

        if (selectionLineRef.current) selectionLineRef.current.remove();
        selectionLineRef.current = new paperScopeRef.current.Path.Line(
          selectionShape.current.firstSegment.point,
          selectionShape.current.lastSegment.point
        );

        paperScopeRef.current.project.getItems({
          match: (item) => {
            if (item.data?.selectable === false) return false;
            if (item instanceof paperScopeRef.current.PathItem) {
              const intersections = item.getIntersections(
                selectionLineRef.current
              );
              if (intersections.length > 0) {
                item.opacity = 0.7;
                return true;
              }
            } else {
              if (selectionLineRef.current.intersects(item.bounds)) {
                item.opacity = 0.7;
                return true;
              }
            }
            item.opacity = 1;
            return false;
          },
        });
      } catch (err) {
        console.error("Line selection mouse drag error:", err);
      }
    },
    [mode]
  );

  const onLineMouseUp = useCallback(
    (event) => {
      if (
        mode !== "select-line" ||
        event.button !== 0 ||
        !selectionShape.current
      )
        return;

      try {
        // Reset opacity for all items
        paperScopeRef.current.project.getItems({
          match: (item) => {
            item.opacity = 1;
            return true;
          },
        });

        const lineLength = selectionShape.current.length;
        if (lineLength < MIN_SELECTION_LENGTH) {
          selectionShape.current.remove();
          selectionShape.current = null;
          if (selectionLineRef.current) {
            selectionLineRef.current.remove();
            selectionLineRef.current = null;
          }
          return;
        }

        if (selectionLineRef.current) selectionLineRef.current.remove();
        selectionLineRef.current = new paperScopeRef.current.Path.Line(
          selectionShape.current.firstSegment.point,
          selectionShape.current.lastSegment.point
        );

        // First find all intersected items
        const allIntersected = paperScopeRef.current.project.getItems({
          recursive: true,
          match: (item) => {
            if (
              item.data?.selectable === false ||
              item.name?.startsWith("selection-") ||
              item instanceof paperScopeRef.current.CompoundPath // Skip compound paths
            ) {
              return false;
            }

            // Only check direct intersections with PathItems
            if (item instanceof paperScopeRef.current.PathItem) {
              return item.getIntersections(selectionLineRef.current).length > 0;
            }

            return false;
          },
        });

        // Filter to only include the most specific intersected items
        const itemsToSelect = allIntersected.filter((item) => {
          // If this item is a child of a compound path, only select it if it's the direct hit
          if (item.parent instanceof paperScopeRef.current.CompoundPath) {
            // Check if this is the specific child that was intersected
            const intersections = item.getIntersections(
              selectionLineRef.current
            );
            return intersections.length > 0;
          }
          return true;
        });

        console.log(
          "Precisely intersected items:",
          itemsToSelect.map((i) => ({
            id: i.data?.uniqueId,
            type: i.className,
            parent: i.parent?.className,
          }))
        );

        if (itemsToSelect.length > 0) {
          if (event.shiftKey) {
            itemsToSelect.forEach((item) => {
              item.selected = !item.selected;
            });
          } else {
            paperScopeRef.current.project.deselectAll();
            itemsToSelect.forEach((item) => {
              item.selected = true;
            });
          }
          updateSelectedItems();
        } else if (!event.shiftKey) {
          paperScopeRef.current.project.deselectAll();
          updateSelectedItems();
        }

        selectionLineRef.current.remove();
        selectionLineRef.current = null;
        selectionShape.current.remove();
        selectionShape.current = null;
        saveToHistory();
      } catch (err) {
        console.error("Line selection mouse up error:", err);
      }
    },
    [mode, updateSelectedItems, saveToHistory]
  );

  const onContextMenu = useCallback((event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setContextMenu({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    if (
      !canvasRef.current ||
      (mode !== "select-rect" && mode !== "select-line")
    )
      return;

    const canvas = canvasRef.current;

    if (mode === "select-rect") {
      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("mousemove", onMouseDrag);
      canvas.addEventListener("mouseup", onMouseUp);
    } else if (mode === "select-line") {
      canvas.addEventListener("mousedown", onLineMouseDown);
      canvas.addEventListener("mousemove", onLineMouseDrag);
      canvas.addEventListener("mouseup", onLineMouseUp);
    }
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseDrag);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousedown", onLineMouseDown);
      canvas.removeEventListener("mousemove", onLineMouseDrag);
      canvas.removeEventListener("mouseup", onLineMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      if (selectionRectangle.current) {
        selectionRectangle.current.remove();
        selectionRectangle.current = null;
      }
      if (selectionShape.current) {
        selectionShape.current.remove();
        selectionShape.current = null;
      }
      if (selectionLineRef.current) {
        selectionLineRef.current.remove();
        selectionLineRef.current = null;
      }
    };
  }, [
    mode,
    onMouseDown,
    onMouseDrag,
    onMouseUp,
    onLineMouseDown,
    onLineMouseDrag,
    onLineMouseUp,
    onContextMenu,
  ]);
  useEffect(() => {
    if (!paperScopeRef.current || !drawingLayer.current) return;

    const tool = new paperScopeRef.current.Tool();

    tool.onMouseMove = (event) => {};

    tool.onMouseDown = (event) => {
      if (isTagSelectionActive) {
        setIsTagSelectionActive(false);
        return;
      }
      if (!paperScopeRef.current) return;
      if (panonoff) return;
      if (event.event.detail > 1) return;
      if (
        mode === "freehand" ||
        mode === "line" ||
        mode === "rectangle" ||
        mode === "circle"
      ) {
        startPointRef.current = event.point;

        switch (mode) {
          case "freehand":
            pathRef.current = new paperScopeRef.current.Path({
              segments: [event.point],
              strokeColor: "black",
              strokeWidth: 2,
              name: "drawing-item",
            });
            pathRef.current.data = {
              selectable: true,
              uniqueId: generateUniqueId(),
              movable: true,
            };
            drawingLayer.current.addChild(pathRef.current);
            break;

          case "line":
            pathRef.current = new paperScopeRef.current.Path.Line({
              from: event.point,
              to: event.point,
              strokeColor: "black",
              strokeWidth: 2,
              name: "drawing-item",
            });
            pathRef.current.data = {
              selectable: true,
              uniqueId: generateUniqueId(),
              movable: true,
            };
            drawingLayer.current.addChild(pathRef.current);
            break;

          case "rectangle":
            pathRef.current = new paperScopeRef.current.Path.Rectangle({
              from: event.point,
              to: event.point,
              strokeColor: "black",
              strokeWidth: 2,
              fillColor: "rgba(0,0,0,0.1)",
              name: "drawing-item",
            });
            pathRef.current.data = {
              selectable: true,
              uniqueId: generateUniqueId(),
              movable: true,
            };
            drawingLayer.current.addChild(pathRef.current);
            break;

          case "circle":
            pathRef.current = new paperScopeRef.current.Path.Circle({
              center: event.point,
              radius: 1,
              strokeColor: "black",
              strokeWidth: 2,
              fillColor: "rgba(0,0,0,0.1)",
              name: "drawing-item",
            });
            pathRef.current.data = {
              selectable: true,
              uniqueId: generateUniqueId(),
              movable: true,
            };
            drawingLayer.current.addChild(pathRef.current);
            break;
          default:
            break;
        }
     
        return;
      }
      if (mode === "text") {
        const point = event.point;
        const textId = generateUniqueId();

        setTextBoxes((prev) => [
          ...prev,
          {
            id: textId,
            point: point.clone(),
            content: "",
          },
        ]);

        saveToHistory();
        return;
      }

      if (mode === "select") {
        let hitResult = paperScopeRef.current.project.hitTest(event.point, {
          segments: true,
          stroke: true,
          tolerance: 5,
          match: (hit) => hit.item.data?.selectable !== false,
        });

        if (!hitResult) {
          hitResult = paperScopeRef.current.project.hitTest(event.point, {
            fill: true,
            tolerance: 1,
            match: (hit) => hit.item.data?.selectable !== false,
          });
        }

        if (!hitResult) {
          hitResult = paperScopeRef.current.project.hitTest(event.point, {
            bounds: true,
            tolerance: 5,
            match: (hit) => hit.item.data?.selectable !== false,
          });
        }

        if (hitResult) {
          const item = hitResult.item;
          if (
            item instanceof paperScopeRef.current.PointText ||
            (item.data && item.data.isText)
          ) {
            console.log(
              "Selected text content:",
              item.content || item.textContent
            );
          }
          if (item.data?.uniqueId) {
            console.log("Clicked item ID:", item.data.uniqueId);
            console.log("Item type:", item.className || item.constructor.name);
          }
          if (event.modifiers.shift) {
            item.selected = !item.selected;
          } else if (!item.selected) {
            paperScopeRef.current.project.deselectAll();
            item.selected = true;
          }

          updateSelectedItems();
        } else if (!event.modifiers.shift) {
          paperScopeRef.current.project.deselectAll();
          updateSelectedItems();
        }
      }
    };

    tool.onMouseDrag = (event) => {
      if (!paperScopeRef.current) return;

      try {
        if (panonoff) return;

        if (mode === "select" && selectedItems.length > 0) {
          const delta = event.delta;
          selectedItems.forEach((item) => {
            if (item.data?.movable !== false) {
              item.position = item.position.add(delta);
            }
          });
          return;
        }

        if (mode === "freehand" && pathRef.current) {
          pathRef.current.add(event.point);
          return;
        }

        if (mode === "line" && pathRef.current) {
          pathRef.current.lastSegment.point = event.point;
            pathRef.current.strokeWidth = 2 / paperScopeRef.current.view.zoom;
          return;
        }

        if (mode === "rectangle" && pathRef.current) {
          pathRef.current.remove();
          pathRef.current = new paperScopeRef.current.Path.Rectangle({
            from: startPointRef.current,
            to: event.point,
            strokeColor: "black",
              strokeWidth: 2 / paperScopeRef.current.view.zoom,
            fillColor: "rgba(0,0,0,0.1)",
            name: "drawing-item",
          });
          pathRef.current.data = {
            selectable: true,
            uniqueId: generateUniqueId(),
            movable: true,
          };
          drawingLayer.current.addChild(pathRef.current);
          return;
        }

        if (mode === "circle" && pathRef.current) {
          const radius = startPointRef.current.getDistance(event.point);
          pathRef.current.remove();
          pathRef.current = new paperScopeRef.current.Path.Circle({
            center: startPointRef.current,
            radius: radius,
            strokeColor: "black",
             strokeWidth: 2 / paperScopeRef.current.view.zoom,
            fillColor: "rgba(0,0,0,0.1)",
            name: "drawing-item",
          });
          pathRef.current.data = {
            selectable: true,
            uniqueId: generateUniqueId(),
            movable: true,
          };
          drawingLayer.current.addChild(pathRef.current);
          return;
        }
      } catch (err) {
        console.error("Mouse drag error:", err);
      }
    };

   tool.onMouseUp = (event) => {
  if (!paperScopeRef.current) return;

  try {
    if (panonoff) return;

    if (
      pathRef.current &&
      (mode === "freehand" ||
        mode === "line" ||
        mode === "rectangle" ||
        mode === "circle")
    ) {
      // Define minimum size thresholds
      const MIN_LINE_LENGTH = 5; // pixels
      const MIN_SHAPE_SIZE = 5; // pixels (for width/height or radius)

      let shouldRemove = false;

      switch (mode) {
        case "freehand":
          shouldRemove = pathRef.current.segments.length < 2;
          break;
        case "line":
          shouldRemove = pathRef.current.length < MIN_LINE_LENGTH;
          break;
        case "rectangle":
          const rectBounds = pathRef.current.bounds;
          shouldRemove = 
            rectBounds.width < MIN_SHAPE_SIZE || 
            rectBounds.height < MIN_SHAPE_SIZE;
          break;
        case "circle":
          shouldRemove = pathRef.current.bounds.width < MIN_SHAPE_SIZE;
          break;
          default:
      }
 if (!shouldRemove) {
        pathRef.current = null;
        saveToHistory(); // Only save here when the action is complete
      }
      if (shouldRemove) {
        pathRef.current.remove();
      } else {
        if (mode === "freehand") {
          pathRef.current.simplify(10);
        }
        pathRef.current = null;
      }

      return;
    }

    saveToHistory();
  } catch (err) {
    console.error("Mouse up error:", err);
  }
};

    return () => {
      try {
        tool.remove();
        if (selectionLineRef.current) {
          selectionLineRef.current.remove();
          selectionLineRef.current = null;
        }
      } catch (err) {
        console.error("Tool cleanup error:", err);
      }
    };
  }, [
    mode,
    panonoff,
    selectionMode,
    updateSelectedItems,
    generateUniqueId,
    saveToHistory,
    selectedItems,
    handleResize,
    itemTags,
  ]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleRightClick = (event) => {
      if (!paperScopeRef.current) return;

      const selected = paperScopeRef.current.project.getItems({
        recursive: true,
        match: (item) => item.selected,
      });

      if (selected.length === 0) return;

      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      setContextMenu({
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    canvas.addEventListener("contextmenu", handleRightClick);
    return () => {
      canvas.removeEventListener("contextmenu", handleRightClick);
    };
  }, [itemTags]);

  const deleteSelectedItems = useCallback(() => {
    if (!paperScopeRef.current || selectedItems.length === 0) return;

    try {
      paperScopeRef.current.project.deselectAll();
      selectedItems.forEach((item) => {
        try {
          item.remove();
        } catch (err) {
          console.error("Error removing item:", err);
        }
      });
      setSelectedItems([]);
      saveToHistory();
      handleResize();
    } catch (err) {
      console.error("Error deleting items:", err);
      setError("Failed to delete selected items");
    }
  }, [selectedItems, saveToHistory, handleResize]);

  const resetView = useCallback(() => {
    if (!paperScopeRef.current || !mainContainerRef.current) return;

    try {
      handleResize();
    } catch (err) {
      console.error("Error resetting view:", err);
      setError("Failed to reset view");
    }
  }, [handleResize]);

  const handleTagClick = useCallback(
    (tagId) => {
      if (!paperScopeRef.current || !itemTags[tagId]) return;

      // Save current selection state
      const previousSelection = [...selectedItems];

      try {
        paperScopeRef.current.project.deselectAll();
        const uniqueIds = itemTags[tagId].uniqueIds
          .map((entry) => entry.unique_id)
          .filter(Boolean);

        if (uniqueIds.length === 0) {
          setShowTagsList(false);
          return;
        }

        // Select new items
        const itemsToSelect = paperScopeRef.current.project.getItems({
          recursive: true,
          match: (item) =>
            item.data?.uniqueId && uniqueIds.includes(item.data.uniqueId),
        });

        itemsToSelect.forEach((item) => (item.selected = true));

        // Update state while preserving previous selection context
        setSelectedItems(itemsToSelect);
        temarrRef.current = uniqueIds;
        setShowTagsList(false);

        // Return a function to restore previous selection if needed
        return () => {
          paperScopeRef.current.project.deselectAll();
          previousSelection.forEach((item) => (item.selected = true));
          setSelectedItems(previousSelection);
        };
      } catch (err) {
        console.error(err);
      }
    },
    [itemTags]
  );

  useEffect(() => {
    if (tagId && isCanvasLoaded && Object.keys(itemTags).length > 0) {
      const cleanup = handleTagClick(tagId);

      // Return cleanup to restore normal operation
      return () => {
        if (cleanup) cleanup();
        paperScopeRef.current?.project.deselectAll();
        setSelectedItems([]);
        temarrRef.current = [];
      };
    }
  }, [tagId, isCanvasLoaded, itemTags]);
  const handleSaveToBackend = async () => {
    if (!paperScopeRef.current) return;

    try {
      if (!fileId) {
        throw new Error("No fileId provided for saving");
      }

      const project = paperScopeRef.current.project;

      viewStateRef.current = {
        center: project.view.center.clone(),
        zoom: project.view.zoom,
        bounds: project
          .getItems({
            recursive: true,
            visible: true,
          })
          .reduce(
            (bounds, item) => bounds.unite(item.bounds),
            new paper.Rectangle(0, 0, 0, 0)
          ),
      };

      textBoxes.forEach((box) => {
        const textItem = new paperScopeRef.current.TextItem({
          point: box.point,
          content: box.content,
          fillColor: "black",
          fontSize: 14,
        });
        textItem.data = {
          uniqueId: box.id,
          selectable: true,
          isText: true,
          textContent: box.content,
          movable: true, // Text items are movable
        };
        const textLayer =
          paperScopeRef.current.project.getItems({
            name: "TextItem-layer",
          })[0] || new paperScopeRef.current.Layer({ name: "TextItem-layer" });
        textLayer.addChild(textItem);
      });
      setTextBoxes([]);

      project.getItems({ recursive: true }).forEach((item) => {
        if (!item.data) item.data = {};
        if (!item.data.uniqueId) {
          item.data.uniqueId = generateUniqueId();
        }
        item.data.originalMatrix = item.matrix.clone();
      });

      const exportableItems = project.getItems({
        recursive: true,
        match: (item) =>
          item.data?.uniqueId &&
          item.visible !== false &&
          !item.name?.startsWith("selection-") &&
          !(item instanceof paperScopeRef.current.Layer),
      });

      console.log("Exporting items for saving:", exportableItems.length);
      exportableItems.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          uniqueId: item.data.uniqueId,
          type: item.className,
          layer: item.layer?.name || "unknown",
        });
      });

      const uniqueItemsMap = new Map();
      exportableItems.forEach((item) => {
        if (!uniqueItemsMap.has(item.data.uniqueId)) {
          uniqueItemsMap.set(item.data.uniqueId, item);
        } else {
          console.warn(
            `Duplicate item ${item.data.uniqueId} skipped during save`
          );
        }
      });

      const itemsToSave = Array.from(uniqueItemsMap.values())
        .map((item) => {
          try {
            const jsonData = item.exportJSON({ asString: false });
            return {
              uniqueId: item.data.uniqueId,
              json: JSON.stringify(jsonData),
            };
          } catch (err) {
            console.error(`Failed to export item ${item.data.uniqueId}:`, err);
            return null;
          }
        })
        .filter((item) => item !== null);

      const svgContent = project.exportSVG({
        asString: true,
        matrix: paperScopeRef.current.view.matrix,
        bounds: "content",
        embedImages: true,
        precision: 5,
      });

      console.log("Saving to backend:", {
        fileId,
        itemCount: itemsToSave.length,
        svgLength: svgContent.length,
      });

      const response = await UpdateSpidData(
        fileId,
        svgContent,
        itemsToSave,
        viewStateRef.current
      );
      console.log("Backend response:", response.data);
      alert(`Changes saved successfully. ${itemsToSave.length} items saved.`);
      captureSnapshot();
    } catch (err) {
      console.error("Failed to save:", {
        error: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(
        `Failed to save changes: ${err.response?.data?.message || err.message}`
      );
    }
  };

  const AssignedTags = async (fileId) => {
    const response = await getAssignedTags(fileId);
    if (response.status === 200) {
      console.log("itemTags from backend:", response.data);

      const tagsMap = {};
      response.data.forEach((tag) => {
        tagsMap[tag.tag_id] = {
          tagName: tag.tagName,
          uniqueIds: tag.uniqueIds,
        };
      });
      setItemTags(tagsMap);
    }
  };

  useEffect(() => {
    AssignedTags(fileId);
  }, [tagAssign]);

  const handleDoubleClickLogic = useCallback(
    (point) => {
      if (!paperScopeRef.current) return;

      console.log("Double-click processing at:", point);

      paperScopeRef.current.project.deselectAll();

      let hitResult = paperScopeRef.current.project.hitTest(point, {
        segments: false,
        stroke: true,
        fill: true,
        tolerance: 2,
        match: (hit) => hit.item.data?.selectable !== false,
      });

         if (!hitResult) {
      hitResult = paperScopeRef.current.project.hitTest(point, {
        segments: false,
        stroke: true,
        fill: true,
        tolerance: 5,
        match: (hit) => hit.item.data?.selectable !== false,
      });
    }   if (!hitResult) {
      hitResult = paperScopeRef.current.project.hitTest(point, {
        bounds: true,
        tolerance: 1, // Very small tolerance for bounds
        match: (hit) => hit.item.data?.selectable !== false,
      });
    }
if (!hitResult) {
      console.log("No item was double-clicked");
      setDisplayedTag(null);
      setTagPosition({ x: 0, y: 0 });
      return;
    }
      const item = hitResult.item;
      if (!item.data?.uniqueId) {
        console.log("Double-clicked item has no uniqueId");
        return;
      }

      item.selected = true;
      setSelectedItems([item]);
      updateSelectedItems();

      const itemId = item.data.uniqueId;
      console.log("Double-clicked item ID:", itemId);

      const viewPoint = paperScopeRef.current.view.projectToView(point);
      const canvasRect = canvasRef.current.getBoundingClientRect();

      let tagX = viewPoint.x + 10;
      let tagY = viewPoint.y + 10;

      const tagWidth = 300;
      const tagHeight = 100;
      const margin = 10;

      tagX = Math.max(
        margin,
        Math.min(tagX, canvasRect.width - tagWidth - margin)
      );
      tagY = Math.max(
        margin,
        Math.min(tagY, canvasRect.height - tagHeight - margin)
      );

      setTagPosition({ x: tagX, y: tagY });

      const assignedTags = Object.entries(itemTags).filter(
        ([tagId, tagData]) => {
          return tagData.uniqueIds.some((entry) => entry.unique_id === itemId);
        }
      );

      if (assignedTags.length > 0) {
        const tagDisplayText = assignedTags
          .map(([tagId, tagData]) => {
            return `Tag Name: ${tagData.tagName}`;
          })
          .join("\n\n");

        setDisplayedTag(tagDisplayText);

        assignedTags.forEach(([tagId, tagData]) => {
          // console.log(`Tag ${tagId} (${tagData.tagName}) contains:`, {
          //   tagId,
          //   tagName: tagData.tagName,
          //   uniqueIds: tagData.uniqueIds.map(u => u.unique_id)
          // });
        });
      } else {
        setDisplayedTag(`No tags assigned`);
      }

      setTimeout(() => {
        setDisplayedTag(null);
        setTagPosition({ x: 0, y: 0 });
      }, 5000);
    },
    [itemTags, updateSelectedItems]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !paperScopeRef.current) return;

    const handleNativeDblClick = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = new paper.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      const projectPoint = paperScopeRef.current.view.viewToProject(point);

      handleDoubleClickLogic(projectPoint);
    };

    canvas.addEventListener("dblclick", handleNativeDblClick);

    const tool = new paperScopeRef.current.Tool();

    return () => {
      canvas.removeEventListener("dblclick", handleNativeDblClick);
      tool.remove();
    };
  }, [handleDoubleClickLogic]);

  const AssignedFlags = async (fileId) => {
    const response = await getAssignedFlags(fileId);
    if (response.status === 200) {
      setFlagData(response.data.data);
    } else {
      console.log("Something Went Wrong");
    }
  };

  useEffect(() => {
    AssignedFlags(fileId);
  }, []);

  if (error) {
    return (
      <div className="svg-error-container">
        <div className="svg-error-message">{error}</div>
        <button
          className="svg-error-retry"
          onClick={() => {
            setError(null);
            initializePaper();
            if (fileId) loadSvgFromBackend(fileId);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pid-app">
      <div className="pid-main-content" ref={mainContainerRef}>
        <div className="pid-canvas-container">
          <div className="pid-canvas-wrapper">
            <canvas
              ref={canvasRef}
              resize="true"
              className="pid-canvas"
              onClick={() => setContextMenu({ visible: false, x: 0, y: 0 })}
            />
            {displayedTag && (
              <div
                className="pid-tag-display"
                style={{
                  position: "absolute",
                  left: tagPosition.x,
                  top: tagPosition.y,
                  zIndex: 1000,
                  background: "rgba(255, 255, 255, 0.9)",
                  border: "1px solid #ccc",
                  padding: "8px",
                  borderRadius: "4px",
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
                  maxWidth: "300px",
                  whiteSpace: "pre-wrap",
                  fontSize: "12px",
                }}
              >
                {displayedTag}
              </div>
            )}
            <div className="pid-tooltip">
              {mode === "freehand" ? (
                <span>Freehand Drawing: Draw on the canvas</span>
              ) : mode === "line" ? (
                <span>Line Tool: Click and drag to draw a line</span>
              ) : mode === "rectangle" ? (
                <span>Rectangle Tool: Click and drag to draw a rectangle</span>
              ) : mode === "circle" ? (
                <span>Circle Tool: Click and drag to draw a circle</span>
              ) : mode === "select-rect" ? (
                <span>Rectangle Selection: Drag to select items</span>
              ) : mode === "select-line" ? (
                <span>Line Selection: Drag to select items</span>
              ) : panonoff ? (
                <span>Pan Mode: Click and drag to pan the canvas</span>
              ) : (
                <span>
                  Selection Mode: Click to select | Shift+Click to multi-select
                </span>
              )}
            </div>
            {contextMenu.visible && (
              <div
                className="pid-context-menu"
                style={{
                  position: "absolute",
                  left: contextMenu.x,
                  width: "200px",
                  top: contextMenu.y,
                  zIndex: 1000,
                  background: "white",
                  border: "1px solid #ccc",
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
                  padding: "5px",
                  borderRadius: "5px",
                }}
              >
                <div className="d-flex justify-content-between">
                  <h6>Control</h6>
                  <div
                    onClick={() =>
                      setContextMenu({ visible: false, x: 0, y: 0 })
                    }
                    className="me-2"
                  >
                    <FontAwesomeIcon icon={faXmark} />{" "}
                  </div>
                </div>
                <hr
                  style={{
                    marginTop: "-2px",
                  }}
                />
                {selectedItems.length > 0 && (
                  <div>
                    <TagAssign
                      selectedItems={selectedItems}
                      fileId={fileId}
                      setTagAssign={setTagAssign}
                      setContextMenu={setContextMenu}
                    />
                    <br />
                    {flagdata.some(
                      (flag) =>
                        flag.flagText === FlagText.text ||
                        (temarrRef.current &&
                          temarrRef.current.some(
                            (selectedId) =>
                              flag.uniqueIds &&
                              flag.uniqueIds.includes(selectedId)
                          ))
                    ) ? (
                      flagdata.map((flag) => {
                        if (
                          flag.flagText === FlagText.text ||
                          (temarrRef.current &&
                            temarrRef.current.some(
                              (selectedId) =>
                                flag.uniqueIds &&
                                flag.uniqueIds.includes(selectedId)
                            ))
                        ) {
                          return (
                            <p
                              key={flag.id}
                              style={{
                                margin: 0,
                                padding: "5px",
                                color: "#666",
                              }}
                            >
                              Flag <strong>{flag.flagText}</strong> is assigned.{" "}
                              <a
                                href={`/canvas/${flag.AssigneddocumentId}`}
                                style={{
                                  textDecoration: "none",
                                }}
                              >
                                Go to document {flag.documentTitle}
                              </a>
                            </p>
                          );
                        }
                        return null;
                      })
                    ) : (
                      <FlagAssign
                        uniqueIds={temarrRef.current}
                        fileId={fileId}
                        FlagText={FlagText}
                        setContextMenu={setContextMenu}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            {showTagsList && (
              <div
                className="pid-tags-list"
                style={{
                  position: "absolute",
                  top: "50px",
                  right: "10px",
                  width: "200px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  zIndex: 1000,
                  background: "white",
                  border: "1px solid #ccc",
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
                  padding: "10px",
                  borderRadius: "5px",
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <h6>Tags</h6>
                  <div
                    onClick={() => setShowTagsList(false)}
                    style={{ cursor: "pointer" }}
                    className="me-2"
                  >
                    <FontAwesomeIcon icon={faXmark} />{" "}
                  </div>
                </div>
                <hr style={{ margin: "5px 0" }} />
                {Object.keys(itemTags).length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {Object.entries(itemTags).map(([tagId, tagData]) => (
                      <li
                        key={tagId}
                        onClick={() => handleTagClick(tagId)}
                        style={{
                          padding: "5px 10px",
                          cursor: "pointer",
                          borderRadius: "3px",
                          marginBottom: "5px",
                          background: "#f8f9fa",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#e9ecef")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#f8f9fa")
                        }
                      >
                        {tagData.tagName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: "#666" }}>No tags assigned</p>
                )}
              </div>
            )}
            {textBoxes.map((box) => {
              const viewPoint = paperScopeRef.current?.view?.projectToView(
                box.point
              ) || { x: 0, y: 0 };
              return (
                <textarea
                  key={box.id}
                  value={box.content}
                  onChange={(e) => {
                    const newContent = e.target.value;
                    setTextBoxes((prev) =>
                      prev.map((b) =>
                        b.id === box.id ? { ...b, content: newContent } : b
                      )
                    );
                  }}
                  style={{
                    position: "absolute",
                    left: `${viewPoint.x}px`,
                    top: `${viewPoint.y}px`,
                    width: "120px",
                    height: "40px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    padding: "4px",
                    resize: "none",
                    zIndex: 10,
                  }}
                />
              );
            })}
          </div>

          <div className="pid-controls-panel">
            <button
              onClick={handleSaveToBackend}
              className="pid-button"
              title="Save"
            >
              <FontAwesomeIcon icon={faFloppyDisk} />{" "}
            </button>
            {Object.keys(itemTags).length > 0 && (
              <div className="pid-tool-group">
                <button
                  onClick={() => setShowTagsList((prev) => !prev)}
                  className={`pid-button ${showTagsList ? "active" : ""}`}
                  title="View Tags"
                >
                  <FontAwesomeIcon icon={faTags} />
                </button>
              </div>
            )}
            <div className="pid-tool-group">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="pid-button"
                title="Undo"
              >
                <FontAwesomeIcon icon={faUndo} />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="pid-button"
                title="Redo"
              >
                <FontAwesomeIcon icon={faRedo} />
              </button>
            </div>
            <button
              onClick={zoomIn}
              className="pid-button"
              title="Zoom In"
              disabled={zoomLevel >= maxZoom}
            >
              <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
            </button>
            <button
              onClick={zoomOut}
              className="pid-button"
              title="Zoom Out"
              disabled={zoomLevel <= minZoom}
            >
              <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
            </button>
            <div className="pid-tool-group">
              <button
                onClick={() => {
                  setMode("select");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "select" ? "active" : ""}`}
                title="Select"
              >
                <FontAwesomeIcon icon={faMousePointer} />
              </button>
              <button
                onClick={() => {
                  setMode("select-line");
                  setPanonoff(false);
                }}
                className={`pid-button ${
                  mode === "select-line" ? "active" : ""
                }`}
                title="Select by Line"
              >
                <FontAwesomeIcon icon={faSlash} rotation={90} />
              </button>
              <button
                onClick={() => {
                  setMode("select-rect");
                  setPanonoff(false);
                }}
                className={`pid-button ${
                  mode === "select-rect" ? "active" : ""
                }`}
                title="Select by Rectangle"
              >
                <FontAwesomeIcon icon={faVectorSquare} />
              </button>
            </div>
            <div className="pid-tool-group">
              <button
                onClick={() => {
                  setMode("text");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "text" ? "active" : ""}`}
                title="Add Text"
              >
                <FontAwesomeIcon icon={faFont} />
              </button>
            </div>
            <div className="pid-tool-group">
              <button
                onClick={() => {
                  setMode("freehand");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "freehand" ? "active" : ""}`}
                title="Freehand Draw"
              >
                <FontAwesomeIcon icon={faPencilAlt} />
              </button>
              <button
                onClick={() => {
                  setMode("line");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "line" ? "active" : ""}`}
                title="Draw Line"
              >
                <FontAwesomeIcon icon={faRulerHorizontal} />
              </button>
              <button
                onClick={() => {
                  setMode("rectangle");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "rectangle" ? "active" : ""}`}
                title="Draw Rectangle"
              >
                <FontAwesomeIcon icon={faSquare} />
              </button>
              <button
                onClick={() => {
                  setMode("circle");
                  setPanonoff(false);
                }}
                className={`pid-button ${mode === "circle" ? "active" : ""}`}
                title="Draw Circle"
              >
                <FontAwesomeIcon icon={faCircle} />
              </button>
            </div>
            <div className="pid-tool-group">
              <button
                onClick={handlepan}
                className={`pid-button ${panonoff ? "active" : ""}`}
                title="Pan"
              >
                <FontAwesomeIcon icon={faHandPaper} />
              </button>
              <button
                onClick={resetView}
                className="pid-button"
                title={`Reset View (${(zoomLevel * 100).toFixed(0)}%)`}
              >
                <FontAwesomeIcon icon={faSearch} />
              </button>
            </div>

            {selectedItems.length > 0 && (
              <button
                onClick={deleteSelectedItems}
                className="pid-button delete"
                title={`Delete (${selectedItems.length})`}
              >
                <FontAwesomeIcon icon={faTrashAlt} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpidCanvas;
