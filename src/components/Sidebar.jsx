import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Alert from "../components/Alert";
import Arearegister from "../components/Tree/Arearegister";
import DisciplineRegister from "../components/Tree/DisiplineRegister";
import SystemRegister from "../components/Tree/SystemRegister";
import ProjectDetails from "./ProjectDetails";
import { iroamerContext, updateProjectContext } from "../context/ContextShare";
import { Modal } from "react-bootstrap";
import {
  faFighterJet,
  faTags,
  faInfoCircle,
  faListUl,
  faPenSquare,
  faArchive,
  faSliders,
  faLineChart,
  faBook,
  faBoxesStacked,
  faSuitcase,
  faUsersLine,
  faUserTie
} from "@fortawesome/free-solid-svg-icons";
import {
  AllSavedView,
  DeleteSavedView,
  UpdateSavedView,
} from "../services/CommonApis";
import DeleteConfirm from "./DeleteConfirm";
import { clearGlobalModal } from "../services/GlobalModalApi";
import { canAccess } from "../Utils/accessControl";

function Sidebar({
  onToggle,
  projectName,
  setProjectname,
  onOpenProjectModal,
  onActiveLinkChange,
}) {
  const { updateProject } = useContext(updateProjectContext);
  const { view } = useContext(iroamerContext);
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState(() => {
    return sessionStorage.getItem("activeItem") || "iRoamer";
  });

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProjectName, setShowProjectName] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(true);
  const sidebarMenuRef = useRef(null);
  const [openModal, setOpenModal] = useState({
    areaRegister: false,
    disciplineRegister: false,
    systemRegister: false,
  });
  const [allSavedViews, setAllSavedViews] = useState([]);
  const [showContents, setShowCOntents] = useState(false);
  const [activeLink, setActiveLink] = useState(() => {
    return sessionStorage.getItem("activeLink") || "three";
  });
  const [activeTab, setActiveTab] = useState("");
  const [editViewDialog, setEditViewDialog] = useState(false);
  const [editingView, setEditingView] = useState(null);
  const [editViewName, setEditViewName] = useState("");
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const userDetails = JSON.parse(sessionStorage.getItem("userDetails"));
  const userRole = userDetails?.role || "user";

  const projects = JSON.parse(sessionStorage.getItem("projects") || "{}");
  const selectedProjectId = project?.projectId;
  const selectedProjectAccess = projects[selectedProjectId]?.features?.project_access;
  const isUserAdminOnProject = userRole === "user" && selectedProjectAccess === "project_admin";

  // Reset to iRoamer when no project is selected (post-logout)
  useEffect(() => {
    const storedProject = sessionStorage.getItem("selectedProject");
    if (!storedProject) {
      setActiveItem("iRoamer");
      setActiveLink("three");
      sessionStorage.setItem("activeItem", "iRoamer");
      sessionStorage.setItem("activeLink", "three");
      setShowProjectName(false);
    } else {
      try {
        const project = JSON.parse(storedProject);
        if (project?.projectName) {
          setShowProjectName(true);
        } else {
          console.warn("Stored project data is invalid");
        }
      } catch (error) {
        console.error("Error parsing stored project:", error);
      }
    }
  }, [updateProject]);

  // Notify parent component when activeLink changes
  useEffect(() => {
    if (onActiveLinkChange) {
      onActiveLinkChange(activeLink);
    }
    sessionStorage.setItem("activeLink", activeLink);
    sessionStorage.setItem("activeItem", activeItem);
  }, [activeLink, activeItem, onActiveLinkChange]);

  const handleOpenModal = (modalName) => {
    setOpenModal((prev) => ({
      ...prev,
      [modalName]: true,
    }));
  };

  const handleCloseModal = (modalName) => {
    setOpenModal((prev) => ({
      ...prev,
      [modalName]: false,
    }));
  };

  const handleSubItemClick = (label, path, isModal = false, modalName = "", action = null, parentFeature = null) => {
  // Skip access check for admin panel sub-items
  if (["Assign Tokens", "Assign Projects", "Project Details", "Features assign"].includes(label)) {
    setActiveItem(label);
    setActiveTab(label);
    if (action && actionMap[action]) {
      actionMap[action]();
    } else if (isModal) {
      handleOpenModal(modalName);
    } else {
      navigate(path);
    }
    return;
  }

  // Determine required role
  const requiredRole = (isModal || action) ? "EDITOR" : "VIEWER";
  const feature = parentFeature || getFeatureFromName(label);
  
  // Debug access check
  console.log("Checking access:", { label, feature, requiredRole, projectId });
  const accessGranted = canAccess(projectId, feature, requiredRole);
  console.log("Access granted:", accessGranted);

  // Temporary bypass for "Review" under "Tags"
  if (label === "Review" && feature === "taglist") {
    console.log("Bypassing access check for Tags > Review");
    setActiveItem(label);
    setActiveTab(label);
    navigate(path);
    return;
  }

  if (!accessGranted) {
    console.log(`Access denied for feature: ${feature}, role: ${requiredRole}, projectId: ${projectId}`);
    alert("You do not have permission to access this feature.");
    return;
  }

  setActiveItem(label);
  setActiveTab(label);
  if (action && actionMap[action]) {
    actionMap[action]();
  } else if (isModal) {
    handleOpenModal(modalName);
  } else {
    navigate(path);
  }
};

  const handleMoveToSavedView = (view) => {
    const activeItem = sessionStorage.getItem("activeItem");
    if (!canAccess(projectId, "global_model", "VIEWER") && !canAccess(projectId, "iroamer", "VIEWER")) {
      alert("You do not have permission to access saved views.");
      return;
    }

    if (view) {
      if (activeItem === "Open Global Model") {
        navigate("/global-model/open", { state: { view: view } });
      } else {
        navigate("/iroamer", { state: { view: view } });
      }
    }
  };

  const [openMenus, setOpenMenus] = useState({
    documents: false,
    tags: false,
    treeManagement: false,
    globalModel: false,
    tagInfo: false,
    specManagement: false,
    mto: false,
    commentManagement: false,
  });

  const handleItemClick = (item) => {
    // Skip access check for admin panels
    if (item.name === "Super admin panel" || item.name === "Admin panel") {
      setActiveItem(item.name);
      setActiveLink(
        item.activeLink || item.name.toLowerCase().replace(/\s+/g, "")
      );

      if (item.toggleMenu) {
        const newOpenMenus = { ...openMenus };
        newOpenMenus[item.toggleMenu] = true;

        Object.keys(newOpenMenus).forEach((key) => {
          if (key !== item.toggleMenu) {
            newOpenMenus[key] = false;
          }
        });

        if (
          !openMenus[item.toggleMenu] &&
          item.subItems &&
          item.subItems.length > 0
        ) {
          const firstSubItem = item.subItems[0];
          setActiveItem(firstSubItem.name);
          setActiveTab(firstSubItem.name);
          if (firstSubItem.path) {
            navigate(firstSubItem.path);
          }
        } else if (openMenus[item.toggleMenu] && item.path) {
          navigate(item.path);
        }

        setOpenMenus(newOpenMenus);
      } else if (item.path) {
        setOpenMenus({
          documents: false,
          tags: false,
          treeManagement: false,
          globalModel: false,
          tagInfo: false,
          specManagement: false,
          mto: false,
          commentManagement: false,
        });
        navigate(item.path);
      }
      return;
    }

    // Check access for other main menu items
    const feature = getFeatureFromName(item.name);
    if (!canAccess(projectId, feature, "VIEWER")) {
      console.log(`Access denied for feature: ${feature}, role: VIEWER, projectId: ${projectId}`);
      alert("You do not have permission to access this feature.");
      return;
    }

    setActiveItem(item.name);
    setActiveLink(
      item.activeLink || item.name.toLowerCase().replace(/\s+/g, "")
    );

    if (item.toggleMenu) {
      const newOpenMenus = { ...openMenus };
      newOpenMenus[item.toggleMenu] = true;

      Object.keys(newOpenMenus).forEach((key) => {
        if (key !== item.toggleMenu) {
          newOpenMenus[key] = false;
        }
      });

      if (
        !openMenus[item.toggleMenu] &&
        item.subItems &&
        item.subItems.length > 0
      ) {
        const firstSubItem = item.subItems[0];
        if (canAccess(projectId, firstSubItem.parentFeature || getFeatureFromName(firstSubItem.name), "VIEWER") || 
            ["Assign Tokens", "Assign Projects", "Project Details", "Features assign"].includes(firstSubItem.name)) {
          setActiveItem(firstSubItem.name);
          setActiveTab(firstSubItem.name);
          if (firstSubItem.path) {
            navigate(firstSubItem.path);
          }
        } else {
          alert("You do not have permission to access this feature.");
        }
      } else if (openMenus[item.toggleMenu] && item.path) {
        navigate(item.path);
      }

      setOpenMenus(newOpenMenus);
    } else if (item.path) {
      setOpenMenus({
        documents: false,
        tags: false,
        treeManagement: false,
        globalModel: false,
        tagInfo: false,
        specManagement: false,
        mto: false,
        commentManagement: false,
      });
      navigate(item.path);
    }
  };

  // Helper function to map menu item names to feature names
  const getFeatureFromName = (name) => {
    const featureMap = {
      "iRoamer": "iroamer",
      "Bulk Model Import": "bulk_model",
      "Unassigned Tags": "unassigned_tags",
      "Tree Management": "tree_management",
      "Area Register": "area",
      "Discipline Register": "discipline",
      "System Register": "system",
      "Global Model": "global_model",
      "Open Global Model": "global_model",
      "Create Global Model": "global_model",
      "Delete Global Model": "global_model",
      "Tags": "taglist",
      "Review": "taglist",
      "Register": "taglist",
      "Tag Info": "tag_info",
      "Documents": "documents",
      "Line List": "line_list",
      "Equipment List": "equipment_list",
      "Valve List": "valve_list",
      "Smart P&ID": "spid",
      "Spec Management": "spec_management",
      "MTO": "mto",
      "Comment Management": "comment",
      "Color Management": "color_management",
      "Work Package": "work_package",
      "4D Plan": "4d_plan",
    };
    return featureMap[name] || name.toLowerCase().replace(/\s+/g, "_");
  };

  useEffect(() => {
    const preventScrollChaining = (e) => {
      const target = e.currentTarget;
      const delta = e.deltaY;
      const atTop = delta < 0 && target.scrollTop <= 0;
      const atBottom =
        delta > 0 &&
        target.scrollTop + target.clientHeight >= target.scrollHeight - 1;

      if (atTop || atBottom) {
        e.preventDefault();
      }
    };

    const sidebarMenu = sidebarMenuRef.current;
    if (sidebarMenu) {
      sidebarMenu.addEventListener("wheel", preventScrollChaining, {
        passive: false,
      });
    }

    return () => {
      if (sidebarMenu) {
        sidebarMenu.removeEventListener("wheel", preventScrollChaining);
      }
    };
  }, []);

  function clearAllPipingStores() {
    if (!canAccess(projectId, "global_model", "EDITOR")) {
      alert("You do not have permission to perform this action.");
      return;
    }

    const confirmClear = window.confirm(
      "Are you sure you want to Delete Global modal? This action cannot be undone."
    );

    if (!confirmClear) return;

    const request = indexedDB.open("piping");

    request.onsuccess = function (event) {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames);

      const transaction = db.transaction(storeNames, "readwrite");

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        store.clear().onsuccess = () => {};
        store.clear().onerror = (e) => {
          console.error(`Error clearing store ${storeName}:`, e);
        };
      });

      transaction.oncomplete = async () => {
        db.close();
        const response = await clearGlobalModal(projectId);
        if (response.status === 200) {
          setCustomAlert(true);
          setModalMessage(response.data.message);
        } else {
          setCustomAlert(true);
          setModalMessage("Something went wrong");
        }
      };
    };

    request.onerror = function (event) {
      console.error("❌ Failed to open database:", event.target.error);
      setCustomAlert(true);
      setModalMessage("Failed to open the 'piping' database.");
    };
  }

  const actionMap = {
    clearAllPipingStores: clearAllPipingStores,
  };

  // Filter sub-items based on user access
