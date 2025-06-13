import React, { useContext, useEffect, useState } from 'react';
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
  deleteAllSystems
} from '../services/TreeManagementApi';
import '../styles/TreeReview.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { faEdit, faSave } from '@fortawesome/free-regular-svg-icons';
import { TreeresponseContext } from '../context/ContextShare';

function TreeReview(updatetree) {
 const { updateTree } = useContext(TreeresponseContext);


  const [areaData, setAreaData] = useState([]);
  const [discData, setDiscData] = useState([]);
  const [sysData, setSysData] = useState([]);

  const [editedRowIndex, setEditedRowIndex] = useState({ type: '', index: -1 });
  const [editedLineData, setEditedLineData] = useState({});

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

  const fetchData = async () => {
    try {
      const [areaRes, discRes, sysRes] = await Promise.all([
        getArea(projectId),
        getDisipline(projectId), 
        getSystem(projectId)
      ]);
      setAreaData(areaRes.data.area || []);
      setDiscData(discRes.data.disipline || []); // Fixed typo: disipline -> discipline
      setSysData(sysRes.data.system || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId,updateTree]);

  const startEdit = (type, index, row) => {
    setEditedRowIndex({ type, index });
    setEditedLineData({ ...row });
  };

  const cancelEdit = () => {
    setEditedRowIndex({ type: '', index: -1 });
    setEditedLineData({});
  };

  const handleChange = (field, value) => {
    setEditedLineData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (type) => {
    try {
      switch(type) {
        case 'area':
          await updateArea(editedLineData);
          break;
        case 'discipline':
          await updateDiscipline(editedLineData);
          break;
        case 'system':
          await updateSystem(editedLineData);
          break;
        default:
          return;
      }
      cancelEdit();
      fetchData();
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      switch(type) {
        case 'area':
          await deleteArea(id);
          break;
        case 'discipline':
          await deleteDiscipline(id);
          break;
        case 'system':
          await deleteSystem(id);
          break;
        default:
          return;
      }
      fetchData();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleDeleteAll = async (type) => {
    try {
      switch(type) {
        case 'area':
          await deleteAllAreas();
          break;
        case 'discipline':
          await deleteAllDisciplines();
          break;
        case 'system':
          await deleteAllSystems();
          break;
        default:
          return;
      }
      fetchData();
    } catch (error) {
      console.error("Delete all failed:", error);
    }
  };

  const renderTable = (data, type, codeKey, nameKey, idKey) => (
    <div className="table-wrapper">
      <div className="table-header">
        <h4 className="table-title">{type.toUpperCase()} Table</h4>
      
      </div>
      <table className="styled-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>
              <div className='d-flex justify-content-between'>
                <p  style={{marginLeft:"140px" }}  >Actions</p>
                <button
          className="delete-all-btn"
          onClick={() => handleDeleteAll(type)}
          title={`Delete all ${type}s`}
        >
          <FontAwesomeIcon className='text-white' icon={faTrash} />
        </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row[idKey]}>
              <td>
                {editedRowIndex.type === type && editedRowIndex.index === index ? (
                  <input
                    value={editedLineData[codeKey] || ''}
                    onChange={(e) => handleChange(codeKey, e.target.value)}
                  />
                ) : row[codeKey]}
              </td>
              <td>
                {editedRowIndex.type === type && editedRowIndex.index === index ? (
                  <input
                    value={editedLineData[nameKey] || ''}
                    onChange={(e) => handleChange(nameKey, e.target.value)}
                  />
                ) : row[nameKey]}
              </td>
              <td>
                {editedRowIndex.type === type && editedRowIndex.index === index ? (
                  <>
                    <button className="save-btn" onClick={() => handleSave(type)}>
                      <FontAwesomeIcon icon={faSave} />
                    </button>
                    <button className="cancel-btn" onClick={cancelEdit}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="edit-btn" onClick={() => startEdit(type, index, row)}>
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(type, row[idKey])}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="tree-review-container">
      {renderTable(areaData, 'area', 'area', 'name', 'areaId')} {/* Fixed: AreaId -> areaId */}
      {renderTable(discData, 'discipline', 'disc', 'name', 'discId')}
      {renderTable(sysData, 'system', 'sys', 'name', 'sysId')}
    </div>
  );
}

export default TreeReview;