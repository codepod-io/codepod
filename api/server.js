// import { ApolloServer, gql } from "apollo-server";
import { ApolloServer, gql } from "apollo-server-express";

import { resolvers } from "./resolvers-pg.js";
import jwt from "jsonwebtoken";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import * as pty from "node-pty";

import {
  JuliaKernel,
  constructMessage,
  constructExecuteRequest,
} from "./kernel.js";

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
    lang: String
    parent: Pod
    index: Int
    children: [Pod]
    result: String
    stdout: String
  }

  type Mutation {
    login(username: String, password: String): AuthData
    signup(
      username: String
      email: String
      password: String
      name: String
    ): AuthData
    createRepo(name: String): Repo
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
      type: String
      lang: String
      result: String
      stdout: String
    ): Pod
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
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
  const io = new Server(http_server, {
    cors: {
      origin: "*",
    },
  });

  apollo.applyMiddleware({ app });

  app.use((req, res) => {
    res.status(200);
    res.send("Hello!");
    res.end();
  });

  let procs = {};

  console.log("connnecting to kernel ..");
  let kernel = new JuliaKernel();
  console.log("kernel connected");

  io.on("connection", (socket) => {
    console.log("a user connected");
    // CAUTION should listen to message on this socket instead of io
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
    // FIXME kill previous julia process?
    let proc;
    socket.on("spawn", (sessionId, lang) => {
      if (sessionId in procs && lang in procs[sessionId]) {
        // already exist
        proc = procs[sessionId][lang];
      } else {
        switch (lang) {
          case "julia":
            proc = pty.spawn("julia");
            break;
          case "python":
            proc = pty.spawn("python3");
            break;
          default:
            console.log(`Invalid language: ${lang}`);
            return;
        }
        if (!(sessionId in procs)) {
          procs[sessionId] = {};
        }
        procs[sessionId][lang] = proc;
      }
      // This will broadcast output to all REPL pods
      //
      // How did Jupyter handle this? Each cell send code to the server. The
      // server evaluate it and send back. The front-end then know which cell
      // sends the code? Or the cell send the result together with the cell ID?
      //
      // Actually the terminal monitor each stroke, so probably I cannot do it
      // better. I would skip terminal for now, as it is not too critical.
      proc.onData((data) => {
        socket.emit("terminalOutput", data);
      });
      proc.onExit(({ exitCode, signal }) => {});
    });

    socket.on("terminalInput", (data) => {
      if (proc) {
        proc.write(data);
      } else {
        console.log("warning: received input, but proc not connected");
      }
    });

    kernel.listenIOPub((topic, msgs) => {
      switch (topic) {
        case "status":
          console.log("emiting status ..");
          socket.emit("status", msgs.content.execution_state);
          break;
        case "execute_result":
          console.log("emitting execute_result ..");
          socket.emit("execute_result", {
            podId: msgs.parent_header.msg_id,
            result: msgs.content.data["text/plain"],
          });
          break;
        default:
          console.log("Message Not handled", topic);
          break;
      }
    });

    socket.on("runCode", (code, podId) => {
      kernel.sendShellMessage(constructExecuteRequest({ code, msg_id: podId }));
    });

    socket.on("requestKernelStatus", () => {
      kernel.sendShellMessage(constructMessage("kernel_info_request"));
    });
  });

  // should call http_server.listen instead of express app.listen, otherwise
  // CORS won't work
  await new Promise((resolve) => http_server.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${apollo.graphqlPath}`);
  // return { apollo, app };
  return;
}

startApolloServer();
