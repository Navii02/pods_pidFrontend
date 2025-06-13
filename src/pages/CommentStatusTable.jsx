import React, { useState } from "react";
import {
  faDownload,
  faUpload,
  faTrash,
  faEdit,
  faSave,
  faTimes,
  faPencil,
  faPlus
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const CommentStatusTable = () => {
  const [tableData, setTableData] = useState([
  ]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = (id) => {
   
    setTableData(tableData.map(item => 
      item.id === id ? { ...editData } : item
    ));
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this status?")) {
      setTableData(tableData.filter(item => item.id !== id));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (e) => {
    setEditData(prev => ({ ...prev, color: e.target.value }));
  };

  const handleExport = () => {
    console.log("Exporting status data");
  };

  const handleAdd = () => {
    console.log("Importing status data");
  };

  const filteredData = tableData.filter(item =>
    item.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.number.toString().includes(searchTerm)
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
              <th style={thStyle}>Number</th>
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
                    title="Import"
                  />
                </div>
              </th>
            </tr>
            <tr>
              <td colSpan="4">
                <input
                  type="text"
                  placeholder="Search by number or status"
                  className="form-control w-100 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </td>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr 
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        name="number"
                        value={editData.number || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      item.number
                    )}
                  </td>
                  <td>
                    {editingId === item.id ? (
                      <select
                        name="status"
                        value={editData.status || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    ) : (
                      item.status
                    )}
                  </td>
                  <td>
                    {editingId === item.id ? (
                      <div className="d-flex align-items-center">
                        <input
                          type="color"
                          value={editData.color || "#ffffff"}
                          onChange={handleColorChange}
                          style={{ width: "30px", height: "30px", marginRight: "10px" }}
                        />
                        <span>{editData.color}</span>
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
                    <div className="d-flex justify-content-center">
                      {editingId === item.id ? (
                        <>
                          <button
                            className="btn btn-link p-0 me-2"
                            onClick={() => handleSave(item.id)}
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
                            onClick={() => handleEdit(item)}
                          >
                            <FontAwesomeIcon icon={faPencil} />
                          </button>
                          <button
                            className="btn btn-link p-0"
                            onClick={() => handleDelete(item.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </>
                      )}
                    </div>
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
    </div>
  );
};

export default CommentStatusTable;