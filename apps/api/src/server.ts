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
import { initRoutes, loopKillInactiveRoutes } from "./resolver_runtime";

interface TokenInterface {
  id: string;
}

async function startServer() {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const token = req?.headers?.authorization?.slice(7);
      let userId;

      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as TokenInterface;
        userId = decoded.id;
      }
      return {
        userId,
      };
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });
  // graphql api will be available at /graphql

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  await initRoutes();
  loopKillInactiveRoutes();

  const port = process.env.PORT || 4000;
  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}

startServer();
