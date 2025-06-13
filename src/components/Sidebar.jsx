import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
} from "@fortawesome/free-solid-svg-icons";
import "../styles/Sidebar.css";
import treeIcon from "../assets/images/tree.png";
import Arearegister from "../components/Tree/Arearegister";
import DisciplineRegister from "../components/Tree/DisiplineRegister";
import SystemRegister from "../components/Tree/SystemRegister";
import ProjectDetails from "./ProjectDetails";

function Sidebar({ onToggle, setProjectname, onOpenProjectModal }) {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProjectName, setShowProjectName] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(true);
  const sidebarMenuRef = useRef(null);
  const [openModal, setOpenModal] = useState({
    areaRegister: false,
    disciplineRegister: false,
    systemRegister: false,
  });
    const  [updatetree,setUpdateTree]=useState("")

  useEffect(() => {
    const storedProject = sessionStorage.getItem("selectedProject");
    if (storedProject) {
      const project = JSON.parse(storedProject);
      if (project && project.projectName) {
        setShowProjectName(true);
      } else {
        console.warn("Stored project data is invalid");
      }
    }
  }, [sessionStorage.getItem("selectedProject")]);

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

  const handleSubItemClick = (label, path, isModal = false, modalName = "") => {
    setActiveItem(label);
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
          navigate(firstSubItem.path);
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
      });
      navigate(item.path);
    }
  };

  const handleToggle = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onToggle(newCollapsedState);
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
    { icon: faFighterJet, name: "iRoamer", path: "/iroamer" },
    { icon: faBoxes, name: "Bulk Model Import", path: "/bulk-model-import" },
    {
      icon: faSitemap,
      name: "Tree Management",
      path: "/tree-management/review",
      toggleMenu: "treeManagement",
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
      icon: faGlobe,
      name: "Global Model",
      path: "/global-model/open",
      toggleMenu: "globalModel",
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
      subItems: [{ name: "Review", path: "/tag-info/review" }],
    },
    {
      icon: faFileAlt,
      name: "Documents",
      path: "/documents/review",
      toggleMenu: "documents",
    subItems: [
        { name: "Review", path: "/documents/review" },
        { name: "Register", path: "/documents/register" },
      ],
    },
    { icon: faListUl, name: "Line List", path: "/line-list" },
    { icon: faListUl, name: "Equipment List", path: "/equipment-list" },
    { icon: faListUl, name: "Valve List", path: "/valve-list" },
    { icon: faPenSquare, name: "Smart P&ID", path: "/spid" },
    {
      icon: faListUl,
      name: "Spec Management",
      path: "/spec-management/1",
      toggleMenu: "specManagement",
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
      subItems: [
        { name: "MTO 1", path: "/mto/1" },
        { name: "MTO 2", path: "/mto/2" },
        { name: "MTO 3", path: "/mto/3" },
      ],
    },
    {
      icon: faCommentAlt,
      name: "Comment Management",
      path: "/comment-review",
         toggleMenu: "CommentManagement",
      subItems: [
        { name: "Comment Review", path: "/comment-review" },
        { name: "Comment Status Table", path: "/comment-status" },
       
      ],

    },
    { icon: faBriefcase, name: "Work Package", path: "/work-package" },
  ];

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-toggle" onClick={handleToggle}>
        <img src={treeIcon} alt="Toggle Sidebar" className="tree-toggle-icon" />
      </div>

      {!isCollapsed && (
        <div className="sidebar-menu" ref={sidebarMenuRef}>
          <div className="open-project-section">
            <span onClick={onOpenProjectModal}>
              <FontAwesomeIcon icon={faFolderOpen} />
              Project Management
            </span>
            {showProjectName && (
               <ProjectDetails 
    showProjectDetails={showProjectDetails}
    setShowProjectDetails={setShowProjectDetails}
    onAddArea={() => console.log("Add area clicked")} // Add your actual handler
  />
            )}
          </div>

          {menuItems.map((item) => (
            <React.Fragment key={item.name}>
              <div
                className={`menu-item ${
                  activeItem === item.name ? "active" : ""
                }`}
                onClick={() => handleItemClick(item)}
              >
                <FontAwesomeIcon icon={item.icon} />
                <span>{item.name}</span>
                {item.toggleMenu && (
                  <FontAwesomeIcon
                    icon={
                      openMenus[item.toggleMenu]
                        ? faChevronDown
                        : faChevronRight
                    }
                    className="submenu-toggle-icon"
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </div>

              {item.toggleMenu &&
                openMenus[item.toggleMenu] &&
                item.subItems && (
                  <div className="submenu">
                    {item.subItems.map((subItem) => (
                      <div
                        key={subItem.name}
                        className={`submenu-item ${
                          activeItem === subItem.name ? "active" : ""
                        }`}
                        onClick={() =>
                          handleSubItemClick(
                            subItem.name,
                            subItem.path,
                            subItem.isModal,
                            subItem.modalName
                          )
                        }
                      >
                        {subItem.name}
                      </div>
                    ))}
                  </div>
                )}
            </React.Fragment>
          ))}

          <div className="views-section">
            <div className="views-empty">(Empty)</div>
          </div>
        </div>
      )}
      <Arearegister
        isOpen={openModal.areaRegister}
        onClose={() => handleCloseModal("areaRegister")}
    
      />
      <DisciplineRegister
        isOpen={openModal.disciplineRegister}
        onClose={() => handleCloseModal("disciplineRegister")}
   
      />
      <SystemRegister
        isOpen={openModal.systemRegister}
        onClose={() => handleCloseModal("systemRegister")}
    
      />
    </div>
  );
}

export default Sidebar;