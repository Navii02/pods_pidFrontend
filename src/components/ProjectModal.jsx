import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  Alert,
  ListGroup,
  Card,
  Row,
  Col,
} from "react-bootstrap";

import "../styles/ProjectModal.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPlus, faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";

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
  const [formState, setFormState] = useState(INITIAL_PROJECT_STATE);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setIsCreating(false);
    setEditingProject(null);
    setFormState(INITIAL_PROJECT_STATE);
    setError("");
  };

  const handleSelectProject = (project) => {
    sessionStorage.setItem("selectedProject", JSON.stringify(project));
    setProjectname(project.projectName);
    onClose();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Ensure value is a string, default to empty string if null/undefined
    setFormState((prev) => ({ ...prev, [name]: value ?? "" }));
    setError("");
  };

  const handleEditProject = (project) => {
    setIsCreating(false);
    setEditingProject(project);
    // Ensure projectName and projectNumber are strings
    setFormState({
      ...project,
      projectName: project.projectName ?? "",
      projectNumber: project.projectNumber ?? "",
      description: project.description ?? "",
      projectId: project.projectId ?? "",
      projectPath: project.projectPath ?? "",
    });
    setError("");
  };

  const handleCreateProject = () => {
    setIsCreating(true);
    setEditingProject(null);
    setFormState(INITIAL_PROJECT_STATE);
    setError("");
  };

  const handleCancel = () => {
    resetState();
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      // Ensure projectName and projectNumber are strings before trim
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
            onClose();
          }
        } else {
          const response = await saveProject(formState);
          if (response.status === 201) {
            updateStateAfterCreate(response.data);
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
    <Modal
      show={isOpen}
      onHide={onClose}
      centered
      size="lg"
      className="project-modal-custom"
      aria-labelledby="project-management-modal"
    >
      <Modal.Header className="project-modal-header d-flex justify-content-between">
        <Modal.Title id="project-management-modal">Project Management</Modal.Title>
        <Button
          variant="link"
          className="close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faTimes} />
        </Button>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        {!isCreating && !editingProject && (
          <Button
            variant="primary"
            className="mb-3 create-project-button"
            onClick={handleCreateProject}
          >
            <FontAwesomeIcon icon={faPlus} className="me-2" />
            Create New Project
          </Button>
        )}

        {(isCreating || editingProject) && (
          <Card className="project-form-card mb-3">
            <Card.Body>
              <Card.Title>{editingProject ? "Edit Project" : "Create New Project"}</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group controlId="projectNumber" className="mb-3">
                      <Form.Label>Project Number</Form.Label>
                      <Form.Control
                        type="text"
                        name="projectNumber"
                        value={formState.projectNumber}
                        onChange={handleInputChange}
                        placeholder="Enter project number"
                        isInvalid={!!error && !formState.projectNumber.trim()}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="projectName" className="mb-3">
                      <Form.Label>Project Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="projectName"
                        value={formState.projectName}
                        onChange={handleInputChange}
                        placeholder="Enter project name"
                        isInvalid={!!error && !formState.projectName.trim()}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group controlId="description" className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="description"
                    rows={3}
                    value={formState.description}
                    onChange={handleInputChange}
                    placeholder="Enter project description"
                  />
                </Form.Group>

                <div className="form-buttons">
                  <Button variant="secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={!formState.projectName.trim() || !formState.projectNumber.trim()}
                  >
                    {editingProject ? "Update" : "Create"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        )}

        {!isCreating && !editingProject && (
          projects.length > 0 ? (
            <ListGroup className="project-list">
              <ListGroup.Item className="project-header">
                <Row>
                  <Col md={3}><strong>Project Number</strong></Col>
                  <Col md={6}><strong>Project Name</strong></Col>
                  <Col md={3} className="text-center"><strong>Actions</strong></Col>
                </Row>
              </ListGroup.Item>

              {projects.map((project) => (
                <ListGroup.Item key={project.projectId} className="project-item">
                  <Row className="align-items-center">
                    <Col md={3} onClick={() => handleSelectProject(project)} className="project-number">
                      {project.projectNumber}
                    </Col>
                    <Col md={6} onClick={() => handleSelectProject(project)} className="project-name">
                      {project.projectName}
                    </Col>
                    <Col md={3} className="project-actions">
                      <Button variant="link" className="action-icon" onClick={() => handleEditProject(project)}>
                        <FontAwesomeIcon icon={faEdit} />
                      </Button>
                      <Button variant="link" className="action-icon text-danger" onClick={() => handleDeleteProject(project)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </Col>
                  </Row>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <Alert variant="info" className="mt-3">No projects found</Alert>
          )
        )}
      </Modal.Body>
    </Modal>
  );
}

export default ProjectModal;