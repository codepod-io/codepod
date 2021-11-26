// Module to control the application lifecycle and the native browser window.
const {
  app,
  BrowserWindow,
  protocol,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const url = require("url");


if (app.isPackaged) {
  const { startServer } = require("cpkernel");
  const express = require("express");

  // if packaged, run the backend:
  // 1. the graphql on :14321
  // 2. the static UI on :14322

  // during development, I'm going to start the two server manually
  console.log("Starting repo/kernel server ..")
  startServer(path.join(app.getPath("userData"), "repos"));

  const static_dir = path.join(__dirname, "ui");
  console.log("===", static_dir);
  const expapp = express();
  expapp.use("/", express.static(static_dir));
  console.log("starting UI server ..")
  expapp.listen(14322, () => {
    console.log("UI server started on port :14322");
  });
}

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
  const indexurl = url.format({
    pathname: path.join(__dirname, "index.html"),
    protocol: "file:",
    slashes: true,
  });
  const appURL = app.isPackaged
    ? url.format({
      pathname: path.join(__dirname, "ui/index.html"),
      protocol: "file:",
      slashes: true,
    })
    : // : "http://localhost:13001";
    "http://localhost:14322";
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

let tray;

// This method will be called when Electron has finished its initialization and
// is ready to create the browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  setupLocalFilesNormalizerProxy();

  const icon = nativeImage.createFromPath("./favicon.ico");
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open in Browser",
      type: "normal",
      click: () => {
        require("electron").shell.openExternal("http://localhost:14322");
      },
    },
    { label: "Preference", type: "normal" },
    { label: "Dashboard" },
    { label: "Public Access", type: "checkbox" },
    {
      label: "Quit", click: () => {
        app.quit();
      }
    },
  ]);

  tray.setContextMenu(contextMenu);
  // tray.setToolTip("This is my application");
  tray.setTitle("CP");

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
