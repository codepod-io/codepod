// import { ApolloServer, gql } from "apollo-server";
import { ApolloServer, gql } from "apollo-server-express";

import { resolvers } from "./resolvers-pg.js";
import jwt from "jsonwebtoken";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import * as pty from "node-pty";

import { Kernel, constructMessage, constructExecuteRequest } from "./kernel.js";

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
    error: String
    imports: String
    exports: String
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
      error: String
      imports: String
      exports: String
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
  let kernels = {
    julia: new Kernel("./kernels/julia/conn.json"),
    racket: new Kernel("./kernels/racket/conn.json"),
  };
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

    // listen IOPub
    for (const [lang, kernel] of Object.entries(kernels)) {
      kernel.listenIOPub((topic, msgs) => {
        // console.log("-----", topic, msgs);
        // iracket's topic seems to be an ID. I should use msg type instead
        switch (msgs.header.msg_type) {
          case "status":
            console.log("emiting status ..");
            socket.emit("status", lang, msgs.content.execution_state);
            break;
          case "execute_result":
            console.log("emitting execute_result ..");
            socket.emit("execute_result", {
              podId: msgs.parent_header.msg_id,
              result: msgs.content.data["text/plain"],
              count: msgs.content.execution_count,
            });
            break;
          case "stdout":
            console.log("emitting stdout ..");
            if (msgs.content.text.startsWith("base64 binary data")) {
              console.log("warning: base64 encoded stdout");
            } else {
              socket.emit("stdout", {
                podId: msgs.parent_header.msg_id,
                stdout: msgs.content.text,
              });
            }
            break;
          case "error":
            console.log("emitting error ..");
            socket.emit("error", {
              podId: msgs.parent_header.msg_id,
              stacktrace: msgs.content.traceback,
              ename: msgs.content.ename,
              evalue: msgs.content.evalue,
            });
            break;
          case "stream":
            // iracket use this to send stderr
            // FIXME there are many frames
            if (msgs.content.name === "stdout") {
              console.log("ignore stdout stream");
            } else if (msgs.content.name === "stderr") {
              console.log("emitting error stream ..");
              socket.emit("stream", {
                podId: msgs.parent_header.msg_id,
                text: msgs.content.text,
              });
            } else {
              console.log(msgs);
              throw new Error(`Invalid stream type: ${msgs.content.name}`);
            }
            break;
          default:
            console.log(
              "Message Not handled",
              msgs.header.msg_type,
              "topic:",
              topic
            );
            // console.log("Message body:", msgs);
            break;
        }
      });
    }

    socket.on("runCode", ({ lang, code, podId, namespace }) => {
      if (!(lang in kernels)) {
        console.log("Invalid language", lang);
        socket.emit("stdout", {
          podId: podId,
          stdout: `Error: Invalid Language ${lang}`,
        });
      } else {
        kernels[lang].sendShellMessage(
          constructExecuteRequest({ code, msg_id: podId, namespace })
        );
      }
    });

    socket.on("requestKernelStatus", (lang) => {
      if (lang in kernels) {
        kernels[lang].sendShellMessage(
          constructMessage({ msg_type: "kernel_info_request" })
        );
      } else {
        console.log("Invalid requestKernelStatus for lang", lang);
      }
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
