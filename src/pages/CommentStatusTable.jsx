import React, { useEffect, useState, useRef, useContext } from "react";
import {
  faDownload,
  faPlus,
  faTimes,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getStatustableData, addStatus, deleteStatus } from "../services/CommentApi";
import Modal from "react-bootstrap/Modal";
import { updateProjectContext } from "../context/ContextShare";

const CommentStatusTable = () => {
   const {updateProject} = useContext(updateProjectContext)

  const [tableData, setTableData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState("");
  const [modalColor, setModalColor] = useState("#ffffff");
  const [modalAlert, setModalAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const statusInputRef = useRef(null);

  const getStatusTable = async (projectId) => {
    try {
      const response = await getStatustableData(projectId);
      if (response.status === 200) {
        setTableData(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch status table data:", error);
    }
  };

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  useEffect(() => {
    getStatusTable(projectId);
  }, [updateProject]);

  useEffect(() => {
    if (showModal) {
      setModalStatus("");
      setModalColor("#ffffff");
      setModalAlert(false);
      setModalMessage("");
      if (statusInputRef.current) {
        statusInputRef.current.focus();
      }
    }
  }, [showModal]);

  const handleDelete = async (number) => {
    if (window.confirm("Are you sure you want to delete this status?")) {
      try {
        const response = await deleteStatus(number);
        if (response.status === 200) {
          getStatusTable(projectId);
        }
      } catch (error) {
        alert("Failed to delete status. Please try again.");
      }
    }
  };

  const handleExport = () => {
    console.log("Exporting status data");
  };

  const handleAdd = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setModalStatus("");
    setModalColor("#ffffff");
    setModalAlert(false);
    setModalMessage("");
  };

  const handleModalOk = async () => {
    if (!modalStatus.trim()) {
      setModalAlert(true);
      setModalMessage("Status is mandatory");
      return;
    }
    if (!modalColor) {
      setModalAlert(true);
      setModalMessage("Color is mandatory");
      return;
    }

    const newStatus = {
      statusname: modalStatus,
      color: modalColor,
      projectId
    };

    try {
      const response = await addStatus(newStatus);
      if (response.status === 200 || response.status === 201) {
        getStatusTable(projectId);
        handleModalClose();
      }
    } catch (error) {
      setModalAlert(true);
      setModalMessage("Failed to add status. Please try again.");
    }
  };

  const filteredData = tableData?.filter(item =>
    item.statusname?.toLowerCase()?.includes(searchTerm?.toLowerCase())
  );

  const thStyle = {
    backgroundColor: "#4d5dbe",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 10,
    textAlign: "left",
    padding: "12px 10px",
    fontWeight: "bold"
  };

  const iconThStyle = {
    ...thStyle,
    width: "120px",
  };

  const wrapperStyle = {
    maxHeight: "500px",
    overflowY: "auto",
    borderRadius: "4px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  };

  return (
    <div className="container-fluid px-0">
      <div style={wrapperStyle} className="rounded shadow-sm">
        <table className="table table-bordered table-hover mb-0">
          <thead>
            <tr>
              <th style={thStyle}  className="ms-4">Number</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Color</th>
              <th style={iconThStyle}>
                <div className="d-flex justify-content-around">
                  <FontAwesomeIcon 
                    icon={faDownload} 
                    onClick={handleExport}
                    style={{ cursor: "pointer" }}
                    title="Export"
                  />
                  <FontAwesomeIcon 
                    icon={faPlus} 
                    onClick={handleAdd}
                    style={{ cursor: "pointer" }}
                    title="Add Status"
                  />
                </div>
              </th>
            </tr>
            <tr>
              <td colSpan="4">
                <input
                  type="text"

                  placeholder="Search by status"
                  className="form-control w-100 bg-white text-dark"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </td>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData?.map((item, index) => (
                <tr 
                  key={item.number}
                  onMouseEnter={() => setHoveredRow(item.number)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td>{index + 1}</td>
                  <td>{item.statusname}</td>
                  <td>
                    {item.statusname === "open" ? (
                      <div className="d-flex align-items-center">
                        <span>#FF0000</span>
                        <div
                          style={{
                            width: "15px",
                            height: "15px",
                            backgroundColor: "#FF0000",
                            display: "inline-block",
                            marginLeft: "10px",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    ) : item.statusname === "closed" ? (
                      <div className="d-flex align-items-center">
                        <span>#00FF00</span>
                        <div
                          style={{
                            width: "15px",
                            height: "15px",
                            backgroundColor: "#00FF00",
                            display: "inline-block",
                            marginLeft: "10px",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    ) : (
                      <div className="d-flex align-items-center">
                        <span>{item.color}</span>
                        <div
                          style={{
                            width: "15px",
                            height: "15px",
                            backgroundColor: item.color,
                            display: "inline-block",
                            marginLeft: "10px",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    {item.statusname !== "open" && item.statusname !== "closed" && (
                      <div className="d-flex justify-content-center">
                        <button
                          className="btn btn-link p-0"
                          onClick={() => handleDelete(item.number)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted py-3">
                  {searchTerm ? "No matching statuses found" : "No statuses available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        show={showModal}
        onHide={handleModalClose}
        keyboard={false}
        centered
        dialogClassName="custom-modal-dialog"
        contentClassName="custom-modal-content"
      >
        <Modal.Header className="custom-modal-header d-flex justify-content-between">
          <Modal.Title>Add Status</Modal.Title>
          <p className="text-light cross" onClick={handleModalClose}>
            <FontAwesomeIcon icon={faTimes} size="lg" className="mt-3" />
          </p>
        </Modal.Header>

        <Modal.Body className="custom-modal-body">
          <div className="form-group">
            <label>
              Status <span className="required">*</span>
            </label>
            <input
              type="text"
              ref={statusInputRef}
              value={modalStatus}
              onChange={(e) => setModalStatus(e.target.value)}
              className="form-control bg-white text-black"
              placeholder="Enter status"
            />
          </div>

          <div className="form-group">
            <label>
              Color <span className="required">*</span>
            </label>
            <div className="d-flex align-items-center gap-3">
              <input
                type="color"
                value={modalColor}
                onChange={(e) => setModalColor(e.target.value)}
                style={{ width: "100px", height: "40px", border: "none" }}
              />
              <span>{modalColor}</span>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: modalColor,
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          {modalAlert && (
            <div className="custom-alert">
              {modalMessage}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="custom-modal-footer">
          <button className="btn btn-secondary" onClick={handleModalClose}>
            Cancel
          </button>
          <button className="btn btn-dark" onClick={handleModalOk}>
            OK
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CommentStatusTable;