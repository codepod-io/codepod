import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { ApolloServer, gql } from "apollo-server-express";
import jwt from "jsonwebtoken";

import {
  ApolloServerPluginLandingPageProductionDefault,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";

import { typeDefs } from "./typedefs";
import { resolvers } from "./resolver";
import { listenOnMessage } from "./socket.js";

export async function startServer() {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
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
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });
  // graphql api will be available at /graphql

  await apollo.start();
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

  http_server.listen({ port: 4000 }, () => {
    console.log(`🚀 Server ready at http://localhost:4000`);
  });
}
