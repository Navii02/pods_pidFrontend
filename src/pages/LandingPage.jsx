import React from "react";
import Footer from "../components/Footer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../Utils/AuthConfig";
import { GetuserDetails } from "../services/UserApi";
import axios from "axios";

function LandingPage() {
  const navigate = useNavigate();
  const { instance } = useMsal();

  // ✅ Updated to check `exists` and `is_enabled`
  const validateToken = async (token) => {
    try {
      const response = await axios.post(
        "https://apiservices.plantdesks.com/api/user-tokens/check-exists",
        { token }
      );
      const data = response.data;
      return data.exists === true && data.token_info?.is_enabled === true;
    } catch (err) {
      console.error("Token validation failed", err);
      return false;
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup(loginRequest);
      console.log("Microsoft login successful", loginResponse);

      if (loginResponse) {
        const account = loginResponse.account;
        const data = {
          username: account.name,
          email: account.username,
          userId: loginResponse.uniqueId,
        };

        const response = await GetuserDetails(data);

        if (response.status === 200) {
          const token = response.data.user.token;

          const isValid = await validateToken(token);

          if (isValid) {
            sessionStorage.setItem(
              "userDetails",
              JSON.stringify(response.data.user)
            );
            sessionStorage.setItem(
              "projects",
              JSON.stringify(response.data.projects)
            );

            navigate("/iroamer");
          } else {
            alert("Sorry, you have no access or your token is invalid.");
          }
        }
      }
    } catch (error) {
      console.error("Microsoft Login failed", error);
    }
  };

  return (
    <div className="landing-page" style={{ width: "100%", height: "100vh" }}>
      <header>
        <img id="logoPD" src="/images/logo-pd.png" alt="Logo" />
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

      <div id="content"></div>

      <Footer />
    </div>
  );
}

export default LandingPage;
