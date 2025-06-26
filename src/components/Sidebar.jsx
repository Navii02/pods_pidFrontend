import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Alert from "../components/Alert";
import Arearegister from "../components/Tree/Arearegister";
import DisciplineRegister from "../components/Tree/DisiplineRegister";
import SystemRegister from "../components/Tree/SystemRegister";
import ProjectDetails from "./ProjectDetails";
import { updateProjectContext } from "../context/ContextShare";
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
} from "@fortawesome/free-solid-svg-icons";
import {
  AllSavedView,
  DeleteSavedView,
  UpdateSavedView,
} from "../services/CommonApis";
import DeleteConfirm from "./DeleteConfirm";

function Sidebar({
  onToggle,
  projectName,
  setProjectname,
  onOpenProjectModal,
  onActiveLinkChange,
}) {
  const { updateProject } = useContext(updateProjectContext);
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

  const handleSubItemClick = (label, path, isModal = false, modalName = "") => {
    setActiveItem(label);
    setActiveTab(label);
    if (isModal) {
      handleOpenModal(modalName);
    } else {
      navigate(path);
    }
  };

  const handleMoveToSavedView = (view) => {
    if (view) {
      navigate("/global-model/open", { state: { view: view } });
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
  });

  const handleItemClick = (item) => {
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
      activeLink: "three",
    },
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
    try {
      const response = await AllSavedView(projectId);
      if (response.status === 200) {
        setAllSavedViews(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch all saved views table data:", error);
    }
  };

  useEffect(() => {
    getAllSavedViews(projectId);
  }, [updateProject]);

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
  const handleDeleteView = (saveViewMenu) => {
    setCurrentDeleteNumber(saveViewMenu);
    setConfirmMessage("Are you sure you want to delete?");
    setShowConfirm(true);
  };
  const handleUpdateView = async () => {
    if (!editViewName.trim()) {
      return;
    }
    // Check if a view with the same name already exists
    const trimmedName = editViewName.trim();
    const viewExists = allSavedViews.some(
      (view) => view.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    console.log("viewExists", viewExists);
    if (viewExists) {
      setCustomAlert(true);
      setModalMessage("A view with this name already exists");
      return;
    }

    const data = {
      projectId: projectId,
      oldName: editingView.name,
      newName: editViewName,
    };
    console.log(data);
    const response = await UpdateSavedView(data);
    if (response.status === 200) {
      setCustomAlert(true);
      setModalMessage("View updated..");
      getAllSavedViews(projectId);
      handleCloseEditView();
    } else {
      setCustomAlert(true);
      setModalMessage("Something went wrong on updatio.Please try again..");
      handleCloseEditView();
    }
  };
  const handleCancelDelete = () => {
    setShowConfirm(false);
  };
  const handleConfirmDelete = async () => {
    const response = await DeleteSavedView(projectId, currentDeleteNumber);

    if (response.status === 200) {
      setCustomAlert(true);
      setModalMessage("View deleted successfully..");
      getAllSavedViews(projectId);
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
            class="dropdown"
            onClick={onOpenProjectModal}
          >
            <i class="fa fa-folder-open"></i>Open Project
            <div class="dropdown-content"></div>
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
                  class="fa-solid fa-caret-down fs-3 text-secondary"
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
                    title="Edite"
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
              &times;
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
