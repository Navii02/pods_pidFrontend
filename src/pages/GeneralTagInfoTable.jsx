import React, { useState, useEffect, useContext } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import DeleteConfirm from "../components/DeleteConfirm";
import {
  DeleteGeneralTagInfolist,
  EditGeneralTagInfolist,
  fetchAllGentagInfo,
  fetchFromGentagInfoFields,
  UpdateGentagInfoFields,
} from "../services/TagApi";
import { updateProjectContext } from "../context/ContextShare";
import Alert from '../components/Alert';
import { canAccess } from "../Utils/accessControl";


function GeneralTagInfoTable({}) {
  const [editedTagId, setEditedTagId] = useState(null); // Changed from editedRowIndex
  const [editedTagData, setEditedTagData] = useState({});
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [numFields, setNumFields] = useState(16);
  const [editUserField, setEditUserField] = useState(false);
  const [editUnitField, setEditUnitField] = useState(false);
  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editedFieldData, setEditedFieldData] = useState({});
  const [userTagInfotable, setUserTagInfotable] = useState([]);
  const [displayFields, setDisplayFields] = useState([]);
  const [generalTagInfoFields, setGeneralTagInfoFields] = useState([]);
  const [selectedTagInfoIds, setSelectedTagInfoIds] = useState([]); // New state for multiple selection
  const { updateProject } = useContext(updateProjectContext);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [istaginfotab, settaginfotab] = useState(true);
  const [istagsettab, settagsettab] = useState(false);
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;
    const [loaded, setLoaded] = useState(false);
  

  const fetchGeneralTagInfo = async (projectId) => {
    const response = await fetchAllGentagInfo(projectId);
    if (response.status === 200) {
      console.log(response.data);
      setUserTagInfotable(response.data);
    } else if(response.status === 404) {
      console.log(response);
    }
  };

     useEffect(() => {
      if (loaded) fetchGeneralTagInfo(projectId);
    }, [ updateProject,loaded]);

  const getGeneralTagInfoField = async (projectId) => {
    try {
      const response = await fetchFromGentagInfoFields(projectId);
      if (response.status === 200) {
        console.log(response.data);
        setGeneralTagInfoFields(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch status table data:", error);
    }
  };

  useEffect(() => {
    getGeneralTagInfoField(projectId);
  }, [updateProject]);

  useEffect(() => {
    const initialFields =
      generalTagInfoFields.length > 0
        ? generalTagInfoFields.slice(0, numFields).map((field) => ({
            ...field,
            statuscheck: field.statuscheck || "unchecked",
          }))
        : Array.from({ length: numFields }, (_, index) => ({
            field: `Field ${index + 1}`,
            unit: `Unit ${index + 1}`,
            statuscheck: "unchecked",
          }));

    setDisplayFields(initialFields);
  }, [numFields, generalTagInfoFields]);

  // Updated to handle both single and multiple deletes
  const handleConfirm = async() => {
    try {
      const tagIds = Array.isArray(currentDeleteNumber) 
        ? currentDeleteNumber 
        : [currentDeleteNumber];

      for (const tagId of tagIds) {
        const data = { projectId: projectId, tagId: tagId };
        const response = await DeleteGeneralTagInfolist(data);
        if (response.status !== 200) {
          throw new Error(`Failed to delete tag ${tagId}`);
        }
      }

      setCustomAlert(true);
      setModalMessage(
        tagIds.length > 1
          ? "Tag info items deleted successfully"
          : "Tag info deleted successfully"
      );
      fetchGeneralTagInfo(projectId);
    } catch (error) {
      console.error("Error deleting tag info:", error);
      setModalMessage("Error deleting tag info");
      setCustomAlert(true);
    }

    setShowConfirm(false);
    setCurrentDeleteNumber(null);
    setSelectedTagInfoIds([]); // Clear selection
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  // Modified to use tag object instead of index
  const handleEditOpen = (tagInfo) => {
    setEditedTagId(tagInfo.tagId);
    setEditedTagData(tagInfo);
  };

  const handleCloseEdit = () => {
    setEditedTagId(null);
    setEditedTagData({});
    setEditUserField(false);
    setEditUnitField(false);
  };

  const handleChange = (field, value) => {
    setEditedTagData({
      ...editedTagData,
      [field]: value,
    });
  };

  // Updated save function
  const handleSave = async(tagId) => {
    console.log(tagId);

    try {
      const response = await EditGeneralTagInfolist(editedTagData); 
      if(response.status === 200) {
        setEditedTagId(null);
        setEditedTagData({});
        setCustomAlert(true);
        setModalMessage("Updated successfully..");
        fetchGeneralTagInfo(projectId);
      }
    } catch (error) {
      console.error("Error saving tag info:", error);
      setModalMessage("Failed to save tag info data.");
      setCustomAlert(true);
    }
  };

  const handleDeleteTagInfoFromTable = (tagNumber) => {
    setCurrentDeleteNumber(tagNumber);
    setShowConfirm(true);
  };

  // New function for multiple delete
  const handleMultipleDelete = () => {
    if (selectedTagInfoIds.length === 0) {
      setModalMessage("No tag info selected for deletion");
      setCustomAlert(true);
      return;
    }
    setCurrentDeleteNumber([...selectedTagInfoIds]);
    setShowConfirm(true);
  };

  // New functions for checkbox handling
  const handleSelectAllCheckbox = (e) => {
    if (e.target.checked) {
      setSelectedTagInfoIds(userTagInfotable.map((info) => info.tagId));
    } else {
      setSelectedTagInfoIds([]);
    }
  };

  const handleTagInfoCheckboxChange = (tagId, isChecked) => {
    if (isChecked) {
      setSelectedTagInfoIds((prev) => [...prev, tagId]);
    } else {
      setSelectedTagInfoIds((prev) => prev.filter((id) => id !== tagId));
    }
  };

  const handleExport = () => {
    // Generate headers from generalTagInfoFields and add Tag and Type
    const headers = [
      "tag",
      "type",
      ...generalTagInfoFields.map((field) => field.field),
    ];

    // Create data rows by mapping each entry in userTagInfotable
    const dataToExport = userTagInfotable.map((info) => {
      const row = {
        tag: info.tag || "",
        type: info.type || "",
      };

      // Include additional taginfo fields based on generalTagInfoFields
      generalTagInfoFields.forEach((field, index) => {
        row[field.field] = info[`taginfo${index + 1}`] || "";
      });

      return row;
    });

    // Convert data to a sheet with headers
    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

    // Create a new workbook and append the sheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "General Tag List");

    // Write the workbook to an array buffer
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    // Save the file using FileSaver
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "General-Tag-Info.xlsx"
    );
  };

  const handleImportClick = () => {};
 
  const handleEditRow = (index) => {
    setEditRowIndex(index);
    setEditedFieldData({ ...displayFields[index] });
  };

  const handleSaveEditedRow = async () => {
    try {
      // Validate the edited data
      if (!editedFieldData.field || !editedFieldData.unit) {
        alert("Please fill in both field and unit values");
        return;
      }

      // Update the local state with edited data
      const updatedFields = [...displayFields];
      updatedFields[editRowIndex] = {
        ...updatedFields[editRowIndex],
        ...editedFieldData,
      };

      // Update the display fields state
      setDisplayFields(updatedFields);

      // Prepare data for backend
      const dataToSave = {
        id: displayFields[editRowIndex].id, // Assuming each field has an ID
        projectId: projectId,
        field: editedFieldData.field,
        unit: editedFieldData.unit,
        statuscheck: displayFields[editRowIndex].statuscheck,
        index: editRowIndex,
      };
      console.log(dataToSave);
      // Send to backend
      try {
        const response = await UpdateGentagInfoFields(dataToSave);

        if (response.status === 200 || response.status === 201) {
          setCustomAlert({
            show: true,
            type: "success",
            message: "Update Tag field successfully!",
          });
          setEditRowIndex(null);
          setEditedFieldData({});
          console.log("Field updated successfully");
          fetchFromGentagInfoFields(projectId);
        } else {
          setCustomAlert({
            show: true,
            type: "error",
            message: "Something went wrong while updating.",
          });
        }
      } catch (error) {
        console.error("Error in updating :", error);
        setCustomAlert({
          show: true,
          type: "error",
          message: "Error occurred while in updating. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error saving edited row:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleCancelEditRow = () => {
    setEditRowIndex(null);
    setEditedFieldData({});
  };

  const handlesettings = () => {
    settaginfotab(false);
    settagsettab(true);
  };

  const handlesettingclose = () => {
    settaginfotab(true);
    settagsettab(false);
  };

  const handleEditedFieldChange = (key, value) => {
    setEditedFieldData({
      ...editedFieldData,
      [key]: value,
    });
  };

  // Calculate the number of checked fields for column span
  const checkedFieldsCount = displayFields.filter(field => field.statuscheck === "checked").length;
  
     const canView = canAccess(projectId, "tag_info", "VIEWER");
    const canEdit = canAccess(projectId, "tag_info", "EDITOR");
  
    if (!canView) {
      return <div className="alert alert-danger">Access Denied</div>;
    }
  

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
      {istagsettab ? (
        <form>
          <div className="table-container">
            <table className="tagTable">
              <thead style={{ backgroundColor: "#606BCB" }}>
                <th className="wideHead">Field value</th>
                <th>Value assigned</th>
                <th className="wideHead">Unit</th>
                <th>Unit assigned</th>
                <th className="wideHead">Show</th>
                <th>
                  <i
                    className="ms-5 fa-regular fa-circle-xmark"
                    onClick={handlesettingclose}
                    style={{ cursor: "pointer" }}
                  ></i>
                </th>
              </thead>
              <tbody>
                {displayFields.map((field, index) => (
                  <tr key={index} style={{ color: "black" }}>
                    <td style={{ backgroundColor: "#f0f0f0" }}>
                      {field.field}
                    </td>
                    <td>
                      {editRowIndex === index ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editedFieldData.field}
                          onChange={(e) =>
                            handleEditedFieldChange("field", e.target.value)
                          }
                        />
                      ) : (
                        field.field
                      )}
                    </td>
                    <td>{field.unit}</td>
                    <td>
                      {editRowIndex === index ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editedFieldData.unit}
                          onChange={(e) =>
                            handleEditedFieldChange("unit", e.target.value)
                          }
                        />
                      ) : (
                        field.unit
                      )}
                    </td>
                    <td>
                      {editRowIndex === index ? (
                        <input
                          className="ms-2"
                          type="checkbox"
                          checked={editedFieldData.statuscheck === "checked"}
                          onChange={(e) =>
                            handleEditedFieldChange(
                              "statuscheck",
                              e.target.checked ? "checked" : "unchecked"
                            )
                          }
                        />
                      ) : (
                        <input
                          className="ms-2"
                          type="checkbox"
                          checked={field.statuscheck === "checked"}
                          disabled
                        />
                      )}
                    </td>

                    <td style={{ backgroundColor: "#f0f0f0" }}>
                      
                      <>
                        {editRowIndex === index ? (
                          <>
                            <i
                              className="fa-solid fa-floppy-disk me-3 text-success"
                              style={{ cursor: "pointer" }}
                              onClick={handleSaveEditedRow}
                            ></i>
                            <i
                              className="fa-solid fa-xmark text-danger"
                              style={{ cursor: "pointer" }}
                              onClick={handleCancelEditRow}
                            ></i>
                          </>
                        ) : (
                          <>
                            <i
                              className="fa-solid fa-pencil me-3 text-dark"
                              style={{ cursor: "pointer" }}
                              onClick={() => handleEditRow(index)}
                            ></i>
                          </>
                        )}
                      </>
                    </td>
                  </tr>
                ))}
              </tbody>
            
            </table>
          </div>
        </form>
      ) : (
        <form>
          <div className="table-container">
            <table className="tagTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="mediumHead">
                    <input
                      type="checkbox"
                      onChange={handleSelectAllCheckbox}
                      checked={
                        userTagInfotable.length > 0 &&
                        userTagInfotable.every((info) =>
                          selectedTagInfoIds.includes(info.tagId)
                        )
                      }
                    />
                  </th>
                  <th className="wideHead">Tag</th>
                  <th className="wideHead">Type</th>
                  {displayFields.map((item) =>
                    item.statuscheck === "checked" ? (
                      <th key={item.id}>{item.field}</th>
                    ) : null
                  )}
                  <th>
                    <i
                      className="fa fa-download"
                      title="Export"
                      onClick={handleExport}
                      style={{ cursor: "pointer" }}
                    ></i>
                   {canEdit && (
                  <>
                    <i
                      className="fa fa-upload ms-2"
                      title="Import"
                      onClick={handleImportClick}
                      style={{ cursor: "pointer" }}
                    ></i>
                    <i
                      className="fa fa-trash ms-2"
                      title="Delete Selected"
                      onClick={handleMultipleDelete}
                      style={{ cursor: "pointer" }}
                    ></i>
                  
                              </>
                   )}
                  </th>
                </tr>

                <tr>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  {displayFields.map((item) =>
                    item.statuscheck === "checked" ? (
                      <th key={item.id}>{item.unit}</th>
                    ) : null
                  )}
                  <th>
                    <i
                      onClick={handlesettings}
                      style={{ cursor: "pointer" }}
                      className="fa-solid fa-gear"
                    ></i>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(userTagInfotable) &&
                userTagInfotable.length > 0 ? (
                  userTagInfotable.map((info, index) => {
                    return (
                      <tr key={info.tagId || index} style={{ color: "black" }}>
                        <td style={{ backgroundColor: "#f0f0f0" }}>
                          {index + 1}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedTagInfoIds.includes(info.tagId)}
                            onChange={(e) =>
                              handleTagInfoCheckboxChange(info.tagId, e.target.checked)
                            }
                          />
                        </td>
                        <td style={{ backgroundColor: "#f0f0f0" }}>
                          {info.tag}
                        </td>
                        <td>{info.type}</td>
                        {displayFields
                          .filter((field) => field.statuscheck === "checked")
                          .map((field, fieldIndex) => {
                            // Fix the data access - use taginfo1, taginfo2, etc. instead of taginfo${field.id}
                            const taginfoKey = `taginfo${fieldIndex + 1}`;
                          
                            return (
                              <td key={fieldIndex}>
                                {editedTagId === info.tagId ? (
                                  <input
                                    onChange={(e) =>
                                      handleChange(taginfoKey, e.target.value)
                                    }
                                    type="text"
                                    value={editedTagData[taginfoKey] || ""}
                                  />
                                ) : (
                                  info[taginfoKey] || ""
                                )}
                              </td>
                            );
                          })}
                          
                        <td style={{ backgroundColor: "#f0f0f0" }}>
                          {editedTagId === info.tagId ? (
                            <>
                              <i
                                className="fa-solid fa-floppy-disk text-success"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleSave(info.tagId)}
                              ></i>
                              <i
                                className="fa-solid fa-xmark ms-3 text-danger"
                                style={{ cursor: "pointer" }}
                                onClick={handleCloseEdit}
                              ></i>
                            </>
                          ) : (
                            <>
                              <i
                                className="fa-solid fa-pencil"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleEditOpen(info)}
                              ></i>
                              <i
                                className="fa-solid fa-trash-can ms-3"
                                style={{ cursor: "pointer" }}
                                onClick={() =>
                                  handleDeleteTagInfoFromTable(info.tagId)
                                }
                              ></i>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6 + checkedFieldsCount}>No data available</td>
                  </tr>
                )}
              </tbody>
                {
              loaded?'':<button className="btn" style={{cursor:'pointer',backgroundColor:'#5B66CB',color:'white',width:'100px'}} onClick={() => setLoaded(true)}>Load data</button>
            }
            </table>
          </div>
        </form>
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

export default GeneralTagInfoTable;