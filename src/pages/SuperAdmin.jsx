import React, { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../Utils/AuthConfig";
import axios from "axios";
import { Adduser, GetAllUsers } from "../services/UserApi";

function SuperAdmin() {
  const { instance, accounts } = useMsal();
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [generatedTokens, setGeneratedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const graphResponse = await axios.get(
          "https://graph.microsoft.com/v1.0/users",
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );

        const backendResponse = await GetAllUsers();
        const backendUsers = backendResponse.data.data.users || [];

        const loggedInUser = JSON.parse(sessionStorage.getItem("userDetails"));
        const loggedInUserEmail = loggedInUser?.email?.toLowerCase();

        const initialUsers = graphResponse.data.value
          .filter((user) => user.userPrincipalName.toLowerCase() !== loggedInUserEmail)
          .map((user) => {
            const backendUser = backendUsers.find(
              (bu) => bu.userId === user.id || bu.email.toLowerCase() === user.userPrincipalName.toLowerCase()
            );

            return {
              ...user,
              token: backendUser?.token || "",
              status: backendUser?.token ? "Assigned" : "Unassigned",
            };
          });

        setUsers(initialUsers);
      } catch (err) {
        console.error("Token or API error:", err);
        setError("Failed to fetch users. Ensure correct permissions and admin consent.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [instance, accounts]);

  // Generate dummy tokens
  const generateDummyTokens = () => {
    const tokens = [];
    for (let i = 0; i < 5; i++) {
      tokens.push(`VALID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
    }
    setGeneratedTokens(tokens);
  };

  // Dummy token validation function
  const validateToken = async (token) => {
    return token.startsWith("VALID-");
  };

  // Save user details with token to backend
  const saveToBackend = async (user, token) => {
    try {
      const data = {
        userId: user.id,
        username: user.displayName,
        email: user.userPrincipalName,
        token: token,
      }
      const response = await Adduser(data);
      if (response.status === 200) {
        return true;
      }
    } catch (err) {
      console.error("Backend save error:", err);
      return false;
    }
  };

  // Handle select/deselect all
  const handleSelectAll = () => {
    const newSelected = {};
    if (!selectAll) {
      users.forEach((user) => {
        newSelected[user.id] = true;
      });
    }
    setSelectedUsers(newSelected);
    setSelectAll(!selectAll);
  };

  // Handle individual checkbox
  const handleUserSelect = (userId) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleAssignTokens = async () => {
    if (generatedTokens.length === 0) {
      alert("Please generate tokens first");
      return;
    }

    let tokenIdx = 0;
    const updatedUsers = [...users];
    let anyUserSelected = Object.values(selectedUsers).some((val) => val);

    for (let i = 0; i < updatedUsers.length && tokenIdx < generatedTokens.length; i++) {
      const user = updatedUsers[i];
      const isSelected = selectedUsers[user.id];
      const hasToken = user.token && user.token.trim() !== "";

      // Skip users with existing tokens when no users are selected
      if (!anyUserSelected && hasToken) {
        continue;
      }

      // Assign token if user is selected or if no users are selected
      if ((anyUserSelected && isSelected) || (!anyUserSelected && !hasToken)) {
        if (tokenIdx < generatedTokens.length) {
          const token = generatedTokens[tokenIdx];
          const isValid = await validateToken(token);
          
          if (isValid) {
            updatedUsers[i] = {
              ...user,
              token: token,
              status: "Assigned",
            };
            // Save to backend
            await saveToBackend(user, token);
            tokenIdx++;
          } else {
            updatedUsers[i] = {
              ...user,
              token: token,
              status: "Invalid",
            };
            tokenIdx++;
          }
        }
      }
    }

    setUsers(updatedUsers);
    setGeneratedTokens([]);
    setSelectedUsers({});
    setSelectAll(false);
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
        <h3 style={{ fontWeight: "bold", paddingLeft: "20px" }}>All users</h3>
      </div>
      <div className="table-container">
        <div
          style={{
            marginBottom: "5px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px",
            gap: "10px"
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {generatedTokens.length > 0 && (
              <div style={{ 
                backgroundColor: "#f0f0f0", 
                padding: "10px", 
                borderRadius: "4px",
                marginBottom: "10px"
              }}>
                <h4 style={{ color: "#333", marginBottom: "5px" }}>Generated Tokens:</h4>
                {generatedTokens.map((token, index) => (
                  <div key={index} style={{ color: "#333" }}>{token}</div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={generateDummyTokens}
                className="btn"
                style={{ padding: "8px 16px", backgroundColor: "#515CBC" }}
              >
                Get Tokens
              </button>
              <button
                onClick={handleAssignTokens}
                className="btn"
                style={{ padding: "8px 16px", backgroundColor: "#4CAF50" }}
                disabled={generatedTokens.length === 0}
              >
                Assign Tokens
              </button>
            </div>
          </div>
        </div>

        <table
          className="tagTable"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </th>
              <th>User</th>
              <th>Mail ID</th>
              <th>Token</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ backgroundColor: '#f0f0f0' }}>
                  <input
                    type="checkbox"
                    checked={!!selectedUsers[u.id]}
                    onChange={() => handleUserSelect(u.id)}
                    disabled={u.status === "Assigned"}
                  />
                </td>
                <td className="text-dark">{u.displayName}</td>
                <td className="text-dark">{u.userPrincipalName}</td>
                <td style={{ backgroundColor: '#f0f0f0' }} className="text-dark">
                  {u.token || "—"}
                </td>
                <td style={{ backgroundColor: '#f0f0f0' }} className="text-dark">
                  {u.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SuperAdmin;