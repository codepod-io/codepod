import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { createSetupWSConnection } from "@codepod/yjs";
import { bindState, writeState } from "./yjs-blob";

export async function startWsServer({ port }) {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  const http_server = http.createServer(expapp);
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
