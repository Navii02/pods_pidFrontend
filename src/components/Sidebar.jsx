// Sidebar.js - Updated to notify parent of active link changes
import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Alert from '../components/Alert'
// import "../styles/Sidebar.css";
import treeIcon from "../assets/images/tree.png";
import Arearegister from "../components/Tree/Arearegister";
import DisciplineRegister from "../components/Tree/DisiplineRegister";
import SystemRegister from "../components/Tree/SystemRegister";
import ProjectDetails from "./ProjectDetails";
import { updateProjectContext } from "../context/ContextShare";
import {
  faFolderOpen,
  faFighterJet,
  faBoxes,
  faSitemap,
  faGlobe,
  faTags,
  faInfoCircle,
  faFileAlt,
  faListUl,
  faPenSquare,
  faBriefcase,
  faCommentAlt,
  faChevronDown,
  faChevronRight,
  faChevronUp,
  faPlusCircle,
  faArchive,
  faSliders,
  faEye,
  faEyeSlash,
  faCaretDown,
  faCaretUp,
  faSuitcase,
  faLineChart,
  faPencil,
  faBook,
} from "@fortawesome/free-solid-svg-icons";

function Sidebar({
  onToggle,
  projectName,
  setProjectname,
  onOpenProjectModal,
  onActiveLinkChange, // New prop to notify parent of active link changes
}) {
  const { updateProject } = useContext(updateProjectContext);
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("iRoamer");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProjectName, setShowProjectName] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(true);
  const sidebarMenuRef = useRef(null);
  const [openModal, setOpenModal] = useState({
    areaRegister: false,
    disciplineRegister: false,
    systemRegister: false,
  });

  const [showContents, setShowCOntents] = useState(false);
  const [activeLink, setActiveLink] = useState("three");
  const [activeTab, setActiveTab] = useState("");
    const [customAlert, setCustomAlert] = useState(false);
    const [modalMessage, setModalMessage] = useState("");

  // Notify parent component when activeLink changes
  useEffect(() => {
    if (onActiveLinkChange) {
      onActiveLinkChange(activeLink);
    }
  }, [activeLink, onActiveLinkChange]);

  useEffect(() => {
    const storedProject = sessionStorage.getItem("selectedProject");
    if (storedProject) {
      const project = JSON.parse(storedProject);
      if (project && project?.projectName) {
        setShowProjectName(true);
      } else {
        console.warn("Stored project data is invalid");
      }
    }
  }, [sessionStorage.getItem("selectedProject"), updateProject]);

  const handleOpenModal = (modalName) => {
    console.log(modalName);
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

  const handleSubItemClick = (label, path, isModal = false, modalName = "") => {
    setActiveItem(label);
    setActiveTab(label);
    if (isModal) {
      handleOpenModal(modalName);
    } else {
      navigate(path);
    }
  };

  const toggleMenu = (menu) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const [openMenus, setOpenMenus] = useState({
    documents: false,
    tags: false,
    treeManagement: false,
    globalModel: false,
    tagInfo: false,
    specManagement: false,
    mto: false,
  });

  const handleItemClick = (item) => {
    setActiveItem(item.name);
    setActiveLink(item.activeLink || item.name.toLowerCase().replace(/\s+/g, ''));
    
    if (item.toggleMenu) {
      const isOpening = !openMenus[item.toggleMenu];
      const newOpenMenus = Object.keys(openMenus).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {});

      if (isOpening) {
        newOpenMenus[item.toggleMenu] = true;
        if (item.subItems && item.subItems.length > 0) {
          const firstSubItem = item.subItems[0];
          setActiveItem(firstSubItem.name);
          setActiveTab(firstSubItem.name);
          if (firstSubItem.path) {
            navigate(firstSubItem.path);
          }
        }
      } else if (item.path) {
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

  const menuItems = [
    { 
      icon: faFighterJet, 
      name: "iRoamer", 
      path: "/iroamer",
      activeLink: "three"
    },
    { 
      icon: faArchive, 
      name: "Bulk Model Import", 
      path: "/bulk-model-import",
      activeLink: "bulk"
    },
    {
      icon: faSliders,
      name: "Tree Management",
      path: "/tree-management/review",
      toggleMenu: "treeManagement",
      activeLink: "treemanagement",
      subItems: [
        { name: "Review", path: "/tree-management/review" },
        {
          name: "Area Register",
          isModal: true,
          modalName: "areaRegister",
        },
        {
          name: "Discipline Register",
          isModal: true,
          modalName: "disciplineRegister",
        },
        {
          name: "System Register",
          isModal: true,
          modalName: "systemRegister",
        },
      ],
    },
    {
      icon: faArchive,
      name: "Global Model",
      path: "/global-model/open",
      toggleMenu: "globalModel",
      activeLink: "expandglobal",
      subItems: [
        { name: "Open Global Model", path: "/global-model/open" },
        { name: "Assign Token", path: "/global-model/assign-token" },
        { name: "Add World Box", path: "/global-model/add-world-box" },
        { name: "Create Global Model", path: "/global-model/create" },
        { name: "Delete Global Model", path: "/global-model/delete" },
      ],
    },
    {
      icon: faTags,
      name: "Tags",
      path: "/tags/review",
      toggleMenu: "tags",
      activeLink: "expandtag",
      subItems: [
        { name: "Review", path: "/tags/review" },
        { name: "Register", path: "/tags/register" },
      ],
    },
    {
      icon: faInfoCircle,
      name: "Tag Info",
      path: "/tag-info/review",
      toggleMenu: "tagInfo",
      activeLink: "taginfo",
      subItems: [{ name: "Review", path: "/tag-info/review" }],
    },
    {
      icon: faBook,
      name: "Documents",
      path: "/documents/review",
      toggleMenu: "documents",
      activeLink: "expanddocument",
      subItems: [
        { name: "Review", path: "/documents/review" },
        { name: "Register", path: "/documents/register" },
      ],
    },
    { 
      icon: faListUl, 
      name: "Line List", 
      path: "/line-list",
      activeLink: "linelist"
    },
    { 
      icon: faListUl, 
      name: "Equipment List", 
      path: "/equipment-list",
      activeLink: "equipmentlist"
    },
    { 
      icon: faListUl, 
      name: "Valve List", 
      path: "/valve-list",
      activeLink: "valvelist"
    },
    { 
      icon: faPenSquare, 
      name: "Smart P&ID", 
      path: "/spid",
      activeLink: "spid"
    },
    {
      icon: faListUl,
      name: "Spec Management",
      path: "/spec-management/1",
      toggleMenu: "specManagement",
      activeLink: "specmanagement",
      subItems: [
        { name: "Spec 1", path: "/spec-management/1" },
        { name: "Spec 2", path: "/spec-management/2" },
        { name: "Spec 3", path: "/spec-management/3" },
        { name: "Spec 4", path: "/spec-management/4" },
        { name: "Spec 5", path: "/spec-management/5" },
      ],
    },
    {
      icon: faListUl,
      name: "MTO",
      path: "/mto/1",
      toggleMenu: "mto",
      activeLink: "mto",
      subItems: [
        { name: "MTO 1", path: "/mto/1" },
        { name: "MTO 2", path: "/mto/2" },
        { name: "MTO 3", path: "/mto/3" },
      ],
    },
    {
      icon: faSliders,
      name: "Comment Management",
      path: "/comment-review",
      toggleMenu: "commentManagement",
      activeLink: "comment",
      subItems: [
        { name: "Comment Review", path: "/comment-review" },
        { name: "Comment Status Table", path: "/comment-status" },
      ],
    },
    { 
      icon: faSuitcase, 
      name: "Color Management", 
      path: "/color-management",
      activeLink: "color"
    },
    { 
      icon: faSuitcase, 
      name: "Work Package", 
      path: "/work-package",
      activeLink: "package"
    },
    { 
      icon: faLineChart, 
      name: "4D Plan", 
      path: "/4d-plan",
      activeLink: "4dplan"
    },
  ];

  const handleShowContents = () => {
    setShowCOntents(!showContents);
  };

  return (
    <>
      <ul>
        <li>
          <div
            id="openFileButton"
            class="dropdown"
            onClick={onOpenProjectModal}
          >
            <i class="fa fa-folder-open"></i>Open Project
            <div class="dropdown-content"></div>
          </div>
          {projectName &&
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
                  class="fa-solid fa-caret-down fs-3 text-secondary"
                  onClick={handleShowContents}
                ></i>
              </div>
            ) : (
              <>
                <div>
                  <div className="project-folder">
                    <div
                      className="tree"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "7px",
                      }}
                    >
                      <span>{projectName}</span>
                      <span>
                        <i
                          className="fa-solid fa-eye"
                          style={{
                            fontSize: "12px",
                            marginRight: "9px",
                          }}
                        ></i>
                        <FontAwesomeIcon
                          icon={faPlusCircle}
                          className="ms-2"
                          style={{ fontSize: "15px" }}
                        />
                      </span>
                    </div>
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
                    class="fa-solid fa-caret-up fs-3 text-secondary"
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
                activeLink === item.activeLink ? "sideLnkActive" : "sideLnkInactive"
              }
              onClick={() => handleItemClick(item)}
              style={{ cursor: "pointer" }}
            >
              <FontAwesomeIcon icon={item.icon} className="sideLnkIcon" />
              <a className="sideLnk">{item.name}</a>
            </div>
            
            {item.subItems && openMenus[item.toggleMenu] && (
              <ul className="sub-menu">
                {item.subItems.map((subItem, subIndex) => (
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
                          subItem.modalName
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

      {/* Modals */}
      {openModal.areaRegister && (
        <Arearegister isOpen={openModal.areaRegister} onClose={() => handleCloseModal("areaRegister")} setModalMessage={setModalMessage} setCustomAlert={setCustomAlert}/>
      )}
      {openModal.disciplineRegister && (
        <DisciplineRegister isOpen={openModal.disciplineRegister} onClose={() => handleCloseModal("disciplineRegister")} />
      )}
      {openModal.systemRegister && (
        <SystemRegister isOpen={openModal.systemRegister} onClose={() => handleCloseModal("systemRegister")} />
      )}
        {customAlert && (
    <Alert
      message={modalMessage}
      onAlertClose={() => setCustomAlert(false)}
    />
  )}
      {showProjectDetails && <ProjectDetails />}
    </>
  );
}

export default Sidebar;