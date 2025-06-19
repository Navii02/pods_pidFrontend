import React, { useEffect, useState, useRef, useContext } from "react";
import {
  faDownload,
  faPlus,
  faTimes,
  faTrash,
  faPencil,
  faFloppyDisk,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getStatustableData, addStatus, deleteStatus } from "../services/CommentApi";
import { Modal } from "react-bootstrap";
import { updateProjectContext } from "../context/ContextShare";
import * as XLSX from "xlsx";
import Alert from "../components/Alert";
import DeleteConfirm from "../components/DeleteConfirm";

const CommentStatusTable = () => {
  const { updateProject } = useContext(updateProjectContext);
  const [tableData, setTableData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState("");
  const [modalColor, setModalColor] = useState("#ffffff");
  const [modalAlert, setModalAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [editedRowIndex, setEditedRowIndex] = useState(-1);
  const [editedStatusData, setEditedStatusData] = useState({});
  const [importStatus, setImportStatus] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

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

  useEffect(() => {
    getStatusTable(projectId);
  }, [updateProject]);

  useEffect(() => {
    if (showModal) {
      setModalStatus("");
      setModalColor("#ffffff");
      setModalAlert(false);
      setModalMessage("");
    }
  }, [showModal]);

  const handleDelete = (number) => {
    setCurrentDeleteNumber(number);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const response = await deleteStatus(currentDeleteNumber);
      if (response.status === 200) {
        getStatusTable(projectId);
      }
    } catch (error) {
      console.error("Failed to delete status:", error);
    } finally {
      setShowConfirm(false);
      setCurrentDeleteNumber(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  const handleExport = () => {
    const headers = ["Number", "Status", "Color"];
    const dataToExport = tableData.map((item, index) => ({
      Number: index + 1,
      Status: item.statusname,
      Color: item.color
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Status List");
    XLSX.writeFile(wb, "StatusList.xlsx");
  };

  const handleAdd = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);

  const handleModalOk = async () => {
    if (!modalStatus.trim()) {
      setModalAlert(true);
      setModalMessage("Status is mandatory");
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
        handleCloseModal();
      }
    } catch (error) {
      setModalAlert(true);
      setModalMessage("Failed to add status. Please try again.");
    }
  };

  const handleEditOpen = (index) => {
    // Prevent editing if status is "open" or "closed"
    const status = tableData[index].statusname.toLowerCase();
    if (status === "open" || status === "closed") {
      return;
    }
    setEditedRowIndex(index);
    setEditedStatusData(tableData[index]);
  };

  const handleCloseEdit = () => {
    setEditedRowIndex(-1);
    setEditedStatusData({});
  };

  const handleSave = async () => {
    try {
      const response = await addStatus(editedStatusData);
      if (response.status === 200) {
        getStatusTable(projectId);
        handleCloseEdit();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleChange = (field, value) => {
    setEditedStatusData({
      ...editedStatusData,
      [field]: value,
    });
  };

  const handleImportStatus = () => setImportStatus(true);
  const handleCloseImport = () => setImportStatus(false);

  const handleExcelFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleImportClick = async () => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const formattedData = jsonData.map(item => ({
          statusname: item["Status"] || "",
          color: item["Color"] || "#ffffff",
          projectId
        }));

        try {
          // You would need to implement a bulk import API endpoint
          // const response = await bulkImportStatuses(formattedData);
          // if(response.status === 200) {
          //   getStatusTable(projectId);
          //   handleCloseImport();
          // }
        } catch (error) {
          console.error("Failed to import statuses:", error);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ["Status", "Color"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "StatusTemplate");
    XLSX.writeFile(workbook, "StatusTemplate.xlsx");
  };

  const filteredData = tableData.filter(item =>
    item.statusname?.toLowerCase()?.includes(searchTerm?.toLowerCase())
  );

  return (
    <div style={{ width: "100%", backgroundColor: "white" }}>
      <div className="table-container w-100">
        <table className="linetable w-100">
          <thead>
            <tr>
              <th className="wideHead">Number</th>
              <th className="wideHead">Status</th>
              <th className="wideHead">Color</th>
              <th className="tableActionCell">
                <FontAwesomeIcon 
                  icon={faDownload} 
                  title="Export"
                  onClick={handleExport}
                  style={{ cursor: "pointer" }}
                />
                <FontAwesomeIcon 
                  icon={faPlus} 
                  title="Add Status"
                  onClick={handleAdd}
                  style={{ cursor: "pointer", marginLeft: "15px" }}
                />
                <FontAwesomeIcon 
                  icon={faDownload} 
                  title="Import"
                  onClick={handleImportStatus}
                  style={{ cursor: "pointer", marginLeft: "15px" }}
                />
              </th>
            </tr>
            <tr>
              <th colSpan="4">
                <input
                  type="text"
                  placeholder="Search by status"
                  className="form-control bg-light"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: "100%", padding: "5px" }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <tr key={item.number} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        type="text"
                        value={editedStatusData.statusname || ""}
                        onChange={(e) => handleChange("statusname", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      item.statusname
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          value={editedStatusData.color || "#ffffff"}
                          onChange={(e) => handleChange("color", e.target.value)}
                        />
                        <span>{editedStatusData.color}</span>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center">
                        <span>{item.color}</span>
                        <div
                          style={{
                            width: "15px",
                            height: "15px",
                            backgroundColor: item.color,
                            marginLeft: "10px",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedRowIndex === index ? (
                      <>
                        <FontAwesomeIcon
                          icon={faFloppyDisk}
                          className="text-success"
                          onClick={handleSave}
                          style={{ cursor: "pointer" }}
                        />
                        <FontAwesomeIcon
                          icon={faXmark}
                          className="text-danger ms-3"
                          onClick={handleCloseEdit}
                          style={{ cursor: "pointer" }}
                        />
                      </>
                    ) : (
                      <>
                        {/* Only show edit icon if status is not "open" or "closed" */}
                        {item.statusname.toLowerCase() !== "open" && 
                         item.statusname.toLowerCase() !== "closed" && (
                          <FontAwesomeIcon
                            icon={faPencil}
                            onClick={() => handleEditOpen(index)}
                            style={{ cursor: "pointer" }}
                          />
                        )}
                        {/* Only show delete icon if status is not "open" or "closed" */}
                        {item.statusname.toLowerCase() !== "open" && 
                         item.statusname.toLowerCase() !== "closed" && (
                          <FontAwesomeIcon
                            icon={faTrash}
                            className="ms-3"
                            onClick={() => handleDelete(item.number)}
                            style={{ cursor: "pointer" }}
                          />
                        )}
                      </>
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

      {/* Add Status Modal */}
      <Modal
        show={showModal}
        onHide={handleCloseModal}
        backdrop="static"
        keyboard={false}
        dialogClassName="custom-modal"
      >
        <div className="tag-dialog">
          <div className="title-dialog">
            <p className="text-light">Add Status</p>
            <p className="text-light cross" onClick={handleCloseModal}>
              <FontAwesomeIcon icon={faTimes} />
            </p>
          </div>
          <div className="dialog-input">
            <label>Status <span className="required">*</span></label>
            <input
              type="text"
              value={modalStatus}
              onChange={(e) => setModalStatus(e.target.value)}
              className="form-control"
            />
            <label className="mt-3">Color <span className="required">*</span></label>
            <div className="d-flex align-items-center gap-2">
              <input
                type="color"
                value={modalColor}
                onChange={(e) => setModalColor(e.target.value)}
              />
              <span>{modalColor}</span>
            </div>
            {modalAlert && (
              <div className="alert alert-danger mt-3">
                {modalMessage}
              </div>
            )}
          </div>
          <div className="dialog-button">
            <button className="btn btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button className="btn btn-dark" onClick={handleModalOk}>
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Status Modal */}
      {importStatus && (
        <Modal
          show={importStatus}
          onHide={handleCloseImport}
          backdrop="static"
          keyboard={false}
          dialogClassName="custom-modal"
        >
          <div className="tag-dialog">
            <div className="title-dialog">
              <p className="text-light">Import Status</p>
              <p className="text-light cross" onClick={handleCloseImport}>
                <FontAwesomeIcon icon={faTimes} />
              </p>
            </div>
            <div className="dialog-input">
              <label>File</label>
              <input
                type="file"
                onChange={handleExcelFileChange}
                accept=".xlsx, .xls"
              />
              <a
                onClick={handleDownloadTemplate}
                style={{ cursor: "pointer", color: "#00BFFF" }}
              >
                Download template
              </a>
            </div>
            <div className="dialog-button">
              <button className="btn btn-secondary" onClick={handleCloseImport}>
                Cancel
              </button>
              <button className="btn btn-dark" onClick={handleImportClick}>
                Upload
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete this status?"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default CommentStatusTable;