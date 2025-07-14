import React from "react";
import Footer from "../components/Footer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../Utils/AuthConfig"; // path to your authConfig

function LandingPage() {
  const navigate = useNavigate();
  const { instance } = useMsal();

  const handleMicrosoftLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup(loginRequest);
      console.log("Microsoft login successful", loginResponse);
      navigate("/iroamer");
    } catch (error) {
      console.error("Microsoft Login failed", error);
    } 
  };



  return (
    <div className="landing-page" style={{ width: "100%", height: "100vh" }}>
      <header>
        <img id="logoPD" src="/images/logo-pd.png" alt="" />
        <div
          id="logout"
          className="me-3"
          style={{ display: "flex" }}
          onClick={handleMicrosoftLogin}
        >
          <p style={{ padding: "8px 16px", cursor: "pointer" }}>
            <FontAwesomeIcon className="ms-1" icon={faArrowRightFromBracket} />
            Log in
          </p>
        </div>
      </header>

      <div id="content">
       
      </div>

      <Footer />
    </div>
  );
}

export default LandingPage;
