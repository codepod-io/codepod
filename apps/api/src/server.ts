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
import { createUserResolver } from "./resolver_user";
import { RepoResolver } from "./resolver_repo";

// dotenv
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env variable is not set.");
}
// FIXME even if this is undefined, the token verification still works. Looks
// like I only need to set client ID in the frontend?
if (!process.env.GOOGLE_CLIENT_ID) {
  console.log("WARNING: GOOGLE_CLIENT_ID env variable is not set.");
}

const UserResolver = createUserResolver({
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
});

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    ...UserResolver.Query,
    ...RepoResolver.Query,
  },
  Mutation: {
    ...UserResolver.Mutation,
    ...RepoResolver.Mutation,
  },
};

interface TokenInterface {
  id: string;
}

export async function startServer({ port }) {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const token = req?.headers?.authorization?.slice(7);
      let userId;

      console.log("in context", token);

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

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
