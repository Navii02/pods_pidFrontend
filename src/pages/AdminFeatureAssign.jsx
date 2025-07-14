import React, { useState, useEffect } from 'react';

function AdminFeatureAssign() {
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({}); // { "userId-feature": true }

  useEffect(() => {
    // Replace with API call if needed
    const dummyUsers = [
      { id: 1, email: "456@poulconsult.com", role: "EDITOR" },
      { id: 2, email: "333@poulconsult.com", role: "VIEWER" },
      { id: 3, email: "670@poulconsult.com", role: "EDITOR" },
    ];
    setUsers(dummyUsers);

    // Initial dummy assignments
    setAssignments({
      "1-linelist": true,
      "1-eqplist": true,
      "3-linelist": true,
      "3-eqplist": true,
      "3-taglist": true,
    });
  }, []);

  const features = ["linelist", "eqplist", "taglist"];

  const handleCheckboxChange = (userId, feature) => {
    const key = `${userId}-${feature}`;
    setAssignments(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getRoleColor = (role) => {
    return role === "EDITOR" ? "red" : "green";
  };

  const handleSubmit = () => {
    const formattedAssignments = [];

    users.forEach(user => {
      features.forEach(feature => {
        const key = `${user.id}-${feature}`;
        if (assignments[key]) {
          formattedAssignments.push({ userId: user.id, feature });
        }
      });
    });

    console.log("Submitted assignments:", formattedAssignments);

    // Submit to backend API
    // axios.post('/api/assign-features', formattedAssignments)
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
        <h3 style={{ fontWeight: "bold", paddingLeft: "20px" }}>Features Assign</h3>
         <button onClick={handleSubmit}  className="btn"
          style={{ padding: "8px 16px", backgroundColor: "#fff" }}>
        Save Feature
      </button>
      </div>
<div className="table-container">

      <table className="tagTable"
          style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th>User list</th>
            <th>Role</th>
            {features.map(feature => (
              <th key={feature}>{feature}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td style={{ backgroundColor: '#f0f0f0',color:'black' }}>{user.email}</td>
              <td style={{ color: getRoleColor(user.role), fontWeight: 'bold' }}>{user.role}</td>
              {features.map(feature => {
                const key = `${user.id}-${feature}`;
                return (
                  <td key={key} style={{ textAlign: 'center',backgroundColor: '#f0f0f0' }}>
                    <input
                      type="checkbox"
                      checked={!!assignments[key]}
                      onChange={() => handleCheckboxChange(user.id, feature)}
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

export default AdminFeatureAssign;
