import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import ContextShare from "./context/ContextShare";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
     <ContextShare>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </ContextShare>
  </React.StrictMode>
);
