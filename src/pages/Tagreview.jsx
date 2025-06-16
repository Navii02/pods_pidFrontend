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
import { updateProjectContext } from "../context/ContextShare";

const Tagreview = () => {
 const {updateProject} = useContext(updateProjectContext)

  const [tags, setTags] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [popupData, setPopupData] = useState({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
  const [hoveredRow, setHoveredRow] = useState(null);
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
        alert("The Tag is updated Successfully");
        GetTags();
      }
      setEditingId(null);
    } catch (error) {
      console.error("Error updating tag:", error);
    }
  };

  const handleDelete = async (tagId) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      try {
        const response = await deleteTag(tagId);
        if (response.status === 200) {
          GetTags();
        } else {
          alert("Something Went Wrong");
        }
      } catch (error) {
        console.error("Error deleting tag:", error);
      }
    }
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
      const response = await getdocumentsbyTags(tagId)
      console.log(response.data);
      
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
        alert("No documents assigned to this tag");
      }
    } catch (error) {
      console.error("Error fetching documents for tag:", error);
      alert("Failed to fetch documents");
    }
  };

  const handleDocumentClick = (documentId, tagId) => {
    navigate(`/canvas/${documentId}?tagId=${tagId}`);
    setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
  };

  const filteredTags = tags.filter(
    (tag) =>
      tag.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const thStyle = {
    backgroundColor: "#4d5dbe",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 10,
    textAlign: "center",
    padding: "8px 12px",
  };

  const iconThStyle = {
    ...thStyle,
    width: "120px",
  };

  const wrapperStyle = {
    maxHeight: "500px",
    overflowY: "auto",
  };

  return (
    <div className="container-fluid px-0">
      <div style={wrapperStyle} className="rounded shadow-sm">
        <table className="table table-bordered table-hover mb-0">
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Tag number</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Parent tag</th>
              <th style={thStyle}>Model</th>
              <th style={iconThStyle}>
                <div className="d-flex justify-content-around">
                  <FontAwesomeIcon icon={faDownload} />
                  <FontAwesomeIcon icon={faUpload} />
                  <FontAwesomeIcon icon={faTrash} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="text-center">
            {tags.length !== 0 && (
              <tr>
                <td colSpan="7">
                  <input
                    type="text"
                    placeholder="Search by Tag Number or Type"
                    className="form-control w-100 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </td>
              </tr>
            )}
            {filteredTags.length > 0 ? (
              filteredTags.map((tag, index) => (
                <tr 
                  key={tag.tagId}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative' }}
                >
                  <td>{index + 1}</td>
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
                      tag.model || "-"
                    )}
                  </td>
                  <td>
                    <div className="d-flex justify-content-center">
                      {editingId === tag.tagId ? (
                        <>
                          <button
                            className=""
                            onClick={() => handleSave(tag.tagId)}
                          >
                            <FontAwesomeIcon icon={faSave} />
                          </button>
                          <button
                            className=""
                            onClick={handleCancel}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </>
                      ) : (
                        <div className="p-0">
                          <button
                            className=""
                            onClick={() => handleEdit(tag)}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className=""
                            onClick={() => handleDelete(tag.tagId)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* Tooltip */}
                  {hoveredRow === index && (
                    <div 
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
      </div>
     {popupData.visible && (
  <div
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
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h6 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
        Documents for Tag
      </h6>
      <button
        onClick={() =>
          setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 })
        }
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          color: "#6b7280",
        }}
        title="Close"
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>

    <hr style={{ margin: "12px 0", borderColor: "#e5e7eb" }} />

    {/* Document List */}
    {popupData.documents.length > 0 ? (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {popupData.documents.map((doc) => (
          <li
            key={doc.documentId}
            onClick={() => handleDocumentClick(doc.documentId, popupData.tagId)}
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: "6px",
              marginBottom: "8px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              transition: "background 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#eef2f7";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f9fafb";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "13px",
                  backgroundColor: "#e0e7ff",
                  color: "#3730a3",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontWeight: "600",
                  minWidth: "60px",
                  textAlign: "center",
                }}
              >
                {doc.number}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginLeft: "12px",
                  flexGrow: 1,
                  textAlign: "right",
                }}
              >
                {doc.title}
              </span>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", textAlign: "center" }}>
        No documents found
      </p>
    )}
  </div>
)}

    </div>
  );
};

export default Tagreview;