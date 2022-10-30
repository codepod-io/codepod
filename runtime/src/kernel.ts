// this file is used to create kernel process and act as proxy to communicate
// with the kernels using ZeroMQ

import { readFileSync } from "fs";

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

let wire: ZmqWire;

let socket;

function ensureZmqConnected() {
  if (!wire) {
    // estabilish a ZMQ connection
    console.log("connecting to zmq ..");
    let host = process.env.ZMQ_HOST;
    console.log("Host: ", host);
    wire = new ZmqWire(
      JSON.parse(readFileSync("./kernel/conn.json").toString()),
      host
    );
    // FIXME the path
    console.log("executing startup code ..");
    wire.sendShellMessage(
      constructExecuteRequest({
        code: readFileSync(`./kernel/codepod.py`, "utf8"),
        msg_id: "CODEPOD",
      })
    );
    console.log("kernel initialized successfully");
  }
}

function setSocket(_socket) {
  if (!wire) throw Error("Must connect ZMQ wire first before set socket.");
  socket = _socket;
  wire.setOnIOPub((topic, msgs) => {
    // console.log("-----", topic, msgs);
    // iracket's topic seems to be an ID. I should use msg type instead
    switch (msgs.header.msg_type) {
      case "status":
        handleIOPub_status({ msgs, socket, lang: "python" });
        break;
      case "execute_result":
        handleIOPub_execute_result({ msgs, socket });
        break;
      case "stdout":
        handleIOPub_stdout({ msgs, socket });
        break;
      case "error":
        handleIOPub_error({ msgs, socket });
        break;
      case "stream":
        handleIOPub_stream({ msgs, socket });
        break;
      case "display_data":
        handleIOPub_display_data({ msgs, socket });
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

  wire.setOnShell((msgs) => {
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

export function initializeKernel(socket) {
  ensureZmqConnected();
  setSocket(socket);
}

function runCode({ code, msg_id }) {
  wire.sendShellMessage(
    constructExecuteRequest({
      code,
      msg_id,
    })
  );
}

function requestKernelStatus() {
  wire.sendShellMessage(constructMessage({ msg_type: "kernel_info_request" }));
}
function interrupt() {
  wire.sendControlMessage(constructMessage({ msg_type: "interrupt_request" }));
}

type EvalInput = {
  code: string;
  namespace: string;
};

export class CodePodKernel {
  mapEval({ code, namespace }: EvalInput) {
    return `CODEPOD_EVAL("""${code
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')}""", "${namespace}")`;
  }
  mapAddImport({ from, to, name }: { from: string; to: string; name: string }) {
    // FIXME this should be re-evaluated everytime the function changes
    // I cannot use importlib because the module here lacks the finder, and
    // some other attribute functions
    return `CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${from}").__dict__["${name}"]\n0""", "${to}")`;
  }
  mapAddImportNS({ nses, to }: { nses: [string]; to: string }) {}
  mapDeleteImport({ ns, name }: { ns: string; name: string }) {
    return `CODEPOD_EVAL("del ${name}", "${ns}")`;
  }
  mapEnsureImports({ from, to, name }) {
    return `CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${from}").__dict__["${name}"]\n0""", "${to}")`;
  }
  constructor() {}

  // 2. runCode
  eval({ code, podId, namespace, midports }) {
    runCode({
      code: this.mapEval({ code, namespace }),
      msg_id: podId,
    });
  }
  evalRaw({ code, podId }) {
    runCode({
      code,
      msg_id: podId,
    });
  }
  // 4. addImport
  addImport({ id, from, to, name }) {
    runCode({
      code: this.mapAddImport({ from, to, name }),
      msg_id: id + "#" + name,
    });
  }
  addImportNS({ id, nses, to }) {
    runCode({
      code: this.mapAddImportNS({ nses, to }),
      // FIXME this id is the deck
      msg_id: id,
    });
  }
  // 5. deleteImport
  deleteImport({ id, ns, name }) {
    runCode({
      code: this.mapDeleteImport({ ns, name }),
      msg_id: id + "#" + name,
    });
  }
  // 6. ensureImports
  ensureImports({ id, from, to, names }) {
    for (let name of names) {
      // only python needs to re-evaluate for imports
      runCode({
        code: this.mapEnsureImports({ from, to, name }),
        msg_id: id + "#" + name,
      });
    }
  }
}

export function listenOnMessage(socket, useMQ = false) {
  socket.on("message", async (msg) => {
    let { type, payload } = JSON.parse(msg.toString());
    if (type === "ping") return;
    let { sessionId, lang } = payload;
    let kernel = new CodePodKernel();
    switch (type) {
      case "runCode":
        {
          let { sessionId, lang, raw, code, podId, namespace, midports } =
            payload;
          if (!code) {
            console.log("Code is empty");
            return;
          }
          if (raw) {
            kernel.evalRaw({ code, podId });
            return;
          } else {
            kernel.eval({ code, podId, namespace, midports });
          }
        }
        break;
      case "requestKernelStatus":
        console.log("requestKernelStatus", sessionId, lang);
        requestKernelStatus();
        break;
      case "interruptKernel":
        {
          interrupt();
        }
        break;
      case "ensureImports":
        {
          let { id, from, to, names } = payload;
          kernel.ensureImports({ id, from, to, names });
        }
        break;
      case "addImport":
        {
          let { id, from, to, name } = payload;
          kernel.addImport({ id, from, to, name });
        }
        break;
      case "addImportNS":
        {
          let { id, nses, to } = payload;
          kernel.addImportNS({ id, nses, to });
        }
        break;
      case "deleteImport":
        {
          let { lang, id, name, ns } = payload;
          kernel.deleteImport({ id, ns, name });
        }
        break;
      default:
        console.log("WARNING unhandled message", { type, payload });
    }
  });
}
