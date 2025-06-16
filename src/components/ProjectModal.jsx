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

  return (
    <>
      <Modal show={isOpen} onHide={onClose} centered  dialogClassName="custom-project-form-size" className="project-modal-custom">
        <Modal.Header className="project-modal-header d-flex justify-content-between">
          <Modal.Title>Project Management</Modal.Title>
          <div className="header-icons">
            <FontAwesomeIcon icon={faFolder} />
            <FontAwesomeIcon icon={faTrash} />
            <FontAwesomeIcon icon={faPlus} onClick={handleCreateProject} />
            <FontAwesomeIcon icon={faTimes} onClick={onClose} />
          </div>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {projects.length > 0 ? (
            <ListGroup className="project-list">
              <ListGroup.Item className="project-header">
                <div className="project-row header">
                  <div className="project-cell number"><strong>Project Number</strong></div>
                  <div className="project-cell name"><strong>Project Name</strong></div>
                  <div className="project-cell actions"><strong>Actions</strong></div>
                </div>
              </ListGroup.Item>

              {projects.map((project) => (
                <ListGroup.Item key={project.projectId} className="project-item">
                  <div className="project-row">
                    <div className="project-cell number">{project.projectNumber}</div>
                    <div className="project-cell name">{project.projectName}</div>
                    <div className="project-cell actions">
                      <Button variant="link" className="action-icon" onClick={() => handleSelectProject(project)}>
                        <FontAwesomeIcon icon={faFolder} />
                      </Button>
                      <Button variant="link" className="action-icon" onClick={() => handleEditProject(project)}>
                        <FontAwesomeIcon icon={faEdit} />
                      </Button>
                      <Button variant="link" className="action-icon text-danger" onClick={() => handleDeleteProject(project)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <Alert variant="info" className="mt-3">No projects found</Alert>
          )}
        </Modal.Body>
      </Modal>

      {/* Project Form Modal */}
      <Modal show={isFormModalOpen} onHide={handleCancel} centered size="sm" backdrop="static"   className="project-form-modal" >
        <Modal.Header className="">
          <Modal.Title >
            {editingProject ? "Edit Project" : "Add New Project"}
          </Modal.Title>
          <Button variant="link" className="" onClick={handleCancel}>
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </Modal.Header>

        <Modal.Body >
          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="projectNumber" >
              <Form.Label  className="text-dark">Project Number <span>*</span></Form.Label>
              <Form.Control
                type="text"
                name="projectNumber"
                value={formState.projectNumber}
                onChange={handleInputChange}
                placeholder="Enter project number"
                isInvalid={!!error && !formState.projectNumber.trim()}
              />
            </Form.Group>

            <Form.Group controlId="projectName" >
              <Form.Label  className="text-dark">Project Name <span >*</span></Form.Label>
              <Form.Control
                type="text"
                name="projectName"
                value={formState.projectName}
                onChange={handleInputChange}
                placeholder="Enter project name"
                isInvalid={!!error && !formState.projectName.trim()}
              />
            </Form.Group>

            <Form.Group controlId="description" >
              <Form.Label  className="text-dark">Project Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={formState.description}
                onChange={handleInputChange}
                placeholder="Enter project description"
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer >
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!formState.projectName.trim() || !formState.projectNumber.trim()}
          >
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default ProjectModal;
