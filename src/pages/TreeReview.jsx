import React, { useContext, useEffect, useState } from "react";
import {
  getArea,
  getDisipline,
  getSystem,
  updateArea,
  updateDiscipline,
  updateSystem,
  deleteArea,
  deleteDiscipline,
  deleteSystem,
  deleteAllAreas,
  deleteAllDisciplines,
  deleteAllSystems,
  RegisterArea,
  RegisterDisipline,
  RegisterSystem,
} from "../services/TreeManagementApi";
import "../styles/TreeReview.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";
import { faEdit, faSave } from "@fortawesome/free-regular-svg-icons";
import {
  TreeresponseContext,
  updateProjectContext,
} from "../context/ContextShare";
import DeleteConfirm from "../components/DeleteConfirm";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import * as XLSX from "xlsx";
import { canAccess } from "../Utils/accessControl";


function TreeReview() {
  const { updateTree, setUpdatetree } = useContext(TreeresponseContext);
  const { updateProject } = useContext(updateProjectContext);

  const [areaData, setAreaData] = useState([]);
  const [discData, setDiscData] = useState([]);
  const [sysData, setSysData] = useState([]);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const [currentDeleteTag, setCurrentDeleteTag] = useState("");
  const [currentDeleteType, setCurrentDeleteType] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [editedAreaRowIndex, setEditedAreaRowIndex] = useState(-1);
  const [editedDiscRowIndex, setEditedDiscRowIndex] = useState(-1);
  const [editedSysRowIndex, setEditedSysRowIndex] = useState(-1);
  const [editedLineData, setEditedLineData] = useState({});
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // Import related states
  const [importArea, setImportArea] = useState(false);
  const [importDisc, setImportDisc] = useState(false);
  const [importSys, setImportSys] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [currentImportType, setCurrentImportType] = useState("");

  const handleDeleteTagFromTable = (number, type) => {
    setCurrentDeleteTag(number);
    setCurrentDeleteType(type);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (currentDeleteType === "area") {
        await deleteArea(currentDeleteTag);
      } else if (currentDeleteType === "disc") {
        await deleteDiscipline(currentDeleteTag);
      } else if (currentDeleteType === "sys") {
        await deleteSystem(currentDeleteTag);
      } else if (currentDeleteType === "all-area") {
        await deleteAllAreas();
      } else if (currentDeleteType === "all-discipline") {
        await deleteAllDisciplines();
      } else if (currentDeleteType === "all-system") {
        await deleteAllSystems();
      }
      setUpdatetree(Date.now());
      fetchData();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setShowConfirm(false);
      setCurrentDeleteTag("");
      setCurrentDeleteType("");
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteTag("");
    setCurrentDeleteType("");
  };

  const handleEditOpen = (index, type) => {
    setEditedLineData({});
    if (type === "area") {
      setEditedAreaRowIndex(index);
      setEditedDiscRowIndex(-1);
      setEditedSysRowIndex(-1);
      setEditedLineData({ ...areaData[index], oldArea: areaData[index].area });
    } else if (type === "disc") {
      setEditedDiscRowIndex(index);
      setEditedAreaRowIndex(-1);
      setEditedSysRowIndex(-1);
      setEditedLineData({ ...discData[index], oldDisc: discData[index].disc });
    } else if (type === "sys") {
      setEditedSysRowIndex(index);
      setEditedAreaRowIndex(-1);
      setEditedDiscRowIndex(-1);
      setEditedLineData({ ...sysData[index], oldSys: sysData[index].sys });
    }
  };

  const handleCloseEdit = () => {
    setEditedAreaRowIndex(-1);
    setEditedDiscRowIndex(-1);
    setEditedSysRowIndex(-1);
    setEditedLineData({});
  };

  const fetchData = async () => {
    try {
      const [areaRes, discRes, sysRes] = await Promise.all([
        getArea(projectId),
        getDisipline(projectId),
        getSystem(projectId),
      ]);
      setAreaData(areaRes.data.area || []);
      setDiscData(discRes.data.disipline || []);
      setSysData(sysRes.data.system || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId, updateTree, updateProject]);

  const handleChange = (field, value) => {
    setEditedLineData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (type) => {
    try {
      let response;
      switch (type) {
        case "area":
          response = await updateArea(editedLineData);
          break;
        case "discipline":
          response = await updateDiscipline(editedLineData);
          break;
        case "system":
          response = await updateSystem(editedLineData);
          break;
        default:
          return;
      }
      handleCloseEdit();
      setUpdatetree(Date.now());
      fetchData();
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  // Import functions
  const handleImportTag = (type) => {
    setCurrentImportType(type);
    setExcelData([]);
    setImportResults(null);
    setSelectedFile(null);

    if (type === "area") {
      setImportArea(true);
    } else if (type === "disc") {
      setImportDisc(true);
    } else if (type === "sys") {
      setImportSys(true);
    }
  };

  const handleCloseImport = () => {
    setImportArea(false);
    setImportDisc(false);
    setImportSys(false);
    setExcelData([]);
    setImportResults(null);
    setSelectedFile(null);
    setCurrentImportType("");
    setIsProcessing(false);
  };

  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);

    if (!file) {
      setExcelData([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate and format data
        const formattedData = jsonData.map((row, index) => ({
          rowNumber: index + 2, // Excel row number (starting from 2, assuming header in row 1)
          code: (row.Code || row.code || "").toString().trim(),
          name: (row.Name || row.name || "").toString().trim(),
          isValid: !!(row.Code || row.code),
        }));

        setExcelData(formattedData);
        setCustomAlert(false);
      } catch (error) {
        setCustomAlert(true);
        setModalMessage("Error reading Excel file. Please check the format.");
        setExcelData([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    let templateData, filename;

    if (currentImportType === "area") {
      templateData = [
        { Code: "AREA001", Name: "Sample Area 1" },
        { Code: "AREA002", Name: "Sample Area 2" },
      ];
      filename = "area_import_template.xlsx";
    } else if (currentImportType === "disc") {
      templateData = [
        { Code: "DISC001", Name: "Sample Discipline 1" },
        { Code: "DISC002", Name: "Sample Discipline 2" },
      ];
      filename = "discipline_import_template.xlsx";
    } else if (currentImportType === "sys") {
      templateData = [
        { Code: "SYS001", Name: "Sample System 1" },
        { Code: "SYS002", Name: "Sample System 2" },
      ];
      filename = "system_import_template.xlsx";
    }

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, filename);
  };

  const handleImportClick = async () => {
    const validData = excelData.filter((row) => row.isValid);
    if (validData.length === 0) {
      setCustomAlert(true);
      setModalMessage("No valid data to import");
      return;
    }

    setIsProcessing(true);
    const results = {
      success: [],
      failures: [],
      total: validData.length,
    };

    for (const row of validData) {
      try {
        const data = {
          code: row.code,
          name: row.name,
          projectId,
        };

        let response;

        // Call appropriate API based on current import type
        if (currentImportType === "area") {
          response = await RegisterArea(data);
        } else if (currentImportType === "disc") {
          response = await RegisterDisipline(data);
        } else if (currentImportType === "sys") {
          response = await RegisterSystem(data);
        }

        if (response && response.status === 200) {
          results.success.push({
            ...row,
            message: "Successfully imported",
          });
        } else {
          results.failures.push({
            ...row,
            message: "Failed to import",
          });
        }
      } catch (error) {
        console.error("Import error for row:", row, error);
        results.failures.push({
          ...row,
          message:
            error.status === 406 || error.status === 409
              ? `${currentImportType} already exists`
              : "Import failed",
        });
      }
    }
    setImportArea(false);
    setImportDisc(false);

    setImportSys(false);

    if (results.success.length > 0) {
      setUpdatetree(Date.now());
      fetchData(); // Refresh the table data
    }
  };

  // Export functions
  const handleExportData = (type) => {
    let data, filename;

    if (type === "area") {
      data = areaData.map((item) => ({ Code: item.area, Name: item.name }));
      filename = "areas_export.xlsx";
    } else if (type === "disc") {
      data = discData.map((item) => ({ Code: item.disc, Name: item.name }));
      filename = "disciplines_export.xlsx";
    } else if (type === "sys") {
      data = sysData.map((item) => ({ Code: item.sys, Name: item.name }));
      filename = "systems_export.xlsx";
    }

    if (data.length === 0) {
      setCustomAlert(true);
      setModalMessage(`No ${type} data to export`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, filename);
  };

  const getImportModalTitle = () => {
    if (currentImportType === "area") return "Import Areas";
    if (currentImportType === "disc") return "Import Disciplines";
    if (currentImportType === "sys") return "Import Systems";
    return "Import";
  };

  const isImportModalOpen = importArea || importDisc || importSys;

   const canView = canAccess(projectId, "tree_management", "VIEWER");
  const canEdit = canAccess(projectId, "tree_management", "EDITOR");

  if (!canView) {
    return <div className="alert alert-danger">Access Denied</div>;
  }


  return (
    <div>
      <form>
        <div className="table-container">
          <h4 className="text-center">Area table</h4>
          <table className="tagTable">
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="mediumHead">
                   {canEdit && (
                  <>
                  <i
                    className="fa-solid fa-trash-can ms-1"
                    title="Delete all"
                    onClick={() => handleDeleteTagFromTable(0, "all-area")}
                  ></i>
                  <i
                    className="fa-solid fa-upload ms-1"
                    title="Import"
                    onClick={() => handleImportTag("area")}
                    style={{ cursor: "pointer" }}
                  ></i>
                      </>
                )}
                  <i
                    className="fa-solid fa-download ms-1"
                    title="Export"
                    onClick={() => handleExportData("area")}
                    style={{ cursor: "pointer" }}
                  ></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {areaData.map((tag, index) => (
                <tr key={tag.AreaId} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedAreaRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("area", e.target.value)}
                        type="text"
                        value={editedLineData.area || ""}
                      />
                    ) : (
                      tag.area
                    )}
                  </td>
                 
                  <td className="text-center">
                    {editedAreaRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("name", e.target.value)}
                        type="text"
                        value={editedLineData.name || ""}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                      {canEdit && (
                  <>
                    {editedAreaRowIndex === index ? (
                      <>
                        <i
                          className="fa-solid fa-floppy-disk text-success"
                          onClick={() => handleSave("area")}
                        ></i>
                        <i
                          className="fa-solid fa-xmark ms-3 text-danger"
                          onClick={handleCloseEdit}
                        ></i>
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-pencil"
                          onClick={() => handleEditOpen(index, "area")}
                        ></i>
                        <i
                          className="fa-solid fa-trash-can ms-3"
                          onClick={() =>
                            handleDeleteTagFromTable(tag.AreaId, "area")
                          }
                        ></i>
                      </>
                    )}
                              </>
                )}
                  </td>
            
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="text-center">Discipline table</h4>
          <table className="tagTable">
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="mediumHead">
                   {canEdit && (
                  <>
                  <i
                    className="fa-solid fa-trash-can ms-1"
                    title="Delete all"
                    onClick={() =>
                      handleDeleteTagFromTable(0, "all-discipline")
                    }
                  ></i>
                  <i
                    className="fa-solid fa-upload ms-1"
                    title="Import"
                    onClick={() => handleImportTag("disc")}
                    style={{ cursor: "pointer" }}
                  ></i>
                      </>
                )}
                  <i
                    className="fa-solid fa-download ms-1"
                    title="Export"
                    onClick={() => handleExportData("disc")}
                    style={{ cursor: "pointer" }}
                  ></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {discData.map((tag, index) => (
                <tr key={tag.discId} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedDiscRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("disc", e.target.value)}
                        type="text"
                        value={editedLineData.disc || ""}
                      />
                    ) : (
                      tag.disc
                    )}
                  </td>
                  <td>
                    {editedDiscRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("name", e.target.value)}
                        type="text"
                        value={editedLineData.name || ""}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                       {canEdit && (
                  <>
                    {editedDiscRowIndex === index ? (
                      <>
                        <i
                          className="fa-solid fa-floppy-disk text-success"
                          onClick={() => handleSave("discipline")}
                        ></i>
                        <i
                          className="fa-solid fa-xmark ms-3 text-danger"
                          onClick={handleCloseEdit}
                        ></i>
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-pencil"
                          onClick={() => handleEditOpen(index, "disc")}
                        ></i>
                        <i
                          className="fa-solid fa-trash-can ms-1"
                          onClick={() =>
                            handleDeleteTagFromTable(tag.discId, "disc")
                          }
                        ></i>
                      </>
                    )}
                              </>
                )}
                  </td>
            
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="text-center">System table</h4>
          <table className="tagTable">
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="mediumHead">
                   {canEdit && (
                  <>
                  <i
                    className="fa-solid fa-trash-can ms-3"
                    title="Delete all"
                    onClick={() => handleDeleteTagFromTable(0, "all-system")}
                  ></i>
                  <i
                    className="fa-solid fa-upload ms-1"
                    title="Import"
                    onClick={() => handleImportTag("sys")}
                    style={{ cursor: "pointer" }}
                  ></i>
                      </>
                )}
                  <i
                    className="fa-solid fa-download ms-1"
                    title="Export"
                    onClick={() => handleExportData("sys")}
                    style={{ cursor: "pointer" }}
                  ></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {sysData.map((tag, index) => (
                <tr key={tag.sysId} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedSysRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("sys", e.target.value)}
                        type="text"
                        value={editedLineData.sys || ""}
                      />
                    ) : (
                      tag.sys
                    )}
                  </td>
                  <td>
                    {editedSysRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("name", e.target.value)}
                        type="text"
                        value={editedLineData.name || ""}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                 
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                      {canEdit && (
                                    <>
                    {editedSysRowIndex === index ? (
                      <>
                        <i
                          className="fa-solid fa-floppy-disk text-success"
                          onClick={() => handleSave("system")}
                        ></i>
                        <i
                          className="fa-solid fa-xmark ms-3 text-danger"
                          onClick={handleCloseEdit}
                        ></i>
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-pencil"
                          onClick={() => handleEditOpen(index, "sys")}
                        ></i>
                        <i
                          className="fa-solid fa-trash-can ms-3"
                          onClick={() =>
                            handleDeleteTagFromTable(tag.sysId, "sys")
                          }
                        ></i>
                      </>
                    )}
                           </>
                )}
                  </td>
               
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      {/* Import Modal */}
      {isImportModalOpen && (
        <Modal
          onHide={handleCloseImport}
          show={isImportModalOpen}
          backdrop="static"
          keyboard={false}
          dialogClassName="custom-modal"
          size="lg"
        >
          <div className="tag-dialog">
            <div className="title-dialog">
              <p className="text-light">{getImportModalTitle()}</p>
              <p className="text-light cross" onClick={handleCloseImport}>
                &times;
              </p>
            </div>
            <div className="dialog-input">
              <label>Select Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="form-control mb-3"
              />
              <a
                onClick={handleDownloadTemplate}
                style={{ cursor: "pointer", color: "#00BFFF" }}
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
              <button className="btn btn-secondary" onClick={handleCloseImport}>
                Cancel
              </button>
              <button
                className="btn btn-dark"
                onClick={handleImportClick}
                disabled={excelData.length === 0 || isProcessing}
              >
              Import
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showConfirm && (
        <DeleteConfirm
          message="Are you sure you want to delete this tag?"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {customAlert && (
        <Alert message={modalMessage} onClose={() => setCustomAlert(false)} />
      )}
    </div>
  );
}

export default TreeReview;
