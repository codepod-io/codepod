import { WebSocketServer } from "ws";
import express from "express";
import http from "http";
import { ApolloServer, gql } from "apollo-server-express";
import jwt from "jsonwebtoken";

import { typeDefs } from "./typedefs.js";
// import { resolvers } from "./resolver.js";
import { listenOnMessage } from "./socket.js";
import { getResolvers } from "./resolver_local.js";

export function startSocketServer() {
  // only listen on socket for kernel

  const app = express();
  const http_server = http.createServer(app);
  const wss = new WebSocketServer({ server: http_server });
  wss.on("connection", (socket) => {
    console.log("a user connected");
    // CAUTION should listen to message on this socket instead of io
    socket.on("close", () => {
      console.log("user disconnected");
    });

    // listenOnRepl(socket);
    // listenOnKernelManagement(socket);
    // listenOnSessionManagement(socket);
    // listenOnRunCode(socket);
    // useMQ=true when creating a stand-alone runtime server
    listenOnMessage(socket, true);
  });

  http_server.listen({ port: 14321 }, () => {
    console.log(`🚀 Server ready at http://localhost:14321`);
  });
}

export async function startServer(appDir, staticDir) {
  const apollo = new ApolloServer({
    typeDefs,
    // resolvers,
    resolvers: getResolvers(appDir),
    context: ({ req }) => {
      const token = req?.headers?.authorization?.slice(7);
      let userId;

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      }
      return {
        userId,
      };
    },
  });
  const expapp = express();
  if (staticDir) {
    console.log("using static dir", staticDir);
    expapp.use("/", express.static(staticDir));
  }
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });
  // graphql api will be available at /graphql

  // await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  wss.on("connection", (socket) => {
    console.log("a user connected");
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

  http_server.listen({ port: 14321 }, () => {
    console.log(`🚀 Server ready at http://localhost:14321`);
  });
}
