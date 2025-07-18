import React, { useEffect, useState } from "react";
import DeleteConfirm from "../components/DeleteConfirm";
import * as XLSX from "xlsx";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import {
  deleteequipmentList,
  EditEquipmentlist,
  getequipmentList,
  saveimportedEquipmentList,
} from "../services/TagApi";

function EquipmentList() {
  const [editedEquipmentId, setEditedEquipmentId] = useState(null); // Changed from editedRowIndex
  const [editedEquipmentData, seteditedEquipmentData] = useState({});
  const [currentDeleteEqup, setCurrentDeleteEqup] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [importTag, setImportTag] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [allEquipementList, setallEquipementList] = useState([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]); // New state for multiple selection
  const [loaded, setLoaded] = useState(false);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchEquipmentlist = async (projectId) => {
    const response = await getequipmentList(projectId);
    if (response.status === 200) {
      setallEquipementList(response.data);
    }
  };
  useEffect(() => {
    if (loaded) fetchEquipmentlist(projectId);
  }, [loaded]);

  const handleDeleteEquipmentFromTable = (number) => {
    setCurrentDeleteEqup(number);
    setShowConfirm(true);
  };

  // New function for multiple delete
  const handleMultipleDelete = () => {
    if (selectedEquipmentIds.length === 0) {
      setModalMessage("No equipment selected for deletion");
      setCustomAlert(true);
      return;
    }
    setCurrentDeleteEqup([...selectedEquipmentIds]);
    setShowConfirm(true);
  };

  // Updated to handle both single and multiple deletes
  const handleConfirmDelete = async () => {
    try {
      const equipmentIds = Array.isArray(currentDeleteEqup)
        ? currentDeleteEqup
        : [currentDeleteEqup];

      for (const id of equipmentIds) {
        const response = await deleteequipmentList(projectId, id);
        if (response.status !== 200) {
          throw new Error(`Failed to delete equipment ${id}`);
        }
      }

      setModalMessage(
        equipmentIds.length > 1
          ? "Equipment items deleted successfully"
          : "Equipment deleted successfully"
      );
      setCustomAlert(true);
      fetchEquipmentlist(projectId);
    } catch (error) {
      console.error("Error deleting equipment:", error);
      setModalMessage("Error deleting equipment");
      setCustomAlert(true);
    }

    setShowConfirm(false);
    setCurrentDeleteEqup(null);
    setSelectedEquipmentIds([]); // Clear selection
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteEqup(null);
  };

  // Modified to use equipment object instead of index
  const handleEditOpen = (equipment) => {
    setEditedEquipmentId(equipment.tagId);
    seteditedEquipmentData(equipment);
  };

  const handleCloseEdit = () => {
    setEditedEquipmentId(null);
    seteditedEquipmentData({});
  };

  // Updated save function
  const handleSave = async (tag) => {
    try {
      const response = await EditEquipmentlist(editedEquipmentData);
      if (response.status === 200) {
        setEditedEquipmentId(null);
        seteditedEquipmentData({});
        fetchEquipmentlist(projectId);
        setModalMessage("Equipment updated successfully");
        setCustomAlert(true);
      }
    } catch (error) {
      console.error("Error saving equipment:", error);
      setModalMessage("Failed to save equipment data.");
      setCustomAlert(true);
    }
  };

  const handleChange = (field, value) => {
    seteditedEquipmentData({
      ...editedEquipmentData,
      [field]: value,
    });
  };

  // New functions for checkbox handling
  const handleSelectAllCheckbox = (e) => {
    if (e.target.checked) {
      setSelectedEquipmentIds(
        filteredEquipmentList.map((equipment) => equipment.tagId)
      );
    } else {
      setSelectedEquipmentIds([]);
    }
  };

  const handleEquipmentCheckboxChange = (tagId, isChecked) => {
    if (isChecked) {
      setSelectedEquipmentIds((prev) => [...prev, tagId]);
    } else {
      setSelectedEquipmentIds((prev) => prev.filter((id) => id !== tagId));
    }
  };

  const handleImportTag = () => {
    setImportTag(true);
  };

  const handleClose = () => {
    setImportTag(false);
  };

  const handleExcelFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleImportClick = async () => {
    if (!selectedFile) {
      setModalMessage("Please select a file to import.");
      setCustomAlert(true);
      return;
    }

    setImportTag(false); // Close modal immediately to show loading state
    setModalMessage("Importing equipment data, please wait...");
    setCustomAlert(true);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          setModalMessage("No data found in the Excel file");
          setCustomAlert(true);
          return;
        }

        const headers = [
          "tag",
          "descr",
          "qty",
          "capacity",
          "type",
          "materials",
          "capacityDuty",
          "dims",
          "dsgnPress",
          "opPress",
          "dsgnTemp",
          "opTemp",
          "dryWeight",
          "opWeight",
          "supplier",
          "remarks",
          "initStatus",
          "revision",
          "revisionDate",
        ];

        const formattedData = jsonData.map((item) => {
          const formattedItem = { projectId: projectId }; // Add projectId to each item
          headers.forEach((header) => {
            formattedItem[header] = item[header] || "";
          });
          return formattedItem;
        });
        console.log(formattedData);

        const response = await saveimportedEquipmentList(formattedData);
        console.log(response);

        if (response.status === 200) {
          setImportTag(false);
          setModalMessage("Equipment added..");
          setCustomAlert(true);
          setSelectedFile(null);
          fetchEquipmentlist(projectId);
        } else {
          throw new Error(response.data.error || "Import failed");
        }
      } catch (error) {
        console.error("Equipment import error:", error);
        setModalMessage(`Import failed: ${error.message || "Unknown error"}`);
        setCustomAlert(true);
      }
    };

    reader.onerror = () => {
      setModalMessage("Error reading file. Please try again.");
      setCustomAlert(true);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleExport = () => {
    const headers = [
      "tag",
      "descr",
      "qty",
      "capacity",
      "type",
      "materials",
      "capacityDuty",
      "dims",
      "dsgnPress",
      "opPress",
      "dsgnTemp",
      "opTemp",
      "dryWeight",
      "opWeight",
      "supplier",
      "remarks",
      "initStatus",
      "revision",
      "revisionDate",
    ];

    const dataToExport =
      allEquipementList.length > 0
        ? allEquipementList.map((row) => {
            const formattedRow = {};
            headers.forEach((header) => {
              formattedRow[header] = row[header] || "";
            });
            return formattedRow;
          })
        : [];

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipment List");
    XLSX.writeFile(wb, "EquipmentList.xlsx");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "tag",
      "descr",
      "qty",
      "capacity",
      "type",
      "materials",
      "capacityDuty",
      "dims",
      "dsgnPress",
      "opPress",
      "dsgnTemp",
      "opTemp",
      "dryWeight",
      "opWeight",
      "supplier",
      "remarks",
      "initStatus",
      "revision",
      "revisionDate",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Equipment Template");
    XLSX.writeFile(workbook, "EquipmentTemplate.xlsx");
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredEquipmentList = allEquipementList.filter((equipment) =>
    equipment.tag.toLowerCase().includes(searchQuery.toLowerCase())
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
          <table className="eqptable">
            <thead>
              <tr>
                <th>#</th>
                <th className="mediumHead">
                  <input
                    type="checkbox"
                    onChange={handleSelectAllCheckbox}
                    checked={
                      filteredEquipmentList.length > 0 &&
                      filteredEquipmentList.every((equipment) =>
                        selectedEquipmentIds.includes(equipment.tagId)
                      )
                    }
                  />
                </th>
                <th className="wideHead">Tag</th>
                <th className="extraWideHead">Description</th>
                <th>Quantity</th>
                <th>Capacity (%)</th>
                <th>Equipment type</th>
                <th>Materials</th>
                <th>Capacity/duty</th>
                <th>Dimensions - ID x TT or L x W x H (mm)</th>
                <th>Design pressure</th>
                <th>Operating pressure</th>
                <th>Design temperature</th>
                <th>Operating temperature</th>
                <th>Dry weight</th>
                <th>Operating weight</th>
                <th>Supplier</th>
                <th className="extraWideHead">Remarks</th>
                <th className="wideHead">Initial status</th>
                <th>Revision</th>
                <th>Revision date</th>
                <th>
                  <i
                    className="fa-solid fa-upload"
                    title="Export"
                    onClick={handleExport}
                    style={{ cursor: "pointer" }}
                  ></i>
                  <i
                    className="fa-solid fa-download ms-2"
                    title="Import"
                    onClick={handleImportTag}
                    style={{ cursor: "pointer" }}
                  ></i>
                  <i
                    className="fa-solid fa-trash ms-2"
                    title="Delete Selected"
                    onClick={handleMultipleDelete}
                    style={{ cursor: "pointer" }}
                  ></i>
                </th>
              </tr>
              <tr>
                <th colSpan={22}>
                  <input
                    type="text"
                    placeholder="Search by Tag"
                    value={searchQuery}
                    onChange={handleSearch}
                    style={{ width: "100%", padding: "5px" }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipmentList.map((equipment, index) => (
                <tr key={equipment.tagId || index} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedEquipmentIds.includes(equipment.tagId)}
                      onChange={(e) =>
                        handleEquipmentCheckboxChange(
                          equipment.tagId,
                          e.target.checked
                        )
                      }
                    />
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {equipment.tag}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) => handleChange("descr", e.target.value)}
                        type="text"
                        value={editedEquipmentData.descr || ""}
                      />
                    ) : (
                      equipment.descr
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) => handleChange("qty", e.target.value)}
                        type="text"
                        value={editedEquipmentData.qty || ""}
                      />
                    ) : (
                      equipment.qty
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("capacity", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.capacity || ""}
                      />
                    ) : (
                      equipment.capacity
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) => handleChange("type", e.target.value)}
                        type="text"
                        value={editedEquipmentData.type || ""}
                      />
                    ) : (
                      equipment.type
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("materials", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.materials || ""}
                      />
                    ) : (
                      equipment.materials
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("capacityDuty", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.capacityDuty || ""}
                      />
                    ) : (
                      equipment.capacityDuty
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) => handleChange("dims", e.target.value)}
                        type="text"
                        value={editedEquipmentData.dims || ""}
                      />
                    ) : (
                      equipment.dims
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("dsgnPress", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.dsgnPress || ""}
                      />
                    ) : (
                      equipment.dsgnPress
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("opPress", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.opPress || ""}
                      />
                    ) : (
                      equipment.opPress
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("dsgnTemp", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.dsgnTemp || ""}
                      />
                    ) : (
                      equipment.dsgnTemp
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) => handleChange("opTemp", e.target.value)}
                        type="text"
                        value={editedEquipmentData.opTemp || ""}
                      />
                    ) : (
                      equipment.opTemp
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("dryWeight", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.dryWeight || ""}
                      />
                    ) : (
                      equipment.dryWeight
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("opWeight", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.opWeight || ""}
                      />
                    ) : (
                      equipment.opWeight
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("supplier", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.supplier || ""}
                      />
                    ) : (
                      equipment.supplier
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("remarks", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.remarks || ""}
                      />
                    ) : (
                      equipment.remarks
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("initStatus", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.initStatus || ""}
                      />
                    ) : (
                      equipment.initStatus
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("revision", e.target.value)
                        }
                        type="text"
                        value={editedEquipmentData.revision || ""}
                      />
                    ) : (
                      equipment.revision
                    )}
                  </td>
                  <td>
                    {editedEquipmentId === equipment.tagId ? (
                      <input
                        onChange={(e) =>
                          handleChange("revisionDate", e.target.value)
                        }
                        type="date"
                        value={editedEquipmentData.revisionDate || ""}
                      />
                    ) : (
                      equipment.revisionDate
                    )}
                  </td>
                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedEquipmentId === equipment.tagId ? (
                      <>
                        <i
                          className="fa-solid fa-floppy-disk text-success"
                          onClick={() => handleSave(equipment.tag)}
                          style={{ cursor: "pointer" }}
                        ></i>
                        <i
                          className="fa-solid fa-xmark ms-3 text-danger"
                          onClick={handleCloseEdit}
                          style={{ cursor: "pointer" }}
                        ></i>
                      </>
                    ) : (
                      <>
                        <i
                          className="fa-solid fa-pencil"
                          onClick={() => handleEditOpen(equipment)}
                          style={{ cursor: "pointer" }}
                        ></i>
                        <i
                          className="fa-solid fa-trash-can ms-3"
                          onClick={() =>
                            handleDeleteEquipmentFromTable(equipment.tagId)
                          }
                          style={{ cursor: "pointer" }}
                        ></i>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {loaded ? (
              ""
            ) : (
              <button
                className="btn"
                style={{
                  cursor: "pointer",
                  backgroundColor: "#5B66CB",
                  color: "white",
                  width: "100px",
                }}
                onClick={() => setLoaded(true)}
              >
                Load data
              </button>
            )}
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
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}

export default EquipmentList;
