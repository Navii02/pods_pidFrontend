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

function GeneralTagInfoTable({}) {
  const [editedRowIndex, setEditedRowIndex] = useState(-1);
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
  const { updateProject } = useContext(updateProjectContext);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [istaginfotab, settaginfotab] = useState(true);
  const [istagsettab, settagsettab] = useState(false);
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchGeneralTagInfo = async (projectId) => {
    const response = await fetchAllGentagInfo(projectId);
    if (response.status === 200) {
      console.log(response.data);
      setUserTagInfotable(response.data);
    }else if(response.status===404){
      console.log(response)
    }
  };
  useEffect(() => {
    fetchGeneralTagInfo(projectId);
  }, [updateProject]);

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

  const handleConfirm = async() => {
    const data= {projectId:projectId,tagId:currentDeleteNumber}
     const response = await DeleteGeneralTagInfolist(data)
    if(response.status===200){
       setCustomAlert(true);
       setModalMessage(response.data.message)
       fetchGeneralTagInfo(projectId);
        setShowConfirm(false);
    setCurrentDeleteNumber(null);
    }
   
   
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
  };

  const handleEditOpen = (index) => {
    setEditedRowIndex(index);
    setEditedTagData(userTagInfotable[index]);
  };

  const handleCloseEdit = () => {
    setEditedRowIndex(-1);
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

  const handleSave = async(tagId) => {
    console.log(tagId);

     try {
        const response = await EditGeneralTagInfolist(editedTagData); 
        if(response.status === 200) {
          const updatedGeneralTagInfoList = [...userTagInfotable];
          updatedGeneralTagInfoList[editedRowIndex] = { ...editedTagData};
          setUserTagInfotable(updatedGeneralTagInfoList);
          setEditedRowIndex(-1);
          setEditedTagData({});
          setCustomAlert(true);
          setModalMessage("Upadated successfully..")
        }
      } catch (error) {
        console.error("Error saving equipment:", error);
        setModalMessage("Failed to save equipment data.");
        setCustomAlert(true);
      }

  };

  const handleDeleteTagInfoFromTable = (tagNumber) => {
    setCurrentDeleteNumber(tagNumber);
    setShowConfirm(true);
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
                    class="ms-5 fa-regular fa-circle-xmark"
                    onClick={handlesettingclose}
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
                  <th className="wideHead">Tag</th>
                  <th className="wideHead">Type</th>
                  {displayFields.map((item) =>
                    item.statuscheck === "checked" ? (
                      <th key={item.id}>{item.field}</th>
                    ) : null
                  )}
                  <th>
                    <i
                      className="fa fa-upload"
                      title="Export"
                      onClick={handleExport}
                    ></i>
                    <i
                      className="fa fa-download ms-2"
                      title="Import"
                      onClick={handleImportClick}
                    ></i>
                  </th>
                </tr>

                <tr>
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
                      class="fa-solid fa-gear"
                    ></i>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(userTagInfotable) &&
                userTagInfotable.length > 0 ? (
                  userTagInfotable.map((info, index) => {
                    return (
                      <tr key={index} style={{ color: "black" }}>
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
                                {editedRowIndex === index ? (
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
                          {editedRowIndex === index ? (
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
                                onClick={() => handleEditOpen(index)}
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
                    <td colSpan="100%">No data available</td>
                  </tr>
                )}
              </tbody>
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
