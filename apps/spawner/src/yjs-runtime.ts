import * as Y from "yjs";
import WebSocket from "ws";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

export type PodResult = {
  exec_count?: number;
  data: {
    type: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: number;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

export type RuntimeInfo = {
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
          oldresult.lastExecutedAt = Date.now();
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
  routingTable,
}: {
  runtimeId: string;
  runtimeMap: Y.Map<RuntimeInfo>;
  resultMap: Y.Map<PodResult>;
  routingTable: Map<string, string>;
}) {
  console.log("connectSocket");
  const runtime = runtimeMap.get(runtimeId)!;
  switch (runtime.wsStatus) {
    case "connecting":
      // FIXME connecting status could cause dead lock.
      console.log("socket was connecting, skip");
      return;
    case "connected":
      console.log("socket was connected, skip");
      return;
    case "disconnected":
    case undefined:
      {
        const url = routingTable.get(runtimeId);
        if (!url) throw new Error(`cannot find url for runtime ${runtimeId}`);
        console.log("connecting to websocket url", url);
        runtimeMap.set(runtimeId, {
          ...runtime,
          wsStatus: "connecting",
        });
        let socket = new WebSocket(url);
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
