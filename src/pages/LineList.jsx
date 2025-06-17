import React, { useState, useEffect } from "react";
import DeleteConfirm from "../components/DeleteConfirm";
import * as XLSX from "xlsx";
import Alert from "../components/Alert";
import { Modal } from "react-bootstrap";
import { deletelineList, EditLinelist, getLineList, saveimportedLineList } from "../services/TagApi";

function LineList() {
  const [editedRowIndex, setEditedRowIndex] = useState(-1);
  const [editedLineData, setEditedLineData] = useState({});
  const [currentDeleteNumber, setCurrentDeleteNumber] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [importTag, setImportTag] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
   const [allLineList,setAllLinelist]=useState([])


        const projectString = sessionStorage.getItem("selectedProject");
      const project = projectString ? JSON.parse(projectString) : null;
      const projectId = project?.projectId;
   const fetchLineList  = async(projectId)=>{
    const response = await getLineList(projectId)
    if(response.status===200){
  setAllLinelist(response.data)

    }
   }
  useEffect(() => {
    fetchLineList(projectId)
 
  }, []);

   
  const handleDeleteLineFromTable = (tagNumber) => {
    setCurrentDeleteNumber(tagNumber);
    setShowConfirm(true);
  };

  const handleEditOpen = (index) => {
    setEditedRowIndex(index);
    setEditedLineData(allLineList[index]);
  };

  const handleCloseEdit = () => {
    setEditedRowIndex(-1);
    setEditedLineData({});
  };

  const handleSave = async(tag) => {
    const updatedLineList = [...allLineList];
    updatedLineList[editedRowIndex] = { ...editedLineData, tag: tag };
 const response = await EditLinelist(editedLineData)
 if(response.status===200){
  setEditedRowIndex(-1);
    setEditedLineData({});
 }
  

  };

  const handleChange = (field, value) => {
    setEditedLineData({
      ...editedLineData,
      [field]: value,
    });
  };

  const handleConfirm = async() => {
     const response = await deletelineList(currentDeleteNumber)
     if(response.status===200){
   
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
     }

  };

  const handleCancel = () => {
    setShowConfirm(false);
    setCurrentDeleteNumber(null);
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
  
      reader.onload = async(e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
        const formattedData = jsonData.map(item => ({
          tag: item["tag"] || "",
          fluidCode: item["fluidCode"] || "",
          lineId: item["lineId"] || "",
          medium: item["medium"] || "",
          lineSizeIn: item["lineSizeIn"] || "",
          lineSizeNb: item["lineSizeNb"] || "",
          pipingSpec: item["pipingSpec"] || "",
          insType: item["insType"] || "",
          insThickness: item["insThickness"] || "",
          heatTrace: item["heatTrace"] || "",
          lineFrom: item["lineFrom"] || "",
          lineTo: item["lineTo"] || "",
          maxOpPress: item["maxOpPress"] || "",
          maxOpTemp: item["maxOpTemp"] || "",
          dsgnPress: item["dsgnPress"] || "",
          minDsgnTemp: item["minDsgnTemp"] || "",
          maxDsgnTemp: item["maxDsgnTemp"] || "",
          testPress: item["testPress"] || "",
          testMedium: item["testMedium"] || "",
          testMediumPhase: item["testMediumPhase"] || "",
          massFlow: item["massFlow"] || "",
          volFlow: item["volFlow"] || "",
          density: item["density"] || "",
          velocity: item["velocity"] || "",
          paintSystem: item["paintSystem"] || "",
          ndtGroup: item["ndtGroup"] || "",
          chemCleaning: item["chemCleaning"] || "",
          pwht: item["pwht"] || ""
        }));
  
        // Send to main process or update state
        const response = await saveimportedLineList(formattedData)
        if(response.status===200){
    setImportTag(false);
        setSelectedFile('');
        }
  
        // Reset
    
      };
  
      reader.readAsArrayBuffer(selectedFile);
    }
  };
  
  const handleExcelFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  }

  const handleDownloadTemplate = () => {
    const headers = [
      "tag",
      "fluidCode",
      "lineId",
      "medium",
      "lineSizeIn",
      "lineSizeNb",
      "pipingSpec",
      "insType",
      "insThickness",
      "heatTrace",
      "lineFrom",
      "lineTo",
      "maxOpPress",
      "maxOpTemp",
      "dsgnPress",
      "minDsgnTemp",
      "maxDsgnTemp",
      "testPress",
      "testMedium",
      "testMediumPhase",
      "massFlow",
      "volFlow",
      "density",
      "velocity",
      "paintSystem",
      "ndtGroup",
      "chemCleaning",
      "pwht"
    ];
  
    const worksheet = XLSX.utils.aoa_to_sheet([headers]); // Header only
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LineListTemplate");
  
    XLSX.writeFile(workbook, "LineListTemplate.xlsx");
  };
  

  const handleExport = () => {
    const headers = [
      "tag",
      "fluidCode",
      "lineId",
      "medium",
      "lineSizeIn",
      "lineSizeNb",
      "pipingSpec",
      "insType",
      "insThickness",
      "heatTrace",
      "lineFrom",
      "lineTo",
      "maxOpPress",
      "maxOpTemp",
      "dsgnPress",
      "minDsgnTemp",
      "maxDsgnTemp",
      "testPress",
      "testMedium",
      "testMediumPhase",
      "massFlow",
      "volFlow",
      "density",
      "velocity",
      "paintSystem",
      "ndtGroup",
      "chemCleaning",
      "pwht",
    ];

    // Normalize data
    const dataToExport = allLineList?.map((item) => {
      const row = {};
      headers.forEach((header) => {
        row[header] = item[header] || "";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Line List");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredLineList = allLineList?.filter((line) =>
    line.tag.toLowerCase().includes(searchQuery.toLowerCase())
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
                <th className="wideHead">Tag</th>
                <th className="wideHead">Fluid code</th>
                <th className="wideHead">Line ID</th>
                <th>Medium</th>
                <th>Line size (inch)</th>
                <th>Line size (NB)</th>
                <th>Piping spec.</th>
                <th>Insulation type</th>
                <th>Insulation thickness</th>
                <th>Heat tracing</th>
                <th className="wideHead">Line from</th>
                <th className="wideHead">Line to</th>
                <th>Maximum operating pressure (bar)</th>
                <th>Maximum operating temperature (ºC)</th>
                <th>Design pressure (bar)</th>
                <th>Minimum design temperature (ºC)</th>
                <th>Maximum design temperature (ºC)</th>
                <th>Test pressure (bar)</th>
                <th>Test medium</th>
                <th>Test medium phase</th>
                <th>Mass flow (kg/hr)</th>
                <th>
                  Volume flow (m<sup>3</sup>/hr)
                </th>
                <th>
                  Density (kg/m<sup>3</sup>)
                </th>
                <th>Velocity (m/s)</th>
                <th>Paint system</th>
                <th>NDT group</th>
                <th>Chemical cleaning</th>
                <th>PWHT</th>
                <th className="tableActionCell">
                  <i
                    className="fa fa-upload"
                    title="Export"
                    onClick={handleExport}
                  ></i>
                  <i
                    className="fa fa-download ms-2"
                    title="Import"
                    onClick={handleImportTag}
                  ></i>
                </th>
              </tr>
              <tr>
                <th colSpan="29">
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
              {filteredLineList?.map((line, index) => (
                <tr key={index} style={{ color: "black" }}>
                  <td style={{ backgroundColor: "#f0f0f0" }}>{line.tag}</td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("fluidCode", e.target.value)
                        }
                        type="text"
                        value={editedLineData.fluidCode || ""}
                      />
                    ) : (
                      line.fluidCode
                    )}
                  </td>
                  <td>{line.lineId}</td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("medium", e.target.value)}
                        type="text"
                        value={editedLineData.medium || ""}
                      />
                    ) : (
                      line.medium
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("lineSizeIn", e.target.value)
                        }
                        type="text"
                        value={editedLineData.lineSizeIn || ""}
                      />
                    ) : (
                      line.lineSizeIn
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("lineSizeNb", e.target.value)
                        }
                        type="text"
                        value={editedLineData.lineSizeNb || ""}
                      />
                    ) : (
                      line.lineSizeNb
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("pipingSpec", e.target.value)
                        }
                        type="text"
                        value={editedLineData.pipingSpec || ""}
                      />
                    ) : (
                      line.pipingSpec
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("insType", e.target.value)
                        }
                        type="text"
                        value={editedLineData.insType || ""}
                      />
                    ) : (
                      line.insType
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("insThickness", e.target.value)
                        }
                        type="text"
                        value={editedLineData.insThickness || ""}
                      />
                    ) : (
                      line.insThickness
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("heatTrace", e.target.value)
                        }
                        type="text"
                        value={editedLineData.heatTrace || ""}
                      />
                    ) : (
                      line.heatTrace
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("lineFrom", e.target.value)
                        }
                        type="text"
                        value={editedLineData.lineFrom || ""}
                      />
                    ) : (
                      line.lineFrom
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("lineTo", e.target.value)}
                        type="text"
                        value={editedLineData.lineTo || ""}
                      />
                    ) : (
                      line.lineTo
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("maxOpPress", e.target.value)
                        }
                        type="text"
                        value={editedLineData.maxOpPress || ""}
                      />
                    ) : (
                      line.maxOpPress
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("maxOpTemp", e.target.value)
                        }
                        type="text"
                        value={editedLineData.maxOpTemp || ""}
                      />
                    ) : (
                      line.maxOpTemp
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("dsgnPress", e.target.value)
                        }
                        type="text"
                        value={editedLineData.dsgnPress || ""}
                      />
                    ) : (
                      line.dsgnPress
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("minDsgnTemp", e.target.value)
                        }
                        type="text"
                        value={editedLineData.minDsgnTemp || ""}
                      />
                    ) : (
                      line.minDsgnTemp
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("maxDsgnTemp", e.target.value)
                        }
                        type="text"
                        value={editedLineData.maxDsgnTemp || ""}
                      />
                    ) : (
                      line.maxDsgnTemp
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("testPress", e.target.value)
                        }
                        type="text"
                        value={editedLineData.testPress || ""}
                      />
                    ) : (
                      line.testPress
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("testMedium", e.target.value)
                        }
                        type="text"
                        value={editedLineData.testMedium || ""}
                      />
                    ) : (
                      line.testMedium
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("testMediumPhase", e.target.value)
                        }
                        type="text"
                        value={editedLineData.testMediumPhase || ""}
                      />
                    ) : (
                      line.testMediumPhase
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("massFlow", e.target.value)
                        }
                        type="text"
                        value={editedLineData.massFlow || ""}
                      />
                    ) : (
                      line.massFlow
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("volFlow", e.target.value)
                        }
                        type="text"
                        value={editedLineData.volFlow || ""}
                      />
                    ) : (
                      line.volFlow
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("density", e.target.value)
                        }
                        type="text"
                        value={editedLineData.density || ""}
                      />
                    ) : (
                      line.density
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("velocity", e.target.value)
                        }
                        type="text"
                        value={editedLineData.velocity || ""}
                      />
                    ) : (
                      line.velocity
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("paintSystem", e.target.value)
                        }
                        type="text"
                        value={editedLineData.paintSystem || ""}
                      />
                    ) : (
                      line.paintSystem
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("ndtGroup", e.target.value)
                        }
                        type="text"
                        value={editedLineData.ndtGroup || ""}
                      />
                    ) : (
                      line.ndtGroup
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) =>
                          handleChange("chemCleaning", e.target.value)
                        }
                        type="text"
                        value={editedLineData.chemCleaning || ""}
                      />
                    ) : (
                      line.chemCleaning
                    )}
                  </td>
                  <td>
                    {editedRowIndex === index ? (
                      <input
                        onChange={(e) => handleChange("pwht", e.target.value)}
                        type="text"
                        value={editedLineData.pwht || ""}
                      />
                    ) : (
                      line.pwht
                    )}
                  </td>

                  <td style={{ backgroundColor: "#f0f0f0" }}>
                    {editedRowIndex === index ? (
                      <>
                        <i
                          className="fa-solid fa-floppy-disk text-success"
                          onClick={() => handleSave(line.tag)}
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
                          onClick={() => handleEditOpen(index)}
                        ></i>
                        <i
                          className="fa-solid fa-trash-can ms-3"
                          onClick={() => handleDeleteLineFromTable(line.tagId)}
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

        {importTag &&
              <Modal
                onHide={handleClose}
                show={importTag}
                backdrop="static"
                keyboard={false}
                dialogClassName="custom-modal"
              >
                <div className="tag-dialog">
                  <div className="title-dialog">
                    <p className='text-light'>Import list</p>
                    <p className='text-light cross' onClick={handleClose}>&times;</p>
                  </div>
                  <div className="dialog-input">
                    <label>File</label>
                    <input
                      type="file" onChange={handleExcelFileChange} />
                    <a onClick={handleDownloadTemplate} style={{ cursor: 'pointer', color: ' #00BFFF' }}>Download template</a>
                  </div>
                  <div className='dialog-button' style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', bottom: 0 }}>
                    <button className='btn btn-secondary' onClick={handleClose}>Cancel</button>
                    <button className='btn btn-dark' onClick={handleImportClick}>Upload</button>
                  </div>
                </div>
              </Modal>
            }
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

export default LineList;
