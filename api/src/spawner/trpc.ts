import { initTRPC } from "@trpc/server";
const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

import express from "express";
import Y from "yjs";
import WebSocket from "ws";
import { z } from "zod";

// import { WebsocketProvider } from "../../ui/src/lib/y-websocket";
import { WebsocketProvider } from "../yjs/y-websocket";

import { killRuntime, spawnRuntime } from "./spawner_native";

import { connectSocket, runtime2socket, RuntimeInfo } from "./yjs_runtime";

// FIXME need to have a TTL to clear the ydoc.
const docs: Map<string, Y.Doc> = new Map();

// FIXME hard-coded yjs server url
const yjsServerUrl = `ws://localhost:4000/socket`;

const app = express();
const http = require("http");

async function getMyYDoc({ repoId, yjsServerUrl }): Promise<Y.Doc> {
  return new Promise((resolve, reject) => {
    const oldydoc = docs.get(repoId);
    if (oldydoc) {
      resolve(oldydoc);
      return;
    }
    const ydoc = new Y.Doc();
    // connect to primary database
    console.log("connecting to y-websocket provider", yjsServerUrl);
    const provider = new WebsocketProvider(yjsServerUrl, repoId, ydoc, {
      // resyncInterval: 2000,
      //
      // BC is more complex to track our custom Uploading status and SyncDone events.
      disableBc: true,
      params: {
        role: "runtime",
      },
      // IMPORTANT: import websocket, because we're running it in node.js
      WebSocketPolyfill: WebSocket as any,
    });
    provider.on("status", ({ status }) => {
      console.log("provider status", status);
    });
    provider.once("synced", () => {
      console.log("Provider synced");
      docs.set(repoId, ydoc);
      resolve(ydoc);
    });
    provider.connect();
  });
}

const routingTable: Map<string, string> = new Map();

export function createSpawnerRouter(
  yjsServerUrl,
  copilotIpAddress,
  copilotPort
) {
  return router({
    spawnRuntime: publicProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId } }) => {
        console.log("spawnRuntime", runtimeId, repoId);
        // create the runtime container
        const wsUrl = await spawnRuntime(runtimeId);
        console.log("Runtime spawned at", wsUrl);
        routingTable.set(runtimeId, wsUrl);
        // set initial runtimeMap info for this runtime
        console.log("Loading yDoc ..");
        const doc = await getMyYDoc({ repoId, yjsServerUrl });
        console.log("yDoc loaded");
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.set(runtimeId, {});
        //   console.log("=== runtimeMap", runtimeMap);
        let values = Array.from(runtimeMap.values());
        const keys = Array.from(runtimeMap.keys());
        console.log("all runtimes", keys);
        const nodesMap = rootMap.get("nodesMap") as Y.Map<any>;
        const nodes = Array.from(nodesMap.values());
        console.log("all nodes", nodes);
        return true;
      }),
    killRuntime: publicProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId } }) => {
        await killRuntime(runtimeId);
        console.log("Removing route ..");
        // remove from runtimeMap
        const doc = await getMyYDoc({ repoId, yjsServerUrl });
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.delete(runtimeId);
        routingTable.delete(runtimeId);
        return true;
      }),

    connectRuntime: publicProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId } }) => {
        console.log("=== connectRuntime", runtimeId, repoId);
        // assuming doc is already loaded.
        // FIXME this socket/ is the prefix of url. This is very prone to errors.
        const doc = await getMyYDoc({ repoId, yjsServerUrl });
        const rootMap = doc.getMap("rootMap");
        console.log("rootMap", Array.from(rootMap.keys()));
        const runtimeMap = rootMap.get("runtimeMap") as any;
        const resultMap = rootMap.get("resultMap") as any;
        await connectSocket({
          runtimeId,
          runtimeMap,
          resultMap,
          routingTable,
        });
      }),
    disconnectRuntime: publicProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId } }) => {
        console.log("=== disconnectRuntime", runtimeId);
        // get socket
        const socket = runtime2socket.get(runtimeId);
        if (socket) {
          socket.close();
          runtime2socket.delete(runtimeId);
        }

        const doc = await getMyYDoc({ repoId, yjsServerUrl });
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.set(runtimeId, {});
      }),
    runCode: publicProcedure
      .input(
        z.object({
          runtimeId: z.string(),
          spec: z.object({ code: z.string(), podId: z.string() }),
        })
      )
      .mutation(
        async ({
          input: {
            runtimeId,
            spec: { code, podId },
          },
        }) => {
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
        }
      ),
    runChain: publicProcedure
      .input(
        z.object({
          runtimeId: z.string(),
          specs: z.array(z.object({ code: z.string(), podId: z.string() })),
        })
      )
      .mutation(async ({ input: { runtimeId, specs } }) => {
        console.log("runChain", runtimeId);
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
      }),
    interruptKernel: publicProcedure
      .input(z.object({ runtimeId: z.string() }))
      .mutation(async ({ input: { runtimeId } }) => {
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
      }),
    requestKernelStatus: publicProcedure
      .input(z.object({ runtimeId: z.string() }))
      .mutation(async ({ input: { runtimeId } }) => {
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
      }),
    codeAutoComplete: publicProcedure
      .input(
        z.object({
          inputPrefix: z.string(),
          inputSuffix: z.string(),
          podId: z.string(),
        })
      )
      .mutation(async ({ input: { inputPrefix, inputSuffix, podId } }) => {
        console.log(
          `======= codeAutoComplete of pod ${podId} ========\n`,
          inputPrefix,
          inputSuffix
        );
        let data = "";
        let options = {};
        if (inputSuffix.length == 0) {
          data = JSON.stringify({
            prompt: inputPrefix,
            temperature: 0.1,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.05,
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: 128,
            stream: false,
          });

          options = {
            hostname: copilotIpAddress,
            port: copilotPort,
            path: "/completion",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            },
          };
        } else {
          data = JSON.stringify({
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            temperature: 0.1,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.05,
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: 128,
          });

          options = {
            hostname: copilotIpAddress,
            port: copilotPort,
            path: "/infill",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            },
          };
        }

        return new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let responseData = "";

            res.on("data", (chunk) => {
              responseData += chunk;
            });

            res.on("end", () => {
              if (responseData.toString() === "") {
                resolve(""); // Resolve with an empty string if no data
              }
              const resData = JSON.parse(responseData.toString());
              console.log(res.statusCode, resData["content"]);
              resolve(resData["content"]); // Resolve the Promise with the response data
            });
          });

          req.on("error", (error) => {
            console.error(error);
            reject(error); // Reject the Promise if an error occurs
          });

          req.write(data);
          req.end();
        });
      }),
  });
}

// This is only used for frontend to get the type of router.
const _appRouter_for_type = router({
  spawner: createSpawnerRouter(null, null, null), // put procedures under "post" namespace
});
export type AppRouter = typeof _appRouter_for_type;
