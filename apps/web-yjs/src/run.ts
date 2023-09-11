import { startWsServer } from "./yjs-server";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env variable is not set.");
}

startWsServer({ jwtSecret: process.env.JWT_SECRET, port: 4233 });
// startAPIServer({ port: 4234 });

// ts-node-dev might fail to restart. Force the exiting and restarting. Ref:
// https://github.com/wclr/ts-node-dev/issues/69#issuecomment-493675960
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Exiting...");
  process.exit();
});
