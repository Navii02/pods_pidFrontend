import React, { useState, useEffect } from "react";
import DeleteConfirm from "../components/DeleteConfirm";
import * as XLSX from "xlsx";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faUpload,
  faTrashCan,
  faSave,
  faTimes,
  faEdit,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { deletevalveList, getvalvelist, saveimportedValveList, EditValvelist } from "../services/TagApi";

function ValveList() {
  const [editedValveId, setEditedValveId] = useState(null); // Changed from editedRowIndex
  const [editedValveData, setEditedValveData] = useState({});
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [importTag, setImportTag] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [allValveList, setAllValveList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedValveIds, setSelectedValveIds] = useState([]); // New state for multiple selection
  const [loaded, setLoaded] = useState(false);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchValveData = async (projectId) => {
    const response = await getvalvelist(projectId);
    if (response.status === 200) {
      console.log(response.data);
      setAllValveList(response.data);
    }
  };

      useEffect(() => {
        if (loaded)fetchValveData(projectId);
  
      }, [ loaded]);

  const handleDeleteValveFromTable = (id) => {
    setCurrentDeleteNumber(id);
    setShowConfirm(true);
  };

  // New function for multiple delete
  const handleMultipleDelete = () => {
    if (selectedValveIds.length === 0) {
      setModalMessage("No valves selected for deletion");
      setCustomAlert(true);
      return;
    }
    setCurrentDeleteNumber([...selectedValveIds]);
    setShowConfirm(true);
  };

  // Modified to use valve object instead of index
  const handleEditOpen = (valve) => {
    setEditedValveId(valve.tagId);
    setEditedValveData(valve);
  };

  const handleCloseEdit = () => {
    setEditedValveId(null);
    setEditedValveData({});
  };

  // Updated save function
  const handleSave = async (id) => {
    try {
      const response = await EditValvelist(editedValveData);
      if (response.status === 200) {
        setEditedValveId(null);
        setEditedValveData({});
        fetchValveData(projectId);
        setModalMessage("Valve updated successfully");
        setCustomAlert(true);
      }
    } catch (error) {
      console.error("Error saving valve:", error);
      setModalMessage("Failed to save valve data.");
      setCustomAlert(true);
    }
  };

  const handleChange = (field, value) => {
    setEditedValveData({
      ...editedValveData,
      [field]: value,
    });
  };

  // Updated to handle both single and multiple deletes
  const handleConfirm = async () => {
    try {
      const valveIds = Array.isArray(currentDeleteNumber)
        ? currentDeleteNumber
        : [currentDeleteNumber];

      for (const id of valveIds) {
        const response = await deletevalveList(projectId, id);
        if (response.status !== 200) {
          throw new Error(`Failed to delete valve ${id}`);
        }
      }

      setModalMessage(
        valveIds.length > 1
          ? "Valves deleted successfully"
          : "Valve deleted successfully"
      );
      setCustomAlert(true);
      fetchValveData(projectId);
    } catch (error) {
      console.error("Error deleting valves:", error);
      setModalMessage("Error deleting valve(s)");
      setCustomAlert(true);
    }

    setShowConfirm(false);
    setCurrentDeleteNumber(null);
    setSelectedValveIds([]); // Clear selection
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  // New functions for checkbox handling
  const handleSelectAllCheckbox = (e) => {
    if (e.target.checked) {
      setSelectedValveIds(filteredValveList.map((valve) => valve.tagId));
    } else {
      setSelectedValveIds([]);
    }
  };

  const handleValveCheckboxChange = (tagId, isChecked) => {
    if (isChecked) {
      setSelectedValveIds((prev) => [...prev, tagId]);
    } else {
      setSelectedValveIds((prev) => prev.filter((id) => id !== tagId));
    }
  };

  const handleImportTag = () => {
    setImportTag(true);
  };

  const handleClose = () => {
    setImportTag(false);
  };

  const handleImportClick = () => {
    if (selectedFile) {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const formattedData = jsonData.map(item => ({
          area: item["area"] || "",
          discipline: item["discipline"] || "",
          system: item["system"] || "",
          function_code: item["function_code"] || "",
          sequence_number: item["sequence_number"] || "",
          tag_number: item["tag_number"] || "",
          line_id: item["line_id"] || "",
          line_number: item["line_number"] || "",
          pid: item["pid"] || "",
          isometric: item["isometric"] || "",
          data_sheet: item["data_sheet"] || "",
          drawings: item["drawings"] || "",
          design_pressure: item["design_pressure"] || "",
          design_temperature: item["design_temperature"] || "",
          size: item["size"] || "",
          paint_system: item["paint_system"] || "",
          purchase_order: item["purchase_order"] || "",
          supplier: item["supplier"] || "",
          information_status: item["information_status"] || "",
          equipment_status: item["equipment_status"] || "",
          comment: item["comment"] || ""
        }));

        const response = await saveimportedValveList(formattedData);
        if (response.status === 200) {
          setImportTag(false);
          setSelectedFile(null);
          fetchValveData(projectId);
          setModalMessage("File imported successfully");
          setCustomAlert(true);
        }
      };

      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleExcelFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "area",
      "discipline",
      "system",
      "function_code",
      "sequence_number",
      "tag_number",
      "line_id",
      "line_number",
      "pid",
      "isometric",
      "data_sheet",
      "drawings",
      "design_pressure",
      "design_temperature",
      "size",
      "paint_system",
      "purchase_order",
      "supplier",
      "information_status",
      "equipment_status",
      "comment"
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ValveListTemplate");
    XLSX.writeFile(workbook, "ValveListTemplate.xlsx");
  };

  const handleExport = () => {
    const headers = [
      "area",
      "discipline",
      "system",
      "function_code",
      "sequence_number",
      "tag_number",
      "line_id",
      "line_number",
      "pid",
      "isometric",
      "data_sheet",
      "drawings",
      "design_pressure",
      "design_temperature",
      "size",
      "paint_system",
      "purchase_order",
      "supplier",
      "information_status",
      "equipment_status",
      "comment"
    ];

    const dataToExport = allValveList?.map((item) => {
      const row = {};
      headers.forEach((header) => {
        row[header] = item[header] || "";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Valve List");
    XLSX.writeFile(wb, "valve_list.xlsx");
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredValveList = allValveList?.filter((valve) =>
    valve.tag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <form>
        <div className="table-container">
          <table className="linetable">
            <thead>
              <tr>
                <th>#</th>
                <th className="mediumHead">
                  <input
                    type="checkbox"
                    onChange={handleSelectAllCheckbox}
                    checked={
                      filteredValveList.length > 0 &&
                      filteredValveList.every((valve) =>
                        selectedValveIds.includes(valve.tagId)
                      )
                    }
                  />
                </th>
                <th className="wideHead">Tag</th>
                <th className="wideHead">Area</th>
                <th className="wideHead">Discipline</th>
                <th className="wideHead">System</th>
                <th>Function Code</th>
                <th>Sequence Number</th>
                <th>Tag Number</th>
                <th>Line ID</th>
                <th>Line Number</th>
                <th>PID</th>
                <th>Isometric</th>
                <th>Data Sheet</th>
                <th>Drawings</th>
                <th>Design Pressure</th>
                <th>Design Temperature</th>
                <th>Size</th>
                <th>Paint System</th>
                <th>Purchase Order</th>
                <th>Supplier</th>
                <th>Information Status</th>
                <th>Equipment Status</th>
                <th>Comment</th>
                <th className="tableActionCell">
                  <FontAwesomeIcon
                    icon={faDownload}
                    title="Export"
                    onClick={handleExport}
                    style={{ cursor: "pointer" }}
                  />
                  <FontAwesomeIcon
                    icon={faUpload}
                    title="Import"
                    onClick={handleImportTag}
                    style={{ cursor: "pointer", marginLeft: "10px" }}
                  />
                  <FontAwesomeIcon
                    icon={faTrash}
                    title="Delete Selected"
                    onClick={handleMultipleDelete}
                    style={{ cursor: "pointer", marginLeft: "10px" }}
                  />
                </th>
              </tr>
              <tr>
                <th colSpan="25">
                  <input
                    type="text"
                    placeholder="Search by Tag "
                    value={searchQuery}
                    onChange={handleSearch}
                    style={{ width: "100%", padding: "5px" }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredValveList?.map((valve, index) => (
                <tr key={valve.tagId || index} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedValveIds.includes(valve.tagId)}
                      onChange={(e) =>
                        handleValveCheckboxChange(valve.tagId, e.target.checked)
                      }
                    />
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{valve.tag}</td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("area", e.target.value)}
                        type="text"
                        value={editedValveData.area || ""}
                      />
                    ) : (
                      valve.area
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("discipline", e.target.value)}
                        type="text"
                        value={editedValveData.discipline || ""}
                      />
                    ) : (
                      valve.discipline
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("system", e.target.value)}
                        type="text"
                        value={editedValveData.Systm || ""}
                      />
                    ) : (
                      valve.Systm
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("function_code", e.target.value)}
                        type="text"
                        value={editedValveData.function_code || ""}
                      />
                    ) : (
                      valve.function_code
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("sequence_number", e.target.value)}
                        type="text"
                        value={editedValveData.sequence_number || ""}
                      />
                    ) : (
                      valve.sequence_number
                    )}
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{valve.tag_number}</td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("line_id", e.target.value)}
                        type="text"
                        value={editedValveData.line_id || ""}
                      />
                    ) : (
                      valve.line_id
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("line_number", e.target.value)}
                        type="text"
                        value={editedValveData.line_number || ""}
                      />
                    ) : (
                      valve.line_number
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("pid", e.target.value)}
                        type="text"
                        value={editedValveData.pid || ""}
                      />
                    ) : (
                      valve.pid
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("isometric", e.target.value)}
                        type="text"
                        value={editedValveData.isometric || ""}
                      />
                    ) : (
                      valve.isometric
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("data_sheet", e.target.value)}
                        type="text"
                        value={editedValveData.data_sheet || ""}
                      />
                    ) : (
                      valve.data_sheet
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("drawings", e.target.value)}
                        type="text"
                        value={editedValveData.drawings || ""}
                      />
                    ) : (
                      valve.drawings
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("design_pressure", e.target.value)}
                        type="text"
                        value={editedValveData.design_pressure || ""}
                      />
                    ) : (
                      valve.design_pressure
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("design_temperature", e.target.value)}
                        type="text"
                        value={editedValveData.design_temperature || ""}
                      />
                    ) : (
                      valve.design_temperature
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("size", e.target.value)}
                        type="text"
                        value={editedValveData.size || ""}
                      />
                    ) : (
                      valve.size
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("paint_system", e.target.value)}
                        type="text"
                        value={editedValveData.paint_system || ""}
                      />
                    ) : (
                      valve.paint_system
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("purchase_order", e.target.value)}
                        type="text"
                        value={editedValveData.purchase_order || ""}
                      />
                    ) : (
                      valve.purchase_order
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("supplier", e.target.value)}
                        type="text"
                        value={editedValveData.supplier || ""}
                      />
                    ) : (
                      valve.supplier
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("information_status", e.target.value)}
                        type="text"
                        value={editedValveData.information_status || ""}
                      />
                    ) : (
                      valve.information_status
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("equipment_status", e.target.value)}
                        type="text"
                        value={editedValveData.equipment_status || ""}
                      />
                    ) : (
                      valve.equipment_status
                    )}
                  </td>
                  <td>
                    {editedValveId === valve.tagId ? (
                      <input
                        onChange={(e) => handleChange("comment", e.target.value)}
                        type="text"
                        value={editedValveData.comment || ""}
                      />
                    ) : (
                      valve.comment
                    )}
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedValveId === valve.tagId ? (
                      <>
                        <FontAwesomeIcon
                          icon={faSave}
                          className="text-success"
                          onClick={() => handleSave(valve.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <FontAwesomeIcon
                          icon={faTimes}
                          className="text-danger ms-3"
                          onClick={handleCloseEdit}
                          style={{ cursor: "pointer" }}
                        />
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faEdit}
                          onClick={() => handleEditOpen(valve)}
                          style={{ cursor: "pointer" }}
                        />
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="ms-3"
                          onClick={() => handleDeleteValveFromTable(valve.tagId)}
                          style={{ cursor: "pointer" }}
                        />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
             {
              loaded?'':<button className="btn" style={{cursor:'pointer',backgroundColor:'#5B66CB',color:'white',width:'100px'}} onClick={() => setLoaded(true)}>Load data</button>
            }
          </table>
        </div>
      </form>

      {importTag && (
        <Modal
          onHide={handleClose}
          show={importTag}
          backdrop="static"
          keyboard={false}
          dialogClassName="custom-modal"
        >
          <div className="tag-dialog">
            <div className="title-dialog">
              <p className="text-light">Import list</p>
              <p className="text-light cross" onClick={handleClose}>
                &times;
              </p>
            </div>
            <div className="dialog-input">
              <label>File</label>
              <input type="file" onChange={handleExcelFileChange} />
              <a
                onClick={handleDownloadTemplate}
                style={{ cursor: "pointer", color: " #00BFFF" }}
              >
                Download template
              </a>
            </div>
            <div
              className="dialog-button"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                bottom: 0,
              }}
            >
              <button className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn btn-dark" onClick={handleImportClick}>
                Upload
              </button>
            </div>
          </div>
        </Modal>
      )}

      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default ValveList;