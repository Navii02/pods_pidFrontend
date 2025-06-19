import React, { useState, useEffect, useContext } from "react";
import DeleteConfirm from "../components/DeleteConfirm";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faTrash,
  faUpload,
  faEdit,
  faSave,
  faTimes,
  faPencil
} from "@fortawesome/free-solid-svg-icons";
import { updateProjectContext } from "../context/ContextShare";
import { getAllcomments, deleteComment, updateComment, deleteAllComment,  } from "../services/CommentApi";
import * as XLSX from "xlsx";

function CommentReview() {
  const { updateProject } = useContext(updateProjectContext);
  const [comments, setComments] = useState([]);
  const [editedRowIndex, setEditedRowIndex] = useState(-1);
  const [editedCommentData, setEditedCommentData] = useState({});
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [importComments, setImportComments] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchComments = async (projectId) => {
    try {
      const response = await getAllcomments(projectId);
      if (response.status === 200) {
        setComments(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      setCustomAlert(true);
      setModalMessage("Failed to fetch comments");
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchComments(projectId);
    }
  }, [projectId, updateProject]);

  const handleDeleteComment = (commentId) => {
    setCurrentDeleteNumber(commentId);
    setShowConfirm(true);
  };

  const handleDeleteAllClick = () => {
    setShowDeleteAllConfirm(true);
  };

  const handleConfirmDeleteAll = async () => {
    try {
      const response = await deleteAllComment(projectId);
      if (response.status === 200) {
        setComments([]);
        setShowDeleteAllConfirm(false);
        setCustomAlert(true);
     
      }
    } catch (error) {
      console.error("Error deleting all comments:", error);
      setCustomAlert(true);
      setModalMessage("Failed to delete all comments");
    }
  };

  const handleCancelDeleteAll = () => {
    setShowDeleteAllConfirm(false);
  };

  const handleEditOpen = (index) => {
    setEditedRowIndex(index);
    setEditedCommentData(comments[index]);
  };

  const handleCloseEdit = () => {
    setEditedRowIndex(-1);
    setEditedCommentData({});
  };

  const handleSave = async () => {
    try {
      const response = await updateComment(editedCommentData);
      if (response.status === 200) {
        const updatedComments = [...comments];
        updatedComments[editedRowIndex] = editedCommentData;
        setComments(updatedComments);
        handleCloseEdit();
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      setCustomAlert(true);
      setModalMessage("Failed to update comment");
    }
  };

  const handleChange = (field, value) => {
    setEditedCommentData({
      ...editedCommentData,
      [field]: value,
    });
  };

  const handlePriorityChange = (priority) => {
    setEditedCommentData({ ...editedCommentData, priority });
  };

  const handleConfirmDelete = async () => {
    try {
      const response = await deleteComment(currentDeleteNumber);
      if (response.status === 200) {
        setComments(comments.filter(comment => comment.number !== currentDeleteNumber));
        setShowConfirm(false);
        setCurrentDeleteNumber(null);
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setCustomAlert(true);
      setModalMessage("Failed to delete comment");
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  const handleExport = () => {
    const headers = [
      "Comment number",
      "Comment",
      "Status",
      "Priority",
      "Comment Date",
      "Closed Date"
    ];

    const dataToExport = comments.map((comment, index) => ({
      "Comment number": index + 1,
      "Comment": comment.comment,
      "Status": comment.status,
      "Priority": comment.priority,
      "Comment Date": new Date(comment.createddate).toLocaleString(),
      "Closed Date": comment.closedDate ? new Date(comment.closedDate).toLocaleString() : "Not closed"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comments List");
    XLSX.writeFile(wb, "CommentsList.xlsx");
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredComments = comments.filter(comment =>
    comment.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.priority?.toString().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: "white",
        zIndex: "1",
        position: "absolute",
      }}
    >
      <div className="table-container">
        <table className="linetable w-100">
          <thead>
            <tr>
              <th className="wideHead">Comment number</th>
              <th className="wideHead">Comment</th>
              <th className="wideHead">Status</th>
              <th>Priority</th>
              <th>Comment Date</th>
              <th>Closed Date</th>
              <th className="tableActionCell">
                <FontAwesomeIcon 
                  icon={faDownload} 
                  title="Export"
                  onClick={handleExport}
                  style={{ cursor: 'pointer' }}
                />
                <FontAwesomeIcon 
                  icon={faTrash} 
                  title="DeleteAll"
                  onClick={handleDeleteAllClick}
                  style={{ cursor: 'pointer', marginLeft: '15px' }}
                />
              </th>
            </tr>
            <tr>
              <th colSpan="7">
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={handleSearch}
                  style={{ width: "100%", padding: "5px" }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredComments.length > 0 ? (
              filteredComments.map((comment, index) => (
                <tr key={comment.number} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        type="text"
                        value={editedCommentData.comment || ""}
                        onChange={(e) => handleChange("comment", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      comment.comment
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <select
                        value={editedCommentData.status || ""}
                        onChange={(e) => handleChange("status", e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="onhold">On Hold</option>
                      </select>
                    ) : (
                      comment.status
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <div style={{ display: "flex" }}>
                        {[1, 2, 3].map((priority) => (
                          <div key={priority} style={{ marginRight: "15px" }}>
                            <input
                              type="radio"
                              name={`priority-${index}`}
                              id={`priority-${index}-${priority}`}
                              value={priority.toString()}
                              checked={editedCommentData.priority === priority.toString()}
                              onChange={() => handlePriorityChange(priority.toString())}
                            />
                            <label htmlFor={`priority-${index}-${priority}`}>
                              {priority}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      comment.priority
                    )}
                  </td>
                  <td>{formatDate(comment.createddate)}</td>
                  <td>{formatDate(comment.closedDate) || ""}</td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedRowIndex === index ? (
                      <>
                        <FontAwesomeIcon
                          icon={faSave}
                          className="text-success"
                          onClick={handleSave}
                          style={{ cursor: "pointer" }}
                        />
                        <FontAwesomeIcon
                          icon={faTimes}
                          className="text-danger"
                          onClick={handleCloseEdit}
                          style={{ cursor: "pointer", marginLeft: "15px" }}
                        />
                      </>
                    ) : (
                      <>
                        {comment.status !== "closed" && (
                          <FontAwesomeIcon
                            icon={faPencil}
                            onClick={() => handleEditOpen(index)}
                            style={{ cursor: "pointer" }}
                          />
                        )}
                        <FontAwesomeIcon
                          icon={faTrash}
                          onClick={() => handleDeleteComment(comment.number)}
                          style={{ cursor: "pointer", marginLeft: "15px" }}
                        />
                      </>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">
                  {searchQuery ? "No matching comments found" : "No comments available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete this comment?"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {showDeleteAllConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete ALL comments for this project? This action cannot be undone."
          onConfirm={handleConfirmDeleteAll}
          onCancel={handleCancelDeleteAll}
        />
      )}
    </div>
  );
}

export default CommentReview;