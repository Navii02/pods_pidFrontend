import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../assets/images/logo-pd.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { iroamerContext, updateProjectContext } from "../context/ContextShare";

const Header = () => {
  const navigate = useNavigate();
    const {setIroamerfieldEmpty,setModaldata} =
      useContext(iroamerContext);
  const { setUpdateProject } = useContext(updateProjectContext);
  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;

  const handleLogout = async () => {
 
    sessionStorage.clear();

    setUpdateProject("No data");
    setIroamerfieldEmpty(false)
    setModaldata([])
    navigate("/iroamer");
  };

  //console.log(project?.projectName);

  return (
    <header>
      <img id="logoPD" src="/images/logo-pd.png" alt="" onClick={() => navigate("/")} />

     <p className="text-light">
  {project?.projectName || ""}
  {project?.projectName && project?.projectNumber ? "--" : ""}
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

Header.propTypes = {
  // Add prop types if needed
};

export default Header;
