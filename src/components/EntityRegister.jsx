import React, { useState, useEffect, useRef } from "react";
import Modal from "react-bootstrap/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
// import "../styles/TreeRegistration.css";
import { GetEntities, RegisterEnitity } from "../services/TreeManagementApi";


function EntityRegister({
  onClose,
  isOpen,
  entityType,
  parentEntity,
  onSuccess,
  expandedSystem
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [existingEntities, setExistingEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const codeInputRef = useRef(null);
  console.log(parentEntity);

  const entityConfig = {
    Area: {
      title: "Add Area",
      codeLabel: "Area Code",
      nameLabel: "Area Name",
      requireName: true,

      showExisting: true,
      codeField: "area",
    },
    System: {
      title: "Add System",
      codeLabel: "System Code",
      nameLabel: "System Name",
      requireName: true,

      showExisting: true,
      codeField: "sys",
    },
    Discipline: {
      title: "Add Discipline",
      codeLabel: "Discipline Code",
      nameLabel: "Discipline Name",
      requireName: true,

      showExisting: true,
      codeField: "disc",
    },
  };

  const config = entityConfig[entityType] || entityConfig.Area;

  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchExistingEntities();
    }
  }, [isOpen, entityType]);

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
    setCustomAlert(false);
    setModalMessage("");
    if (codeInputRef.current) {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  };

  const fetchExistingEntities = async () => {
    try {
      let id;
      if (entityType === "Area") {
        id = parentEntity.projectId;
      } else {
        id = parentEntity.project_id;
      }
      const response = await GetEntities(entityType, id);
      const endpoint = {
        Area: "area",
        System: "system",
        Discipline: "disipline",
      }[entityType];

      if (response.status === 200) {
        console.log(response.data);

        const fetchedList = response.data[endpoint];
        setExistingEntities(Array.isArray(fetchedList) ? fetchedList : []);
      } else {
        setCustomAlert(true);
        setModalMessage(
          response.message || `Failed to fetch existing ${entityType}s`
        );
      }
    } catch (error) {
      console.error(error);
      setCustomAlert(true);
      setModalMessage(`Failed to load existing ${entityType}s`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (codeVal) => {
    const selected = existingEntities.find(
      (e) => e[config.codeField] === codeVal
    );
    if (selected) {
      setCode(selected[config.codeField]);
      setName(selected.name);
      setDescription(selected.description || "");
    } else {
      setCode(codeVal);
      setName("");
      setDescription("");
    }
  };

  const handleNameChange = (nameVal) => {
    const selected = existingEntities.find((e) => e.name === nameVal);
    if (selected) {
      setCode(selected[config.codeField]);
      setName(selected.name);
      setDescription(selected.description || "");
    } else {
      setName(nameVal);
      setCode("");
      setDescription("");
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleOk = async () => {
    let payload = {
      code,
      name,
    };

    if (entityType === "Area") {
      payload.id = parentEntity?.projectId;
    } else {
      // For System and Discipline
      payload.id = parentEntity?.project_id;

      // Add parent entity code depending on entity type
      if (entityType === "System") {
        payload.area = parentEntity?.area;
        payload.disiplne = parentEntity?.disc;
      } else if (entityType === "Discipline") {
        payload.area = parentEntity?.area;
      }
    }

    try {
      const response = await RegisterEnitity(entityType, payload);

      if (response.status === 200) {
        alert("Created successfully");
        onSuccess(); // notify parent
        handleClose(); // close modal
      } else if (response.status === 406) {
        setCustomAlert(true);
        setModalMessage("This combination already exists.");
      } else {
        setCustomAlert(true);
        setModalMessage(response.message || "Failed to save entity");
      }
    } catch (error) {
      console.error(error);
      setCustomAlert(true);
      setModalMessage("Error occurred while saving entity");
    }
  };

  return (

    //   <Modal
    //   onHide={handleClose}
    //   show={showAreaDialog}
    //   backdrop="static"
    //   keyboard={false}
    //   dialogClassName="custom-modal"
    // ></Modal>
    <Modal
      show={isOpen}
      onHide={handleClose}
      keyboard={false}
      centered
      dialogClassName="custom-modal"
      
    >
      {/* <Modal.Header className="custom-modal-header d-flex justify-content-between">

        <Modal.Title>{config.title}</Modal.Title>
        <p className="text-light cross" onClick={handleClose}>
          <FontAwesomeIcon icon={faTimes} size="lg" className="mt-3" />
        </p>
        
      </Modal.Header> */}
        <div className="title-dialog">
            <p className="text-light">{config.title}</p>
            <p className="text-light cross" onClick={handleClose}>
              &times;
            </p>
          </div>

      <Modal.Body className="custom-modal-body">
        {isLoading ? (
          <div className="text-center py-3">
            Loading existing {entityType.toLowerCase()}s...
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>
                {config.codeLabel} <span className="required">*</span>
              </label>
              <select
                className="custom-input"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
              >
                <option value="">Select Code</option>
                {existingEntities.map((entity) => (
                  <option
                    key={entity[config.codeField]}
                    value={entity[config.codeField]}
                  >
                    {entity[config.codeField]}- {entity.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                {config.nameLabel} <span className="required">*</span>
              </label>
              <select
                className="custom-input"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              >
                <option value="">Select Name</option>
                {existingEntities.map((entity) => (
                  <option key={entity[config.codeField]} value={entity.name}>
                    {entity.name}- {entity[config.codeField]}
                  </option>
                ))}
              </select>
            </div>

            {config.showDescription && (
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="custom-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {customAlert && <div className="custom-alert">{modalMessage}</div>}
      </Modal.Body>

      <Modal.Footer className="custom-modal-footer">
        <button
          className="btn btn-secondary"
          onClick={handleClose}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          className="btn btn-dark"
          onClick={handleOk}
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default EntityRegister;
