import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faTrash,
  faSave,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
  AssignuserFeature,
  GetAllUsers,
  getfeatures,
  getUserfeature,
} from "../services/UserApi";
import { getProjects, getUserProjects } from "../services/CommonApis";
import Alert from "../components/Alert";

function AdminFeatureAssign() {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [featureRoleMap, setFeatureRoleMap] = useState({});
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userProjects, setUserProjects] = useState({});
  const [features, setFeatures] = useState([]);
  const [userFeaturesWithProjects, setUserFeaturesWithProjects] = useState([]);
   const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

   
  

  const roles = ["EDITOR", "VIEWER", "NO ROLE"];

  const Projects = JSON.parse(sessionStorage.getItem('projects'));
const projectIds = Object.keys(Projects);
  const getProjectDetails = async () => {
    const response = await getUserProjects({projectIds});
    console.log(response.data);
    
    setProjects(response.data);
    const result = await getfeatures();
    setFeatures(result.data);

    // Fetch all user feature assignments
    const userFeaturesResponse = await getUserfeature();
    console.log(userFeaturesResponse.data);
    
    setUserFeaturesWithProjects(userFeaturesResponse.data);

    // Create a map of projects by user
    const projectsByUser = {};
    userFeaturesResponse.data.forEach((feature) => {
      if (!projectsByUser[feature.userId]) {
        projectsByUser[feature.userId] = new Set();
      }
      if (feature.projectName) {
        projectsByUser[feature.userId].add(feature.projectName);
      }
    });

    // Convert Sets to Arrays
    const formattedUserProjects = {};
    Object.keys(projectsByUser).forEach((userId) => {
      formattedUserProjects[userId] = Array.from(projectsByUser[userId]);
    });

    setUserProjects(formattedUserProjects);
  };
 const getUserdetails = async () => {
  const response = await GetAllUsers();
  if (response.status === 200) {
    const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));
    console.log(userDetails)
    const currentUserId = userDetails?.userId
;
    
    // Filter out admins and current user
    const filteredUsers = response.data.data.users.filter(user => {
      return user.role !== 'admin' && user.userId !== currentUserId;
    });
    
    setUsers(filteredUsers);
  }
};
 useEffect(() => {
  // Get current user from session storage
  const userDetails = JSON.parse(sessionStorage.getItem('userdetails'));
  setCurrentUser(userDetails);
  
  getUserdetails();
  getProjectDetails();
  setFeatureRoleMap({});
}, []);
  const handleUserSelect = async (userId) => {
    const newSelectedUsers = selectedUsers.includes(userId)
      ? selectedUsers.filter((id) => id !== userId)
      : [...selectedUsers, userId];

    setSelectedUsers(newSelectedUsers);
    setFeatureRoleMap({}); // Reset feature role map when changing user selection

    // If a single user is selected, initialize featureRoleMap with their existing assignments
    if (newSelectedUsers.length === 1) {
      const userIdStr = newSelectedUsers[0].toString();
      const userAssignments = userFeaturesWithProjects.filter(
        (assignment) => assignment.userId === userIdStr
      );

      // Initialize featureRoleMap with existing assignments for the selected project (if any)
      const initialFeatureRoles = {};
      userAssignments.forEach((assignment) => {
        if (
          selectedProject &&
          assignment.projectId === selectedProject.projectId
        ) {
          initialFeatureRoles[assignment.feature] = assignment.role;
        }
      });
      setFeatureRoleMap(initialFeatureRoles);
    }
  };

  const handleRoleAssign = (feature, role) => {
    setFeatureRoleMap((prev) => {
      const newMap = { ...prev };
      if (role === "NO ROLE") {
        delete newMap[feature];
      } else {
        newMap[feature] = role;
      }
      return newMap;
    });
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);

    // When a new project is selected, update featureRoleMap with existing assignments
    if (selectedUsers.length === 1) {
      const userIdStr = selectedUsers[0].toString();
      const userAssignments = userFeaturesWithProjects.filter(
        (assignment) =>
          assignment.userId === userIdStr &&
          assignment.projectId === project.projectId
      );

      const initialFeatureRoles = {};
      userAssignments.forEach((assignment) => {
        initialFeatureRoles[assignment.feature] = assignment.role;
      });
      setFeatureRoleMap(initialFeatureRoles);
    } else {
      setFeatureRoleMap({});
    }
  };

