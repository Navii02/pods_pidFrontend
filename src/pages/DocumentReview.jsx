import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faUpload, faPencil, faTrashCan, faFloppyDisk, faXmark } from "@fortawesome/free-solid-svg-icons";
import { getDocumentsdetails } from "../services/CommonApis";
import { updateProjectContext } from "../context/ContextShare";
import DeleteConfirm from "../components/DeleteConfirm";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";

const Review = () => {
  const { updateProject } = useContext(updateProjectContext);
  const [documents, setDocuments] = useState([]);
  const [currentDeleteDoc, setCurrentDeleteDoc] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editedRowIndex, setEditedRowIndex] = useState(-1);
  const [editedDocData, setEditedDocData] = useState({});

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) return;

      try {
        const response = await getDocumentsdetails(projectId);
        if (response.status === 200) {
          setDocuments(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch documents", error);
      }
    };

    fetchData();
  }, [updateProject, projectId]);

  const handleDeleteDoc = (docId) => {
    setCurrentDeleteDoc(docId);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    // Add your delete API call here
    setShowConfirm(false);
    setCurrentDeleteDoc(null);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteDoc(null);
  };

  const handleEditOpen = (index) => {
    setEditedRowIndex(index);
    setEditedDocData(documents[index]);
  };

  const handleCloseEdit = () => {
    setEditedRowIndex(-1);
    setEditedDocData({});
  };

  const handleSave = async () => {
    // Add your save API call here
    setEditedRowIndex(-1);
    setEditedDocData({});
  };

  const handleChange = (field, value) => {
    setEditedDocData({
      ...editedDocData,
      [field]: value
    });
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{
      
      height: "100vh",
      backgroundColor: "white",
      zIndex: "1",
      position: "absolute",
    }}className="w-100">
      <div className="table-container w-100">
        <table className="linetable w-100">
          <thead>
            <tr>
              <th className="wideHead">#</th>
              <th className="wideHead">Document number</th>
              <th className="wideHead">Title</th>
              <th>Description</th>
              <th>Type</th>
              <th>File</th>
              <th className="tableActionCell">
                <FontAwesomeIcon 
                  icon={faUpload} 
                  className="me-2" 
                  title="Export" 
                  // onClick={handleExport} 
                />
                <FontAwesomeIcon 
                  icon={faDownload} 
                  title="Import" 
                  // onClick={handleImport} 
                />
              </th>
            </tr>
            <tr>
              <th colSpan="7">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={handleSearch}
                  style={{ width: "100%", padding: "5px" }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.map((doc, index) => (
              <tr key={index} style={{ color: "black" }}>
                <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                <td>
                  {editedRowIndex === index ? (
                    <input
                      type="text"
                      value={editedDocData.number || ""}
                      onChange={(e) => handleChange("number", e.target.value)}
                    />
                  ) : (
                    doc.number
                  )}
                </td>
                <td>
                  {editedRowIndex === index ? (
                    <input
                      type="text"
                      value={editedDocData.title || ""}
                      onChange={(e) => handleChange("title", e.target.value)}
                    />
                  ) : (
                    doc.title
                  )}
                </td>
                <td>
                  {editedRowIndex === index ? (
                    <input
                      type="text"
                      value={editedDocData.descr || ""}
                      onChange={(e) => handleChange("descr", e.target.value)}
                    />
                  ) : (
                    doc.descr
                  )}
                </td>
                <td>
                  {editedRowIndex === index ? (
                    <input
                      type="text"
                      value={editedDocData.type || ""}
                      onChange={(e) => handleChange("type", e.target.value)}
                    />
                  ) : (
                    doc.type
                  )}
                </td>
                <td>{doc.filename}</td>
                <td style={{ backgroundColor: "#f0f0f0" }}>
                  {editedRowIndex === index ? (
                    <>
                      <FontAwesomeIcon
                        icon={faFloppyDisk}
                        className="text-success me-2"
                        onClick={handleSave}
                      />
                      <FontAwesomeIcon
                        icon={faXmark}
                        className="text-danger"
                        onClick={handleCloseEdit}
                      />
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faPencil}
                        className="me-2"
                        onClick={() => handleEditOpen(index)}
                      />
                      <FontAwesomeIcon
                        icon={faTrashCan}
                        onClick={() => handleDeleteDoc(doc.id)}
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredDocuments.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">
                  No documents available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete this document?"
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
    </div>
  );
};

export default Review;