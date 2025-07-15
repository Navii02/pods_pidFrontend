import React, { useState, useEffect, useRef, useContext } from "react";
import Modal from "react-bootstrap/Modal";
import { RegisterSystem } from "../../services/TreeManagementApi";
import { TreeresponseContext } from "../../context/ContextShare";
import Alert from "../Alert";

function SystemRegister({ onClose, isOpen }) {
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

const handleOk = async () => {
  if (!code.trim()) {
    setCustomAlert(true);
    setModalMessage("Code is mandatory");
    return;
  }

  try {
    const projectString = sessionStorage.getItem("selectedProject");
    const project = projectString ? JSON.parse(projectString) : null;
    const projectId = project?.projectId;

    const data = { code, name, projectId };

    const response = await RegisterSystem(data);

    if (response.status === 200) {
      setUpdatetree(response);
      handleClose();
    } else {
      console.error("Something went wrong. Status:", response.status);
      setCustomAlert(true);
      setModalMessage("Failed to register system");
    }
  } catch (error) {
    console.error("Error in handleOk:", error);
    if (error.status === 406 || error.status === 409 ) {
    setCustomAlert(true);
    setModalMessage("Registering System already exist");
     }
  }
};


  return (
    <Modal
      onHide={handleClose}
      show={isOpen}
      backdrop="static"
      keyboard={false}
      dialogClassName="custom-modal"
    >
      <div className="area-dialog">
        <div className="title-dialog">
          <p className="text-light">Add System</p>
          <p className="text-light cross" onClick={handleClose}>
            &times;
          </p>
        </div>
        <div className="dialog-input">
          <label>
            Code<span className="required">*</span>
          </label>
          <input
            type="text"
            ref={codeInputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
 {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}
         <Modal.Footer className="custom-modal-footer">
        <button
          className="btn btn-secondary"
          onClick={handleClose}
          
        >
          Cancel
        </button>
        <button
          className="btn btn-dark"
          onClick={handleOk}
       
        >
         Ok
        </button>
      </Modal.Footer>
      </div>
    </Modal>
  );
}

export default SystemRegister;
