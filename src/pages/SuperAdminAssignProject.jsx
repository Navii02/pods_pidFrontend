import React, { useEffect, useState } from 'react';
import { GetAllUsers, getUserAssignedFeatures, SaveProjectAdmin } from '../services/UserApi';
import { getProjects } from '../services/CommonApis';

function SuperAdminAssignProject() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState({
    users: false,
    projects: false,
    submitting: false
  });

  const getUsers = async () => {
    setLoading(prev => ({ ...prev, users: true }));
    try {
      const response = await GetAllUsers();
      if (response.status === 200) {
        const allUsers = response.data.data.users;

        // Get current user from localStorage
        const localUser = JSON.parse(sessionStorage.getItem('userDetails'));
        setCurrentUser(localUser?.user);

        // Exclude current user
        const filteredUsers = allUsers.filter(user => user.userId !== localUser?.userId);
        setUsers(filteredUsers);
      }
    } catch (error) {
      alert('Failed to load users');
      console.error('Error loading users:', error);
    } finally {
      setLoading(prev => ({ ...prev, users: false }));
    }
  };

  const getProjectsData = async () => {
    setLoading(prev => ({ ...prev, projects: true }));
    try {
      const response = await getProjects();
      if (response.status === 200) {
        setProjects(response.data.row);
      }
    } catch (error) {
      alert('Failed to load projects');
      console.error('Error loading projects:', error);
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const getAssignedUsers = async () => {
    try {
      const response = await getUserAssignedFeatures();
      if (response.status === 200) {
        const initialAssignments = {};
        response.data.forEach(item => {
          if (item.role === "project_admin") {
            const key = `${item.userId}|${item.projectId}`;
            initialAssignments[key] = true;
          }
        });
        setAssignments(initialAssignments);
      }
    } catch (error) {
      console.error('Error loading assigned users:', error);
    }
  };

  useEffect(() => {
    getUsers();
    getProjectsData();
    getAssignedUsers();
  }, []);

  const handleCheckboxChange = (userId, projectId) => {
    const key = `${userId}|${projectId}`;
    setAssignments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async () => {
    setLoading(prev => ({ ...prev, submitting: true }));

    const assignmentArray = Object.entries(assignments)
      .filter(([key, isSelected]) => isSelected)
      .map(([key]) => {
        const [userId, projectId] = key.split('|');
        return {
          userId,
          projectId,
          role: "project_admin"
        };
      });

    if (assignmentArray.length === 0) {
      alert('Please select at least one assignment');
      setLoading(prev => ({ ...prev, submitting: false }));
      return;
    }

    try {
      const response = await SaveProjectAdmin({ assignments: assignmentArray });

      if (response.status === 200) {
        alert('Projects assigned successfully!');
        await getAssignedUsers();
      }
    } catch (error) {
      console.error('Error details:', error.response?.data || error.message);
      alert(
        `Failed to assign projects: ${
          error.response?.data?.message || error.message || 'Unknown error'
        }`
      );
    } finally {
      setLoading(prev => ({ ...prev, submitting: false }));
    }
  };

  if (loading.users || loading.projects) {
    return <div>Loading data...</div>;
  }

  return (
    <div
      style={{
        zIndex: "1",
        position: "absolute",
        width: "100%",
        height: "80vh",
        backgroundColor: "#33334c",
        color: "white",
      }}
    >
      <div
        className="head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px",
        }}
      >
        <h3 style={{ fontWeight: "bold", paddingLeft: "20px" }}>Assign Projects</h3>
        <button
          onClick={handleSubmit}
          className="btn"
          style={{ padding: "8px 16px", backgroundColor: "#fff" }}
          disabled={loading.submitting}
        >
          {loading.submitting ? 'Submitting...' : 'Submit Assignments'}
        </button>
      </div>
      <div className="table-container">
        <table className="tagTable" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>PROJECT LIST</th>
              {users.map(user => (
                <th key={user.userId}>{user.email}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr key={project.projectId}>
                <td style={{ backgroundColor: '#f0f0f0', color: 'black' }}>{project.projectName}</td>
                {users.map(user => {
                  const key = `${user.userId}|${project.projectId}`;
                  return (
                    <td key={key} style={{ textAlign: 'center', backgroundColor: '#f0f0f0' }}>
                      <input
                        type="checkbox"
                        checked={!!assignments[key]}
                        onChange={() => handleCheckboxChange(user.userId, project.projectId)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SuperAdminAssignProject;