const handleSubmit = async () => {
  if (!selectedProject) {
    alert("Please select a project first");
    return;
  }

  // Update user projects assignments
  const updatedUserProjects = { ...userProjects };
  selectedUsers.forEach((userId) => {
    if (selectedProject) {
      if (!updatedUserProjects[userId]) {
        updatedUserProjects[userId] = [];
      }
      if (!updatedUserProjects[userId].includes(selectedProject.name)) {
        updatedUserProjects[userId].push(selectedProject.name);
      }
    }
  });
  setUserProjects(updatedUserProjects);

  // Prepare assignments including explicit NO ROLE selections
  const assignments = [];
  
  // Add features with explicit roles from featureRoleMap
  Object.entries(featureRoleMap).forEach(([feature, role]) => {
    assignments.push({ feature, role });
  });

  // For features not in featureRoleMap (NO ROLE), explicitly send NO ROLE
  features.forEach(feature => {
    if (!featureRoleMap.hasOwnProperty(feature.feature_name)) {
      assignments.push({
        feature: feature.feature_name,
        role: "NO ROLE"
      });
    }
  });

  const data = {
    userIds: selectedUsers,
    projectId: selectedProject?.projectId,
    assignments: assignments
  };

  try {
    const response = await AssignuserFeature(data);
    if (response.status === 200) {
      setModalMessage("Assignments saved successfully!");
        setCustomAlert(true);
      setSidebarVisible(false);
      setSelectedUsers([]);
      // Refresh the data after saving
      getProjectDetails();
    }
  } catch (error) {
    console.error("Error saving assignments:", error);
    setModalMessage("Failed to save assignments");
      setCustomAlert(true);
  }
};

