import {
  faDownload,
  faTrash,
  faUpload,
  faEdit,
  faSave,
  faTimes,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTag, getdocumentsbyTags, GetTagDetails, updateTags } from "../services/TagApi";
import { TreeresponseContext, updateProjectContext } from "../context/ContextShare";
import { Modal } from "react-bootstrap";
import Alert from "../components/Alert";
import DeleteConfirm from "../components/DeleteConfirm";

const Tagreview = () => {
  const {updateProject} = useContext(updateProjectContext);
    const {  setUpdatetree } = useContext(TreeresponseContext);
  
  const [tags, setTags] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [popupData, setPopupData] = useState({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const navigate = useNavigate();
  
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const GetTags = async () => {
    const response = await GetTagDetails(projectId);
    if (response.status === 200) {
      const mappedTags = response.data.map((tag) => ({
        ...tag,
        parentTag: tag.parenttag,
      }));
      setTags(mappedTags);
      const parents = [
        ...new Set(mappedTags.map((tag) => tag.number).filter(Boolean)),
      ];
      setParentTagOptions(parents);
    }
  };

  useEffect(() => {
    GetTags();
  }, [updateProject]);

  const handleEdit = (tag) => {
    setEditingId(tag.tagId);
    setEditData({
      ...tag,
      parentTag: tag.parentTag || "",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (tagId) => {
    try {
      const payload = {
        ...editData,
        parenttag: editData.parentTag,
      };
      const response = await updateTags(tagId, payload);
      if (response.status === 200) {
        setModalMessage("The Tag is updated Successfully");
        setCustomAlert(true);
         setUpdatetree(Date.now()); 
        GetTags();
      }
      setEditingId(null);
    } catch (error) {
      console.error("Error updating tag:", error);
      setModalMessage("Error updating tag");
      setCustomAlert(true);
    }
  };

  const handleDelete = async (tagId) => {
    setTagToDelete(tagId);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const response = await deleteTag(tagToDelete);
      if (response.status === 200) {
        GetTags();
         setUpdatetree(Date.now()); 
        setModalMessage("Tag deleted successfully");
        setCustomAlert(true);
      } else {
        setModalMessage("Something Went Wrong");
        setCustomAlert(true);
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
    }
    setShowConfirm(false);
    setTagToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setTagToDelete(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setEditData((prev) => ({ ...prev, modelFile: e.target.files[0] }));
  };

  const handleTagNameClick = async (tagId, event) => {
    try {
      const response = await getdocumentsbyTags(tagId);
      if (response.status === 200 && response.data.length > 0) {
        setPopupData({
          visible: true,
          tagId,
          documents: response.data,
          x: event.clientX,
          y: event.clientY,
        });
      } else {
        setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
        setModalMessage("No documents assigned to this tag");
        setCustomAlert(true);
      }
    } catch (error) {
      console.error("Error fetching documents for tag:", error);
      setModalMessage("Failed to fetch documents");
      setCustomAlert(true);
    }
  };

  const handleDocumentClick = (documentId, tagId) => {
    navigate(`/canvas/${documentId}?tagId=${tagId}`);
    setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
  };

  const filteredTags = tags.filter((tag) =>
    tag.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: 'white', zIndex: '1', position: 'absolute' }}>
      <div className="table-container">
        <table className='tagTable'>
          <thead>
            <tr>
              <th>#</th>
              <th>Tag number</th>
              <th>Name</th>
              <th>Type</th>
              <th>Parent tag</th>
              <th>Model</th>
              <th>
                <FontAwesomeIcon icon={faDownload} className="me-2" title="Export" />
                <FontAwesomeIcon icon={faUpload} className="me-2" title="Import" />
                <FontAwesomeIcon icon={faTrash} title="Delete" />
              </th>
            </tr>
            <tr>
              <th colSpan="7">
                <input
                  type="text"
                  placeholder="Search by Tag Number or Type"
                  className="form-control w-100 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTags.length > 0 ? (
              filteredTags.map((tag, index) => (
                <tr 
                  key={tag.tagId}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative', color: 'black' }}
                >
                  <td style={{ backgroundColor: '#f0f0f0' }}>{index + 1}</td>
                  <td>
                    {editingId === tag.tagId ? (
                      <input
                        type="text"
                        name="number"
                        value={editData.number || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      tag.number
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <input
                        type="text"
                        name="name"
                        value={editData.name || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      <span
                        style={{ cursor: "pointer", color: "#4d5dbe" }}
                        onClick={(e) => handleTagNameClick(tag.tagId, e)}
                      >
                        {tag.name}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <select
                        name="type"
                        value={editData.type || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      >
                        <option value="Line">Line</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Valve">Valve</option>
                        <option value="Structural">Structural</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      tag.type
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <select
                        name="parentTag"
                        value={editData.parentTag || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      >
                        <option value="">None</option>
                        {parentTagOptions.map((parent, i) => (
                          <option key={i} value={parent}>
                            {parent}
                          </option>
                        ))}
                      </select>
                    ) : (
                      tag.parentTag || "-"
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      tag.filename || "-"
                    )}
                  </td>
                  <td style={{ backgroundColor: '#f0f0f0' }} className="text-center">
                    {editingId === tag.tagId ? (
                      <>
                        <FontAwesomeIcon 
                          icon={faSave} 
                          className="text-success me-3" 
                          onClick={() => handleSave(tag.tagId)}
                          title="Save"
                        />
                        <FontAwesomeIcon 
                          icon={faTimes} 
                          className="text-danger" 
                          onClick={handleCancel}
                          title="Cancel"
                        />
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon 
                          icon={faEdit} 
                          className="me-3" 
                          onClick={() => handleEdit(tag)}
                          title="Edit"
                        />
                        <FontAwesomeIcon 
                          icon={faTrash} 
                          onClick={() => handleDelete(tag.tagId)}
                          title="Delete"
                        />
                      </>
                    )}
                  </td>
                  
                  {hoveredRow === index && (
                    <div 
                      className="tooltip"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#333',
                        color: '#fff',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 2000,
                        pointerEvents: 'none'
                      }}
                    >
                      Click tag name to view assigned documents
                    </div>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">
                  {searchTerm ? "No matching tags found" : "No Tags available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {popupData.visible && (
          <div
            className="document-popup"
            style={{
              position: "fixed",
              left: popupData.x,
              top: popupData.y,
              backgroundColor: "#ffffff",
              border: "1px solid #d1d5db",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              padding: "16px",
              borderRadius: "8px",
              zIndex: 1000,
              maxWidth: "480px",
              minWidth: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h6 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
                Documents for Tag
              </h6>
              <button
                onClick={() => setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 })}
                className="popup-close"
                title="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <hr style={{ margin: "12px 0", borderColor: "#e5e7eb" }} />

            {popupData.documents.length > 0 ? (
              <ul className="document-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {popupData.documents.map((doc) => (
                  <li
                    key={doc.documentId}
                    onClick={() => handleDocumentClick(doc.documentId, popupData.tagId)}
                    className="document-item"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="document-number">
                        {doc.number}
                      </span>
                      <span className="document-title">
                        {doc.title}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-documents">No documents found</p>
            )}
          </div>
        )}

        {customAlert && (
          <Alert
            message={modalMessage}
            onAlertClose={() => setCustomAlert(false)}
          />
        )}

        {showConfirm && (
          <DeleteConfirm
            message="Are you sure you want to delete this tag?"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        )}
      </div>
    </div>
  );
};

export default Tagreview;