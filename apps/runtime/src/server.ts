import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { ApolloClient, InMemoryCache } from "@apollo/client/core";

import { listenOnMessage, initializeKernel } from "./kernel";

interface TokenInterface {
  id: string;
}

const cache: InMemoryCache = new InMemoryCache({});

async function startServer() {
  const expapp = express();
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });

  wss.on("connection", (socket) => {
    console.log("a user connected");
    initializeKernel(socket);
    // CAUTION should listen to message on this socket instead of io
    socket.on("close", () => {
      console.log("user disconnected");
    });

    // listenOnRepl(socket);
    // listenOnKernelManagement(socket);
    // listenOnSessionManagement(socket);
    // listenOnRunCode(socket);
    listenOnMessage(socket);
  });

  const port = process.env.WS_PORT || 4020;
  http_server.listen({ port }, () => {
    console.log(`🚀 WS_server ready at http://localhost:${port}`);
  });
}

startServer();
