import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import ContextShare from "./context/ContextShare";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./Utils/AuthConfig"; // Import your config

const msalInstance = new PublicClientApplication(msalConfig);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ContextShare>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ContextShare>
    </MsalProvider>
  </React.StrictMode>
);
