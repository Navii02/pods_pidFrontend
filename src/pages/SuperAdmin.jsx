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

  // Fetch Microsoft 365 users and match with backend users
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

  // Fetch real tokens from license server
const fetchTokensFromAPI = async () => {
  const loggedInUser = JSON.parse(sessionStorage.getItem("userDetails"));
  const loggedInUserEmail = loggedInUser?.email;
  const loggedInUserToken = loggedInUser?.token;

  if (!loggedInUserEmail) {
    alert("User email not found in session.");
    return;
  }

  try {
    // Step 1: Get assigned tokens from license server
    const response = await axios.post(
      "https://apiservices.plantdesks.com/api/users/check-app-purchase",
      {
        email: loggedInUserEmail,
        app_id: 1,
      }
    );

    // Step 2: Get backend users to extract used tokens
    const backendResponse = await GetAllUsers();
    const backendUsers = backendResponse.data?.data?.users || [];
    const tokensAlreadyUsed = backendUsers.map((u) => u.token).filter(Boolean);

    if (
      response.data.success &&
      response.data.hasPurchased &&
      Array.isArray(response.data.assignedTokens)
    ) {
      const tokens = response.data.assignedTokens
        .map((t) => t.token)
        .filter(
          (token) =>
            token !== loggedInUserToken && !tokensAlreadyUsed.includes(token)
        );

      if (tokens.length === 0) {
        alert("No unassigned tokens found. All tokens may be in use.");
      }

      setGeneratedTokens(tokens);
    } else {
      alert("Failed to fetch tokens.");
    }
  } catch (error) {
    console.error("Error fetching tokens from API:", error);
    alert("Failed to fetch tokens from license server.");
  }
};


  const validateToken = async (token) => {
    // Optional validation logic, keep or remove based on needs
    return token && typeof token === "string" && token.trim() !== "";
  };

  const saveToBackend = async (user, token) => {
    try {
      const data = {
        userId: user.id,
        username: user.displayName,
        email: user.userPrincipalName,
        token: token,
      };
      const response = await Adduser(data);
      return response.status === 200;
    } catch (err) {
      console.error("Backend save error:", err);
      return false;
    }
  };

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

  const handleUserSelect = (userId) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

const handleAssignTokens = async () => {
  if (generatedTokens.length === 0) {
    alert("Please get tokens first");
    return;
  }

  let tokenIdx = 0;
  const updatedUsers = [...users];
  const anyUserSelected = Object.values(selectedUsers).some((val) => val);

  for (let i = 0; i < updatedUsers.length && tokenIdx < generatedTokens.length; i++) {
    const user = updatedUsers[i];
    const isSelected = selectedUsers[user.id];
    const hasToken = user.token && user.token.trim() !== "";

    if (!anyUserSelected && hasToken) continue;

    if ((anyUserSelected && isSelected) || (!anyUserSelected && !hasToken)) {
      const token = generatedTokens[tokenIdx];

      const isValid = await validateToken(token);
      updatedUsers[i] = {
        ...user,
        token,
        status: isValid ? "Assigned" : "Invalid",
      };

      if (isValid) {
        try {
          const assignResponse = await axios.post(
            "https://apiservices.plantdesks.com/api/token-permissions/assign",
            {
              token,
              app_id: 1
            
            }
          );

          if (assignResponse.data.success) {
            const saved = await saveToBackend(user, token);
            if (!saved) {
              console.warn(`Token assigned but failed to save for ${user.displayName}`);
            }
          } else {
            console.warn(`Failed to assign token to ${user.displayName}`);
            updatedUsers[i].status = "Assign Failed";
          }
        } catch (assignErr) {
          console.error(`Error assigning token to ${user.displayName}:`, assignErr);
          updatedUsers[i].status = "Assign Error";
        }
      }

      tokenIdx++;
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
            gap: "10px",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {generatedTokens.length > 0 && (
              <div
                style={{
                  backgroundColor: "#f0f0f0",
                  padding: "10px",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              >
                <h4 style={{ color: "#333", marginBottom: "5px" }}>Available Tokens:</h4>
                {generatedTokens.map((token, index) => (
                  <div key={index} style={{ color: "#333" }}>
                    {token}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={fetchTokensFromAPI}
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
                <td style={{ backgroundColor: "#f0f0f0" }}>
                  <input
                    type="checkbox"
                    checked={!!selectedUsers[u.id]}
                    onChange={() => handleUserSelect(u.id)}
                    disabled={u.status === "Assigned"}
                  />
                </td>
                <td className="text-dark">{u.displayName}</td>
                <td className="text-dark">{u.userPrincipalName}</td>
                <td style={{ backgroundColor: "#f0f0f0" }} className="text-dark">
                  {u.token || "—"}
                </td>
                <td style={{ backgroundColor: "#f0f0f0" }} className="text-dark">
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
