import React, { useState, useEffect } from "react";
import DeleteConfirm from "../components/DeleteConfirm";
import Alert from "../components/Alert";
import { getUnassignedmodel, deleteUnassignedModel, deleteAllUnassignedModels, AssignmodelTags } from "../services/BulkImportApi";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSquareCheck, faPlusCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Modal } from "react-bootstrap";

function UnAssignedtags() {
  const [unassignedModels, setUnassignedModels] = useState([]);
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedModels, setSelectedModels] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const tagTypes = [
    "Line ",
    "Equipment",
    "Valve",
    "Structural",
    "Others"
  ];

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchUnassignedModels = async (projectId) => {
    try {
      const response = await getUnassignedmodel(projectId);
      if (response.status === 200) {
        setUnassignedModels(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching unassigned models:", error);
      setCustomAlert(true);
      setModalMessage("Failed to fetch unassigned models");
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchUnassignedModels(projectId);
    }
  }, [projectId]);

  const handleDeleteModel = (number) => {
    setCurrentDeleteNumber(number);
    setIsBulkDelete(false);
    setShowConfirm(true);
  };

  const handleDeleteAll = () => {
    if (unassignedModels.length === 0) return;
    setIsBulkDelete(true);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (isBulkDelete) {
        // Handle bulk delete with projectId
        const response = await deleteAllUnassignedModels(projectId);
        if (response.status === 200) {
          setCustomAlert(true);
          setModalMessage("All unassigned models deleted successfully");
          fetchUnassignedModels(projectId);
          setSelectedModels([]);
        }
      } else {
        // Handle individual delete with model number
        const response = await deleteUnassignedModel(currentDeleteNumber);
        if (response.status === 200) {
          setCustomAlert(true);
          setModalMessage("Model deleted successfully");
          fetchUnassignedModels(projectId);
          setSelectedModels(selectedModels.filter(id => id !== currentDeleteNumber));
        }
      }
    } catch (error) {
      console.error("Error deleting model(s):", error);
      setCustomAlert(true);
      setModalMessage(isBulkDelete ? "Failed to delete all models" : "Failed to delete model");
    } finally {
      setShowConfirm(false);
      setCurrentDeleteNumber(null);
      setIsBulkDelete(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
    setIsBulkDelete(false);
  };

  const handleSelectAll = () => {
    if (selectedModels.length === unassignedModels.length) {
      setSelectedModels([]);
    } else {
      const allModelNumbers = unassignedModels.map(model => model.number);
      setSelectedModels(allModelNumbers);
    }
  };

  const handleSelectModel = (e, number) => {
    if (e.target.checked) {
      setSelectedModels([...selectedModels, number]);
    } else {
      setSelectedModels(selectedModels.filter(modelNumber => modelNumber !== number));
    }
  };

  const handleAssignSelected = () => {
    if (selectedModels.length === 0) return;
    setShowAssignModal(true);
  };

  const handleAssignConfirm = async () => {
    const data = unassignedModels
      .filter(model => selectedModels.includes(model.number))
      .map(model => {
        // Extract tag name by removing everything after last dot in filename
        const fileNameParts = model.fileName.split('.');
        const tagName = fileNameParts.slice(0, -1).join('.');
        
        return {
          tagId: model.number,
          fileName: model.fileName,
          tagName: tagName,
          tagType: selectedType,
          projectId: projectId
        };
      });

    const response = await AssignmodelTags(data);
    if (response.status === 200) {
      setCustomAlert(true);
      setModalMessage(`Assigned ${selectedModels.length} models as ${selectedType}`);
      setShowAssignModal(false);
      setSelectedType("");
      setSelectedModels([]);
      fetchUnassignedModels(projectId); 
    }
  };

  const handleAssignCancel = () => {
    setShowAssignModal(false);
    setSelectedType("");
  };

  const getSelectedFileNames = () => {
    return unassignedModels
      .filter(model => selectedModels.includes(model.number))
      .map(model => model.fileName);
  };

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      backgroundColor: "white",
      zIndex: "1",
      position: "absolute",
    }}>
      <div className="table-container">
        <table className="linetable w-100">
          <thead>
            <tr>
              <th className="tableCheckboxCell">
               
              </th>
              <th className="wideHead">Number</th>
              <th className="wideHead">File Name</th>
              <th className="tableActionCell" style={{ textAlign: "right" }}>
                <FontAwesomeIcon
                  icon={faTrash}
                  title="Delete All"
                  onClick={handleDeleteAll}
                  style={{ 
                    cursor: "pointer", 
                    marginRight: "15px", 
                    opacity: unassignedModels.length > 0 ? 1 : 0.5
                  }}
                />
                <FontAwesomeIcon
                  icon={faSquareCheck}
                  title="Select All"
                  onClick={handleSelectAll}
                  style={{ 
                    cursor: "pointer", 
                    marginRight: "15px", 
                  }}
                />
                {selectedModels.length > 0 && (
                  <FontAwesomeIcon
                    icon={faPlusCircle}
                    title="Assign Selected"
                    onClick={handleAssignSelected}
                    style={{ 
                      cursor: "pointer", 
                    }}
                  />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {unassignedModels.length > 0 ? (
              unassignedModels.map((model, index) => (
                <tr key={model.number} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    <input 
                      type="checkbox" 
                      checked={selectedModels.includes(model.number)}
                      onChange={(e) => handleSelectModel(e, model.number)}
                    />
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>{model.fileName}</td>
                  <td style={{ backgroundColor: "#f0f0f0", textAlign: "right" }}>
                    <FontAwesomeIcon
                      icon={faTrash}
                      onClick={() => handleDeleteModel(model.number)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted py-3">
                  No unassigned models available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Tag Modal */}
      <Modal show={showAssignModal} onHide={handleAssignCancel} centered size="sm">
        <div
          style={{
            width: "335px",
            backgroundColor: "#f0f0f5",
            borderRadius: "12px",
            overflow: "hidden",
            fontFamily: "Segoe UI, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "10px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: "bold" }}>Assign Tags</span>
            <button
              onClick={handleAssignCancel}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: "20px",
                cursor: "pointer",
                marginTop: "-2px"
              }}
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: "16px", backgroundColor: "#f0f0f5" }}>
            {/* Models Section */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", marginBottom: "8px", color: "#000" }}>Models</div>
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  padding: "10px",
                  maxHeight: "100px",
                  overflowY: "auto",
                  fontSize: "13px",
                  color: "#333",
                  border: "1px solid #ccc",
                }}
              >
                {getSelectedFileNames().map((fileName, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ marginRight: "6px", color: "#000" }}>•</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fileName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Type Dropdown */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", marginBottom: "8px", color: "#000" }}>
                Type<span style={{ color: "#ff4d4f" }}> *</span>
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  width: "100%",
                  height: "32px",
                  borderRadius: "6px",
                  border: "2px solid orange",
                  padding: "4px 10px",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                  outline: "none",
                  color: "#000",
                }}
              >
                <option value="">Select a type</option>
                <option value="Line ">Line </option>
                <option value="Equipment">Equipment</option>
                <option value="Valve">Valve</option>
                <option value="Structural">Structural</option>
                <option value="Other">Others</option>
              </select>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 16px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleAssignConfirm}
                disabled={!selectedType}
                style={{
                  backgroundColor: "#fff",
                  border: "2px solid #000",
                  color: "#000",
                  borderRadius: "4px",
                  padding: "2px 10px",
                  fontSize: "14px",
                  cursor: !selectedType ? "not-allowed" : "pointer",
                  opacity: !selectedType ? 0.5 : 1,
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {showConfirm && (
        <DeleteConfirm
          message={
            isBulkDelete
              ? "Are you sure you want to delete ALL unassigned models?"
              : "Are you sure you want to delete this unassigned model?"
          }
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}

export default UnAssignedtags;