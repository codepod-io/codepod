import { WebSocket, WebSocketServer } from "ws";

import express from "express";
import http from "http";

import {
  ZmqWire,
  constructExecuteRequest,
  constructMessage,
  handleIOPub_status,
  handleIOPub_execute_result,
  handleIOPub_stdout,
  handleIOPub_error,
  handleIOPub_stream,
  handleIOPub_display_data,
} from "./zmq-utils";

function bindZMQ(zmq_wire: ZmqWire, socket: WebSocket) {
  zmq_wire.setOnIOPub((topic, msgs) => {
    // console.log("-----", topic, msgs);
    // iracket's topic seems to be an ID. I should use msg type instead
    switch (msgs.header.msg_type) {
      case "status":
        handleIOPub_status({ msgs, socket, lang: "python" });
        break;
      case "execute_result":
        handleIOPub_execute_result({
          msgs,
          socket,
        });
        break;
      case "stdout":
        handleIOPub_stdout({ msgs, socket });
        break;
      case "error":
        handleIOPub_error({ msgs, socket });
        break;
      case "stream":
        handleIOPub_stream({
          msgs,
          socket,
        });
        break;
      case "display_data":
        handleIOPub_display_data({
          msgs,
          socket,
        });
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

  zmq_wire.setOnShell((msgs) => {
    // DEBUG
    // socket = this.mq_socket;
    // socket = this.socket;
    switch (msgs.header.msg_type) {
      case "execute_reply":
        {
          let [podId, name] = msgs.parent_header.msg_id.split("#");
          let payload = {
            podId,
            name,
            // content: {
            //   status: 'ok',
            //   payload: [],
            //   user_expressions: { x: [Object] },
            //   execution_count: 2
            // },
            result: msgs.content.status,
            count: msgs.content.execution_count,
          };
          if (name) {
            console.log("emitting IO execute_reply");
            socket.send(JSON.stringify({ type: "IO:execute_reply", payload }));
          } else {
            console.log("emitting execute_reply");
            socket.send(JSON.stringify({ type: "execute_reply", payload }));
          }
        }
        break;
      case "interrupt_reply":
        {
          socket.send(
            JSON.stringify({
              type: "interrupt_reply",
              payload: {
                status: msgs.content,
                lang: "python",
              },
            })
          );
        }
        break;
      default: {
        console.log("Unhandled shell message", msgs.header.msg_type);
      }
    }
  });
}

function runCode(wire, { code, msg_id }) {
  wire.sendShellMessage(
    constructExecuteRequest({
      code,
      msg_id,
    })
  );
}

function requestKernelStatus(wire) {
  wire.sendShellMessage(constructMessage({ msg_type: "kernel_info_request" }));
}
function interrupt(wire) {
  wire.sendControlMessage(constructMessage({ msg_type: "interrupt_request" }));
}

export type KernelSpec = {
  shell_port: number;
  iopub_port: number;
  stdin_port: number;
  control_port: number;
  hb_port: number;
  ip: string;
  key: string;
  transport: string;
  kernel_name: string;
};

export function startServer({
  spec,
  port,
}: {
  spec: KernelSpec;
  port: number;
}) {
  const expapp = express();
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });

  wss.on("connection", (socket) => {
    console.log("a user connected");
    // 1. connect ZMQ wire to the kernel
    // Assume only one connection, from the spawner service. The user browser doesn't connect to kernel directly.
    const zmq_wire = new ZmqWire(spec);
    // Listen on ZMQWire replies (wire.setOnIOPub and wire.setOnShell) and send back to websocket.
    bindZMQ(zmq_wire, socket);
    socket.on("close", () => {
      console.log("user disconnected");
    });
    // Listen on WS and send commands to kernels through ZMQWire.
    socket.on("message", async (msg) => {
      let { type, payload } = JSON.parse(msg.toString());
      if (type === "ping") return;
      let { sessionId, lang } = payload;
      switch (type) {
        case "runCode":
          {
            let { sessionId, lang, raw, code, podId, namespace, midports } =
              payload;
            if (!code) {
              console.log("Code is empty");
              return;
            }
            runCode(zmq_wire, {
              code,
              msg_id: podId,
            });
          }
          break;
        case "requestKernelStatus":
          console.log("requestKernelStatus", sessionId, lang);
          requestKernelStatus(zmq_wire);
          break;
        case "interruptKernel":
          {
            interrupt(zmq_wire);
          }
          break;
        default:
          console.log("WARNING unhandled message", { type, payload });
      }
    });
  });

  http_server.listen({ port }, () => {
    console.log(`🚀 WS_server ready at http://localhost:${port}`);
  });
  return http_server;
}