const filteredUsers = users.filter((user) => {
  if (user.role === 'admin') return false;

  const emailMatch = user.email.toLowerCase().includes(searchTerm.toLowerCase());

  const projectMatch = (userProjects[user.userId] || []).some((project) =>
    (project || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return emailMatch || projectMatch;
});

  // Function to determine if a radio button should be checked
  const isRoleChecked = (featureName, role) => {
    // First check if there's a pending change in featureRoleMap
    if (featureRoleMap.hasOwnProperty(featureName)) {
      return featureRoleMap[featureName] === role;
    }

    // If no pending change, check existing assignments
    if (selectedUsers.length === 1 && selectedProject) {
      const userIdStr = selectedUsers[0].toString();
      const existingAssignment = userFeaturesWithProjects.find(
        (assignment) =>
          assignment.userId === userIdStr &&
          assignment.projectId === selectedProject.projectId &&
          assignment.feature === featureName
      );

      if (existingAssignment) {
        return existingAssignment.role === role;
      }
    }

    // Default to NO ROLE if no assignment exists
    return role === "NO ROLE";
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#33334c",
        color: "white",
      }}
    >
      {/* Left Main Content */}
      <div style={{ flex: sidebarVisible ? 1 : "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            padding: "0",
          }}
        >
          <h3 style={{ fontWeight: "bold", margin: 0 }}>User Selection</h3>
          {selectedUsers.length > 0 && (
            <button
              onClick={() => setSidebarVisible(true)}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#fff",
                color: "#000",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Assign Project
            </button>
          )}
        </div>

        <div className="table-container">
          <table
            className="tagTable"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0", color: "black" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>#</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Select</th>
                                <th style={{ padding: "10px", textAlign: "left" }}>User Name</th>

                <th style={{ padding: "10px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "10px", textAlign: "left" }}>
                  Assigned Projects
                </th>
              </tr>
              <tr>
                <th colSpan="5" style={{ padding: "5px" }}>
                  <input
                    type="text"
                    placeholder="Search by Email or Project"
                    className="form-control w-100 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: "100%", border: "1px solid #ddd" }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => {
                  const userFeatures = userFeaturesWithProjects.filter(
                    (f) => f.userId === user.userId.toString()
                  );

                  return (
                    <tr
                      key={user.userId}
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? "#ffffff" : "#f9f9f9",
                        color: "black",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.userId)}
                          onChange={() => handleUserSelect(user.userId)}
                          style={{ width: "16px", height: "16px" }}
                        />
                      </td>
                        <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {user.username}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {user.email}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #ddd",
                        }}
                        className="bg-white"
                      >
                        {userProjects[user.userId] &&
                        userProjects[user.userId].length > 0
                          ? userProjects[user.userId].join(", ")
                          : "No projects assigned"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="text-center text-muted py-3"
                    style={{ backgroundColor: "white" }}
                  >
                    {searchTerm
                      ? "No matching users found"
                      : "No users available..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Sidebar */}
      {sidebarVisible && (
        <div
          style={{
            width: "425px",
            backgroundColor: "#22223b",
            padding: "10px",
            overflowY: "hidden",
            borderLeft: "1px solid #555",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <h3>Assign to Project</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {projects?.map((project) => (
                <li
                  key={project.projectId}
                  onClick={() => handleProjectSelect(project)}
                  style={{
                    padding: "8px",
                    margin: "6px 0",
                    backgroundColor:
                      selectedProject?.projectId === project.projectId
                        ? "#444466"
                        : "#333",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  {project.projectName}
                </li>
              ))}
            </ul>
          </div>

          {selectedProject && (
            <>
              <div
                className="d-flex justify-content-between"
                style={{ flexShrink: 0 }}
              >
                <h4 style={{ marginTop: "20px" }}>Assign Feature Roles</h4>
               
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  marginTop: "10px",
                  maxHeight: "450px",
                  position: "relative",
                }}
              >
                <table
                  className="tagTable"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#f0f0f0",
                        color: "black",
                        position: "sticky",
                        top: 0,
                        zIndex: 100,
                      }}
                    >
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          width: "40%",
                           position:"static"
                        }}
                      >
                        Feature
                      </th>
                      {roles.map((role) => (
                        <th
                          key={role}
                          style={{
                            padding: "10px",
                            textAlign: "center",
                            width: "10%",
                              borderRight: "1px solid #ddd",
                          }}
                        >
                          {role}
                        </th>
                     
                      ))}
                      
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature) => (
                      <tr
                        key={feature.feature_id}
                        style={{ backgroundColor: "#ffffff", color: "black" }}
                      >
                        <td
                          style={{
                            padding: "10px",
                            borderBottom: "1px solid #ddd",
                            fontWeight: "bold",
                          }}
                          className="bg-white"
                        >
                          {feature.feature_name}
                        </td>
                        {roles.map((role) => (
                          <td
                            key={`${feature.feature_name}-${role}`}
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #ddd",
                              textAlign: "center",
                              position:"static"
                            }}
                            className="bg-white"
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                              }}
                            >
                              <input
                                type="radio"
                                name={`feature-${feature.feature_name}`}
                                checked={isRoleChecked(
                                  feature.feature_name,
                                  role
                                )}
                                onChange={() =>
                                  handleRoleAssign(feature.feature_name, role)
                                }
                                style={{ width: "16px", height: "16px" }}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
              </div>
               <button
                  onClick={handleSubmit}
                  style={{
                    marginTop: "20px",
                    padding: "10px 20px",
                    backgroundColor: "#fff",
                    color: "#000",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Save Assignments
                </button>
            </>
            
          )}
          
        </div>
        
      )}
          {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}
    </div>
   
  );
}

export default AdminFeatureAssign;
