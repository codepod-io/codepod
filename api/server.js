// import { ApolloServer, gql } from "apollo-server";
import { ApolloServer, gql } from "apollo-server-express";

import { resolvers } from "./resolvers-pg.js";
import jwt from "jsonwebtoken";
import express from "express";
import http from "http";
// import { Server } from "socket.io";
import { WebSocketServer } from "ws";
import { parse } from "url";

import { listenOnMessage } from "./socket.js";

const typeDefs = gql`
  type Query {
    hello: String
    users: [User]
    me: User
    repos: [Repo]
    repo(name: String!, username: String!): Repo
    pods(username: String, reponame: String): [Pod]
    pod(id: ID!): Pod
    myRepos: [Repo]
    activeSessions: [String]
  }

  type AuthData {
    token: String
  }

  type User {
    id: ID!
    username: String!
    email: String!
    password: String!
    name: String
  }

  type Repo {
    id: ID!
    name: String!
    owner: User!
    pods: [Pod]
  }

  type Pod {
    id: ID!
    type: String
    content: String
    column: Int
    lang: String
    parent: Pod
    index: Int
    children: [Pod]
    result: String
    stdout: String
    error: String
    imports: String
    exports: String
    midports: String
  }

  type Mutation {
    login(username: String, password: String): AuthData
    signup(
      username: String
      email: String
      password: String
      invitation: String
    ): AuthData
    createRepo(name: String): Repo
    deleteRepo(name: String): Boolean
    addPod(
      reponame: String
      username: String
      parent: String
      index: Int
      id: String
      type: String
    ): Pod
    deletePod(id: String, toDelete: [String]): Boolean
    updatePod(
      id: String
      content: String
      column: Int
      type: String
      lang: String
      result: String
      stdout: String
      error: String
      imports: String
      exports: String
      midports: String
    ): Pod
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
    killSession(sessionId: String): Boolean
  }
`;

// This is for the stand-alone apollo server, created using apollo-server
// package instead of apollo-server-express
//
// server.listen().then(() => {
//   console.log(`
//       Server is running!
//       Listening on port 4000
//       Explore at https://studio.apollographql.com/dev
//       Explore at http://localhost:4000/graphql
//     `);
// });

async function startApolloServer() {
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
  });

  const app = express();
  const http_server = http.createServer(app);
  // So actually this works, this will capture all wss://xxx/xxx/xxx no matter
  // the path
  const wss = new WebSocketServer({ server: http_server });
  // const wss = new WebSocketServer({ noServer: true });
  // http_server.on("upgrade", function upgrade(request, socket, head) {
  //   const { pathname } = parse(request.url);
  //   if (pathname === "/ws") {
  //     console.log(".....");
  //     wss.handleUpgrade(request, socket, head, function done(ws) {
  //       wss.emit("connection", ws, request);
  //     });
  //   } else {
  //     socket.destroy();
  //   }
  // });

  apollo.applyMiddleware({ app });

  app.use((req, res) => {
    res.status(200);
    res.send("Hello!");
    res.end();
  });

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

  // should call http_server.listen instead of express app.listen, otherwise
  // CORS won't work
  await new Promise((resolve) => http_server.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${apollo.graphqlPath}`);
  // return { apollo, app };
  return;
}

startApolloServer();
