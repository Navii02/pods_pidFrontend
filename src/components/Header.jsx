import React, { useContext } from "react";

import { useNavigate } from "react-router-dom";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";

import { iroamerContext, updateProjectContext } from "../context/ContextShare";

import { useMsal } from "@azure/msal-react"; // Import MSAL hook

const Header = () => {
  const navigate = useNavigate();

  const { instance } = useMsal(); // Get MSAL instance

  const { setIroamerfieldEmpty, setModaldata } = useContext(iroamerContext);

  const { setUpdateProject } = useContext(updateProjectContext);

  const projectString = sessionStorage.getItem("selectedProject");

  const project = projectString ? JSON.parse(projectString) : null;

  const handleLogout = async () => {
    try {
      // Clear all session storage

      // Clear context states

      setUpdateProject("No data");

      setIroamerfieldEmpty(false);

      setModaldata([]);

      // MSAL logout - using popup for better UX

      await instance.logoutPopup({
        postLogoutRedirectUri: "/", // Redirect to home after logout

        mainWindowRedirectUri: "/", // For popup window
      });

      sessionStorage.clear();

      // Navigate to home page

      navigate("/");

      // Optional: Force reload to ensure clean state

      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);

      // Fallback cleanup if MSAL logout fails

      sessionStorage.clear();

      navigate("/");
    }
  };

  return (
    <header>
      <img
        id="logoPD"
        src="/images/logo-pd.png"
        alt=""
        onClick={() => navigate("/")}
        style={{ cursor: "pointer" }}
      />

      <p className="text-light">
        {project?.projectName || ""}

        {project?.projectName && project?.projectNumber ? " -- " : ""}

        {project?.projectNumber || ""}
      </p>

      <div
        id="logout"
        className="me-3"
        style={{ display: "flex" }}
        onClick={handleLogout}
      >
        <p style={{ padding: "8px 16px", cursor: "pointer" }}>
          <FontAwesomeIcon
            style={{ cursor: "pointer" }}
            className="ms-1"
            icon={faArrowRightFromBracket}
          />
          Log out
        </p>
      </div>
    </header>
  );
};

export default Header;
