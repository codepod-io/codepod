import React from "react";
import ReactDOM from "react-dom";

// import 'codemirror.css'
import App from "./App";

import "./index.css";

import { AuthProvider } from "./AuthContext";

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
