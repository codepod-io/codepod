import { startServer } from "./server.js";

const appdata =
  process.env.APPDATA ||
  (process.platform == "darwin"
    ? process.env.HOME + "/Library/Application Support"
    : process.env.HOME + "/.local/share");

startServer(path.join(appdata, "CodePod"));