const getFilteredSubItems = (subItems) => {
  return subItems.filter(subItem => {
    // Bypass permission checks for admin panel items
    if (["Assign Tokens", "Assign Projects", "Project Details", "Features assign"].includes(subItem.name)) {
      return true;
    }
    
    const feature = subItem.parentFeature || getFeatureFromName(subItem.name);
    
    // Determine required role
    const isRegisterItem = subItem.name === "Register";
    const isCreateGlobalModel = subItem.name === "Create Global Model";
    const isDeleteGlobalModel = subItem.name === "Delete Global Model";
    
    const requiredRole = 
      isRegisterItem || isCreateGlobalModel || isDeleteGlobalModel || subItem.isModal || subItem.action 
        ? "EDITOR" 
        : "VIEWER";
    
    return canAccess(projectId, feature, requiredRole);
  });
};

  const menuItems = [
    {
      icon: faFighterJet,
      name: "iRoamer",
      path: "/iroamer",
      activeLink: "three",
    },
    ...(userRole === "admin" ? [{
      icon: faUsersLine,
      name: "Super admin panel",
      path: "/superadmin",
      activeLink: "superAdmin",
      toggleMenu: "superAdmin",
      subItems: [
        { name: "Assign Tokens", path: "/superadmin" },
        { name: "Assign Projects", path: "/superadmin/assignProjects" },
      ],
    }] : []),
    ...(isUserAdminOnProject
      ? [
          {
            icon: faUserTie,
            name: "Admin panel",
            path: "/admin",
            activeLink: "admin",
            toggleMenu: "admin",
            subItems: [
              { name: "Project Details", path: "/admin" },
              { name: "Features assign", path: "/admin/featureAssign" },
            ],
          },
        ]
      : []),
    {
      icon: faArchive,
      name: "Bulk Model Import",
      path: "/bulk-model-import",
      activeLink: "bulk",
    },
    {
      icon: faBoxesStacked,
      name: "Unassigned Tags",
      path: "/assign-tag-models",
      activeLink: "Model",
    },
    {
      icon: faSliders,
      name: "Tree Management",
      path: "/tree-management/review",
      toggleMenu: "treeManagement",
      activeLink: "treemanagement",
      subItems: [
        { name: "Review", path: "/tree-management/review", parentFeature: "tree_management" },
        { name: "Area Register", isModal: true, modalName: "areaRegister", parentFeature: "area" },
        { name: "Discipline Register", isModal: true, modalName: "disciplineRegister", parentFeature: "discipline" },
        { name: "System Register", isModal: true, modalName: "systemRegister", parentFeature: "system" },
      ],
    },
    {
      icon: faArchive,
      name: "Global Model",
      path: "/global-model/open",
      toggleMenu: "globalModel",
      activeLink: "expandglobal",
      subItems: [
        { name: "Open Global Model", path: "/global-model/open", parentFeature: "global_model" },
        { name: "Create Global Model", path: "/global-model/create", parentFeature: "global_model" },
        { name: "Delete Global Model", action: "clearAllPipingStores", parentFeature: "global_model" }
      ],
    },
    {
      icon: faTags,
      name: "Tags",
      path: "/tags/review",
      toggleMenu: "tags",
      activeLink: "expandtag",
      subItems: [
        { name: "Review", path: "/tags/review", parentFeature: "taglist" },
        { name: "Register", path: "/tags/register", parentFeature: "taglist" },
      ],
    },
    {
      icon: faInfoCircle,
      name: "Tag Info",
      path: "/tag-info/review",
      toggleMenu: "tagInfo",
      activeLink: "taginfo",
      subItems: [{ name: "Review", path: "/tag-info/review", parentFeature: "tag_info" }],
    },
    {
      icon: faBook,
      name: "Documents",
      path: "/documents/review",
      toggleMenu: "documents",
      activeLink: "expanddocument",
      subItems: [
        { name: "Review", path: "/documents/review", parentFeature: "documents" },
        { name: "Register", path: "/documents/register", parentFeature: "documents" },
      ],
    },
    {
      icon: faListUl,
      name: "Line List",
      path: "/line-list",
      activeLink: "linelist",
    },
    {
      icon: faListUl,
      name: "Equipment List",
      path: "/equipment-list",
      activeLink: "equipmentlist",
    },
    {
      icon: faListUl,
      name: "Valve List",
      path: "/valve-list",
      activeLink: "valvelist",
    },
    {
      icon: faPenSquare,
      name: "Smart P&ID",
      path: "/spid",
      activeLink: "spid",
    },
    {
      icon: faListUl,
      name: "Spec Management",
      path: "/spec-management/1",
      toggleMenu: "specManagement",
      activeLink: "specmanagement",
      subItems: [
        { name: "Spec 1", path: "/spec-management/1", parentFeature: "spec_management" },
        { name: "Spec 2", path: "/spec-management/2", parentFeature: "spec_management" },
        { name: "Spec 3", path: "/spec-management/3", parentFeature: "spec_management" },
        { name: "Spec 4", path: "/spec-management/4", parentFeature: "spec_management" },
        { name: "Spec 5", path: "/spec-management/5", parentFeature: "spec_management" },
      ],
    },
    {
      icon: faListUl,
      name: "MTO",
      path: "/mto/1",
      toggleMenu: "mto",
      activeLink: "mto",
      subItems: [
        { name: "MTO 1", path: "/mto/1", parentFeature: "mto" },
        { name: "MTO 2", path: "/mto/2", parentFeature: "mto" },
        { name: "MTO 3", path: "/mto/3", parentFeature: "mto" },
      ],
    },
    {
      icon: faSliders,
      name: "Comment Management",
      path: "/comment-review",
      toggleMenu: "commentManagement",
      activeLink: "comment",
      subItems: [
        { name: "Comment Review", path: "/comment-review", parentFeature: "comment" },
        { name: "Comment Status Table", path: "/comment-status", parentFeature: "comment" },
      ],
    },
    {
      icon: faSuitcase,
      name: "Color Management",
      path: "/color-management",
      activeLink: "color",
    },
    {
      icon: faSuitcase,
      name: "Work Package",
      path: "/work-package",
      activeLink: "package",
    },
    {
      icon: faLineChart,
      name: "4D Plan",
      path: "/4d-plan",
      activeLink: "4dplan",
    },
  ];

  const handleShowContents = () => {
    setShowCOntents(!showContents);
  };

  const getAllSavedViews = async (projectId) => {
    const hasGlobalModelAccess = canAccess(projectId, "global_model", "VIEWER");
    const hasIroamerAccess = canAccess(projectId, "iroamer", "VIEWER");

    if (!hasGlobalModelAccess && !hasIroamerAccess) {
      return;
    }

    try {
      const response = await AllSavedView(projectId);
      if (response.status === 200) {
        setAllSavedViews(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch all saved views table data:", error);
      setCustomAlert(true);
      setModalMessage("Failed to fetch saved views. Please try again.");
    }
  };

  useEffect(() => {
    getAllSavedViews(projectId);
  }, [updateProject, view]);

  const handleEditClick = (view) => {
    const canEditGlobalModel = canAccess(projectId, "global_model", "EDITOR");
    const canEditIroamer = canAccess(projectId, "iroamer", "EDITOR");

    if (!canEditGlobalModel && !canEditIroamer) {
      setCustomAlert(true);
      setModalMessage("You do not have permission to edit views.");
      return;
    }

    setEditingView(view);
    setEditViewName(view.name);
    setEditViewDialog(true);
  };

  const handleCloseEditView = () => {
    setEditViewDialog(false);
    setEditingView(null);
    setEditViewName("");
  };

  const handleDeleteView = (saveViewMenu) => {
    const canEditGlobalModel = canAccess(projectId, "global_model", "EDITOR");
    const canEditIroamer = canAccess(projectId, "iroamer", "EDITOR");

    if (!canEditGlobalModel && !canEditIroamer) {
      setCustomAlert(true);
      setModalMessage("You do not have permission to delete views.");
      return;
    }

    setCurrentDeleteNumber(saveViewMenu);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };

  const handleUpdateView = async () => {
    const canEditGlobalModel = canAccess(projectId, "global_model", "EDITOR");
    const canEditIroamer = canAccess(projectId, "iroamer", "EDITOR");

    if (!canEditGlobalModel && !canEditIroamer) {
      setCustomAlert(true);
      setModalMessage("You do not have permission to edit views.");
      return;
    }

    if (!editViewName.trim()) {
      setCustomAlert(true);
      setModalMessage("View name cannot be empty.");
      return;
    }

    const trimmedName = editViewName.trim();
    const viewExists = allSavedViews.some(
      (view) => view.name.trim().toLowerCase() === trimmedName.toLowerCase() && view.id !== editingView.id
    );

    if (viewExists) {
      setCustomAlert(true);
      setModalMessage("A view with this name already exists.");
      return;
    }

    const data = {
      projectId: projectId,
      oldName: editingView.name,
      newName: editViewName,
    };

    try {
      const response = await UpdateSavedView(data);
      if (response.status === 200) {
        setCustomAlert(true);
        setModalMessage("View updated successfully.");
        getAllSavedViews(projectId);
        handleCloseEditView();
      } else {
        throw new Error("Update failed");
      }
    } catch (error) {
      setCustomAlert(true);
      setModalMessage("Something went wrong on update. Please try again.");
      handleCloseEditView();
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  const handleConfirmDelete = async () => {
    const canEditGlobalModel = canAccess(projectId, "global_model", "EDITOR");
    const canEditIroamer = canAccess(projectId, "iroamer", "EDITOR");

    if (!canEditGlobalModel && !canEditIroamer) {
      alert("You do not have permission to delete views.");
      return;
    }

    try {
      const response = await DeleteSavedView(projectId, currentDeleteNumber);

      if (response.status === 200) {
        setCustomAlert(true);
        setModalMessage("View deleted successfully.");
        getAllSavedViews(projectId);
        setShowConfirm(false);
        setCurrentDeleteNumber(null);
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      setCustomAlert(true);
      setModalMessage("Something went wrong while deleting. Please try again.");
      setShowConfirm(false);
      setCurrentDeleteNumber(null);
    }
  };

  return (
    <>
      <ul>
        <li>
          <div
            id="openFileButton"
            className="dropdown"
            onClick={onOpenProjectModal}
          >
            <i className="fa fa-folder-open"></i>Open Project
            <div className="dropdown-content"></div>
          </div>
          {showProjectName &&
            (showContents ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <i
                  className="fa-solid fa-caret-down fs-3 text-secondary"
                  onClick={handleShowContents}
                ></i>
              </div>
            ) : (
              <>
                <div>
                  <div className="project-folder">
                    {showProjectName && (
                      <ProjectDetails
                        showProjectDetails={showProjectDetails}
                        setShowProjectDetails={setShowProjectDetails}
                        onAddArea={() => console.log("Add area clicked")}
                        setActiveItem={setActiveItem}
                        setActiveLink={setActiveLink}
                      />
                    )}
                  </div>
                </div>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <i
                    className="fa-solid fa-caret-up fs-3 text-secondary"
                    onClick={handleShowContents}
                  ></i>
                </div>
              </>
            ))}
        </li>
        {menuItems.map((item, index) => (
          <li key={index}>
            <div
              className={
                activeLink === item.activeLink
                  ? "sideLnkActive"
                  : "sideLnkInactive"
              }
              onClick={() => handleItemClick(item)}
              style={{ cursor: "pointer" }}
            >
              <FontAwesomeIcon icon={item.icon} className="sideLnkIcon" />
              <a className="sideLnk">{item.name}</a>
            </div>
            {item.subItems && openMenus[item.toggleMenu] && (
              <ul className="sub-menu">
                {getFilteredSubItems(item.subItems).map((subItem, subIndex) => (
                  <li key={subIndex}>
                    <div
                      className={
                        activeTab === subItem.name ? "tabActive" : "tabInactive"
                      }
                      onClick={() =>
                        handleSubItemClick(
                          subItem.name,
                          subItem.path,
                          subItem.isModal,
                          subItem.modalName,
                          subItem.action,
                          subItem.parentFeature
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <a className="sideLnk">{subItem.name}</a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <div id="viewsDiv" className="panelBox">
        {allSavedViews.length > 0 ? (
          <div>
            <div className="lbHead">Views</div>
            <div
              id="viewsList"
              className="lbList"
              style={{ paddingLeft: "10px", paddingRight: "10px" }}
            >
              {allSavedViews.map((view, index) => (
                <div key={view.id} className="lbLi">
                  <p>{index + 1}</p>
                  <a
                    style={{ cursor: "pointer" }}
                    onClick={() => handleMoveToSavedView(view)}
                  >
                    {view.name}
                  </a>
                  <i
                    className="fa-solid fa-pencil"
                    title="Edit"
                    onClick={() => handleEditClick(view)}
                  ></i>
                  <img
                    className="lbLiDelBut"
                    src="/images/delete.png"
                    title="Delete"
                    alt="Delete"
                    onClick={() => handleDeleteView(view.name)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div id="viewsList" className="lbList">
            <span>(Empty)</span>
          </div>
        )}
      </div>

      {/* Edit View Modal */}
      <Modal
        onHide={handleCloseEditView}
        show={editViewDialog}
        backdrop="static"
        keyboard={false}
        dialogClassName="custom-modal"
      >
        <div className="save-dialog">
          <div className="title-dialog">
            <p className="text-light">Edit view</p>
            <p className="text-light cross" onClick={handleCloseEditView}>
              ×
            </p>
          </div>
          <div className="dialog-input">
            <label>Name*</label>
            <input
              type="text"
              value={editViewName}
              onChange={(e) => setEditViewName(e.target.value)}
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
            <button className="btn btn-secondary" onClick={handleCloseEditView}>
              Cancel
            </button>
            <button className="btn btn-dark" onClick={handleUpdateView}>
              Save
            </button>
          </div>
        </div>
      </Modal>

      {openModal.areaRegister && (
        <Arearegister
          isOpen={openModal.areaRegister}
          onClose={() => handleCloseModal("areaRegister")}
        />
      )}
      {openModal.disciplineRegister && (
        <DisciplineRegister
          isOpen={openModal.disciplineRegister}
          onClose={() => handleCloseModal("disciplineRegister")}
        />
      )}
      {openModal.systemRegister && (
        <SystemRegister
          isOpen={openModal.systemRegister}
          onClose={() => handleCloseModal("systemRegister")}
        />
      )}

      {showProjectDetails && <ProjectDetails />}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete?"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}
    </>
  );
}

export default Sidebar;