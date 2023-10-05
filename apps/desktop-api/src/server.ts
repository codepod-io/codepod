import express from "express";
import http from "http";
import fs from "fs";
import { WebSocketServer } from "ws";

import { createSetupWSConnection } from "@codepod/yjs";
import { bindState, writeState } from "./yjs-blob";

import { ApolloServer, gql } from "apollo-server-express";

import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";

import cors from "cors";

import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

const nanoid = customAlphabet(lowercase + numbers, 20);

export const typeDefs = gql`
  type User {
    id: ID!
    username: String
    email: String!
    password: String!
    firstname: String!
    lastname: String!
  }

  type Repo {
    id: ID!
    name: String
    userId: ID!
    stargazers: [User]
    collaborators: [User]
    public: Boolean
    createdAt: String
    updatedAt: String
    accessedAt: String
  }

  type Query {
    hello: String
    me: User
    repo: Repo
    getDashboardRepos: [Repo]
  }

  type Mutation {
    world: String
    createRepo: Repo
    updateRepo(id: ID!, name: String!): Boolean
    deleteRepo(id: ID!): Boolean
    star(repoId: ID!): Boolean
    unstar(repoId: ID!): Boolean
  }
`;

const CODEPOD_ROOT = "/var/codepod";
const repoDirs = `${CODEPOD_ROOT}/repos`;

const repoPath = "/tmp/example-repo";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    // TODO Dummy Data
    me: () => {
      return {
        id: "localUser",
        username: "localUser",
        email: "",
        firstname: "Local",
        lastname: "User",
      };
    },
    repo: (_, {}) => {
      return {
        id: repoPath,
        name: repoPath,
      };
    },
  },
  Mutation: {
    world: () => {
      return "World!";
    },
  },
};

export async function startServer({ port }) {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  // support cors
  expapp.use(cors());
  // serve static files generated from UI
  expapp.use(express.static("../../packages/ui/dist"));

  const http_server = http.createServer(expapp);

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

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
