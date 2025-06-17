import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  Modal,
  Button,
  Form,
  Alert,
  ListGroup,
} from "react-bootstrap";
import "../styles/ProjectModal.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faFolder,
  faPlus,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { updateProjectContext } from "../context/ContextShare";

const INITIAL_PROJECT_STATE = {
  projectId: "",
  projectNumber: "",
  projectName: "",
  description: "",
  projectPath: "",
};

function ProjectModal({
  isOpen,
  onClose,
  projects,
  projectDetails,
  setProjects,
  setProjectDetails,
  setProjectname,
  saveProject,
  updateProject,
  deleteProject,
}) {
  const {setUpdateProject} = useContext(updateProjectContext)
  const [formState, setFormState] = useState(INITIAL_PROJECT_STATE);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);
  useEffect(()=>{
    console.log(projects)
  },[])

  const resetState = () => {
    setIsFormModalOpen(false);
    setEditingProject(null);
    setFormState(INITIAL_PROJECT_STATE);
    setError("");
  };

  const handleSelectProject = (project) => {
    sessionStorage.setItem("selectedProject", JSON.stringify(project));
    setProjectname(project?.projectName);
    setUpdateProject(project)
    onClose();

  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value ?? "" }));
    setError("");
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setFormState({
      ...project,
      projectName: project.projectName ?? "",
      projectNumber: project.projectNumber ?? "",
      description: project.description ?? "",
      projectId: project.projectId ?? "",
      projectPath: project.projectPath ?? "",
    });
    setIsFormModalOpen(true);
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setFormState(INITIAL_PROJECT_STATE);
    setIsFormModalOpen(true);
  };

  const handleCancel = () => {
    resetState();
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const projectName = formState.projectName ?? "";
      const projectNumber = formState.projectNumber ?? "";

      if (!projectName.trim() || !projectNumber.trim()) {
        setError("Project Number and Project Name are required.");
        return;
      }

      try {
        if (editingProject) {
          const response = await updateProject({ ...editingProject, ...formState });
          if (response.status === 200) {
            updateStateAfterEdit(response.data);
            console.log(response.data);

            setIsFormModalOpen(false);
            onClose();
          }
        } else {
          const response = await saveProject(formState);
          if (response.status === 201) {
            updateStateAfterCreate(response.data);
             handleSelectProject(response.data.project)
            console.log(response.data);
            setIsFormModalOpen(false);
            onClose();
          }
        }
      } catch (err) {
        setError(err.message || "Failed to process project. Please try again.");
      }
    },
    [formState, editingProject, updateProject, saveProject, onClose]
  );

  const updateStateAfterCreate = (newProject) => {
    setProjects((prev) => [...prev, newProject]);
    setProjectDetails((prev) => [...prev, newProject]);
  };

  const updateStateAfterEdit = (updatedProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.projectId === updatedProject.projectId ? updatedProject : p))
    );
    setProjectDetails((prev) =>
      prev.map((p) => (p.projectId === updatedProject.projectId ? updatedProject : p))
    );
  };

  const handleDeleteProject = async (project) => {
    if (window.confirm(`Are you sure you want to delete "${project.projectName}"?`)) {
      try {
        const response = await deleteProject(project.projectId);
        if (response.status === 200) {
          setProjects((prev) => prev.filter((p) => p.projectId !== project.projectId));
          setProjectDetails((prev) => prev.filter((p) => p.projectId !== project.projectId));
        }
      } catch {
        setError("Failed to delete project. Please try again.");
      }
    }
  };
  const [showallprojects, setshowallprojects] = useState(false);

    const handleshowallprojects = () => {
    setshowallprojects(!showallprojects);
  };

  return (
  
    <>
      <div className="mainpro">
      {isOpen && (
        <div className="project-model">
          <div className="heading">
            <h6>Load project</h6>
            <div className="icons">
              <i
                className="fa-solid fa-trash"
                title="Delete all project"
                
              ></i>
              <i
                class="fa-solid fa-folder  ms-3"
              
                title="Map project"
              ></i>
              <i
                class="fa-solid fa-circle-plus ms-3 "
                title="Create new project"
               onClick={handleCreateProject}
              ></i>
              <i
                class="fa-solid fa-xmark ms-3 "
                title="Close project"
                onClick={onClose}
              ></i>
            </div>
          </div>
          {showallprojects ? (
            <div
              style={{
                textAlign: "center",
                backgroundColor: "#272626",
                height: "30px",
                color: "grey",
              }}
            >
              <p>(Empty)</p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#272626",
                height: "auto",
                color: "grey",
                overflowY: "auto",
              }}
            >
              {projects.length > 0 ? (
                <table className="table table-light">
                  <tbody>
                    {projects.map((project, index) => (
                      <tr key={index}>
                        <td
                          style={{
                            backgroundColor: "#515CBC",
                            textAlign: "center",
                          }}
                        >
                          {project.projectNumber}
                        </td>
                        <td
                          style={{
                            display: "flex",
                            alignItems: "center",
                            backgroundColor: "#272626",
                            color: "white",
                          }}
                        >
                          {project.projectName}
                          <button
                           onClick={() => handleSelectProject(project)}
                            style={{
                              marginLeft: "auto",
                              background: "none",
                              border: "none",
                            }}
                          >
                            <i
                              class="fa-solid fa-folder-open text-light"
                              title="Open-project"
                            ></i>
                          </button>
                          <i
                            className="fa-solid fa-pencil text-light ms-3 me-2"
                            onClick={() => handleEditProject(project)}
                            title="Edit-project"
                          ></i>

                          <i
                            className="fa-solid fa-trash text-light ms-3 me-2"
                            onClick={() =>
                              handleDeleteProject(project)
                            }
                            title="Delete-project"
                          ></i>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    backgroundColor: "#272626",
                    height: "auto",
                    color: "grey",
                  }}
                >
                  <p>(Empty)</p>
                </div>
              )}
            </div>
          )}
          <div className="footing">
            {showallprojects ? (
              <p>
                Show projects
                <input type="checkbox" onClick={handleshowallprojects} />
              </p>
            ) : (
              <p>
                Hide projects
                <input type="checkbox" onClick={handleshowallprojects} />
              </p>
            )}
          </div>
        </div>
      )}

      {isFormModalOpen && (
        <div className="whole">
          <div className="project-dialog">
            <div className="title-dialog">
              <p className="text-light">Add New Project</p>
              <p className="text-light cross" onClick={handleCancel}>
                &times;
              </p>
            </div>
            <div className="dialog-input">
              <label>Project number *</label>
              <input
                type="text"
                 name="projectNumber"
                value={formState.projectNumber}
                onChange={handleInputChange}
              />
              <label>Project Name*</label>
              <input
                type="text"
                name="projectName"
                value={formState.projectName}
                onChange={handleInputChange}
              />
              <label>Project Description</label>
              <textarea
                name="description"
                value={formState.description}
                onChange={handleInputChange}
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
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button className="btn btn-dark" onClick={handleSubmit}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
      {/* {mapprojectmodal && (
        <div className="whole">
          <div className="project-dialog">
            <div className="title-dialog">
              <p className="text-light">Map Project</p>
              <p className="text-light cross" onClick={handleCloseProject}>
                &times;
              </p>
            </div>
            <div className="dialog-input">
              <button
                className="btn projectbtn"
                onClick={handleDirectoryChange}
              >
                Choose Folder
              </button>
              {selectedDirectory && <p>{selectedDirectory}</p>}
            </div>
            <div className="dialog-button">
              <button
                className="btn btn-secondary"
                onClick={handleCloseProject}
              >
                Cancel
              </button>
              <button className="btn btn-dark" onClick={handleMapproject}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="whole">
          <div className="project-dialog">
            <div className="title-dialog">
              <p className="text-light">Edit Project</p>
              <p
                className="text-light cross"
                onClick={() => setShowEditModal(false)}
              >
                &times;
              </p>
            </div>
            <div className="dialog-input">
              <label>Project Number *</label>
              <input
                type="text"
                value={editProjectNumber}
                onChange={(e) => setEditProjectNumber(e.target.value)}
              />
              <label>Project Name *</label>
              <input
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
              />
              <label>Project Description</label>
              <textarea
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
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
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-dark"
                onClick={handleSaveEditedProject}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )} */}
    </div>
    </>
  );
}

export default ProjectModal;
