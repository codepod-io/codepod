import React from "react";
import ReactDOM from "react-dom";
// import 'codemirror.css'
import App from "./App";
import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <App />
    {/* <div id="raweditor"></div>
    <textarea id="editor" className="h-auto"></textarea> */}
  </React.StrictMode>,
  document.getElementById("root")
);
