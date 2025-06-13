import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronUp, faChevronDown, faTrash, faPlus, faEye, faMinus, faFolder, faCube } from "@fortawesome/free-solid-svg-icons";
import EntityRegister from "./EntityRegister";
import TagEntityModal from "../components/Tree/TagEntityModal";
import {
  DeleteEntity,
  getProjectArea,
  getprojectDisipline,
  getprojectsystem,
  getProjectTags // Assuming this API function exists
} from "../services/TreeManagementApi";
import "../styles/ProjectDetails.css";

const ProjectDetails = ({ showProjectDetails, setShowProjectDetails, activeTab }) => {
  const selectedProject = JSON.parse(sessionStorage.getItem("selectedProject"));
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showDisciplineModalFor, setShowDisciplineModalFor] = useState(null);
  const [showSystemModalFor, setShowSystemModalFor] = useState(null);
  const [showTagModalFor, setShowTagModalFor] = useState(null);
  const [areas, setAreas] = useState([]);
  const [expandedArea, setExpandedArea] = useState(null);
  const [disciplinesMap, setDisciplinesMap] = useState({});
  const [systemsMap, setSystemsMap] = useState({});
  const [tagsMap, setTagsMap] = useState({}); // New state for tags
  const [expandedDiscipline, setExpandedDiscipline] = useState(null);
  const [expandedSystem, setExpandedSystem] = useState(null); // New state for expanded systems

  const entityTypes = {
    areas: "Area",
    systems: "System",
    disciplines: "Discipline"
  };
  const currentEntityType = entityTypes[activeTab] || "Area";

  useEffect(() => {
    if (selectedProject?.projectId) {
      fetchAreas();
    }
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await getProjectArea(selectedProject.projectId, { type: "area" });
      if (response.status === 200) {
        setAreas(response.data.area || []);
      }
    } catch (error) {
      console.error("Failed to fetch areas", error);
    }
  };

  const fetchDisciplines = async (areaCode) => {
    try {
      const response = await getprojectDisipline(areaCode, selectedProject.projectId);
      if (response.status === 200) {
        setDisciplinesMap(prev => ({
          ...prev,
          [areaCode]: response.data.disciplines || []
        }));
        setExpandedArea(areaCode);
      }
    } catch (err) {
      console.error("Failed to fetch disciplines", err);
    }
  };

  const fetchSystems = async (area, disc) => {
    try {
      const projectid = selectedProject.projectId;
      const response = await getprojectsystem(projectid, area, disc);
      if (response.status === 200) {
        const key = `${area}_${disc}`;
        setSystemsMap(prev => ({
          ...prev,
          [key]: response.data.systems || []
        }));
        setExpandedDiscipline(key);
      }
    } catch (error) {
      console.error("Failed to fetch systems", error);
    }
  };

  // New function to fetch tags
  const fetchTags = async (area, disc, sys) => {
    try {
      const projectid = selectedProject.projectId;
      const response = await getProjectTags(projectid, area, disc, sys);
      console.log(response.data);
      
      if (response.status === 200) {
        const key = `${area}_${disc}_${sys}`;
        setTagsMap(prev => ({
          ...prev,
          [key]: response.data.tags || []
        }));
        setExpandedSystem(key);
      }
    } catch (error) {
      console.error("Failed to fetch tags", error);
    }
  };

 const handleDelete = async (type, id, code) => {
  const confirm = window.confirm(`Delete ${type}: ${code}? All child entities will be deleted.`);
  if (!confirm) return;
  try {
    let deleteCode = code;

    if (type === "Discipline") {
      deleteCode = `${id}__${code}`;
    } else if (type === "Tag") {
      deleteCode = `${id}__${code}`; 
    }

    const response = await DeleteEntity(type, selectedProject.projectId, deleteCode);
    if (response.status === 200) {
      alert(`${type} and children deleted.`);
      if (type === "Area") fetchAreas();
      else if (type === "Discipline") fetchDisciplines(id);
      else if (type === "System") fetchSystems(id.split('_')[0], id.split('_')[1]);
      else if (type === "Tag") {
        const [area, disc, sys] = id.split('_');
        fetchTags(area, disc, sys); // Refresh tags after deletion
      }
    }
  } catch (error) {
    console.error(`Failed to delete ${type}`, error);
    alert("Deletion failed");
  }
};

  const handleEntityRegisterClose = () => {
    setShowEntityModal(false);
    setShowDisciplineModalFor(null);
    setShowSystemModalFor(null);
    setShowTagModalFor(null);
  };

  const handleEntityRegisterSuccess = () => {
    handleEntityRegisterClose();
    fetchAreas();
  };

  const openDisciplineModal = (area) => setShowDisciplineModalFor(area);
  const openSystemModal = (discipline) => setShowSystemModalFor(discipline);
  const openTagModal = (system) => setShowTagModalFor(system);

  return (
    <div>
      <EntityRegister
        isOpen={showEntityModal || !!showDisciplineModalFor || !!showSystemModalFor}
        onClose={handleEntityRegisterClose}
        onSuccess={handleEntityRegisterSuccess}
        entityType={
          showSystemModalFor ? "System" :
          showDisciplineModalFor ? "Discipline" :
          currentEntityType
        }
        parentEntity={showSystemModalFor || showDisciplineModalFor || selectedProject}
      />

      <TagEntityModal
        showTagModalFor={showTagModalFor}
        setShowTagModalFor={setShowTagModalFor}
        selectedProject={selectedProject}
      />

      <div className="project-toggle-wrapper mt-3">
        {showProjectDetails && (
          <>
            <div className="d-flex w-100 justify-content-between align-items-center selected-project-header mb-4">
              <div>{selectedProject.projectName}</div>
              <button className="add-area-btn" onClick={() => setShowEntityModal(true)}>+</button>
            </div>

            {areas.map((area) => {
              const isExpanded = expandedArea === area.area;
              return (
                <div key={area.area}>
                  <div className="folder-row">
                    <div className="entity-line">
                      <FontAwesomeIcon 
                        icon={isExpanded ? faMinus : faPlus} 
                        onClick={() => isExpanded ? setExpandedArea(null) : fetchDisciplines(area.area)} 
                      />
                      <FontAwesomeIcon icon={faFolder} className="folder-icon" />
                      {area.area} - {area.name}
                    </div>
                    <div className="entity-icons">
                      <button><FontAwesomeIcon icon={faEye} /></button>
                      <button onClick={() => openDisciplineModal(area)}><FontAwesomeIcon icon={faPlus} /></button>
                      <button onClick={() => handleDelete("Area", null, area.area)}><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </div>

                  {isExpanded && disciplinesMap[area.area]?.map((disc) => {
                    const systemKey = `${area.area}_${disc.disc}`;
                    const isDiscExpanded = expandedDiscipline === systemKey;
                    const systems = systemsMap[systemKey] || [];

                    return (
                      <div key={disc.disc} className="folder-indent-1">
                        <div className="disc-row">
                          <div className="entity-line">
                            <FontAwesomeIcon 
                              icon={isDiscExpanded ? faMinus : faPlus} 
                              onClick={() => isDiscExpanded ? setExpandedDiscipline(null) : fetchSystems(area.area, disc.disc)} 
                            />
                            <FontAwesomeIcon icon={faFolder} className="folder-icon" />
                            {disc.disc} - {disc.name}
                          </div>
                          <div className="entity-icons">
                            <button><FontAwesomeIcon icon={faEye} /></button>
                            <button onClick={() => openSystemModal({ ...disc, area: area.area, project_id: selectedProject.projectId })}><FontAwesomeIcon icon={faPlus} /></button>
                            <button onClick={() => handleDelete("Discipline", area.area, disc.disc)}><FontAwesomeIcon icon={faTrash} /></button>
                          </div>
                        </div>

                        {isDiscExpanded && systems.map((sys) => {
                          const tagKey = `${area.area}_${disc.disc}_${sys.sys}`;
                          const isSysExpanded = expandedSystem === tagKey;
                          const tags = tagsMap[tagKey] || [];

                          return (
                            <div key={sys.sys} className="folder-indent-2">
                              <div className="sys-row">
                                <div className="entity-line">
                                  <FontAwesomeIcon 
                                    icon={isSysExpanded ? faMinus : faPlus} 
                                    onClick={() => isSysExpanded ? setExpandedSystem(null) : fetchTags(area.area, disc.disc, sys.sys)} 
                                  />
                                  <FontAwesomeIcon icon={faFolder} className="folder-icon" />
                                  {sys.sys} - {sys.name}
                                </div>
                                <div className="entity-icons">
                                  <button><FontAwesomeIcon icon={faEye} /></button>
                                  <button onClick={() => openTagModal({ ...sys, area: area.area, disc: disc.disc, projectId: selectedProject.projectId })}><FontAwesomeIcon icon={faPlus} /></button>
                                  <button onClick={() => handleDelete("System", `${area.area}_${disc.disc}`, sys.sys)}><FontAwesomeIcon icon={faTrash} /></button>
                                </div>
                              </div>

                              {isSysExpanded && tags.map((tag) => (
                                <div key={tag.tag} className="folder-indent-3">
                                  <div className="tag-row">
                                    <div className="entity-line">
                                      <FontAwesomeIcon icon={faCube}  className="folder-icon" />
                                      {tag.tag} - {tag.name}
                                    </div>
                                    <div className="entity-icons">
                                      <button><FontAwesomeIcon icon={faEye} /></button>
                                      <button onClick={() => handleDelete("Tag", `${area.area}_${disc.disc}_${sys.sys}`, tag.tag)}>
                                        <FontAwesomeIcon icon={faTrash} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
        <div className="d-flex mt-2 justify-content-center">
          <FontAwesomeIcon
            icon={showProjectDetails ? faChevronUp : faChevronDown}
            onClick={() => setShowProjectDetails(prev => !prev)}
            style={{ cursor: "pointer" }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;