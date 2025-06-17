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

function TreeReview(updatetree) {
  const { updateTree } = useContext(TreeresponseContext);
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

  const handleDeleteTagFromTable = (number, type) => {
    setCurrentDeleteTag(number);
    setCurrentDeleteType(type);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (currentDeleteType === "area") {
      console.log(currentDeleteTag);
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
    fetchData();

    setShowConfirm(false);
    setCurrentDeleteTag("");
    setCurrentDeleteType("");
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
      switch (type) {
        case "area":
          await updateArea(editedLineData);
          break;
        case "discipline":
          await updateDiscipline(editedLineData);
          break;
        case "system":
          await updateSystem(editedLineData);
          break;
        default:
          return;
      }
      handleCloseEdit();
      fetchData();
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  return (
    <div>
      {/* style={{ width: '100%', height: '100vh', backgroundColor: 'white', zIndex: '1', position: 'absolute' }} */}
      <form>
        <div className="table-container">
          <h4 className="text-center">Area table</h4>
          <table className="tagTable">
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="tableActionCell">
                  <i
                    className="fa-solid fa-trash-can ms-3"
                    title="Delete all"
                    onClick={() => {
                      handleDeleteTagFromTable(0, "all-area");
                    }}
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
                  <td>
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
                <th className="tableActionCell">
                  <i
                    className="fa-solid fa-trash-can ms-3"
                    title="Delete all"
                    onClick={() => {
                      handleDeleteTagFromTable(0, "all-discipline");
                    }}
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
                          className="fa-solid fa-trash-can ms-3"
                          onClick={() =>
                            handleDeleteTagFromTable(tag.discId, "disc")
                          }
                        ></i>
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
                <th className="tableActionCell">
                  <i
                    className="fa-solid fa-trash-can ms-3"
                    title="Delete all"
                    onClick={() => {
                      handleDeleteTagFromTable(0, "all-system");
                    }}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
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
