import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import jwt from "jsonwebtoken";

import { createSetupWSConnection } from "@codepod/yjs";
import { bindState, writeState } from "./yjs-blob";

import prisma from "@codepod/prisma";
interface TokenInterface {
  id: string;
}

/**
 * Check if user has permission to access document.
 * @param param0
 * @returns
 */
async function checkPermission({
  docName,
  userId,
}): Promise<"read" | "write" | "none"> {
  // Docname is socket/he3og11sp3b73oh7k47o
  // We need to get the actual ID of the pod
  const repoId = docName.split("/")[1];
  // Query the DB for the pod
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
    },
    include: {
      collaborators: true,
      owner: true,
    },
  });
  if (!repo) return "none";
  if (
    repo.owner.id === userId ||
    repo.collaborators.find((collab) => collab.id === userId)
  ) {
    return "write";
  }
  if (repo.public) {
    return "read";
  }
  return "none";
}

export async function startWsServer({ jwtSecret, port }) {
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
      const url = new URL(`ws://${request.headers.host}${request.url}`);
      const docName = request.url.slice(1).split("?")[0];
      const token = url.searchParams.get("token");
      const role = url.searchParams.get("role");
      let userId = "";
      if (token) {
        const decoded = jwt.verify(token, jwtSecret) as TokenInterface;
        userId = decoded.id;
      }
      const permission = await checkPermission({ docName, userId });
      switch (permission) {
        case "read":
          // TODO I should disable editing in the frontend as well.
          wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request, { readOnly: true, role });
          });
          break;
        case "write":
          wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request, { readOnly: false, role });
          });
          break;
        case "none":
          // This should not happen. This should be blocked by frontend code.
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
      }
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
