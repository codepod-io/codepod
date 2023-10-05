import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

import { createSetupWSConnection } from "@codepod/yjs";
import { bindState, writeState } from "./yjs-blob";

import cors from "cors";

export async function startServer({ port }) {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  // support cors
  app.use(cors());
  // serve static files generated from UI
  app.use(express.static("../../packages/ui/dist"));

  const http_server = http.createServer(app);

  // Yjs websocket
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (...args) =>
    createSetupWSConnection(bindState, writeState)(...args)
  );

  http_server.on("upgrade", async (request, socket, head) => {
    // You may check auth of request here..
    // See https://github.com/websockets/ws#client-authentication
    if (request.url) {
      wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit("connection", ws, request, { readOnly: false });
      });
      return;
    }
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  });

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
