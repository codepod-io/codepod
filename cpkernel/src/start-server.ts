import { startServer } from "./server";

import path from "path";

const appdata =
  process.env.APPDATA ||
  (process.platform == "darwin"
    ? process.env.HOME + "/Library/Application Support"
    : process.env.HOME + "/.local/share");

startServer(path.join(appdata, "codepod", "repos"));
