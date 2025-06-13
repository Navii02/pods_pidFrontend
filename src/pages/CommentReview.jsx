import {
  faDownload,
  faTrash,
  faUpload,
  faEdit,
  faSave,
  faTimes,
  faXmark,
  faPencil,
  faFloppyDisk
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";

function CommentReview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editedRowIndex, setEditedRowIndex] = useState(null);
  const [editedLineData, setEditedLineData] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const filteredComments = []; // replace with your actual filtered data

  const handleSearch = (e) => setSearchQuery(e.target.value);
  const handleChange = (field, value) =>
    setEditedLineData({ ...editedLineData, [field]: value });
  const handlePriorityChange = (priority) =>
    setEditedLineData({ ...editedLineData, priority });

  const handleEdit = (comment, index) => {
    setEditedRowIndex(index);
    setEditedLineData({ ...comment });
  };

  const handleCancel = () => {
    setEditedRowIndex(null);
    setEditedLineData({});
  };

  const handleSave = (index) => {
    // Save logic here
    console.log("Saving:", editedLineData);
    setEditedRowIndex(null);
    setEditedLineData({});
  };

  const handleDelete = (commentId) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      // Delete logic here
      console.log("Deleting comment:", commentId);
    }
  };

  const handleExport = () => {
    // Export logic
    console.log("Exporting comments");
  };

  const handleDeleteAllComments = () => {
    if (window.confirm("Are you sure you want to delete ALL comments?")) {
      // Delete all logic
      console.log("Deleting all comments");
    }
  };

  const thStyle = {
    backgroundColor: "#4d5dbe",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 10,
    textAlign: "left",
    padding: "12px 10px",
    fontSize: "15px",
    fontWeight: "bold"
  };

  const iconThStyle = {
    ...thStyle,
    width: "120px",
  };

  const wrapperStyle = {
    maxHeight: "500px",
    overflowY: "auto",
    backgroundColor: "white",
    borderRadius: "4px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  };

  return (
    <div className="container-fluid px-0">
      <div style={wrapperStyle} className="rounded shadow-sm">
        <table className="table table-bordered table-hover mb-0">
          <thead>
            <tr>
              {[
                'Comment number',
                'Comment',
                'Status',
                'Priority',
                'Comment Date',
                'Closed Date',
              ].map((header, i) => (
                <th key={i} style={thStyle}>
                  {header}
                </th>
              ))}
              <th style={iconThStyle}>
                <div className="d-flex justify-content-around">
                  <FontAwesomeIcon 
                    icon={faUpload} 
                    title="Export"
                    onClick={handleExport}
                    style={{ cursor: 'pointer' }}
                  />
                  <FontAwesomeIcon 
                    icon={faTrash} 
                    title="Delete all"
                    onClick={handleDeleteAllComments}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </th>
            </tr>
            <tr>
              <td colSpan="7">
                <input
                  type="text"
                  placeholder="Search by status or date"
                  className="form-control w-100 bg-white"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </td>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: '#f4f4f4' }}>
            {filteredComments.length > 0 ? (
              filteredComments.map((comment, index) => (
                <tr 
                  key={index} 
                  style={{ color: 'black' }}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{ padding: '10px' }}>{comment.number}</td>
                  <td style={{ padding: '10px' }}>
                    {editedRowIndex === index ? (
                      <input
                        type="text"
                        value={editedLineData.comment || ''}
                        onChange={(e) => handleChange('comment', e.target.value)}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      comment.comment
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {editedRowIndex === index ? (
                      <select
                        value={editedLineData.status || ''}
                        onChange={(e) => handleChange('status', e.target.value)}
                        className="form-control bg-white text-black"
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
                  <td style={{ padding: '10px' }}>
                    {editedRowIndex === index ? (
                      <div className="d-flex">
                        {[1, 2, 3].map((priority) => (
                          <div key={priority} className="form-check me-3">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`priority-${index}`}
                              id={`priority-${index}-${priority}`}
                              value={priority.toString()}
                              checked={editedLineData.priority === priority.toString()}
                              onChange={() => handlePriorityChange(priority.toString())}
                            />
                            <label 
                              className="form-check-label" 
                              htmlFor={`priority-${index}-${priority}`}
                            >
                              {priority}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      comment.priority
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>{comment.createddate}</td>
                  <td style={{ padding: '10px' }}>{comment.closedDate}</td>
                  <td style={{ padding: '10px' }}>
                    <div className="d-flex justify-content-center">
                      {comment.status !== 'closed' ? (
                        editedRowIndex === index ? (
                          <>
                            <button
                              className="btn btn-link p-0 me-2"
                              onClick={() => handleSave(index)}
                            >
                              <FontAwesomeIcon icon={faSave} className="text-success" />
                            </button>
                            <button
                              className="btn btn-link p-0"
                              onClick={handleCancel}
                            >
                              <FontAwesomeIcon icon={faTimes} className="text-danger" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-link p-0 me-2"
                              onClick={() => handleEdit(comment, index)}
                            >
                              <FontAwesomeIcon icon={faPencil} />
                            </button>
                            <button
                              className="btn btn-link p-0"
                              onClick={() => handleDelete(comment.id)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        )
                      ) : (
                        <button
                          className="btn btn-link p-0"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                    </div>
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
    </div>
  );
}

export default CommentReview;