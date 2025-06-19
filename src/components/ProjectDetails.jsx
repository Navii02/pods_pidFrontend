import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronUp,
  faChevronDown,
  faTrash,
  faPlus,
  faEye,
  faMinus,
  faFolder,
  faCube,
  faPlusCircle,
} from "@fortawesome/free-solid-svg-icons";
import EntityRegister from "./EntityRegister";
import TagEntityModal from "../components/Tree/TagEntityModal";
import {
  DeleteEntity,
  getProjectArea,
  getprojectDisipline,
  getprojectsystem,
  getProjectTags,
} from "../services/TreeManagementApi";
import "../styles/ProjectDetails.css";
import { TreeresponseContext, updateProjectContext } from "../context/ContextShare";

const ProjectDetails = ({
  showProjectDetails,
  setShowProjectDetails,
  activeTab,
}) => {
  const { updateTree } = useContext(TreeresponseContext);
  const { updateProject } = useContext(updateProjectContext);
  const selectedProject = JSON.parse(sessionStorage.getItem("selectedProject"));
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showDisciplineModalFor, setShowDisciplineModalFor] = useState(null);
  const [showSystemModalFor, setShowSystemModalFor] = useState(null);
  const [showTagModalFor, setShowTagModalFor] = useState(null);
  const [areas, setAreas] = useState([]);
  const [expandedArea, setExpandedArea] = useState(null);
  const [disciplinesMap, setDisciplinesMap] = useState({});
  const [systemsMap, setSystemsMap] = useState({});
  const [tagsMap, setTagsMap] = useState({});
  const [expandedDiscipline, setExpandedDiscipline] = useState(null);
  const [expandedSystem, setExpandedSystem] = useState(null);
  const [hasProjectData, setHasProjectData] = useState(!!selectedProject);
  const entityTypes = {
    areas: "Area",
    systems: "System",
    disciplines: "Discipline",
  };
  const currentEntityType = entityTypes[activeTab] || "Area";

  useEffect(() => {
  if (selectedProject?.projectId) {
    fetchAreas();

    // If an area was expanded, fetch its disciplines
    if (expandedArea) {
      fetchDisciplines(expandedArea);
    }

    // If a discipline was expanded, fetch its systems
    if (expandedDiscipline) {
      const [areaCode, discCode] = expandedDiscipline.split("_");
      fetchSystems(areaCode, discCode);
    }

    // If a system was expanded, fetch its tags
    if (expandedSystem) {
      const [area, disc, sys] = expandedSystem.split("_");
      fetchTags(area, disc, sys);
    }
  }
}, [updateTree, updateProject]);

  const fetchAreas = async () => {
    try {
      const response = await getProjectArea(selectedProject.projectId, {
        type: "area",
      });
      if (response.status === 200) {
        setAreas(response.data.area || []);
      }
    } catch (error) {
      console.error("Failed to fetch areas", error);
    }
  };

  const fetchDisciplines = async (areaCode) => {
    try {
      const response = await getprojectDisipline(
        areaCode,
        selectedProject.projectId
      );
      if (response.status === 200) {
        setDisciplinesMap((prev) => ({
          ...prev,
          [areaCode]: response.data.disciplines || [],
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
        setSystemsMap((prev) => ({
          ...prev,
          [key]: response.data.systems || [],
        }));
        setExpandedDiscipline(key);
      }
    } catch (error) {
      console.error("Failed to fetch systems", error);
    }
  };

  const fetchTags = async (area, disc, sys) => {
    try {
      const projectid = selectedProject.projectId;
      const response = await getProjectTags(projectid, area, disc, sys);
      if (response.status === 200) {
        const key = `${area}_${disc}_${sys}`;
        setTagsMap((prev) => ({
          ...prev,
          [key]: response.data.tags || [],
        }));
        setExpandedSystem(key);
      }
    } catch (error) {
      console.error("Failed to fetch tags", error);
    }
  };

  const handleDelete = async (type, id, code) => {
    const confirm = window.confirm(
      `Delete ${type}: ${code}? All child entities will be deleted.`
    );
    if (!confirm) return;
    try {
      let deleteCode = code;

      if (type === "Discipline") {
        deleteCode = `${id}__${code}`;
      } else if (type === "Tag") {
        deleteCode = `${id}__${code}`;
      }

      const response = await DeleteEntity(
        type,
        selectedProject.projectId,
        deleteCode
      );
      if (response.status === 200) {
        alert(`${type} and children deleted.`);
        if (type === "Area") fetchAreas();
        else if (type === "Discipline") fetchDisciplines(id);
        else if (type === "System")
          fetchSystems(id.split("_")[0], id.split("_")[1]);
        else if (type === "Tag") {
          const [area, disc, sys] = id.split("_");
          fetchTags(area, disc, sys);
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

const handleEntityRegisterSuccess = async (newEntity, entityType, parentInfo) => {
  handleEntityRegisterClose();

  if (newEntity.refetch) {
    if (entityType === "Area") {
      await fetchAreas();
    } else if (entityType === "Discipline" && parentInfo) {
      await fetchDisciplines(parentInfo.area);
      setExpandedArea(parentInfo.area);
    } else if (entityType === "System" && parentInfo) {
      await fetchSystems(parentInfo.area, parentInfo.disc);
      setExpandedDiscipline(`${parentInfo.area}_${parentInfo.disc}`);
    } else if (entityType === "Tag" && parentInfo) {
      await fetchTags(parentInfo.area, parentInfo.disc, parentInfo.sys);
      setExpandedSystem(`${parentInfo.area}_${parentInfo.disc}_${parentInfo.sys}`);
    }
  } else {
    // Existing logic for when entity data is provided
    if (entityType === "Area") {
      setAreas(prev => [...prev, newEntity]);
    } else if (entityType === "Discipline" && parentInfo) {
      setDisciplinesMap(prev => ({
        ...prev,
        [parentInfo.area]: [...(prev[parentInfo.area] || []), newEntity]
      }));
      setExpandedArea(parentInfo.area);
    } else if (entityType === "System" && parentInfo) {
      const systemKey = `${parentInfo.area}_${parentInfo.disc}`;
      setSystemsMap(prev => ({
        ...prev,
        [systemKey]: [...(prev[systemKey] || []), newEntity]
      }));
      setExpandedDiscipline(systemKey);
    } else if (entityType === "Tag" && parentInfo) {
      const tagKey = `${parentInfo.area}_${parentInfo.disc}_${parentInfo.sys}`;
      setTagsMap(prev => ({
        ...prev,
        [tagKey]: [...(prev[tagKey] || []), newEntity]
      }));
      setExpandedSystem(tagKey);
    }
  }
};
  const openDisciplineModal = (area) => setShowDisciplineModalFor(area);
  const openSystemModal = (discipline) => setShowSystemModalFor(discipline);
  const openTagModal = (system) => setShowTagModalFor(system);

  return (
    <div>
      <EntityRegister
        isOpen={
          showEntityModal || !!showDisciplineModalFor || !!showSystemModalFor
        }
        onClose={handleEntityRegisterClose}
        onSuccess={(newEntity) => {
          if (showSystemModalFor) {
            handleEntityRegisterSuccess(newEntity, "System", {
              area: showSystemModalFor.area,
              disc: showSystemModalFor.disc
            });
          } else if (showDisciplineModalFor) {
            handleEntityRegisterSuccess(newEntity, "Discipline", {
              area: showDisciplineModalFor.area
            });
          } else {
            handleEntityRegisterSuccess(newEntity, "Area");
          }
        }}
        entityType={
          showSystemModalFor
            ? "System"
            : showDisciplineModalFor
            ? "Discipline"
            : currentEntityType
        }
        parentEntity={
          showSystemModalFor || showDisciplineModalFor || selectedProject
        }
      />

  <TagEntityModal
  showTagModalFor={showTagModalFor}
  setShowTagModalFor={setShowTagModalFor}
  selectedProject={selectedProject}
  tagsMap={tagsMap}
  onSuccess={async ({ refetch, entityType, parentInfo }) => {
    await handleEntityRegisterSuccess({ refetch }, entityType, parentInfo);
  }}
/>

      <div className="project-toggle-wrapper ">
        {showProjectDetails && (
          <>
            <div className="d-flex w-100 justify-content-between  selected-project-header mb-2 mt-3">
              <div className="ms-3">{selectedProject?.projectName}</div>
              <div className="entity-icons">
                <button>
                  <FontAwesomeIcon icon={faEye} />
                </button>

                <button onClick={() => setShowEntityModal(true)} className="me-2">
                  <FontAwesomeIcon icon={faPlusCircle} />
                </button>
              </div>
            </div>

            {areas.map((area) => {
              const isExpanded = expandedArea === area.area;
              return (
                <div key={area.area}>
                  <div className="folder-row">
                    <div className="entity-line">
                      <FontAwesomeIcon
                        icon={isExpanded ? faMinus : faPlus}
                        onClick={() =>
                          isExpanded
                            ? setExpandedArea(null)
                            : fetchDisciplines(area.area)
                        }
                      />
                      <FontAwesomeIcon
                        icon={faFolder}
                        className="folder-icon"
                      />
                      {area.area} - {area.name}
                    </div>
                    <div className="entity-icons">
                      <button>
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                      <button onClick={() => openDisciplineModal(area)}>
                        <FontAwesomeIcon icon={faPlusCircle} />
                      </button>
                      <button
                        onClick={() => handleDelete("Area", null, area.area)}
                      >
                        <FontAwesomeIcon icon={faTrash} className="me-2" />
                      </button>
                    </div>
                  </div>

                  {isExpanded &&
                    disciplinesMap[area.area]?.map((disc) => {
                      const systemKey = `${area.area}_${disc.disc}`;
                      const isDiscExpanded = expandedDiscipline === systemKey;
                      const systems = systemsMap[systemKey] || [];

                      return (
                        <div key={disc.disc} className="folder-indent-1">
                          <div className="disc-row">
                            <div className="entity-line">
                              <FontAwesomeIcon
                                icon={isDiscExpanded ? faMinus : faPlus}
                                onClick={() =>
                                  isDiscExpanded
                                    ? setExpandedDiscipline(null)
                                    : fetchSystems(area.area, disc.disc)
                                }
                              />
                              <FontAwesomeIcon
                                icon={faFolder}
                                className="folder-icon"
                              />
                              {disc.disc} - {disc.name}
                            </div>
                            <div className="entity-icons">
                              <button>
                                <FontAwesomeIcon icon={faEye} />
                              </button>
                              <button
                                onClick={() =>
                                  openSystemModal({
                                    ...disc,
                                    area: area.area,
                                    project_id: selectedProject.projectId,
                                  })
                                }
                              >
                                <FontAwesomeIcon icon={faPlusCircle} />
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(
                                    "Discipline",
                                    area.area,
                                    disc.disc
                                  )
                                }
                              >
                                <FontAwesomeIcon icon={faTrash} className="me-2" />
                              </button>
                            </div>
                          </div>

                          {isDiscExpanded &&
                            systems.map((sys) => {
                              const tagKey = `${area.area}_${disc.disc}_${sys.sys}`;
                              const isSysExpanded = expandedSystem === tagKey;
                              const tags = tagsMap[tagKey] || [];

                              return (
                                <div key={sys.sys} className="folder-indent-2">
                                  <div className="sys-row">
                                    <div className="entity-line">
                                      <FontAwesomeIcon
                                        icon={isSysExpanded ? faMinus : faPlus}
                                        onClick={() =>
                                          isSysExpanded
                                            ? setExpandedSystem(null)
                                            : fetchTags(
                                                area.area,
                                                disc.disc,
                                                sys.sys
                                              )
                                        }
                                      />
                                      <FontAwesomeIcon
                                        icon={faFolder}
                                        className="folder-icon"
                                      />
                                      {sys.sys} - {sys.name}
                                    </div>
                                    <div className="entity-icons">
                                      <button>
                                        <FontAwesomeIcon icon={faEye} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          openTagModal({
                                            ...sys,
                                            area: area.area,
                                            disc: disc.disc,
                                            projectId: selectedProject.projectId,
                                          })
                                        }
                                      >
                                        <FontAwesomeIcon icon={faPlusCircle} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDelete(
                                            "System",
                                            `${area.area}_${disc.disc}`,
                                            sys.sys
                                          )
                                        }
                                      >
                                        <FontAwesomeIcon icon={faTrash} className="me-2"/>
                                      </button>
                                    </div>
                                  </div>

                                  {isSysExpanded &&
                                    tags.map((tag) => (
                                      <div
                                        key={tag.tag}
                                        className="folder-indent-3"
                                      >
                                        <div className="tag-row">
                                          <div className="entity-line">
                                            <FontAwesomeIcon
                                              icon={faCube}
                                              className="folder-icon"
                                            />
                                            {tag.tag} - {tag.name}
                                          </div>
                                          <div className="entity-icons">
                                            <button>
                                              <FontAwesomeIcon icon={faEye} />
                                            </button>
                                            <button
                                              onClick={() =>
                                                handleDelete(
                                                  "Tag",
                                                  `${area.area}_${disc.disc}_${sys.sys}`,
                                                  tag.tag
                                                )
                                              }
                                            >
                                              <FontAwesomeIcon icon={faTrash} className="me-2" />
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
      </div>
    </div>
  );
};

export default ProjectDetails;