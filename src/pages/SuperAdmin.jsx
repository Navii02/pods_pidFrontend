import React, { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../Utils/AuthConfig";
import axios from "axios";

function SuperAdmin() {
  const { instance, accounts } = useMsal();
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const result = await axios.get(
          "https://graph.microsoft.com/v1.0/users",
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );

        const initialUsers = result.data.value.map((user) => ({
          ...user,
          token: "",
        }));

        setUsers(initialUsers);
      } catch (err) {
        console.error("Token or API error:", err);
        setError(
          "Failed to fetch users. Ensure correct permissions and admin consent."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [instance, accounts]);

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

  const handleAssignTokens = () => {
    const newTokens = tokenInput
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    let tokenIdx = 0;

    const updatedUsers = users.map((user) => {
      const isSelected = selectedUsers[user.id];
      const hasToken = user.token && user.token.trim() !== "";

      if (isSelected && !hasToken && tokenIdx < newTokens.length) {
        return { ...user, token: newTokens[tokenIdx++] };
      }
      return user;
    });

    setUsers(updatedUsers);
    setTokenInput("");
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
        }}
      >
        <textarea
          rows={2}
          placeholder="Paste tokens (one per line)"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          style={{ width: "60%", padding: "8px" }}
        />
        <button
          onClick={handleAssignTokens}
          className="btn"
          style={{ padding: "8px 16px", backgroundColor: "#515CBC" }}
        >
          Assign Tokens
        </button>
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
                  />
                </td>
                <td className="text-dark">{u.displayName}</td>
                <td className="text-dark">{u.userPrincipalName}</td>
                <td style={{ backgroundColor: '#f0f0f0' }} className="text-dark">{u.token || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SuperAdmin;
