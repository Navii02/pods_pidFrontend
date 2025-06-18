/* Developed by POUL CONSULT, Hetlandsgata 9, 4344 Bryne. */
/* @author JaleelaBasheer*/
import React, { useState, useEffect, useRef } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Outlet, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {faPlus , faPlusCircle ,faMinusCircle,faUpRightAndDownLeftFromCenter,faTrash } from "@fortawesome/free-solid-svg-icons";
import Sidebar from "../components/Sidebar";
import ProjectModal from "../components/ProjectModal";
import { getProjects, saveProject, updateProject, deleteProject } from '../services/CommonApis';

function HomePage() {

  const [leftNavVisible, setLeftNavVisible] = useState(true);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("Top View");
  const [assetList, setAssetList] = useState([]);
  const [ionAssetId, setIonAssetId] = useState("");
  const [mode, setMode] = useState("");
  const [orthoviewmode, setOrthoviewmode] = useState("perspective");
  const [showComment, setShowComment] = useState(false);
  const [zoomfit, setzoomfit] = useState(false);
  const [selectedItem, setselectedItem] = useState(false);
  const [activeButton, setActiveButton] = useState(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [projectFolder, setProjectFolder] = useState("");
  const [projectNo, setprojectNo] = useState("");
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [settingbox, setsettingbox] = useState(false);
  const [equipement, setEquipment] = useState(false);
  const [iRoamercanvas, setiRoamercanvas] = useState(true);
  const [allArea, setAllArea] = useState([]);
  const [discDialog, setdiscDialog] = useState(false);
  const [allDisc, setallDisc] = useState([]);
  const [sysDialog, setsysDialog] = useState(false);
  const [allSys, setallSys] = useState([]);
  const [showTagDialog, setshowTagDialog] = useState(false);
  const [rightSideNavVisible, setrightSideNavVisible] = useState(true);
  const [bulkimport, setbulkimport] = useState(false);
  const [loadProject, setloadProject] = useState(false);
  const [areaname, setAreaname] = useState("");
  const [discname, setdiscname] = useState("");
  const [sysname, setsysname] = useState("");
  const [showDisc, setshowDisc] = useState({});
  const [showSys, setshowSys] = useState({});
  const [lineList, setLineList] = useState(false);
  const [expandTags, setExpandTags] = useState(false);
  const [expandGLobalModal, setexpandGLobalModal] = useState(false);
  const [assigntokenmodal, setAssignTokenModal] = useState(false);
  const [selectedprojectPath, setselectedprojectPath] = useState("");
  const [gettokenNumber, setgettokenNumber] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [alltags, setAlltags] = useState([]);
  const [tagsystem, setTagSystem] = useState([]);
  const [showTag, setShowTag] = useState({});
  const [expandTag, setExpandtag] = useState({});
  const [unassignedmodel, setunassignedmodel] = useState([]);
  const [selectunassigned, setselectunassigned] = useState(false);
  const [showContents, setShowCOntents] = useState(false);
  const [expandUnassigned, setExpandUnassigned] = useState(false);
  const [registerTag, setRegisterTag] = useState(false);
  const [reviewTag, setReviewtag] = useState(false);
  const [spidopen, setSpidOpen] = useState(false);
  const [expanddocument, setExpandDocument] = useState(false);
  const [registerDocument, setRegisterDocument] = useState(false);
  const [allDocuments, setAllDocuments] = useState([]);
  const [objecttable, setobjecttable] = useState([]);
  const [allfilestable, setallfilestable] = useState([]);
  const [unassignedCheckboxStates, setUnassignedCheckboxStates] = useState({});
  const [allLineList, setAllLineList] = useState([]);
  const [allEquipementList, setAllEquipementList] = useState([]);
  const [selectAllUnassignedModels, setselectAllUnassignedModels] = useState(
    []
  );
  const [assignTagUnassigned, setAssignTagUnassigned] = useState(false);
  const [openSpidCanvas, setOpenSpidCanvas] = useState(false);
  const [openThreeCanvas, setopenThreeCanvas] = useState(false);
  const [createAssetDialog, setCreateAssetDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState(false);
  const [allComments, SetAllComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewHideThree, setViewHideThree] = useState({});
  const [viewHideThreeunassigned, setViewHideThreeunassigned] = useState({});
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);
  const [openGlobalModal, setOpenGlobalModal] = useState(false);
  const [openTagInfoTable, setTagInfoTable] = useState(false);
  const [userTagInfotable, setUserTagInfoTable] = useState([]);
  const [assetIdProject, setAssetIdProject] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [allprojectDetails, setAllprojectDetails] = useState([]);
  const [showMeasure, setShowMeasure] = useState(false);
  const [showWireFrame, setShowWireFrame] = useState(false);
  const [extendvalidityModal, setExtendvalidityModal] = useState(false);
  let offsets = [];
  let offsetsobject = [];
  const [offsetTable, setOffsetTable] = useState([]);
  const [objectoffsetTable, setobjectoffsetTable] = useState([]);
  const [fileNamePath, setFileNamePath] = useState("");
  const [commentExpand, setCommentExpand] = useState(false);
  const [editCommentStatus, setEditCommentStatus] = useState(false);
  const [allCommentStatus, setAllCommentStatus] = useState([]);
  const [CommentReviewOpen, setCommentReviewOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("three");
  const [activeTab, setActiveTab] = useState("");
  const [savedViewDialog, setSavedViewDialog] = useState(false);
  const [allViews, setAllViews] = useState([]);
  const [generalTagInfoFields, setGeneralTagInfoFields] = useState([]);
  const [expandTreeManangement, setExpandTreeManangement] = useState(false);
  const [areaPopUpBox, setAreaPopUpBox] = useState(false);
  const [discPopUpBox, setDiscPopUpBox] = useState(false);
  const [sysPopUpBox, setSysPopUpBox] = useState(false);
  const [allAreasInTable, setAllAreasInTable] = useState([]);
  const [allDiscsInTable, setAllDiscsInTable] = useState([]);
  const [allSysInTable, setAllSysInTable] = useState([]);
  const [openTreeTable, setOpenTreeTable] = useState(false);
  const [reviewGenTagInfo, setReviewGenTagInfo] = useState(false);
  const [genTagFields, setGenTagFields] = useState(false);
  const startTimeRef = useRef(new Date());
  const [activate, setActivate] = useState(false);
  const [appId, setAppId] = useState("");
  const [applyView, setApplyView] = useState(null);
  const [enableClipping, setEnableClipping] = useState(false);
  const [openWorkPackage, setOpenWorkPackage] = useState(false);
  const [open4dPlan, setOpen4dPlan] = useState(false);

  // ------------------------------------PID--------------------------
  const [svgcontent, setsvgcontent] = useState("");
  const [allspids, setAllspids] = useState([]);
  const [allareas, setallareas] = useState([]);
  const [backgroundColorTag, setBackgroundColorTag] = useState({});
  const [highlightedTagKey, setHighlightedTagKey] = useState(null);
  const [tagdocsel, settagdocsel] = useState([]);
  const [showAxis, setShowAxis] = useState(true);
  const [backgroundTheme, setBackgroundTheme] = useState("DEFAULT");
  const [groundSettingsVisible, setGroundSettingsVisible] = useState(false);
  const [waterSettingsVisible, setWaterSettingsVisible] = useState(false);
  const [waterSettingParameter, setWaterSettingParameter] = useState(null);
  const [baseSettingParameter, setBaseSettingParameter] = useState(null);
  const [groundSettingParameter, setGroundSettingParameter] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState();
  const [editViewDialog, setEditViewDialog] = useState(false);
  const [editingView, setEditingView] = useState(null);
  const [editViewName, setEditViewName] = useState("");
  const babylonRef = useRef(); // Reference to the child
  const [clippingSetting, setClippingSetting] = useState(false);
  const [allWorkPackage, setAllWorkPackage] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [startModalProcess, setModalProcess] = useState(false);

  const handleEditClick = (view) => {
    setEditingView(view);
    setEditViewName(view.name);
    setEditViewDialog(true);
  };

  const handleCloseEditView = () => {
    setEditViewDialog(false);
    setEditingView(null);
    setEditViewName("");
  };

  const toggleLeftNav = () => {
    setLeftNavVisible(!leftNavVisible);
  };
  const handleiRoamercanvas = (activesidelink) => {
    setActiveLink(activesidelink);
    setiRoamercanvas(true);
    setrightSideNavVisible(true);
    setEquipment(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
    setOpenSpidCanvas(false);
    setOpen4dPlan(false);
    setOpenWorkPackage(false);
        setOpenGlobalModal(false);

  };
  const handleequipementList = (activesidelink) => {
    setActiveLink(activesidelink);
    setEquipment(true);
    setOpenWorkPackage(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setActiveButton(null);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
    setOpen4dPlan(false);
  };
  const handlelineList = (activesidelink) => {
    setActiveLink(activesidelink);
    setLineList(true);
    setEquipment(false);
    setOpenWorkPackage(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setExpandTags(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setActiveButton(null);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
    setOpen4dPlan(false);
  };
  const handlebulkmodelimport = (activesidelink) => {
    setActiveLink(activesidelink);
    setEquipment(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setrightSideNavVisible(false);
    setbulkimport(true);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setActiveButton(null);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
  };
  const handleExpandTag = (activesidelink) => {
    setActiveLink(activesidelink);
    setActiveTab("review");
    setExpandTags(true);
    setEquipment(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    // setSpidOpen(false);
  };

  const handleRegisterTag = (activetablink) => {
    setActiveTab(activetablink);
    setRegisterTag(true);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
  };

  const handleExpandGlobalModal = (activesidelink) => {
    setActiveLink(activesidelink);
    setActiveTab("globalmodal");
    setExpandTags(false);
    setEquipment(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setexpandGLobalModal(true);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setOpenGlobalModal(true);
  };
  const handleReviewTag = (activetablink) => {
    setActiveTab(activetablink);
    setReviewtag(true);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setSpidOpen(false);
  };
  const handleExpandTreeManagement = (activesidelink) => {
    setActiveLink(activesidelink);
    setEquipment(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setrightSideNavVisible(false);
    setSpidOpen(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setTagInfoTable(false);
    setCommentExpand(false);
    setActiveButton(null);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(true);
    setOpenTreeTable(false);
  };

  const handleOpenTagInfoTable = (activesidelink) => {
    setActiveLink(activesidelink);
    setTagInfoTable(true);
    setEquipment(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setSpidOpen(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setCommentExpand(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };
  const handleOpenCommentManagement = (activesidelink) => {
    setActiveLink(activesidelink);
    setCommentExpand(true);
    setSpidOpen(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };
  const handleOpenWorkPackage = (activesidelink) => {
    setActiveLink(activesidelink);
    setOpenWorkPackage(true);
    setOpen4dPlan(false);
    setCommentExpand(false);
    setSpidOpen(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };
  const handleOpenCommentRiview = (activesidelink) => {
    setActiveTab(activesidelink);
    setCommentReviewOpen(true);
    setEditCommentStatus(false);
    setSpidOpen(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };
  const handleOpenCommentStatusTable = () => {
    setEditCommentStatus(true);
    setCommentReviewOpen(false);
    setSpidOpen(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };

  const handleOpenReviewGenTagInfo = () => {
    setReviewGenTagInfo(true);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setGenTagFields(false);
    setEditCommentStatus(false);
    setCommentReviewOpen(false);
    setSpidOpen(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };

  const handleOpen4DPlan = (activesidelink) => {
    setActiveLink(activesidelink);
    setOpenWorkPackage(false);
    setOpen4dPlan(true);
    setCommentExpand(false);
    setSpidOpen(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };

  const handleloadModel = (activesidelink)=>{
    setActiveTab(activesidelink);
    setCommentReviewOpen(false);
    setEditCommentStatus(false);
    setSpidOpen(false);
    setOpenWorkPackage(false);
    setOpen4dPlan(false);
    setTagInfoTable(false);
    setEquipment(false);
    setrightSideNavVisible(false);
    setbulkimport(false);
    setLineList(false);
    setExpandTags(false);
    setexpandGLobalModal(false);
    setRegisterTag(false);
    setReviewtag(false);
    setExpandDocument(false);
    setRegisterDocument(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setrightSideNavVisible(true);
    setOpenGlobalModal(true);
    setiRoamercanvas(false);
    
  }

  const handleCreateGlobalModalOpen = () => {
    console.log("enter");
    setCreateAssetDialog(true);
  };

  const handlehideThreeCanvas = (key, tag, isVisible) => {
    setViewHideThree((prevState) => ({
      ...prevState,
      [key]: isVisible,
    }));
  };
  const handlehideThreeCanvasUnassigned = (tag) => {
    setViewHideThreeunassigned((prevState) => ({
      ...prevState,
      [tag]: false, // Explicitly set visibility to false
    }));
  };

  const handleOpenThreeCanvas = (tagobject, tag, visible) => {
    const newViewHideThree = { ...viewHideThree };
    newViewHideThree[tagobject] = visible;
    setViewHideThree(newViewHideThree);

    // Send API request to fetch tag path
    if (visible) {
    //   window.api.send("fetch-tag-path", tag);
    }
    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
    setOpenWorkPackage(false);
  };

  const handleOpenThreeCanvasUnassigned = (tag, visible) => {
    setViewHideThreeunassigned((prevState) => ({
      ...prevState,
      [tag]: visible, // Explicitly set visibility to the provided value
    }));

    // Send API request to fetch tag path
    if (visible) {
    //   window.api.send("fetch-unassigned-path", tag);
    }
    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
    setExpandTreeManangement(false);
    setOpenTreeTable(false);
  };

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
    setselectedItem(true);
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

  const handleLoadProject = () => {
    setloadProject(true);
  };
  const handleAddArea = (areaName) => {
    setAreaname(areaName);
    setdiscDialog(true);
  };
  const handleShowDisc = (areaId) => {
    setAreaname(areaId);
    setshowDisc((prevState) => ({
      ...prevState,
      [areaId]: !prevState[areaId],
    }));
  };
  const handleShowEyeProject = (projectNo) => {
    const newViewHideThree = { ...viewHideThree };
    const toggleState = !viewHideThree[projectNo];

    // Update project-level visibility
    newViewHideThree[projectNo] = toggleState;

    // Iterate through all areas under the project
    allArea.forEach((area) => {
      const areaKey = area.area;
      newViewHideThree[areaKey] = toggleState;

      // Iterate through disciplines under the area
      allDisc.forEach((disc) => {
        if (disc.area === area.area) {
          const discKey = `${area.area}-${disc.disc}`;
          newViewHideThree[discKey] = toggleState;

          // Iterate through systems under the discipline
          allSys.forEach((sys) => {
            if (sys.area === area.area && sys.disc === disc.disc) {
              const sysKey = `${area.area}-${disc.disc}-${sys.sys}`;
              newViewHideThree[sysKey] = toggleState;

              // Iterate through tags under the system
              tagsystem.forEach((tag) => {
                if (
                  tag.area === area.area &&
                  tag.disc === disc.disc &&
                  tag.sys === sys.sys
                ) {
                  const tagKey = `${area.area}-${disc.disc}-${sys.sys}-${tag.tag}`;
                  if (toggleState && !viewHideThree[tagKey]) {
                    // window.api.send("fetch-tag-path", tag.tag);
                  }
                  newViewHideThree[tagKey] = toggleState;
                }
              });
            }
          });
        }
      });
    });

    setViewHideThree(newViewHideThree);

    // Trigger visibility-related UI updates
    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
  };

  const handleShowEyeDisc = (areaId) => {
    const newViewHideThree = { ...viewHideThree };

    // Get the toggle state for the area
    const toggleState = !viewHideThree[areaId];

    // Update visibility for the area
    newViewHideThree[areaId] = toggleState;

    // Iterate through all disciplines
    allDisc.forEach((disc) => {
      if (disc.area === areaId) {
        const discKey = `${areaId}-${disc.disc}`;
        newViewHideThree[discKey] = toggleState;

        allSys.forEach((sys) => {
          if (sys.disc === disc.disc && sys.area === areaId) {
            const sysKey = `${areaId}-${disc.disc}-${sys.sys}`;
            newViewHideThree[sysKey] = toggleState;

            // Iterate through tags associated with the system
            tagsystem.forEach((tag) => {
              if (
                tag.sys === sys.sys &&
                tag.disc === disc.disc &&
                tag.area === areaId
              ) {
                const tagKey = `${areaId}-${disc.disc}-${sys.sys}-${tag.tag}`;
                if (toggleState && !viewHideThree[tagKey]) {
                //   window.api.send("fetch-tag-path", tag.tag);
                }
                newViewHideThree[tagKey] = toggleState;
              }
            });
          }
        });
      }
    });

    setViewHideThree(newViewHideThree);

    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
  };
  const handleShoweyeSys = (discId, areaId) => {
    const newViewHideThree = { ...viewHideThree };

    // Get the toggle state for the discipline
    const discKey = `${areaId}-${discId}`;
    const toggleState = !viewHideThree[discKey];

    // Update visibility for the discipline
    newViewHideThree[discKey] = toggleState;

    // Iterate through systems associated with the discipline and area
    allSys.forEach((sys) => {
      if (sys.disc === discId && sys.area === areaId) {
        const sysKey = `${areaId}-${discId}-${sys.sys}`;
        newViewHideThree[sysKey] = toggleState;

        // Iterate through tags associated with the system
        tagsystem.forEach((tag) => {
          if (
            tag.sys === sys.sys &&
            tag.disc === discId &&
            tag.area === areaId
          ) {
            const tagKey = `${areaId}-${discId}-${sys.sys}-${tag.tag}`;
            if (toggleState && !viewHideThree[tagKey]) {
            //   window.api.send("fetch-tag-path", tag.tag);
            }
            newViewHideThree[tagKey] = toggleState;
          }
        });
      }
    });

    setViewHideThree(newViewHideThree);

    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
  };
  const handleShowEyeTag = (sysId, discId, areaId) => {
    const newViewHideThree = { ...viewHideThree };

    // Get the toggle state for the system
    const sysKey = `${areaId}-${discId}-${sysId}`;
    const toggleState = !viewHideThree[sysKey];

    // Update visibility for the system
    newViewHideThree[sysKey] = toggleState;

    // Iterate through tags associated with the system
    tagsystem.forEach((tag) => {
      if (tag.sys === sysId && tag.disc === discId && tag.area === areaId) {
        const tagKey = `${areaId}-${discId}-${sysId}-${tag.tag}`;
        if (toggleState && !viewHideThree[tagKey]) {
        //   window.api.send("fetch-tag-path", tag.tag);
        }
        newViewHideThree[tagKey] = toggleState;
      }
    });

    setViewHideThree(newViewHideThree);

    setopenThreeCanvas(true);
    setRegisterDocument(false);
    setSpidOpen(false);
    setReviewtag(false);
    setRegisterTag(false);
    setexpandGLobalModal(false);
    setEquipment(false);
    setrightSideNavVisible(true);
    setbulkimport(false);
    setLineList(false);
    setExpandDocument(false);
    setExpandTags(false);
  };

  const handleAddSystem = (discName, areaName) => {
    setdiscname(discName);
    setAreaname(areaName);
    setsysDialog(true);
  };
  const handleShowSys = (discId, areaId) => {
    setdiscname(discId);

    const key = `${areaId}-${discId}`;
    setshowSys((prevState) => ({
      ...prevState,
      [key]: !prevState[key],
    }));
  };

  const handleAddNewTag = (sysName, discName, areaName) => {
    setsysname(sysName);
    setdiscname(discName);
    setAreaname(areaName);
    setshowTagDialog(true);
  };

  const handleShowTag = (areaId, discId, sysId) => {
    setsysname(sysId);
    setdiscname(discId);
    setAreaname(areaId);
    const key = `${areaId}-${discId}-${sysId}`;
    setShowTag((prevState) => ({
      ...prevState,
      [key]: !prevState[key],
    }));
  };

  const handlePublishClick = () => {
    setShowAreaDialog(true);
  };

  const handleCloseAreaDialog = () => {
    setShowAreaDialog(false);
    setdiscDialog(false);
    setsysDialog(false);
    setshowTagDialog(false);
    setAssignTokenModal(false);
    setOpenDeleteModal(false);
    setAssignTagUnassigned(false);
    setCreateAssetDialog(false);
    setAreaPopUpBox(false);
    setDiscPopUpBox(false);
    setSysPopUpBox(false);
  };

 
 

  const handleDeleteTag = (tag, sys, disc, area) => {
    console.log(tag, disc, sys, area);
    setItemToDelete({
      type: "tag",
      area: area,
      disc: disc,
      sys: sys,
      tag: tag,
    });
    setCurrentDeleteNumber(tag);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const handleDeleteSystem = (sys, disc, area) => {
    console.log(sys, disc, area);
    setItemToDelete({ type: "system", area: area, disc: disc, sys: sys });
    setCurrentDeleteNumber(sys);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const handleDeleteDiscipline = (disc, area) => {
    setItemToDelete({ type: "discipline", area: area, disc: disc });
    setCurrentDeleteNumber(disc);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const handleDeleteArea = (tag) => {
    setItemToDelete({ type: "area", data: tag });
    setCurrentDeleteNumber(tag);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const handleDeleteUnassigned = () => {
    setItemToDelete({ type: "unassigned" });
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };
  const handleDeleteView = (saveViewMenu) => {
    setItemToDelete({ type: "view", data: saveViewMenu });
    setCurrentDeleteNumber(saveViewMenu);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const getFilenamesForTags = (tagsToMatch) => {
    return alltags
      .filter((tagObj) => tagsToMatch.includes(tagObj.number))
      .map((tagObj) => ({ filename: tagObj.filename }));
  };


  const handleCancelDelete = () => {
    setShowConfirm(false);
    setItemToDelete(null);
  };

  const handleSelectUnassigned = () => {
    const newSelectState = !selectunassigned;
    console.log("newSelectState", newSelectState);
    const newCheckboxStates = {};

    unassignedmodel.forEach((model, index) => {
      newCheckboxStates[index] = newSelectState;
    });

    setUnassignedCheckboxStates(newCheckboxStates);

    if (newSelectState) {
      setselectAllUnassignedModels(
        unassignedmodel.map((model) => ({
          filename: model.filename,
          number: model.number,
        }))
      );
    } else {
      setselectAllUnassignedModels([]);
    }

    setselectunassigned(newSelectState);
  };

  const handleCheckboxChange = (index) => {
    const newCheckboxStates = {
      ...unassignedCheckboxStates,
      [index]: !unassignedCheckboxStates[index],
    };

    setUnassignedCheckboxStates(newCheckboxStates);

    const newSelectedItems = [...selectAllUnassignedModels];
    const model = {
      filename: unassignedmodel[index].filename,
      number: unassignedmodel[index].number,
    };

    if (newCheckboxStates[index]) {
      newSelectedItems.push(model);
    } else {
      const itemIndex = newSelectedItems.findIndex(
        (item) =>
          item.filename === model.filename && item.number === model.number
      );
      if (itemIndex > -1) {
        newSelectedItems.splice(itemIndex, 1);
      }
    }

    setselectAllUnassignedModels(newSelectedItems);
    setselectunassigned(newSelectedItems.length > 0);
  };

  const handleShowContents = () => {
    setShowCOntents(!showContents);
  };
  const handleExpandUnassigned = () => {
    setExpandUnassigned(!expandUnassigned);
  };

  const handleTagsForUnassigned = () => {
    setAssignTagUnassigned(true);
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

  const handelAreaPopUp = () => {
    setAreaPopUpBox(true);
  };
  const handelDiscPopUp = () => {
    setDiscPopUpBox(true);
  };
  const handelSysPopUp = () => {
    setSysPopUpBox(true);
  };


    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [projectName, setProjectname] = useState('');
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projects, setProjects] = useState([]);
    const [projectDetails, setProjectDetails] = useState([]);
    const [error, setError] = useState('');
  
    const handleSidebarToggle = (collapsed) => {
      setIsSidebarCollapsed(collapsed);
    };
  
    const handleOpenProjectModal = async () => {
      setIsProjectModalOpen(true);
      try {
        const response = await getProjects();
        console.log(response);
        
        if (response.status === 200) {
          setProjectDetails(response.data.row || []);
          setProjects(response.data.row || []);
        } else {
          setError(`Unexpected response status: ${response.status}`);
          setProjects([]);
        }
      } catch (error) {
        setError('Failed to fetch projects. Please try again.');
        setProjects([]);
      }
    };
  
    const handleCloseProjectModal = () => {
      setIsProjectModalOpen(false);
    };
   const [activeMenuLink, setActiveMenuLink] = useState("three");
  const handleActiveLinkChange = (activeLink) => {
    setActiveMenuLink(activeLink);
    // Show right sidebar only when iRoamer (activeLink === "three") is active
    setrightSideNavVisible(activeLink === "three");
  };
  return (
    <div className="row" style={{ overflow: "hidden" }}>
      <div className="row" style={{ width: "100%", margin: "0", padding: "0" }}>
        <Header
          selectedprojectPath={selectedprojectPath}
          responseMessage={responseMessage}
          appId={appId}
        />
      </div>

      <div
        class="container"
        style={{ overflowY: "hidden", overflowX: "hidden" }}
      >
        {leftNavVisible && (
          <div class="left-sidenav" style={{ flex: "0 0 auto" }}>
            <div className="leftSideNav">
                 <Sidebar
                  setProjectname={setProjectname}
                  projectName={projectName}
                  onOpenProjectModal={handleOpenProjectModal}
                  onActiveLinkChange={handleActiveLinkChange} // Pass callback
                />
            </div>
          </div>
        )}

        <div className="content">
          <div className="spacer">
            <img
              onClick={toggleLeftNav}
              id="tree"
              src="/images/tree.png"
              alt=""
            />
          </div>
          <div
            style={{
              width: "100%",
              height: "90vh",
              backgroundColor: "#33334c",
              zIndex: "1",
            }}
          >
     {
      isProjectModalOpen &&  <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseProjectModal}
        projects={projects}
        projectDetails={projectDetails}
        setProjects={setProjects}
        setProjectDetails={setProjectDetails}
        setProjectname={setProjectname}
         saveProject={saveProject}
        updateProject={updateProject}
        deleteProject={deleteProject}
      />
 
     }
      <Outlet leftNavVisible={leftNavVisible}/>       
          </div>
        </div>

       
      </div>
      <div className="row">
        <Footer />
      </div>
    </div>
  );
}

export default HomePage
