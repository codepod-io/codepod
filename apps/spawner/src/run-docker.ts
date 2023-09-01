import { startAPIServer } from "./server";

import { killRuntime, spawnRuntime } from "./spawner-docker";

require("dotenv").config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env variable is not set.");
}

startAPIServer({ port: 4021, spawnRuntime, killRuntime });

// ts-node-dev might fail to restart. Force the exiting and restarting. Ref:
// https://github.com/wclr/ts-node-dev/issues/69#issuecomment-493675960
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Exiting...");
  process.exit();
});
