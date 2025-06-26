import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlus,
  faMinus,
  faFolder,
  faFolderOpen,
  faCube,
  faPlusCircle,
  faEyeSlash,
  faEye,
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
import {
  iroamerContext,
  TreeresponseContext,
  updateProjectContext,
} from "../context/ContextShare";
import { GetAllmodals } from "../services/iroamer";
import { useNavigate } from "react-router-dom";

const ProjectDetails = ({
  showProjectDetails,
  setShowProjectDetails,
  activeTab,
}) => {
  const { updateTree } = useContext(TreeresponseContext);
  const { viewHideThree,backgroundColorTag, setHighlightedTagKey, setTagsToRemove, setViewHideThree,iroamerfieldEmpty} =
    useContext(iroamerContext);
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
  const [eyeState, setEyeState] = useState({});
  const navigate = useNavigate();
 
  const entityTypes = {
    areas: "Area",
    systems: "System",
    disciplines: "Discipline",
  };
  const currentEntityType = entityTypes[activeTab] || "Area";

  const fetchAllProjectData = async () => {
    try {
      const areasResponse = await getProjectArea(selectedProject.projectId, {
        type: "area",
      });
      const allAreas = areasResponse.data.area || [];
      setAreas(allAreas);

      const disciplinesPromises = allAreas.map(async (area) => {
        const discResponse = await getprojectDisipline(
          area.area,
          selectedProject.projectId
        );
        return {
          area: area.area,
          disciplines: discResponse.data.disciplines || [],
        };
      });

      const disciplinesResults = await Promise.all(disciplinesPromises);
      const newDisciplinesMap = {};
      disciplinesResults.forEach((result) => {
        newDisciplinesMap[result.area] = result.disciplines;
      });
      setDisciplinesMap(newDisciplinesMap);

      const systemsPromises = disciplinesResults.flatMap((result) =>
        result.disciplines.map(async (disc) => {
          const sysResponse = await getprojectsystem(
            selectedProject.projectId,
            result.area,
            disc.disc
          );
          return {
            key: `${result.area}_${disc.disc}`,
            systems: sysResponse.data.systems || [],
          };
        })
      );

      const systemsResults = await Promise.all(systemsPromises);
      const newSystemsMap = {};
      systemsResults.forEach((result) => {
        newSystemsMap[result.key] = result.systems;
      });
      setSystemsMap(newSystemsMap);

      const tagsPromises = systemsResults.flatMap((result) =>
        result.systems.map(async (sys) => {
          const [area, disc] = result.key.split("_");
          const tagResponse = await getProjectTags(
            selectedProject.projectId,
            area,
            disc,
            sys.sys
          );
          return {
            key: `${area}_${disc}_${sys.sys}`,
            tags: tagResponse.data.tags || [],
          };
        })
      );

      const tagsResults = await Promise.all(tagsPromises);
      const newTagsMap = {};
      tagsResults.forEach((result) => {
        newTagsMap[result.key] = result.tags;
      });
      setTagsMap(newTagsMap);
    } catch (error) {
      console.error("Failed to fetch project data", error);
    }
  };

  useEffect(() => {
    if (selectedProject?.projectId) {
      fetchAllProjectData();
    }
  }, [selectedProject?.projectId, updateTree, updateProject]);

  const gatherEntityIds = async (entityType, entityData, entityKey) => {
    const ids = {
      areaIds: [],
      discIds: [],
      systemIds: [],
      tagIds: [],
    };

    const newEyeState = { ...eyeState };
    const isOpen = eyeState[entityKey] || false;
    const newViewHideThree = {};

    switch (entityType) {
 case "Project":
  areas.forEach((area) => {
    ids.areaIds.push(area.area);
    newEyeState[`area_${area.area}`] = !isOpen;
    newViewHideThree[`${area.area}`] = !isOpen;
    const disciplines = disciplinesMap[area.area] || [];
    disciplines.forEach((disc) => {
      ids.discIds.push(disc.disc);
      const discKey = `disc_${area.area}_${disc.disc}`;
      newEyeState[discKey] = !isOpen;
      newViewHideThree[`${area.area}-${disc.disc}`] = !isOpen;
      const systemKey = `${area.area}_${disc.disc}`;
      const systems = systemsMap[systemKey] || [];
      systems.forEach((sys) => {
        ids.systemIds.push(sys.sys);
        const sysKey = `sys_${area.area}_${disc.disc}_${sys.sys}`;
        newEyeState[sysKey] = !isOpen;
        newViewHideThree[`${area.area}-${disc.disc}-${sys.sys}`] = !isOpen;
        const tagKey = `${area.area}_${disc.disc}_${sys.sys}`;
        const tags = tagsMap[tagKey] || [];
        tags.forEach((tag) => {
          ids.tagIds.push(tag.tag);
          newEyeState[
            `tag_${area.area}_${disc.disc}_${sys.sys}_${tag.tag}`
          ] = !isOpen;
          newViewHideThree[`${area.area}-${disc.disc}-${sys.sys}-${tag.tag}`] = !isOpen;
        });
      });
    });
  });
  newEyeState["project"] = !isOpen;
  break;

      case "Area":
        ids.areaIds = [entityData.area];
        newEyeState[`area_${entityData.area}`] = !isOpen;
        newViewHideThree[`${entityData.area}`] = !isOpen;
        const disciplines = disciplinesMap[entityData.area] || [];
        disciplines.forEach((disc) => {
          ids.discIds.push(disc.disc);
          const discKey = `disc_${entityData.area}_${disc.disc}`;
          newEyeState[discKey] = !isOpen;
          newViewHideThree[`${entityData.area}-${disc.disc}`] = !isOpen;
          const systemKey = `${entityData.area}_${disc.disc}`;
          const systems = systemsMap[systemKey] || [];
          systems.forEach((sys) => {
            ids.systemIds.push(sys.sys);
            const sysKey = `sys_${entityData.area}_${disc.disc}_${sys.sys}`;
            newEyeState[sysKey] = !isOpen;
            newViewHideThree[`${entityData.area}-${disc.disc}-${sys.sys}`] = !isOpen;
            const tagKey = `${entityData.area}_${disc.disc}_${sys.sys}`;
            const tags = tagsMap[tagKey] || [];
            tags.forEach((tag) => {
              ids.tagIds.push(tag.tag);
              newEyeState[
                `tag_${entityData.area}_${disc.disc}_${sys.sys}_${tag.tag}`
              ] = !isOpen;
              newViewHideThree[`${entityData.area}-${disc.disc}-${sys.sys}-${tag.tag}`] = !isOpen;
            });
          });
        });
        break;

      case "Discipline":
        ids.areaIds = [entityData.area];
        ids.discIds = [entityData.disc];
        newEyeState[`disc_${entityData.area}_${entityData.disc}`] = !isOpen;
        newViewHideThree[`${entityData.area}-${entityData.disc}`] = !isOpen;
        const systemKey = `${entityData.area}_${entityData.disc}`;
        const systems = systemsMap[systemKey] || [];
        systems.forEach((sys) => {
          ids.systemIds.push(sys.sys);
          const sysKey = `sys_${entityData.area}_${entityData.disc}_${sys.sys}`;
          newEyeState[sysKey] = !isOpen;
          newViewHideThree[`${entityData.area}-${entityData.disc}-${sys.sys}`] = !isOpen;
          const tagKey = `${entityData.area}_${entityData.disc}_${sys.sys}`;
          const tags = tagsMap[tagKey] || [];
          tags.forEach((tag) => {
            ids.tagIds.push(tag.tag);
            newEyeState[
              `tag_${entityData.area}_${entityData.disc}_${sys.sys}_${tag.tag}`
            ] = !isOpen;
            newViewHideThree[`${entityData.area}-${entityData.disc}-${sys.sys}-${tag.tag}`] = !isOpen;
          });
        });
        break;

      case "System":
        ids.areaIds = [entityData.area];
        ids.discIds = [entityData.disc];
        ids.systemIds = [entityData.sys];
        newEyeState[
          `sys_${entityData.area}_${entityData.disc}_${entityData.sys}`
        ] = !isOpen;
        newViewHideThree[`${entityData.area}-${entityData.disc}-${entityData.sys}`] = !isOpen;
        const tagKey = `${entityData.area}_${entityData.disc}_${entityData.sys}`;
        const tags = tagsMap[tagKey] || [];
        tags.forEach((tag) => {
          ids.tagIds.push(tag.tag);
          newEyeState[
            `tag_${entityData.area}_${entityData.disc}_${entityData.sys}_${tag.tag}`
          ] = !isOpen;
          newViewHideThree[`${entityData.area}-${entityData.disc}-${entityData.sys}-${tag.tag}`] = !isOpen;
        });
        break;

      case "Tag":
        ids.areaIds = [entityData.area];
        ids.discIds = [entityData.disc];
        ids.systemIds = [entityData.sys];
        ids.tagIds = [entityData.tag];
        newEyeState[
          `tag_${entityData.area}_${entityData.disc}_${entityData.sys}_${entityData.tag}`
        ] = !isOpen;
        newViewHideThree[`${entityData.area}-${entityData.disc}-${entityData.sys}-${entityData.tag}`] = !isOpen;
        break;

      default:
        break;
    }

    setEyeState(newEyeState);
    setViewHideThree((prev) => ({ ...prev, ...newViewHideThree }));

    if (!isOpen) {
      try {
        setTagsToRemove([]);
        const response = await GetAllmodals(selectedProject.projectId,ids.areaIds,
        ids.discIds,
        ids.systemIds,
        ids.tagIds )
        if (response.status === 200) {
          //console.log(response.data)
          navigate("/iroamer", { state: { modalData: response.data.data, timestamp: Date.now() } });
        } else if (response.status === 400) {
          alert("No Records Found");
          setEyeState((prev) => ({
            ...prev,
            [entityKey]: false,
            ...(entityType !== "Tag" &&
              Object.keys(newEyeState).reduce((acc, key) => {
                if (key !== entityKey && newEyeState[key] === true) {
                  acc[key] = false;
                }
                return acc;
              }, {})),
          }));
          setViewHideThree((prev) => ({
            ...prev,
            ...Object.keys(newViewHideThree).reduce((acc, key) => {
              acc[key] = false;
              return acc;
            }, {}),
          }));
        }
      } catch (error) {
        console.error("Failed to fetch modal data", error);
        alert("Failed to fetch data");
        setEyeState((prev) => ({
          ...prev,
          [entityKey]: false,
          ...(entityType !== "Tag" &&
            Object.keys(newEyeState).reduce((acc, key) => {
              if (key !== entityKey && newEyeState[key] === true) {
                acc[key] = false;
              }
              return acc;
            }, {})),
        }));
        setViewHideThree((prev) => ({
          ...prev,
          ...Object.keys(newViewHideThree).reduce((acc, key) => {
            acc[key] = false;
            return acc;
          }, {}),
        }));
      }
    } else {
      setTagsToRemove(ids.tagIds);
    }
  };

  const handleDelete = async (type, id, code) => {
    const confirm = window.confirm(
      `Delete ${type}: ${code}? All child entities will be deleted.`
    );
    if (!confirm) return;
    try {
      let deleteCode = code;
      if (type === "Discipline" || type === "Tag") {
        deleteCode = `${id}__${code}`;
      }
      const response = await DeleteEntity(
        type,
        selectedProject.projectId,
        deleteCode
      );
      if (response.status === 200) {
        alert(`${type} and children deleted.`);
        fetchAllProjectData();
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

  const handleEntityRegisterSuccess = async () => {
    handleEntityRegisterClose();
    await fetchAllProjectData();
  };

  const openDisciplineModal = (area) => setShowDisciplineModalFor(area);
  const openSystemModal = (discipline) => setShowSystemModalFor(discipline);
  const openTagModal = (system) => setShowTagModalFor(system);

  const getHighlightedTagPaths = () => {
    const paths = [];
    for (const [path, isHighlighted] of Object.entries(
      backgroundColorTag || {}
    )) {
      if (isHighlighted) {
        paths.push(path);
      }
    }
    return paths;
  };

  const highlightedTagPaths = getHighlightedTagPaths();

  const shouldHighlightTag = (area, disc, sys, tag) => {
    const tagPath = `${area}-${disc}-${sys}-${tag}`.trim();
    //console.log(tagPath);
    
    return highlightedTagPaths.includes(tagPath);
  };

  const trimText = (text, maxLength = 12) => {
  if (!text) return '';
  return text.length > maxLength 
    ? `${text.substring(0, maxLength)}...` 
    : text;
};

  return (
    <div>
      <EntityRegister
        isOpen={
          showEntityModal || !!showDisciplineModalFor || !!showSystemModalFor
        }
        onClose={handleEntityRegisterClose}
        onSuccess={handleEntityRegisterSuccess}
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
        onSuccess={handleEntityRegisterSuccess}
      />

      <div className="project-toggle-wrapper">
        {showProjectDetails && (
          <>
            <div className="d-flex w-100 justify-content-between selected-project-header mb-2 mt-3">
              <div className="ms-3">{selectedProject?.projectName}</div>
              <div className="entity-icons">
                <button
                  onClick={() =>
                    gatherEntityIds("Project", selectedProject, "project")
                  }
                >
                  <FontAwesomeIcon
                    icon={eyeState["project"] ? faEye : faEyeSlash}
                  />
                </button>
                <button
                  onClick={() => setShowEntityModal(true)}
                  className="me-2"
                >
                  <FontAwesomeIcon icon={faPlusCircle} />
                </button>
              </div>
            </div>

            {areas.map((area) => {
              const isExpanded = expandedArea === area.area;
              const areaKey = `area_${area.area}`;
              return (
                <div key={area.area}>
                  <div className="folder-row">
                    <div className="entity-line">
                      <FontAwesomeIcon
                        icon={isExpanded ? faMinus : faPlus}
                        onClick={() =>
                          setExpandedArea(isExpanded ? null : area.area)
                        }
                      />
                      <FontAwesomeIcon
                        icon={isExpanded ? faFolderOpen : faFolder}
                        className="folder-icon"
                      />
                      {area.area} - {area.name}
                    </div>
                    <div className="entity-icons">
                      <button
                        onClick={() => gatherEntityIds("Area", area, areaKey)}
                      >
                        <FontAwesomeIcon
                          icon={eyeState[areaKey] ? faEye : faEyeSlash}
                        />
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
                      const discKey = `disc_${systemKey}`;

                      return (
                        <div key={disc.disc} className="folder-indent-1">
                          <div className="disc-row">
                            <div className="entity-line">
                              <FontAwesomeIcon
                                icon={isDiscExpanded ? faMinus : faPlus}
                                onClick={() =>
                                  setExpandedDiscipline(
                                    isDiscExpanded ? null : systemKey
                                  )
                                }
                              />
                              <FontAwesomeIcon
                                icon={isDiscExpanded ? faFolderOpen : faFolder}
                                className="folder-icon"
                              />
                              {disc.disc} - {disc.name}
                            </div>
                            <div className="entity-icons">
                              <button
                                onClick={() =>
                                  gatherEntityIds(
                                    "Discipline",
                                    { area: area.area, disc: disc.disc },
                                    discKey
                                  )
                                }
                              >
                                <FontAwesomeIcon
                                  icon={eyeState[discKey] ? faEye : faEyeSlash}
                                />
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
                                <FontAwesomeIcon
                                  icon={faTrash}
                                  className="me-2"
                                />
                              </button>
                            </div>
                          </div>

                          {isDiscExpanded &&
                            systemsMap[systemKey]?.map((sys) => {
                              const tagKey = `${area.area}_${disc.disc}_${sys.sys}`;
                              const isSysExpanded = expandedSystem === tagKey;
                              const sysKey = `sys_${tagKey}`;

                              return (
                                <div key={sys.sys} className="folder-indent-2">
                                  <div className="sys-row">
                                    <div className="entity-line">
                                      <FontAwesomeIcon
                                        icon={isSysExpanded ? faMinus : faPlus}
                                        onClick={() =>
                                          setExpandedSystem(
                                            isSysExpanded ? null : tagKey
                                          )
                                        }
                                      />
                                      <FontAwesomeIcon
                                        icon={isSysExpanded ? faFolderOpen : faFolder}
                                        className="folder-icon"
                                      />
                                      {sys.sys} - {sys.name}
                                    </div>
                                    <div className="entity-icons">
                                      <button
                                        onClick={() =>
                                          gatherEntityIds(
                                            "System",
                                            {
                                              area: area.area,
                                              disc: disc.disc,
                                              sys: sys.sys,
                                            },
                                            sysKey
                                          )
                                        }
                                      >
                                        <FontAwesomeIcon
                                          icon={
                                            eyeState[sysKey]
                                              ? faEye
                                              : faEyeSlash
                                          }
                                        />
                                      </button>
                                      <button
                                        onClick={() =>
                                          openTagModal({
                                            ...sys,
                                            area: area.area,
                                            disc: disc.disc,
                                            projectId:
                                              selectedProject.projectId,
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
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          className="me-2"
                                        />
                                      </button>
                                    </div>
                                  </div>

                                  {isSysExpanded &&
                                    tagsMap[tagKey]?.map((tag) => {
                                      const tagEntityKey = `tag_${area.area}_${disc.disc}_${sys.sys}_${tag.tag}`;
                                      const isTagHighlighted =
                                        shouldHighlightTag(
                                          area.area,
                                          disc.disc,
                                          sys.sys,
                                          tag.tag
                                        );

                                      return (
                                        <div
                                          key={tag.tag}
                                          className={`folder-indent-3 ${
                                            isTagHighlighted
                                              ? "highlighted"
                                              : ""
                                          }`}
                                        >
                                          <div className="tag-row">
                                            <div
                                              className="entity-line"
                                              onClick={() => {
                                                const tagKey = `${area.area}-${disc.disc}-${sys.sys}-${tag.tag}`;
                                                setHighlightedTagKey(tagKey);
                                              }}
                                            >
                                              <FontAwesomeIcon
                                                icon={faCube}
                                                className="folder-icon"
                                              />
                                              {trimText(tag.name)}
                                            </div>
                                            <div className="entity-icons">
                                              <button
                                                onClick={() =>
                                                  gatherEntityIds(
                                                    "Tag",
                                                    {
                                                      area: area.area,
                                                      disc: disc.disc,
                                                      sys: sys.sys,
                                                      tag: tag.tag,
                                                    },
                                                    tagEntityKey
                                                  )
                                                }
                                              >
                                                <FontAwesomeIcon
                                                  icon={
                                                    eyeState[tagEntityKey]
                                                      ? faEye
                                                      : faEyeSlash
                                                  }
                                                />
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
                                                <FontAwesomeIcon
                                                  icon={faTrash}
                                                  className="me-2"
                                                />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
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