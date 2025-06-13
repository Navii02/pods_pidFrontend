
import React, { useState, useEffect, useRef, useContext } from "react";
import Modal from "react-bootstrap/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import "../../styles/TreeRegistration.css";
import { RegisterArea } from "../../services/TreeManagementApi";
import { TreeresponseContext } from "../../context/ContextShare";

function Arearegister({ onClose, isOpen }) {
 const { setUpdatetree } = useContext(TreeresponseContext);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const codeInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setName("");
      setCustomAlert(false);
      setModalMessage("");
      if (codeInputRef.current) {
        codeInputRef.current.focus();
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    setCode("");
    setName("");
    setCustomAlert(false);
    setModalMessage("");
    onClose();
  };

  const handleOk = async() => {
    if (!code.trim()) {
      setCustomAlert(true);
      setModalMessage("Code is mandatory");
      return;
    }

    const projectString = sessionStorage.getItem("selectedProject");
       const project = projectString ? JSON.parse(projectString) : null;
       const projectId = project.projectId
       const data = { code, name ,projectId};
       console.log(data);
       const response = await RegisterArea(data);
       if (response.status === 200) {
         handleClose();
         setUpdatetree(response)
       } else {
         console.log("something Went wrong", response.status);
       }
  };

  return (
    <Modal
      show={isOpen}
      onHide={handleClose}
      keyboard={false}
      centered
      dialogClassName="custom-modal-dialog"
      contentClassName="custom-modal-content"
    >
      <Modal.Header className="custom-modal-header d-flex justify-content-between">
        <Modal.Title>Add Area</Modal.Title>
        <p className="text-light cross " onClick={handleClose}>
          <FontAwesomeIcon icon={faTimes } size="lg " className="mt-3" />
        </p>
      </Modal.Header>

      <Modal.Body className="custom-modal-body">
        <div className="form-group">
          <label>
            Code <span className="required">*</span>
          </label>
          <input
            type="text"
            ref={codeInputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="custom-input"
          />
        </div>

        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="custom-input"
          />
        </div>

        {customAlert && (
          <div className="custom-alert">
            {modalMessage}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="custom-modal-footer">
        <button className="btn btn-secondary" onClick={handleClose}>
          Cancel
        </button>
        <button className="btn btn-dark" onClick={handleOk}>
          OK
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default Arearegister;
