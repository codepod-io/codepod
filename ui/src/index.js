import React from "react";
import ReactDOM from "react-dom";

// import 'codemirror.css'
import App from "./App";

import { AuthProvider } from "./AuthContext";
import { PodProvider } from "./PodContext";

import { Provider } from "react-redux";

import store from "./store.js";

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <PodProvider>
          <App />
        </PodProvider>
      </AuthProvider>
    </Provider>
  </React.StrictMode>,
  document.getElementById("root")
);
