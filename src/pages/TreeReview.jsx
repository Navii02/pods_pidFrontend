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
import { TreeresponseContext, updateProjectContext } from '../context/ContextShare';
import DeleteConfirm from '../components/DeleteConfirm';
import Alert from '../components/Alert';

function TreeReview(updatetree) {
 const { updateTree } = useContext(TreeresponseContext);
 const {updateProject} = useContext(updateProjectContext)


  const [areaData, setAreaData] = useState([]);
  const [discData, setDiscData] = useState([]);
  const [sysData, setSysData] = useState([]);
  //console.log(areaData,discData,sysData);
  

  const [editedRowIndex, setEditedRowIndex] = useState({ type: '', index: -1 });

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
  const projectId = project?.projectId;

    const [currentDeleteTag, setCurrentDeleteTag] = useState('');
  const [currentDeleteType, setCurrentDeleteType] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [editedAreaRowIndex, setEditedAreaRowIndex] = useState(-1);
  const [editedDiscRowIndex, setEditedDiscRowIndex] = useState(-1);
  const [editedSysRowIndex, setEditedSysRowIndex] = useState(-1);
  const [editedLineData, setEditedLineData] = useState({});
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const handleDeleteTagFromTable = (number, type) => {
    setCurrentDeleteTag(number);
    setCurrentDeleteType(type);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (currentDeleteType === 'area') {
    } else if (currentDeleteType === 'disc') {
    } else if (currentDeleteType === 'sys') {
    }
    setShowConfirm(false);
    setCurrentDeleteTag('');
    setCurrentDeleteType('');
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
    setCurrentDeleteTag('');
    setCurrentDeleteType('');
  };

  const handleEditOpen = (index, type) => {
    setEditedLineData({});
    if (type === 'area') {
      setEditedAreaRowIndex(index);
      setEditedDiscRowIndex(-1);
      setEditedSysRowIndex(-1);
      setEditedLineData({ ...areaData[index], oldArea: areaData[index].area });
    } else if (type === 'disc') {
      setEditedDiscRowIndex(index);
      setEditedAreaRowIndex(-1);
      setEditedSysRowIndex(-1);
      setEditedLineData({ ...discData[index], oldDisc: discData[index].disc });
    } else if (type === 'sys') {
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
        getSystem(projectId)
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
  }, [projectId,updateTree,updateProject]);

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
      console.log(id);
      
      switch(type) {
        case 'area':
          console.log(id);
          
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
            <th className="actions-header">
              <div className="actions-header-content">
                <span>Actions</span>
                <button
                  className="delete-all-btn"
                  onClick={() => handleDeleteAll(type)}
                  title={`Delete all ${type}s`}
                >
                  <FontAwesomeIcon icon={faTrash} />
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
              <td className="actions-cell">
                <div className="action-buttons">
                  {editedRowIndex.type === type && editedRowIndex.index === index ? (
                    <>
                      <button 
                        className="icon-btn save-btn" 
                        onClick={() => handleSave(type)}
                        title="Save"
                      >
                        <FontAwesomeIcon icon={faSave} />
                      </button>
                      <button 
                        className="icon-btn cancel-btn" 
                        onClick={cancelEdit}
                        title="Cancel"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="icon-btn edit-btn" 
                        onClick={() => startEdit(type, index, row)}
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button 
                        className="icon-btn delete-btn" 
                        onClick={() => handleDelete(type, row[idKey])}
                        title="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    // <div className="tree-review-container">
    //   {renderTable(areaData, 'area', 'area', 'name', 'AreaId')}
    //   {renderTable(discData, 'discipline', 'disc', 'name', 'discId')}
    //   {renderTable(sysData, 'system', 'sys', 'name', 'sysId')}
    // </div>

        <div style={{ width: '100%', height: '90vh', backgroundColor: 'white', zIndex: '1', position: 'absolute' }}>
      <form>
        <div className="table-container">
          <h4 className='text-center'>Area table</h4>
          <table className='tagTable'>
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="tableActionCell">
                  <i className="fa-solid fa-trash-can ms-3" title='Delete all' onClick={()=>{handleDeleteAll('area')}}></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {areaData.map((tag, index) => (
                <tr key={tag.areaId} style={{ color: 'black' }}>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedAreaRowIndex === index ? (
                      <input
                        onChange={e => handleChange('area', e.target.value)}
                        type="text"
                        value={editedLineData.area || ''}
                      />
                    ) : (
                      tag.area
                    )}
                  </td>
                  <td>
                    {editedAreaRowIndex === index ? (
                      <input
                        onChange={e => handleChange('name', e.target.value)}
                        type="text"
                        value={editedLineData.name || ''}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedAreaRowIndex === index ? (
                      <>
                        <i className="fa-solid fa-floppy-disk text-success" onClick={() => handleSave('area', tag.areaId)}></i>
                        <i className="fa-solid fa-xmark ms-3 text-danger" onClick={handleCloseEdit}></i>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-pencil" onClick={() => handleEditOpen(index, 'area')}></i>
                        <i className="fa-solid fa-trash-can ms-3" onClick={() => handleDeleteTagFromTable(tag.areaId, 'area')}></i>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className='text-center'>Discipline table</h4>
          <table className='tagTable'>
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="tableActionCell">
                  <i className="fa-solid fa-trash-can ms-3" title='Delete all' onClick={()=>{handleDeleteAll('discipline')}}></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {discData.map((tag, index) => (
                <tr key={tag.discId} style={{ color: 'black' }}>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedDiscRowIndex === index ? (
                      <input
                        onChange={e => handleChange('disc', e.target.value)}
                        type="text"
                        value={editedLineData.disc || ''}
                      />
                    ) : (
                      tag.disc
                    )}
                  </td>
                  <td>
                    {editedDiscRowIndex === index ? (
                      <input
                        onChange={e => handleChange('name', e.target.value)}
                        type="text"
                        value={editedLineData.name || ''}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedDiscRowIndex === index ? (
                      <>
                        <i className="fa-solid fa-floppy-disk text-success" onClick={() => handleSave('disc', tag.discId)}></i>
                        <i className="fa-solid fa-xmark ms-3 text-danger" onClick={handleCloseEdit}></i>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-pencil" onClick={() => handleEditOpen(index, 'disc')}></i>
                        <i className="fa-solid fa-trash-can ms-3" onClick={() => handleDeleteTagFromTable(tag.discId, 'disc')}></i>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className='text-center'>System table</h4>
          <table className='tagTable'>
            <thead>
              <tr>
                <th className="wideHead">Code</th>
                <th className="wideHead">Name</th>
                <th className="tableActionCell">
                  <i className="fa-solid fa-trash-can ms-3" title='Delete all'  onClick={()=>{handleDeleteAll('system')}}></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {sysData.map((tag, index) => (
                <tr key={tag.sysId} style={{ color: 'black' }}>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedSysRowIndex === index ? (
                      <input
                        onChange={e => handleChange('sys', e.target.value)}
                        type="text"
                        value={editedLineData.sys || ''}
                      />
                    ) : (
                      tag.sys
                    )}
                  </td>
                  <td>
                    {editedSysRowIndex === index ? (
                      <input
                        onChange={e => handleChange('name', e.target.value)}
                        type="text"
                        value={editedLineData.name || ''}
                      />
                    ) : (
                      tag.name
                    )}
                  </td>
                  <td style={{ backgroundColor: '#f0f0f0' }}>
                    {editedSysRowIndex === index ? (
                      <>
                        <i className="fa-solid fa-floppy-disk text-success" onClick={() => handleSave('sys', tag.sysId)}></i>
                        <i className="fa-solid fa-xmark ms-3 text-danger" onClick={handleCloseEdit}></i>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-pencil" onClick={() => handleEditOpen(index, 'sys')}></i>
                        <i className="fa-solid fa-trash-can ms-3" onClick={() => handleDeleteTagFromTable(tag.sysId, 'sys')}></i>
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
        <Alert
          message={modalMessage}
          onClose={() => setCustomAlert(false)}
        />
      )}
    </div>
  );
}

export default TreeReview;