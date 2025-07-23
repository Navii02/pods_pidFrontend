// import {
//   faDownload,
//   faTrash,
//   faUpload,
//   faEdit,
//   faSave,
//   faTimes,
//   faXmark,
// } from "@fortawesome/free-solid-svg-icons";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import React, { useContext, useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   deleteTag,
//   getdocumentsbyTags,
//   GetTagDetails,
//   updateTags,
//   RegisterTag
// } from "../services/TagApi";
// import {
//   TreeresponseContext,
//   updateProjectContext,
// } from "../context/ContextShare";
// import { Modal } from "react-bootstrap";
// import Alert from "../components/Alert";
// import DeleteConfirm from "../components/DeleteConfirm";
// import { saveAs } from 'file-saver';
// import * as XLSX from 'xlsx';

// const Tagreview = () => {
//   const { updateProject } = useContext(updateProjectContext);
//   const { setUpdatetree } = useContext(TreeresponseContext);

//   const [tags, setTags] = useState([]);
//   const [editingId, setEditingId] = useState(null);
//   const [editData, setEditData] = useState({});
//   const [searchTerm, setSearchTerm] = useState("");
//   const [parentTagOptions, setParentTagOptions] = useState([]);
//   const [popupData, setPopupData] = useState({
//     visible: false,
//     tagId: null,
//     documents: [],
//     x: 0,
//     y: 0,
//   });
//   const [hoveredRow, setHoveredRow] = useState(null);
//   const [showConfirm, setShowConfirm] = useState(false);
//   const [tagToDelete, setTagToDelete] = useState(null);
//   const [customAlert, setCustomAlert] = useState(false);
//   const [modalMessage, setModalMessage] = useState("");
//   const navigate = useNavigate();
//   const [selectedTagIds, setSelectedTagIds] = useState([]);
//   const [loaded, setLoaded] = useState(false);
//   const [importTag, setImportTag] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);


//   const projectString = sessionStorage.getItem("selectedProject");
//   const project = projectString ? JSON.parse(projectString) : null;
//   const projectId = project?.projectId;

//   const GetTags = async () => {
//     const response = await GetTagDetails(projectId);
//     console.log(response);
//     if (response.status === 200) {
//       const mappedTags = response.data.map((tag) => ({
//         ...tag,
//         parentTag: tag.parenttag,
//       }));
//       setTags(mappedTags);
//       const parents = [
//         ...new Set(mappedTags.map((tag) => tag.number).filter(Boolean)),
//       ];
//       setParentTagOptions(parents);
//     }
//   };



//   const handleEdit = (tag) => {
//     setEditingId(tag.tagId);
//     setEditData({
//       ...tag,
//       parentTag: tag.parentTag || "",
//     });
//   };

//   const handleCancel = () => {
//     setEditingId(null);
//     setEditData({});
//   };

//   const handleSave = async (tagId) => {
//     try {
//       const payload = {
//         ...editData,
//         parenttag: editData.parentTag,
//       };
//       const response = await updateTags(tagId,projectId, payload);
//       if (response.status === 200) {
//         setModalMessage("The Tag is updated Successfully");
//         setCustomAlert(true);
//         setUpdatetree(Date.now());
//         GetTags();
//       }
//       setEditingId(null);
//     } catch (error) {
//       console.error("Error updating tag:", error);
//       setModalMessage("Error updating tag");
//       setCustomAlert(true);
//     }
//   };

//   const handleDelete = async (tagId) => {
//     setTagToDelete(tagId);
//     setShowConfirm(true);
//   };
// const handleMultipleDelete = () => {
//   if (selectedTagIds.length === 0) {
//     setModalMessage("No tags selected for deletion");
//     setCustomAlert(true);
//     return;
//   }
//   setTagToDelete([...selectedTagIds]); // store array
//   setShowConfirm(true);
// };

// const handleConfirmDelete = async () => {
//   try {
//     const tagIds = Array.isArray(tagToDelete) ? tagToDelete : [tagToDelete];

//     for (const id of tagIds) {
//       const response = await deleteTag(id);
//       if (response.status !== 200) {
//         throw new Error(`Failed to delete tag ${id}`);
//       }
//     }

//     setModalMessage(
//       tagIds.length > 1
//         ? "Tags deleted successfully"
//         : "Tag deleted successfully"
//     );
//     setCustomAlert(true);
//     setUpdatetree(Date.now());
//     GetTags();
//   } catch (error) {
//     console.error("Error deleting tags:", error);
//     setModalMessage("Error deleting tag(s)");
//     setCustomAlert(true);
//   }

//   setShowConfirm(false);
//   setTagToDelete(null);
//   setSelectedTagIds([]); // clear selection
// };


