// Module to control the application lifecycle and the native browser window.
const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");
const url = require("url");
// const WebSocket = require("ws");
// const express = require("express");
// const http = require("http");
// const { ApolloServer, gql } = require("apollo-server-express");
// const jwt = require("jsonwebtoken");

// import { app, BrowserWindow, protocol } from "electron";
// import path from "path";
// import url from "url";
// import WebSocket from "ws";
// import express from "express";
// import http from "http";

// require("../../api/socket");
const { startServer } = require("cpkernel");

// const { listenOnMessage, typeDefs, resolvers } = require("cpkernel");
// import { listenOnMessage } from "cpkernel";

// Create the native browser window.
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // Set the path of an additional "preload" script that can be used to
    // communicate between node-land and browser-land.
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In production, set the initial browser path to the local bundle generated
  // by the Create React App build process.
  // In development, set it to localhost to allow live/hot-reloading.
  const appURL = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true,
      })
    : "http://localhost:3000";
  mainWindow.loadURL(appURL);

  // Automatically open Chrome's DevTools in development mode.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// Setup a local proxy to adjust the paths of requested files when loading
// them from the local production bundle (e.g.: local fonts, etc...).
function setupLocalFilesNormalizerProxy() {
  protocol.registerHttpProtocol(
    "file",
    (request, callback) => {
      const url = request.url.substr(8);
      callback({ path: path.normalize(`${__dirname}/${url}`) });
    },
    (error) => {
      if (error) console.error("Failed to register protocol");
    }
  );
}

// This method will be called when Electron has finished its initialization and
// is ready to create the browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  setupLocalFilesNormalizerProxy();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
// There, it's common for applications and their menu bar to stay active until
// the user quits  explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// If your app has no need to navigate or only needs to navigate to known pages,
// it is a good idea to limit navigation outright to that known scope,
// disallowing any other kinds of navigation.
const allowedNavigationDestinations = "https://my-electron-app.com";
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (!allowedNavigationDestinations.includes(parsedUrl.origin)) {
      event.preventDefault();
    }
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// create a socket server

// const expapp = express();
// const http_server = http.createServer(expapp);
// const wss = new WebSocket.Server({ server: http_server });
// // graphql api will be available at /graphql
// const apollo = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: ({ req }) => {
//     const token = req?.headers?.authorization?.slice(7);
//     let userId;

//     if (token) {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       userId = decoded.id;
//     }
//     return {
//       userId,
//     };
//   },
// });
// apollo.applyMiddleware({ expapp });

// wss.on("connection", (socket) => {
//   console.log("a user connected");
//   // CAUTION should listen to message on this socket instead of io
//   socket.on("close", () => {
//     console.log("user disconnected");
//   });

//   // listenOnRepl(socket);
//   // listenOnKernelManagement(socket);
//   // listenOnSessionManagement(socket);
//   // listenOnRunCode(socket);
//   listenOnMessage(socket);
// });

// http_server.listen({ port: 14321 }, () => {
//   console.log(`🚀 Server ready at http://localhost:14321`);
// });
console.log(app.getPath("userData"));
startServer(path.join(app.getPath("userData"), "repos"));
