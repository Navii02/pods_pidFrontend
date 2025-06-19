import React, { useRef, useState } from "react";
import BabylonLODManager from "../components/LoadTilesUsingLod";
import CommentModal from "../components/CommentModal";
import {
  faGear,
  faMousePointer,
  faPlane,
  faScissors,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Axis3d } from "lucide-react";

function GlobalModalOpen({leftNavVisible}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mockContent = {
    intersectionPointX: 100,
    intersectionPointY: 200,
    intersectionPointZ: 300,
  };

  const mockStatusList = [
    { statusname: "Open" },
    { statusname: "Resolved" },
    { statusname: "Pending" },
  ];

  const [viewMode, setViewMode] = useState("Top View");

  const [mode, setMode] = useState("");
  const [orthoviewmode, setOrthoviewmode] = useState("perspective");
  const [showComment, setShowComment] = useState(false);
  const [selectedItem, setSelectedItem] = useState(false);
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

  // handel orbit control
  const handleOrbitClick = (buttonName) => {
    setMode("orbit");
    setActiveButton(buttonName);
  };

  // handel fly control
  const handleFlyClick = (buttonName) => {
    setMode("fly");
    setActiveButton(buttonName);
  };

  const handleEnterVR = (buttonName) => {
    setMode("webxr");
    setActiveButton(buttonName);
  };

  const handleShowAxis = (buttonName) => {
    setShowAxis(!showAxis);
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
    setSelectedItem(true);
    setActiveButton(buttonName);
    setShowMeasure(false);
  };

  // handle setting
  const handleSetting = (buttonName) => {
    setsettingbox(true);
    setActiveButton(buttonName);
  };

  const handleEnableSectioning = (buttonName) => {
    setActiveButton(buttonName);
    setEnableClipping(!enableClipping);
  };

  const handleShowMeasure = (buttonName) => {
    setShowMeasure(!showMeasure);
    setActiveButton(buttonName);
  };

  const handleWireFrame = (buttonName) => {
    setShowWireFrame(!showWireFrame);
    setActiveButton(buttonName);
  };

  const handleSavedView = (buttonName) => {
    setActiveButton(buttonName);
    setSavedViewDialog(true);
  };

  return (
    <div>
      <div className="d-flex">
        <div className="w-100">
          <BabylonLODManager
            mode={mode}
            viewMode={viewMode}
            setViewMode={setViewMode}
            leftNavVisible={leftNavVisible}
            showMeasure={showMeasure}
            setShowWireFrame={setShowWireFrame}
            showWireFrame={showWireFrame}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            setActiveButton={setActiveButton}
          />
        </div>

        <div class="right-sidenav">
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
                      src="/images/orbit.png"
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

              <li className={activeButton === "webxr" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleEnterVR("webxr")}
                    title="Fly camera"
                  >
                    <i class="fa-solid fa-shield  fs-4"></i>
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
                  onClick={() => handleEnableSectioning("clip")}
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
                    <i class="fa-solid fa-arrows-to-dot fs-4"></i>
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
                      src="/images/orthographic.png"
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
                      src="/images/perspective.png"
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
                    <img className="button" src="/images/front.png" alt="" />
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
                    <img className="button" src="/images/left.png" alt="" />
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
                    <img className="button" src="/images/back.png" alt="" />
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
                    <img className="button" src="/images/right.png" alt="" />
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
                    <img className="button" src="/images/top.png" alt="" />
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
                    <img className="button" src="/images/bottom.png" alt="" />
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
                      class="button"
                      src="/images/measure.png"
                      alt=""
                    />
                  </span>
                </div>
              </li>
              <li className={activeButton === "wireframe" ? "active" : ""}>
                <div className="tooltip-container">
                  <span
                    className="icon-tooltip"
                    onClick={() => handleWireFrame("wireframe")}
                    title="Wire frame"
                  >
                    <img
                      id="wireframe"
                      class="button"
                      src="/images/wireframe.png"
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
                      class="button"
                      src="/images/save-icon.png"
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
                      src="/images/theme.png"
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
                      class="button"
                      src="/images/4d_plan.png"
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
                    <i class="fa-solid fa-comment fs-4"></i>
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalModalOpen;
