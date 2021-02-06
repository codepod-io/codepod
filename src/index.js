import React from "react";
import ReactDOM from "react-dom";

// import 'codemirror.css'
import App from "./App";

import "./index.css";

import { AuthProvider } from "./AuthContext";
import { PodProvider } from "./PodContext";

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <PodProvider>
        <App />
      </PodProvider>
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
