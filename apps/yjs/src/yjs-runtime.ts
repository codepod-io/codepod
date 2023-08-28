import * as Y from "yjs";
import WebSocket from "ws";

import { spawnRuntime, killRuntime } from "./runtime";

type PodResult = {
  exec_count?: number;
  last_exec_end?: boolean;
  data: {
    type: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: Date;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

type RuntimeInfo = {
  status?: string;
  wsStatus?: string;
};

export const runtime2socket = new Map<string, WebSocket>();

export async function setupRuntimeSocket({
  socket,
  sessionId,
  runtimeMap,
  resultMap,
}: {
  resultMap: Y.Map<PodResult>;
  runtimeMap: Y.Map<RuntimeInfo>;
  sessionId: string;
  socket: WebSocket;
}) {
  console.log("--- setupRuntimeSocket", sessionId);
  socket.onopen = () => {
    console.log("socket connected for runtime", sessionId);
    runtimeMap.set(sessionId, {
      wsStatus: "connected",
    });
    runtime2socket.set(sessionId, socket);
    // request kernel status
    socket.send(
      JSON.stringify({
        type: "requestKernelStatus",
        payload: {
          sessionId,
        },
      })
    );
  };
  socket.onclose = () => {
    console.log("Socket closed for runtime", sessionId);
    runtimeMap.set(sessionId, {
      wsStatus: "disconnected",
    });
    runtime2socket.delete(sessionId);
  };
  socket.onerror = (err) => {
    console.error("[ERROR] Got error", err.message);
    // if error is 404, try create the kernel
  };
  socket.onmessage = (msg) => {
    // FIXME is msg.data a string?
    let { type, payload } = JSON.parse(msg.data as string);
    // console.debug("got message", type, payload);

    switch (type) {
      case "stream":
        {
          let { podId, content } = payload;
          const oldresult: PodResult = resultMap.get(podId) || { data: [] };
          // FIXME if I modify the object, would it modify resultMap as well?
          oldresult.data.push({
            type: `${type}_${content.name}`,
            text: content.text,
          });
          resultMap.set(podId, oldresult);
        }
        break;
      case "execute_result":
        {
          let { podId, content, count } = payload;
          const oldresult: PodResult = resultMap.get(podId) || { data: [] };
          oldresult.data.push({
            type,
            text: content.data["text/plain"],
            html: content.data["text/html"],
          });
          resultMap.set(podId, oldresult);
        }
        break;
      case "display_data":
        {
          let { podId, content } = payload;
          const oldresult: PodResult = resultMap.get(podId) || { data: [] };
          oldresult.data.push({
            type,
            text: content.data["text/plain"],
            image: content.data["image/png"],
            html: content.data["text/html"],
          });
          resultMap.set(podId, oldresult);
        }
        break;
      case "execute_reply":
        {
          let { podId, result, count } = payload;
          const oldresult: PodResult = resultMap.get(podId) || { data: [] };
          oldresult.running = false;
          oldresult.lastExecutedAt = new Date();
          oldresult.exec_count = count;
          resultMap.set(podId, oldresult);
        }
        break;
      case "error":
        {
          let { podId, ename, evalue, stacktrace } = payload;
          const oldresult: PodResult = resultMap.get(podId) || { data: [] };
          oldresult.error = { ename, evalue, stacktrace };
        }
        break;
      case "status":
        {
          const { lang, status, id } = payload;
          // listen to messages
          runtimeMap.set(sessionId, { ...runtimeMap.get(sessionId), status });
        }
        break;
      case "interrupt_reply":
        // console.log("got interrupt_reply", payload);
        break;
      default:
        console.warn("WARNING unhandled message", { type, payload });
    }
  };
}

/**
 * Get the active socket. Create if not connected.
 */
export async function connectSocket({
  runtimeId,
  runtimeMap,
  resultMap,
}: {
  runtimeId: string;
  runtimeMap: Y.Map<RuntimeInfo>;
  resultMap: Y.Map<PodResult>;
}) {
  const runtime = runtimeMap.get(runtimeId)!;
  switch (runtime.wsStatus) {
    case "connecting":
      console.log("socket was connecting, skip");
      return;
    case "connected":
      console.log("socket was connected, skip");
      return;
    case "disconnected":
    case undefined:
      {
        runtimeMap.set(runtimeId, {
          ...runtime,
          wsStatus: "connecting",
        });
        let socket = new WebSocket(`ws://proxy:4010/${runtimeId}`);
        await setupRuntimeSocket({
          socket,
          sessionId: runtimeId,
          runtimeMap,
          resultMap,
        });
      }
      break;
    default:
      throw new Error(`unknown wsStatus ${runtime.wsStatus}`);
  }
}

/**
 * Observe the runtime status info, talk to runtime servver, and update the result.
 */
export function setupObserversToRuntime(ydoc: Y.Doc, repoId: string) {
  const rootMap = ydoc.getMap("rootMap");
  if (rootMap.get("runtimeMap") === undefined) {
    rootMap.set("runtimeMap", new Y.Map<RuntimeInfo>());
  }
  if (rootMap.get("resultMap") === undefined) {
    rootMap.set("resultMap", new Y.Map<PodResult>());
  }
  const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
  // clear runtimeMap status/commands but keep the ID
  for (let key of runtimeMap.keys()) {
    runtimeMap.set(key, {});
  }
  const resultMap = rootMap.get("resultMap") as Y.Map<PodResult>;
  runtimeMap.observe(
    async (ymapEvent: Y.YMapEvent<RuntimeInfo>, transaction: Y.Transaction) => {
      if (transaction.local) {
        return;
      }
      ymapEvent.changes.keys.forEach(async (change, runtimeId) => {
        if (change.action === "add") {
          console.log(
            `Property "${runtimeId}" was added. Initial value: "${runtimeMap.get(
              runtimeId
            )}".`
          );
          const runtime = runtimeMap.get(runtimeId)!;
          console.log(
            "TODO create runtime",
            runtimeId,
            runtimeMap.get(runtimeId)
          );
          const sessionId = runtimeId;
          const created = await spawnRuntime(null, {
            sessionId,
          });
          if (!created) {
            // throw new Error("Failed to create runtime");
            console.error("Failed to create runtime");
          }
          // create socket
          //
          // FIXME it takes time to create the socket, so we need to wait for a
          // while, so we need to keep trying to connect. Currently the re-try
          // logic is done in the frontend.
          //
          // TODO in the future, we need to either attach a callback to the
          // spawner. When the runtime is ready, it should menifest itself.
          //
          // await connectSocket({ runtimeId: sessionId, runtimeMap, resultMap
          // });
          //
          // try an interval
        } else if (change.action === "update") {
          // NO OP
        } else if (change.action === "delete") {
          // FIXME make sure the runtime is deleted.
          console.log("delete runtime", runtimeId, change.oldValue);
          // kill the runtime
          const socket = runtime2socket.get(runtimeId);
          socket?.close();
          await killRuntime(null, {
            sessionId: runtimeId,
          });
          runtime2socket.delete(runtimeId);
        }
      });
    }
  );
}