//   const handleCancelDelete = () => {
//     setShowConfirm(false);
//     setTagToDelete(null);
//   };

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setEditData((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleFileChange = (e) => {
//     setEditData((prev) => ({ ...prev, modelFile: e.target.files[0] }));
//   };

//   const handleTagNameClick = async (tagId, event) => {
//     try {
//       const response = await getdocumentsbyTags(tagId);
//       if (response.status === 200 && response.data.length > 0) {
//         setPopupData({
//           visible: true,
//           tagId,
//           documents: response.data,
//           x: event.clientX,
//           y: event.clientY,
//         });
//       } else {
//         setPopupData({
//           visible: false,
//           tagId: null,
//           documents: [],
//           x: 0,
//           y: 0,
//         });
//         setModalMessage("No documents assigned to this tag");
//         setCustomAlert(true);
//       }
//     } catch (error) {
//       console.error("Error fetching documents for tag:", error);
//       setModalMessage("Failed to fetch documents");
//       setCustomAlert(true);
//     }
//   };

//   const handleDocumentClick = (documentId, tagId) => {
//     navigate(`/canvas/${documentId}?tagId=${tagId}`);
//     setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
//   };

//   const filteredTags = tags.filter(
//     (tag) =>
//       tag.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       tag.type.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const handleSelectAllCheckbox = (e) => {
//     if (e.target.checked) {
//       setSelectedTagIds(filteredTags.map((tag) => tag.tagId));
//     } else {
//       setSelectedTagIds([]);
//     }
//   };

//   const handleTagCheckboxChange = (tagId, isChecked) => {
//     if (isChecked) {
//       setSelectedTagIds((prev) => [...prev, tagId]);
//     } else {
//       setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
//     }
//   };
//   useEffect(() => {
//   if (loaded) GetTags();
// }, [updateProject, loaded]);

//   const handleExportTag = () => {
//     // Define readable headers and matching field keys
//     const headers = [
//       { label: 'Tag Number*', key: 'number' },
//       { label: 'Name', key: 'name' },
//       { label: 'Type*', key: 'type' },
//       { label: 'Parent Tag', key: 'parenttag' },
//       { label: 'Model', key: 'filename' }
//     ];
  
//     // Choose which data to export
//     const dataToExport = filteredTags.length > 0 ? filteredTags : [];
  
//     // Convert data for Excel export
//     const exportData = dataToExport.map(tag => ({
//       number: tag.number,
//       name: tag.name,
//       type: tag.type,
//       parenttag: tag.parenttag,
//       filename: tag.filename
//     }));
  
//     // Create worksheet with column headers
//     const ws = XLSX.utils.json_to_sheet(exportData);
    
//     // Set custom headers manually
//     XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.label)], { origin: "A1" });
  
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, 'Tag List');
  
//     const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
//     saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Taglist.xlsx');
//   };

//     const handleDownloadTemplate = () => {
//     // Define header labels and object keys
//     const headers = [
//       { label: 'TagNumber*', key: 'number' },
//       { label: 'Name', key: 'name' },
//       { label: 'Type*', key: 'type' },
//       { label: 'Parent Tag', key: 'parenttag' },
//       { label: 'Possible Values for Type', key: '' }
//     ];
  
//     // Create initial empty row
//     const data = [
//       { number: "", name: "", type: "", parenttag: "" }
//     ];
  
//     // Create worksheet from data (use keys only)
//     const ws = XLSX.utils.json_to_sheet(data, { header: headers.map(h => h.key) });
  
//     // Add readable headers to the first row
//     XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.label)], { origin: "A1" });
  
//     // Add possible values under "Possible Values for Type" column
//     XLSX.utils.sheet_add_aoa(ws, [
//       ["", "", "", "", "Line"],
//       ["", "", "", "", "Equipment"],
//       ["", "", "", "", "Valve"],
//       ["", "", "", "", "Structural"],
//       ["", "", "", "", "Other"]
//     ], { origin: -1 });
  
//     // Set column widths
//     ws['!cols'] = [
//       { wch: 15 },  // TagNumber
//       { wch: 20 },  // Name
//       { wch: 15 },  // Type
//       { wch: 20 },  // Parent Tag
//       { wch: 30 }   // Possible Values
//     ];
  
//     // Apply yellow background to the "Possible Values" column
//     const range = XLSX.utils.decode_range(ws['!ref']);
//     for (let R = 1; R <= range.e.r; ++R) {
//       const cellAddress = XLSX.utils.encode_cell({ c: 4, r: R });
//       if (!ws[cellAddress]) ws[cellAddress] = {};
//       ws[cellAddress].s = {
//         fill: { fgColor: { rgb: "FFFF00" } }
//       };
//     }
  
//     // Create workbook and save
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, 'Tag-Import-Template');
//     const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
//     saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Tag-Import-Template.xlsx');
//   };
//     const handleImportTag = () => {
//     setImportTag(true);
//   }

//   const handleClose = () => {
//     setImportTag(false);
//   }
//   const handleExcelFileChange = (e) => {
//     setSelectedFile(e.target.files[0]);
//   }

//   const handleImportClick = async () => {
//   if (!selectedFile) {
//     setModalMessage("Please select a file to import.");
//     setCustomAlert(true);
//     return;
//   }

//   const reader = new FileReader();
//   reader.onload = async (e) => {
//     try {
//       const data = new Uint8Array(e.target.result);
//       const workbook = XLSX.read(data, { type: "array" });
//       const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//       const jsonData = XLSX.utils.sheet_to_json(worksheet);
//        // Filter out rows with empty tagNumber, name, or type
//         const formattedData = jsonData
//           .map(item => ({
//             tagNumber: item['TagNumber*'],
//             name: item['Name'],
//             type: item['Type*'],
//             parenttag: item['Parent Tag'] || null,
//               project_id: projectId
//           }))
//           .filter(item => item.tagNumber && item.name && item.type);  // Filter empty rows

//       let successCount = 0;
//       let errorCount = 0;
//       const errors = [];
//       console.log(formattedData)

//       // Loop through each tag and register them individually
//       for (const tagData of formattedData) {
//         // Skip rows with empty required fields
//         if (!tagData.tagNumber.trim() || !tagData.type.trim()) {
//           errorCount++;
//           errors.push(`Skipped row: Tag Number and Type are required`);
//           continue;
//         }

//         try {
//           const response = await RegisterTag(tagData);
//           if (response.status === 201) {
//             successCount++;
//           } else {
//             errorCount++;
//             errors.push(`Failed to register tag: ${tagData.tagNumber}`);
//           }
//         } catch (error) {
//           console.error(`Failed to register tag: ${tagData.tagNumber}`, error);
//           errorCount++;
//           const errorMsg = error.response?.data?.message || 
//                           error.response?.data?.error || 
//                           `Failed to register tag: ${tagData.tagNumber}`;
//           errors.push(errorMsg);
//         }
//       }

//       // Show detailed results
//       if (errorCount === 0) {
//         setModalMessage(`Successfully imported ${successCount} tags`);
//       } else if (successCount === 0) {
//         setModalMessage(`Import failed. ${errorCount} errors occurred.`);
//       } else {
//         setModalMessage(
//           `Imported ${successCount} tags successfully. ${errorCount} failed. Check console for details.`
//         );
//         if (errors.length > 0) {
//           console.log("Import errors:", errors);
//         }
//       }

//       setCustomAlert(true);
//       GetTags(); // Refresh the table
//       handleClose();

//     } catch (error) {
//       console.error("Failed to process Excel file:", error);
//       setModalMessage("Failed to process Excel file. Please check the format.");
//       setCustomAlert(true);
//     }
//   };
  
//   reader.readAsArrayBuffer(selectedFile);
// };


//   return (
//     <div
//       style={{
//         width: "100%",
//         height: "100vh",
//         backgroundColor: "white",
//         zIndex: "1",
//         position: "absolute",
//       }}
//     >
//       <div className="table-container">
        
//         <table className="tagTable">
//           <thead>
//             <tr>
//               <th>#</th>
//               <th className="mediumHead">
//                 <input
//                   type="checkbox"
//                   onChange={handleSelectAllCheckbox}
//                   checked={
//                     filteredTags.length > 0 &&
//                     filteredTags.every((tag) =>
//                       selectedTagIds.includes(tag.tagId)
//                     )
//                   }
//                 />
//               </th>
//               <th>Tag number</th>
//               <th>Name</th>
//               <th>Type</th>
//               <th>Parent tag</th>
//               <th>Model</th>
//               <th>
//                 <FontAwesomeIcon
//                   icon={faDownload}
//                   className="me-2"
//                   title="Export"
//                   onClick={handleExportTag}
//                 />
//                 <FontAwesomeIcon
//                   icon={faUpload}
//                   className="me-2"
//                   title="Import"
//                   onClick={handleImportTag}
//                 />
//                 <FontAwesomeIcon  onClick={handleMultipleDelete}
//   icon={faTrash}
//   title="Delete all" />
//               </th>
//             </tr>
//             <tr>
//               <th colSpan="8">
//                 <input
//                   type="text"
//                   placeholder="Search by Tag Number or Type"
//                   className="form-control w-100 bg-white"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                 />
//               </th>
//             </tr>
//           </thead>
//           <tbody >
//             {filteredTags.length > 0 ? (
//               filteredTags.map((tag, index) => (
//                 <tr
//                   key={tag.tagId}
//                   onMouseEnter={() => setHoveredRow(index)}
//                   onMouseLeave={() => setHoveredRow(null)}
//                   style={{ position: "relative", color: "black" }}
//                 >
//                   <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
//                   <td >
//                     <input
//                       type="checkbox"
//                       checked={selectedTagIds.includes(tag.tagId)}
//                       onChange={(e) =>
//                         handleTagCheckboxChange(tag.tagId, e.target.checked)
//                       }
//                     />
//                   </td>
//                   <td>
                
//                     {  tag.number}
//                   </td>
//                   <td>
//                     {editingId === tag.tagId ? (
//                       <input
//                         type="text"
//                         name="name"
//                         value={editData.name || ""}
//                         onChange={handleChange}
//                         className="form-control bg-white text-black"
//                       />
//                     ) : (
//                       <span
//                         style={{ cursor: "pointer", color: "#4d5dbe" }}
//                         onClick={(e) => handleTagNameClick(tag.tagId, e)}
//                       >
//                         {tag.name}
//                       </span>
//                     )}
//                   </td>
//                   <td>
//                     {editingId === tag.tagId ? (
//                       <select
//                         name="type"
//                         value={editData.type || ""}
//                         onChange={handleChange}
//                         className="form-control bg-white text-black"
//                       >
//                         <option value="Line">Line</option>
//                         <option value="Equipment">Equipment</option>
//                         <option value="Valve">Valve</option>
//                         <option value="Structural">Structural</option>
//                         <option value="Other">Other</option>
//                       </select>
//                     ) : (
//                       tag.type
//                     )}
//                   </td>
//                   <td>
//                     {editingId === tag.tagId ? (
//                       <select
//                         name="parentTag"
//                         value={editData.parentTag || ""}
//                         onChange={handleChange}
//                         className="form-control bg-white text-black"
//                       >
//                         <option value="">None</option>
//                         {parentTagOptions.map((parent, i) => (
//                           <option key={i} value={parent}>
//                             {parent}
//                           </option>
//                         ))}
//                       </select>
//                     ) : (
//                       tag.parentTag || "-"
//                     )}
//                   </td>
//                   <td>
//                     {editingId === tag.tagId ? (
//                       <input
//                         type="file"
//                         onChange={handleFileChange}
//                         className="form-control bg-white text-black"
//                       />
//                     ) : (
//                       tag.filename || "-"
//                     )}
//                   </td>
//                   <td
//                     style={{ backgroundColor: "#f0f0f0" }}
//                     className="text-center"
//                   >
//                     {editingId === tag.tagId ? (
//                       <>
//                         <FontAwesomeIcon
//                           icon={faSave}
//                           className="text-success me-3"
//                           onClick={() => handleSave(tag.tagId)}
//                           title="Save"
//                         />
//                         <FontAwesomeIcon
//                           icon={faTimes}
//                           className="text-danger"
//                           onClick={handleCancel}
//                           title="Cancel"
//                         />
//                       </>
//                     ) : (
//                       <>
//                         <FontAwesomeIcon
//                           icon={faEdit}
//                           className="me-3"
//                           onClick={() => handleEdit(tag)}
//                           title="Edit"
//                         />
//                         <FontAwesomeIcon
//                           icon={faTrash}
//                           onClick={() => handleDelete(tag.tagId)}
//                           title="Delete"
//                         />
//                       </>
//                     )}
//                   </td>

//                   {hoveredRow === index && (
//                     <div
//                       className="tooltip"
//                       style={{
//                         position: "absolute",
//                         top: "100%",
//                         left: "50%",
//                         transform: "translateX(-50%)",
//                         backgroundColor: "#333",
//                         color: "#fff",
//                         padding: "5px 10px",
//                         borderRadius: "4px",
//                         fontSize: "12px",
//                         whiteSpace: "nowrap",
//                         zIndex: 2000,
//                         pointerEvents: "none",
//                       }}
//                     >
//                       Click tag name to view assigned documents
//                     </div>
//                   )}
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td colSpan="8" className="text-center text-muted py-3" style={{backgroundColor:'white'}}>
//                   {searchTerm ? "No matching tags found" : "No Tags available..."}<span style={{cursor:'pointer',color:'blue',fontWeight:'bold'}} onClick={() => setLoaded(true)}>Load tags</span>
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>

//         {popupData.visible && (
//           <div
//             className="document-popup"
//             style={{
//               position: "fixed",
//               left: popupData.x,
//               top: popupData.y,
//               backgroundColor: "#ffffff",
//               border: "1px solid #d1d5db",
//               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
//               padding: "16px",
//               borderRadius: "8px",
//               zIndex: 1000,
//               maxWidth: "480px",
//               minWidth: "300px",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div
//               className="popup-header"
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//               }}
//             >
//               <h6
//                 style={{
//                   margin: 0,
//                   fontSize: "16px",
//                   fontWeight: "600",
//                   color: "#1f2937",
//                 }}
//               >
//                 Documents for Tag
//               </h6>
//               <button
//                 onClick={() =>
//                   setPopupData({
//                     visible: false,
//                     tagId: null,
//                     documents: [],
//                     x: 0,
//                     y: 0,
//                   })
//                 }
//                 className="popup-close"
//                 title="Close"
//               >
//                 <FontAwesomeIcon icon={faXmark} />
//               </button>
//             </div>

//             <hr style={{ margin: "12px 0", borderColor: "#e5e7eb" }} />

//             {popupData.documents.length > 0 ? (
//               <ul
//                 className="document-list"
//                 style={{ listStyle: "none", padding: 0, margin: 0 }}
//               >
//                 {popupData.documents.map((doc) => (
//                   <li
//                     key={doc.documentId}
//                     onClick={() =>
//                       handleDocumentClick(doc.documentId, popupData.tagId)
//                     }
//                     className="document-item"
//                   >
//                     <div
//                       style={{
//                         display: "flex",
//                         justifyContent: "space-between",
//                         alignItems: "center",
//                       }}
//                     >
//                       <span className="document-number">{doc.number}</span>
//                       <span className="document-title">{doc.title}</span>
//                     </div>
//                   </li>
//                 ))}
//               </ul>
//             ) : (
//               <p className="no-documents">No documents found</p>
//             )}
//           </div>
//         )}
//           {importTag &&
//         <Modal
//           onHide={handleClose}
//           show={importTag}
//           backdrop="static"
//           keyboard={false}
//           dialogClassName="custom-modal"
//         >
//           <div className="tag-dialog">
//             <div className="title-dialog">
//               <p className='text-light'>Import Tag</p>
//               <p className='text-light cross' onClick={handleClose}>&times;</p>
//             </div>
//             <div className="dialog-input">
//               <label>File</label>
//               <input
//                 type="file" onChange={handleExcelFileChange} />
//               <a onClick={handleDownloadTemplate} style={{ cursor: 'pointer', color: ' #00BFFF' }}>Download template</a>
//             </div>
//             <div className='dialog-button' style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', bottom: 0 }}>
//               <button className='btn btn-secondary' onClick={handleClose}>Cancel</button>
//               <button className='btn btn-dark' onClick={handleImportClick}>Upload</button>
//             </div>
//           </div>
//         </Modal>
//       }

//         {customAlert && (
//           <Alert
//             message={modalMessage}
//             onAlertClose={() => setCustomAlert(false)}
//           />
//         )}

//         {showConfirm && (
//           <DeleteConfirm
//             message="Are you sure you want to delete this tag?"
//             onConfirm={handleConfirmDelete}
//             onCancel={handleCancelDelete}
//           />
//         )}
//       </div>
//     </div>
//   );
// };

// export default Tagreview;

import {
  faDownload,
  faTrash,
  faUpload,
  faEdit,
  faSave,
  faTimes,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteTag,
  getdocumentsbyTags,
  GetTagDetails,
  updateTags,
  RegisterTag
} from "../services/TagApi";
import {
  TreeresponseContext,
  updateProjectContext,
} from "../context/ContextShare";
import { Modal } from "react-bootstrap";
import Alert from "../components/Alert";
import DeleteConfirm from "../components/DeleteConfirm";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const Tagreview = () => {
  const { updateProject } = useContext(updateProjectContext);
  const { setUpdatetree } = useContext(TreeresponseContext);

  const [tags, setTags] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [popupData, setPopupData] = useState({
    visible: false,
    tagId: null,
    documents: [],
    x: 0,
    y: 0,
  });
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const navigate = useNavigate();
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [importTag, setImportTag] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const GetTags = async () => {
    const response = await GetTagDetails(projectId);
    if (response.status === 200) {
      const mappedTags = response.data.map((tag) => ({
        ...tag,
        parentTag: tag.parenttag,
        area: tag.area || "-",
        discipline: tag.discipline || "-",
        system: tag.system || "-"
      }));
      setTags(mappedTags);
      const parents = [
        ...new Set(mappedTags.map((tag) => tag.number).filter(Boolean)),
      ];
      setParentTagOptions(parents);
    }
  };

  const handleEdit = (tag) => {
    setEditingId(tag.tagId);
    setEditData({
      ...tag,
      parentTag: tag.parentTag || "",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (tagId) => {
    try {
      const payload = {
        ...editData,
        parenttag: editData.parentTag,
      };
      const response = await updateTags(tagId, projectId, payload);
      if (response.status === 200) {
        setModalMessage("The Tag is updated Successfully");
        setCustomAlert(true);
        setUpdatetree(Date.now());
        GetTags();
      }
      setEditingId(null);
    } catch (error) {
      console.error("Error updating tag:", error);
      setModalMessage("Error updating tag");
      setCustomAlert(true);
    }
  };

  const handleDelete = async (tagId) => {
    setTagToDelete(tagId);
    setShowConfirm(true);
  };

  const handleMultipleDelete = () => {
    if (selectedTagIds.length === 0) {
      setModalMessage("No tags selected for deletion");
      setCustomAlert(true);
      return;
    }
    setTagToDelete([...selectedTagIds]);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const tagIds = Array.isArray(tagToDelete) ? tagToDelete : [tagToDelete];

      for (const id of tagIds) {
        const response = await deleteTag(id);
        if (response.status !== 200) {
          throw new Error(`Failed to delete tag ${id}`);
        }
      }

      setModalMessage(
        tagIds.length > 1
          ? "Tags deleted successfully"
          : "Tag deleted successfully"
      );
      setCustomAlert(true);
      setUpdatetree(Date.now());
      GetTags();
    } catch (error) {
      console.error("Error deleting tags:", error);
      setModalMessage("Error deleting tag(s)");
      setCustomAlert(true);
    }

    setShowConfirm(false);
    setTagToDelete(null);
    setSelectedTagIds([]);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setTagToDelete(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setEditData((prev) => ({ ...prev, modelFile: e.target.files[0] }));
  };

  const handleTagNameClick = async (tagId, event) => {
    try {
      const response = await getdocumentsbyTags(tagId);
      if (response.status === 200 && response.data.length > 0) {
        setPopupData({
          visible: true,
          tagId,
          documents: response.data,
          x: event.clientX,
          y: event.clientY,
        });
      } else {
        setPopupData({
          visible: false,
          tagId: null,
          documents: [],
          x: 0,
          y: 0,
        });
        setModalMessage("No documents assigned to this tag");
        setCustomAlert(true);
      }
    } catch (error) {
      console.error("Error fetching documents for tag:", error);
      setModalMessage("Failed to fetch documents");
      setCustomAlert(true);
    }
  };

  const handleDocumentClick = (documentId, tagId) => {
    navigate(`/canvas/${documentId}?tagId=${tagId}`);
    setPopupData({ visible: false, tagId: null, documents: [], x: 0, y: 0 });
  };

  const filteredTags = tags.filter(
    (tag) =>
      tag.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.discipline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.system.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAllCheckbox = (e) => {
    if (e.target.checked) {
      setSelectedTagIds(filteredTags.map((tag) => tag.tagId));
    } else {
      setSelectedTagIds([]);
    }
  };

  const handleTagCheckboxChange = (tagId, isChecked) => {
    if (isChecked) {
      setSelectedTagIds((prev) => [...prev, tagId]);
    } else {
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    }
  };

  useEffect(() => {
    if (loaded) GetTags();
  }, [updateProject, loaded]);

  const handleExportTag = () => {
    const headers = [
      { label: 'Tag Number*', key: 'number' },
      { label: 'Name', key: 'name' },
      { label: 'Type*', key: 'type' },
      { label: 'Parent Tag', key: 'parenttag' },
      { label: 'Area', key: 'area' },
      { label: 'Discipline', key: 'discipline' },
      { label: 'System', key: 'system' },
      { label: 'Model', key: 'filename' }
    ];

    const dataToExport = filteredTags.length > 0 ? filteredTags : [];

    const exportData = dataToExport.map(tag => ({
      number: tag.number,
      name: tag.name,
      type: tag.type,
      parenttag: tag.parenttag,
      area: tag.area,
      discipline: tag.discipline,
      system: tag.system,
      filename: tag.filename
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.label)], { origin: "A1" });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tag List');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Taglist.xlsx');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      { label: 'TagNumber*', key: 'number' },
      { label: 'Name', key: 'name' },
      { label: 'Type*', key: 'type' },
      { label: 'Parent Tag', key: 'parenttag' },
      { label: 'Area', key: 'area' },
      { label: 'AreaName', key: 'areaName' },
      { label: 'Discipline', key: 'discipline' },
      { label: 'DisciplineName', key: 'disciplineName' },
      { label: 'System', key: 'system' },
      { label: 'SystemName', key: 'systemName' },
      { label: 'Possible Values for Type', key: '' }
    ];

    const data = [
      { number: "", name: "", type: "", parenttag: "", area: "", areaName: "", discipline: "", disciplineName: "", system: "", systemName: "" }
    ];

    const ws = XLSX.utils.json_to_sheet(data, { header: headers.map(h => h.key) });
    XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.label)], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, [
      ["", "", "", "", "", "", "", "", "", "", "Line"],
      ["", "", "", "", "", "", "", "", "", "", "Equipment"],
      ["", "", "", "", "", "", "", "", "", "", "Valve"],
      ["", "", "", "", "", "", "", "", "", "", "Structural"],
      ["", "", "", "", "", "", "", "", "", "", "Other"]
    ], { origin: -1 });

    ws['!cols'] = [
      { wch: 15 },  // TagNumber
      { wch: 20 },  // Name
      { wch: 15 },  // Type
      { wch: 20 },  // Parent Tag
      { wch: 15 },  // Area
      { wch: 20 },  // AreaName
      { wch: 15 },  // Discipline
      { wch: 20 },  // DisciplineName
      { wch: 15 },  // System
      { wch: 20 },  // SystemName
      { wch: 30 }   // Possible Values
    ];

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ c: 10, r: R });
      if (!ws[cellAddress]) ws[cellAddress] = {};
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: "FFFF00" } }
      };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tag-Import-Template');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Tag-Import-Template.xlsx');
  };

  const handleImportTag = () => {
    setImportTag(true);
  }

  const handleClose = () => {
    setImportTag(false);
  }

  const handleExcelFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  }

  // const handleImportClick = async () => {
  //   if (!selectedFile) {
  //     setModalMessage("Please select a file to import.");
  //     setCustomAlert(true);
  //     return;
  //   }

  //   const reader = new FileReader();
  //   reader.onload = async (e) => {
  //     try {
  //       const data = new Uint8Array(e.target.result);
  //       const workbook = XLSX.read(data, { type: "array" });
  //       const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  //       const jsonData = XLSX.utils.sheet_to_json(worksheet);

  //       const formattedData = jsonData
  //         .map(item => ({
  //           tagNumber: item['TagNumber*'],
  //           name: item['Name'],
  //           type: item['Type*'],
  //           parenttag: item['Parent Tag'] || null,
  //           area: item['Area'] || null,
  //           areaName: item['AreaName'] || null,
  //           discipline: item['Discipline'] || null,
  //           disciplineName: item['DisciplineName'] || null,
  //           system: item['System'] || null,
  //           systemName: item['SystemName'] || null,
  //           project_id: projectId
  //         }))
  //         .filter(item => item.tagNumber && item.name && item.type);

  //       if (formattedData.length === 0) {
  //         setModalMessage("No valid data found in the Excel file.");
  //         setCustomAlert(true);
  //         return;
  //       }

  //       try {
  //         const response = await RegisterTag(formattedData);
          
  //         if (response.success) {
  //           const { results } = response;
  //           let message = `Successfully imported ${results.created} tags`;
            
  //           if (results.hierarchyStats.areasCreated > 0 || 
  //               results.hierarchyStats.disciplinesCreated > 0 || 
  //               results.hierarchyStats.systemsCreated > 0) {
  //             message += `\nHierarchy created: ${results.hierarchyStats.areasCreated} areas, ${results.hierarchyStats.disciplinesCreated} disciplines, ${results.hierarchyStats.systemsCreated} systems`;
  //           }
            
  //           if (results.errors.length > 0) {
  //             message += `\n${results.errors.length} errors occurred. Check console for details.`;
  //             console.log("Import errors:", results.errors);
  //           }
            
  //           setModalMessage(message);
  //         } else {
  //           setModalMessage("Import failed. Please check the file format and try again.");
  //         }
  //       } catch (error) {
  //         console.error("Import error:", error);
  //         setModalMessage("Import failed. Please check the file format and try again.");
  //       }

  //       setCustomAlert(true);
  //       GetTags();
  //       handleClose();

  //     } catch (error) {
  //       console.error("Failed to process Excel file:", error);
  //       setModalMessage("Failed to process Excel file. Please check the format.");
  //       setCustomAlert(true);
  //     }
  //   };

  //   reader.readAsArrayBuffer(selectedFile);
  // };

   const handleImportClick = async () => {
    if (!selectedFile) {
      setModalMessage("Please select a file to import.");
      setCustomAlert(true);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Filter out rows with empty tagNumber, name, or type
        const formattedData = jsonData
          .map(item => ({
            tagNumber: item['TagNumber*'],
            name: item['Name'],
            type: item['Type*'],
            parentTag: item['Parent Tag'] || null,
            area: item['Area'] || null,
            areaName: item['AreaName'] || null,
            discipline: item['Discipline'] || null,
            disciplineName: item['DisciplineName'] || null,
            system: item['System'] || null,
            systemName: item['SystemName'] || null,
            project_id: projectId
          }))
          .filter(item => item.tagNumber && item.name && item.type);  // Filter empty rows

        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        const hierarchyStats = {
          areasCreated: 0,
          disciplinesCreated: 0,
          systemsCreated: 0
        };

        console.log("Processing", formattedData.length, "tags with hierarchy");

        // Loop through each tag and register them individually
        for (const tagData of formattedData) {
          // Skip rows with empty required fields
          if (!tagData.tagNumber || !tagData.type) {
            errorCount++;
            errors.push(`Skipped row: Tag Number and Type are required`);
            continue;
          }

          try {
            const response = await RegisterTag(tagData);
            
            if (response.status===201) {
             console.log(response.status);
            } else {
              console.error(`❌ Failed to create tag: ${tagData.tagNumber}`);
            }
          } catch (error) {
            console.error(`❌ Failed to register tag: ${tagData.tagNumber}`, error);
           
          }
        }

        setModalMessage("Completed");
        setCustomAlert(true);
        GetTags(); // Refresh the table
        handleClose();

      } catch (error) {
        console.error("Failed to process Excel file:", error);
        setModalMessage("Failed to process Excel file. Please check the format.");
        setCustomAlert(true);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
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
        <table className="tagTable">
          <thead>
            <tr>
              <th>#</th>
              <th className="mediumHead">
                <input
                  type="checkbox"
                  onChange={handleSelectAllCheckbox}
                  checked={
                    filteredTags.length > 0 &&
                    filteredTags.every((tag) =>
                      selectedTagIds.includes(tag.tagId)
                    )
                  }
                />
              </th>
              <th>Tag number</th>
              <th>Name</th>
              <th>Type</th>
              <th>Parent tag</th>
              <th>Area</th>
              <th>Discipline</th>
              <th>System</th>
              <th>Model</th>
              <th>
                <FontAwesomeIcon
                  icon={faDownload}
                  className="me-2"
                  title="Export"
                  onClick={handleExportTag}
                />
                <FontAwesomeIcon
                  icon={faUpload}
                  className="me-2"
                  title="Import"
                  onClick={handleImportTag}
                />
                <FontAwesomeIcon  
                  onClick={handleMultipleDelete}
                  icon={faTrash}
                  title="Delete all" 
                />
              </th>
            </tr>
            <tr>
              <th colSpan="11">
                <input
                  type="text"
                  placeholder="Search by Tag Number, Type, Area, Discipline, or System"
                  className="form-control w-100 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTags.length > 0 ? (
              filteredTags.map((tag, index) => (
                <tr
                  key={tag.tagId}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: "relative", color: "black" }}
                >
                  <td style={{ backgroundColor: "#f0f0f0" }}>{index + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.tagId)}
                      onChange={(e) =>
                        handleTagCheckboxChange(tag.tagId, e.target.checked)
                      }
                    />
                  </td>
                  <td>{tag.number}</td>
                  <td>
                    {editingId === tag.tagId ? (
                      <input
                        type="text"
                        name="name"
                        value={editData.name || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      <span
                        style={{ cursor: "pointer", color: "#4d5dbe" }}
                        onClick={(e) => handleTagNameClick(tag.tagId, e)}
                      >
                        {tag.name}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <select
                        name="type"
                        value={editData.type || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      >
                        <option value="Line">Line</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Valve">Valve</option>
                        <option value="Structural">Structural</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      tag.type
                    )}
                  </td>
                  <td>
                    {editingId === tag.tagId ? (
                      <select
                        name="parentTag"
                        value={editData.parentTag || ""}
                        onChange={handleChange}
                        className="form-control bg-white text-black"
                      >
                        <option value="">None</option>
                        {parentTagOptions.map((parent, i) => (
                          <option key={i} value={parent}>
                            {parent}
                          </option>
                        ))}
                      </select>
                    ) : (
                      tag.parentTag || "-"
                    )}
                  </td>
                  <td>{tag.area}</td>
                  <td>{tag.discipline}</td>
                  <td>{tag.system}</td>
                  <td>
                    {editingId === tag.tagId ? (
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="form-control bg-white text-black"
                      />
                    ) : (
                      tag.filename || "-"
                    )}
                  </td>
                  <td
                    style={{ backgroundColor: "#f0f0f0" }}
                    className="text-center"
                  >
                    {editingId === tag.tagId ? (
                      <>
                        <FontAwesomeIcon
                          icon={faSave}
                          className="text-success me-3"
                          onClick={() => handleSave(tag.tagId)}
                          title="Save"
                        />
                        <FontAwesomeIcon
                          icon={faTimes}
                          className="text-danger"
                          onClick={handleCancel}
                          title="Cancel"
                        />
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faEdit}
                          className="me-3"
                          onClick={() => handleEdit(tag)}
                          title="Edit"
                        />
                        <FontAwesomeIcon
                          icon={faTrash}
                          onClick={() => handleDelete(tag.tagId)}
                          title="Delete"
                        />
                      </>
                    )}
                  </td>

                  {hoveredRow === index && (
                    <div
                      className="tooltip"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#333",
                        color: "#fff",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        zIndex: 2000,
                        pointerEvents: "none",
                      }}
                    >
                      Click tag name to view assigned documents
                    </div>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" className="text-center text-muted py-3" style={{backgroundColor:'white'}}>
                  {searchTerm ? "No matching tags found" : "No Tags available..."}<span style={{cursor:'pointer',color:'blue',fontWeight:'bold'}} onClick={() => setLoaded(true)}>Load tags</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {popupData.visible && (
          <div
            className="document-popup"
            style={{
              position: "fixed",
              left: popupData.x,
              top: popupData.y,
              backgroundColor: "#ffffff",
              border: "1px solid #d1d5db",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              padding: "16px",
              borderRadius: "8px",
              zIndex: 1000,
              maxWidth: "480px",
              minWidth: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="popup-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h6
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                Documents for Tag
              </h6>
              <button
                onClick={() =>
                  setPopupData({
                    visible: false,
                    tagId: null,
                    documents: [],
                    x: 0,
                    y: 0,
                  })
                }
                className="popup-close"
                title="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <hr style={{ margin: "12px 0", borderColor: "#e5e7eb" }} />

            {popupData.documents.length > 0 ? (
              <ul
                className="document-list"
                style={{ listStyle: "none", padding: 0, margin: 0 }}
              >
                {popupData.documents.map((doc) => (
                  <li
                    key={doc.documentId}
                    onClick={() =>
                      handleDocumentClick(doc.documentId, popupData.tagId)
                    }
                    className="document-item"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span className="document-number">{doc.number}</span>
                      <span className="document-title">{doc.title}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-documents">No documents found</p>
            )}
          </div>
        )}
        
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
                <p className='text-light'>Import Tag</p>
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
            message="Are you sure you want to delete this tag?"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        )}
      </div>
    </div>
  );
};

export default Tagreview;
