import React, { useEffect, useState } from 'react';

function SuperAdminAssignProject() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState({}); // { "userId-projectId": true }

  // Example data (replace with actual API calls)
  useEffect(() => {
    setUsers([
      { id: 1, email: "123@poulconsult.com" },
      { id: 2, email: "345@poulconsult.com" },
      { id: 3, email: "688@poulconsult.com" }
    ]);

    setProjects([
      { id: 1, name: "Project1" },
      { id: 2, name: "Project2" },
      { id: 3, name: "Project3" },
      { id: 4, name: "Project4" },
      { id: 5, name: "Project5" }
    ]);
  }, []);

  // Toggle assignment
  const handleCheckboxChange = (userId, projectId) => {
    const key = `${userId}-${projectId}`;
    setAssignments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Submit assignments to backend
  const handleSubmit = () => {
    const assigned = Object.entries(assignments)
      .filter(([_, isChecked]) => isChecked)
      .map(([key]) => {
        const [userId, projectId] = key.split('-');
        return { userId: parseInt(userId), projectId: parseInt(projectId) };
      });

    console.log("Submitting assignments:", assigned);

    // Example POST request:
    // axios.post('/api/assign-projects', { assignments: assigned })
  };

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
        <button onClick={handleSubmit} className="btn"
          style={{ padding: "8px 16px", backgroundColor: "#fff" }}>
        Submit Assignments
      </button>
      </div>
<div className="table-container">

      <table className="tagTable"
          style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>PROJECT LIST</th>
            {users.map(user => (
              <th key={user.id}>{user.email}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map(project => (
            <tr key={project.id}>
              <td style={{ backgroundColor: '#f0f0f0',color:'black' }}>{project.name}</td>
              {users.map(user => {
                const key = `${user.id}-${project.id}`;
                return (
                  <td key={key} style={{ textAlign: 'center',backgroundColor: '#f0f0f0' }}>
                    <input
                      type="checkbox"
                      checked={!!assignments[key]}
                      onChange={() => handleCheckboxChange(user.id, project.id)}
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
