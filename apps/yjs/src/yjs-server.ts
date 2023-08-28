import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import jwt from "jsonwebtoken";

import { ApolloServer } from "apollo-server-express";

import { gql } from "apollo-server";
import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";

import { getYDoc, setupWSConnection } from "./yjs-setupWS";

import prisma from "@codepod/prisma";
import { connectSocket, runtime2socket } from "./yjs-runtime";

import { initRoutes, loopKillInactiveRoutes } from "./runtime";

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

async function startServer() {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", setupWSConnection);

  http_server.on("upgrade", async (request, socket, head) => {
    // You may check auth of request here..
    // See https://github.com/websockets/ws#client-authentication
    if (request.url) {
      const url = new URL(`ws://${request.headers.host}${request.url}`);
      const docName = request.url.slice(1).split("?")[0];
      const token = url.searchParams.get("token");
      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as TokenInterface;
        const userId = decoded.id;
        const permission = await checkPermission({ docName, userId });
        switch (permission) {
          case "read":
            // TODO I should disable editing in the frontend as well.
            wss.handleUpgrade(request, socket, head, function done(ws) {
              wss.emit("connection", ws, request, { readOnly: true });
            });
            break;
          case "write":
            wss.handleUpgrade(request, socket, head, function done(ws) {
              wss.emit("connection", ws, request, { readOnly: false });
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
    }
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  });

  await initRoutes();
  loopKillInactiveRoutes();

  const port = process.env.PORT || 4233;
  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}

async function startAPIServer() {
  const apollo = new ApolloServer({
    typeDefs: gql`
      type RouteInfo {
        url: String
        lastActive: String
      }

      input RunSpecInput {
        code: String
        podId: String
      }

      type Query {
        getUrls: [RouteInfo]
        getRoute(url: String): String
      }

      type Mutation {
        addRoute(url: String, target: String): Boolean
        deleteRoute(url: String): Boolean
        connectRuntime(runtimeId: String, repoId: String): Boolean
        runCode(runtimeId: String, spec: RunSpecInput): Boolean
        runChain(runtimeId: String, specs: [RunSpecInput]): Boolean
        interruptKernel(runtimeId: String): Boolean
        requestKernelStatus(runtimeId: String): Boolean
      }
    `,
    resolvers: {
      Query: {
        getUrls: async () => {},
        getRoute: async (_, { url }) => {},
      },
      Mutation: {
        addRoute: async (_, { url, target }) => {},
        deleteRoute: async (_, { url }) => {},
        connectRuntime: async (_, { runtimeId, repoId }) => {
          console.log("=== connectRuntime", runtimeId, repoId);
          // assuming doc is already loaded.
          // FIXME this socket/ is the prefix of url. This is very prone to errors.
          const { doc } = getYDoc(`socket/${repoId}`);
          const rootMap = doc.getMap("rootMap");
          console.log("rootMap", Array.from(rootMap.keys()));
          const runtimeMap = rootMap.get("runtimeMap") as any;
          const resultMap = rootMap.get("resultMap") as any;
          await connectSocket({ runtimeId, runtimeMap, resultMap });
        },
        runCode: async (_, { runtimeId, spec: { code, podId } }) => {
          console.log("runCode", runtimeId, podId);
          const socket = runtime2socket.get(runtimeId);
          if (!socket) return false;
          // clear old results
          // TODO move this to frontend, because it is hard to get ydoc in GraphQL handler.
          //
          // console.log("clear old result");
          // console.log("old", resultMap.get(runtimeId));
          // resultMap.set(podId, { data: [] });
          // console.log("new", resultMap.get(runtimeId));
          // console.log("send new result");
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: "python",
                code: code,
                raw: true,
                podId: podId,
                sessionId: runtimeId,
              },
            })
          );
          return true;
        },
        runChain: async (_, { runtimeId, specs }) => {
          console.log("runChain", runtimeId, specs.podId);
          const socket = runtime2socket.get(runtimeId);
          if (!socket) return false;
          specs.forEach(({ code, podId }) => {
            socket.send(
              JSON.stringify({
                type: "runCode",
                payload: {
                  lang: "python",
                  code: code,
                  raw: true,
                  podId: podId,
                  sessionId: runtimeId,
                },
              })
            );
          });
          return true;
        },
        interruptKernel: async (_, { runtimeId }) => {
          const socket = runtime2socket.get(runtimeId);
          if (!socket) return false;
          socket.send(
            JSON.stringify({
              type: "interruptKernel",
              payload: {
                sessionId: runtimeId,
              },
            })
          );
          return true;
        },
        requestKernelStatus: async (_, { runtimeId }) => {
          console.log("requestKernelStatus", runtimeId);
          const socket = runtime2socket.get(runtimeId);
          if (!socket) {
            console.log("WARN: socket not found");
            return false;
          }
          socket.send(
            JSON.stringify({
              type: "requestKernelStatus",
              payload: {
                sessionId: runtimeId,
              },
            })
          );
          return true;
        },
      },
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  const http_server = http.createServer(expapp);
  // graphql api will be available at /graphql

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  const port = process.env.API_PORT || 4011;
  http_server.listen({ port }, () => {
    console.log(`🚀 API server ready at http://localhost:${port}`);
  });
}

startServer();
startAPIServer();

// ts-node-dev might fail to restart. Force the exiting and restarting. Ref:
// https://github.com/wclr/ts-node-dev/issues/69#issuecomment-493675960
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Exiting...");
  process.exit();
});
