// this file is used to create kernel process and act as proxy to communicate
// with the kernels using ZeroMQ

// import { spawn } from "node-pty";
import { spawn } from "child_process";

import * as zmq from "zeromq";
import net from "net";
import fs from "fs";
import { readFile, readFileSync, writeFile, writeFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import Docker from "dockerode";

import Stomp from "stompjs";

import path from "path";

function serializeMsg(msg, key) {
  // return a list of message parts
  // 4. header
  let part4 = JSON.stringify(msg.header);
  // 5. parent header
  let part5 = JSON.stringify({});
  // 6. meta data
  let part6 = JSON.stringify({});
  // 7. content
  let part7 = JSON.stringify(msg.content);

  return [
    // 1. the id
    msg.header.msg_id,
    // 2. "<IDS|MSG>"
    "<IDS|MSG>",
    // 3. HMAC
    // "",
    crypto
      .createHmac("sha256", key)
      .update(part4)
      .update(part5)
      .update(part6)
      .update(part7)
      .digest("hex"),
    part4,
    part5,
    part6,
    part7,
    // 8. extra raw buffers]
    // I'm not sending this, because iracket crashes on this
    // JSON.stringify({}),
  ];
}

function deserializeMsg(frames, key = null) {
  var i = 0;
  var idents: any[] = [];
  for (i = 0; i < frames.length; i++) {
    var frame = frames[i];
    // console.log(i);
    // console.log(toJSON(frame));
    if (frame.toString() === "<IDS|MSG>") {
      break;
    }
    idents.push(frame);
  }
  if (frames.length - i < 5) {
    console.log("MESSAGE: DECODE: Not enough message frames", frames);
    return null;
  }

  if (frames[i].toString() !== "<IDS|MSG>") {
    console.log("MESSAGE: DECODE: Missing delimiter", frames);
    return null;
  }

  if (key) {
    var obtainedSignature = frames[i + 1].toString();

    var hmac = crypto.createHmac("sha256", key);
    hmac.update(frames[i + 2]);
    hmac.update(frames[i + 3]);
    hmac.update(frames[i + 4]);
    hmac.update(frames[i + 5]);
    var expectedSignature = hmac.digest("hex");

    if (expectedSignature !== obtainedSignature) {
      console.log(
        "MESSAGE: DECODE: Incorrect message signature:",
        "Obtained = " + obtainedSignature,
        "Expected = " + expectedSignature
      );
      return null;
    }
  }

  function toJSON(value) {
    return JSON.parse(value.toString());
  }

  var message = {
    idents: idents,
    header: toJSON(frames[i + 2]),
    parent_header: toJSON(frames[i + 3]),
    content: toJSON(frames[i + 5]),
    metadata: toJSON(frames[i + 4]),
    buffers: Array.prototype.slice.apply(frames, [i + 6]),
  };

  return message;
}

export function constructMessage({
  msg_type,
  content = {},
  msg_id = uuidv4(),
}) {
  // TODO I should probably switch to Typescript just to avoid writing such checks
  if (!msg_type) {
    throw new Error("msg_type is undefined");
  }
  return {
    header: {
      msg_id: msg_id,
      msg_type: msg_type,
      session: uuidv4(),
      username: "dummy_user",
      date: new Date().toISOString(),
      version: "5.0",
    },
    parent_header: {},
    metadata: {},
    buffers: [],
    content: content,
  };
}

export function constructExecuteRequest({ code, msg_id, cp = {} }) {
  if (!code || !msg_id) {
    throw new Error("Must provide code and msg_id");
  }
  return constructMessage({
    msg_type: "execute_request",
    msg_id,
    content: {
      // Source code to be executed by the kernel, one or more lines.
      code,
      cp,
      // FIXME if this is true, no result is returned!
      silent: false,
      store_history: false,
      // XXX this does not seem to be used
      user_expressions: {
        x: "3+4",
      },
      allow_stdin: false,
      stop_on_error: false,
    },
  });
}

export class ZmqWire {
  kernelSpec;
  onshell;
  oniopub;
  shell;
  control;
  iopub;
  kernelStatus;
  results;

  constructor(spec, ip) {
    this.kernelSpec = spec;
    // console.log(this.kernelSpec);
    if (ip) {
      console.log("Got IP Address:", ip);
      // FIXME hard-coded IP and port
      this.kernelSpec.ip = ip;
    }
    this.onshell = (msgs) => {
      console.log("Default OnShell:", msgs);
    };
    this.oniopub = (topic, msgs) => {
      console.log("Default OnIOPub:", topic, "msgs:", msgs);
    };

    // Pub/Sub Router/Dealer
    this.shell = new zmq.Dealer();
    // FIXME this is not actually connected. I need to check the real status
    // There does not seem to have any method to check connection status
    // console.log("=== connecting to shell port");
    // console.log(this.kernelSpec);
    // console.log(`tcp://${this.kernelSpec.ip}:${this.kernelSpec.shell_port}`);
    this.shell.connect(
      `tcp://${this.kernelSpec.ip}:${this.kernelSpec.shell_port}`
    );
    // FIXME this is not actually connected. I need to check the real status
    // There does not seem to have any method to check connection status
    console.log("connected to shell port");

    console.log("connecting to control port ");
    this.control = new zmq.Dealer();
    this.control.connect(
      `tcp://${this.kernelSpec.ip}:${this.kernelSpec.control_port}`
    );
    this.iopub = new zmq.Subscriber();
    console.log("connecting IOPub");
    this.iopub.connect(
      `tcp://${this.kernelSpec.ip}:${this.kernelSpec.iopub_port}`
    );
    this.iopub.subscribe();
    this.listenOnShell();
    this.listenOnControl();
    this.listenOnIOPub();

    this.kernelStatus = "uknown";
    this.results = {};
  }

  //   getKernelStatus() {
  //     return kernelStatus;
  //   }

  // Send code to kernel. Return the ID of the execute_request
  // The front-end will listen to IOPub and display result accordingly based on
  // this ID.
  sendShellMessage(msg) {
    // bind zeromq socket to the ports
    console.log("sending shell mesasge ..");
    // console.log(msg);
    // FIXME how to receive the message?
    //   sock.on("message", (msg) => {
    //     console.log("sock on:", msg);
    //   });
    // FIXME I probably need to wait until the server is started
    // sock.send(msg);
    // FIXME Error: Socket temporarily unavailable
    this.shell.send(serializeMsg(msg, this.kernelSpec.key));
  }
  sendControlMessage(msg) {
    this.control.send(serializeMsg(msg, this.kernelSpec.key));
  }

  setOnShell(func) {
    this.onshell = func;
  }
  setOnIOPub(func) {
    this.oniopub = func;
  }

  async listenOnShell() {
    for await (const [...frames] of this.shell) {
      let msgs = deserializeMsg(frames, this.kernelSpec.key);
      this.onshell(msgs);
    }
  }
  async listenOnControl() {
    for await (const [...frames] of this.control) {
      let msgs = deserializeMsg(frames, this.kernelSpec.key);
      // FIXME for now, just use the onshell callback
      this.onshell(msgs);
    }
  }

  async listenOnIOPub() {
    // if (this.iopub && !this.iopub.closed) {
    //   console.log("disconnecting previous iopub ..");
    //   this.iopub.close();
    // }
    // console.log("waiting for iopub");

    //   let msgs = await pubsock.receive();
    //   console.log(msgs);
    // FIXME this socket can only be listened here once!
    for await (const [topic, ...frames] of this.iopub) {
      //   func(topic, frames);
      let msgs = deserializeMsg(frames, this.kernelSpec.key);
      this.oniopub(topic.toString(), msgs);
    }
  }
}

async function removeContainer(name) {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    console.log("remove if already exist");
    let old = docker.getContainer(name);
    old.inspect((err, data) => {
      if (err) {
        console.log("removeContainer: container seems not exist.");
        return resolve(null);
      }
      if (data?.State.Running) {
        old.stop((err, data) => {
          // FIXME If the container is stopped but not removed, will there be errors
          // if I call stop?
          if (err) {
            // console.log("ERR:", err);
            // console.log("No such container, resolving ..");
            // reject();
            console.log("No such container running. Returning.");
            return resolve(null);
          }
          console.log("Stopped. Removing ..");
          old.remove((err, data) => {
            if (err) {
              console.log("ERR during removing container:", err);
              return reject("ERROR!!!");
              // resolve();
            }
            console.log("removed successfully");
            return resolve(null);
          });
        });
      } else {
        console.log("Already stopped. Removing ..");
        old.remove((err, data) => {
          if (err) {
            console.log("ERR during removing container:", err);
            return reject("ERROR!!!");
            // resolve();
          }
          console.log("removed successfully");
          return resolve(null);
        });
      }
    });
  });
}

async function loadOrCreateContainer(image, name, network) {
  console.log("loading container", name);
  let ip = await loadContainer(name, network);
  if (ip) return ip;
  console.log("beforing creating container, removing just in case ..");
  await removeContainer(name);
  console.log("creating container ..");
  return await createContainer(image, name, network);
}

async function loadContainer(name, network) {
  // if already exists, just return the IP
  // else, create and return the IP
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    console.log("remove if already exist");
    let old = docker.getContainer(name);
    old.inspect((err, data) => {
      if (err) {
        console.log("removeContainer: container seems not exist.");
        return resolve(null);
      }
      if (data?.State.Running) {
        // console.log(data.NetworkSettings.Networks);
        let ip = data.NetworkSettings.Networks[network].IPAddress;
        console.log("IP:", ip);
        resolve(ip);
      } else {
        console.log("Already stopped. Removing ..");
        old.remove((err, data) => {
          if (err) {
            console.log("ERR during removing container:", err);
            return reject("ERROR!!!");
            // resolve();
          }
          console.log("removed successfully");
          return resolve(null);
        });
      }
    });
  });
}

// return promise of IP address
async function createContainer(image, name, network) {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    // spawn("docker", ["run", "-d", "jp-julia"]);
    // 1. first check if the container already there. If so, stop and delete
    // let name = "julia_kernel_X";
    console.log("spawning kernel in container ..");
    docker.createContainer(
      {
        Image: image,
        name,
        HostConfig: {
          NetworkMode: network,
          Binds: [
            "dotjulia:/root/.julia",
            "pipcache:/root/.cache/pip",
            // FIXME hard coded dev_ prefix
            "dev_shared_vol:/mount/shared",
          ],
          // DeviceRequests: [
          //   {
          //     Count: -1,
          //     Driver: "nvidia",
          //     Capabilities: [["gpu"]],
          //   },
          // ],
        },
      },
      (err, container) => {
        if (err) {
          console.log("ERR:", err);
          return;
        }
        container?.start((err, data) => {
          console.log("Container started!");
          // console.log(container);
          container.inspect((err, data) => {
            // console.log("inspect");
            // let ip = data.NetworkSettings.IPAddress
            //
            // If created using codepod network bridge, the IP is here:
            let ip = data?.NetworkSettings.Networks[network].IPAddress;
            console.log("IP:", ip);
            resolve(ip);
          });
          // console.log("IPaddress:", container.NetworkSettings.IPAddress)
        });
      }
    );
  });
}

class MyMqSocket {
  queue;
  mq_client;
  constructor(queue, mq_client) {
    this.queue = queue;
    this.mq_client = mq_client;
  }
  send(obj) {
    // FIXME need to make sure it is connected
    this.mq_client.send(this.queue, {}, obj);
  }
}

function handleIOPub_status({ msgs, socket, lang }) {
  console.log("emitting status ..", msgs.content.execution_state, "for", lang);
  // console.log("msg", msgs);
  socket.send(
    JSON.stringify({
      type: "status",
      payload: {
        lang: lang,
        status: msgs.content.execution_state,
        // This is for use with racket kernel to check the finish of running
        id: msgs.parent_header.msg_id,
      },
    })
  );
}

function handleIOPub_display_data({ msgs, socket }) {
  console.log("emitting display data ..");
  let [podId, name] = msgs.parent_header.msg_id.split("#");
  let payload = {
    podId,
    name,
    // content is a dict of
    // {
    //   data: {'text/plain': ..., 'image/png': ...},
    //   metadata: {needs_background: 'light'},
    //   transient: ...
    // }
    content: msgs.content,
    // There's no exe_count in display_data
    // FIXME I should use execute_reply for count
    //
    // count: msgs.content.execution_count,
  };
  socket.send(JSON.stringify({ type: "display_data", payload }));
}

function handleIOPub_execute_result({ msgs, socket }) {
  console.log("emitting execute_result ..");
  let [podId, name] = msgs.parent_header.msg_id.split("#");
  let payload = {
    podId,
    name,
    // result: msgs.content.data["text/plain"],
    // This might contina text/plain, or text/html that contains image
    content: msgs.content,
    count: msgs.content.execution_count,
  };
  if (name) {
    console.log("emitting IO result");
    socket.send(JSON.stringify({ type: "IO:execute_result", payload }));
  } else {
    socket.send(JSON.stringify({ type: "execute_result", payload }));
  }
}

function handleIOPub_stdout({ msgs, socket }) {
  console.log("emitting stdout ..");
  if (msgs.content.text.startsWith("base64 binary data")) {
    console.log("warning: base64 encoded stdout");
  } else {
    let [podId, name] = msgs.parent_header.msg_id.split("#");
    let payload = {
      podId,
      name,
      stdout: msgs.content.text,
    };
    if (name) {
      // this is Import/Export cmd
      socket.send(JSON.stringify({ type: "IO:stdout", payload }));
    } else {
      socket.send(JSON.stringify({ type: "stdout", payload }));
    }
  }
}

function handleIOPub_error({ msgs, socket }) {
  console.log("emitting error ..");
  let [podId, name] = msgs.parent_header.msg_id.split("#");
  let payload = {
    podId,
    name,
    stacktrace: msgs.content.traceback,
    ename: msgs.content.ename,
    evalue: msgs.content.evalue,
  };
  if (name) {
    socket.send(JSON.stringify({ type: "IO:error", payload }));
  } else {
    socket.send(JSON.stringify({ type: "error", payload }));
  }
}

function handleIOPub_stream({ msgs, socket }) {
  if (!msgs.parent_header.msg_id) {
    console.log("No msg_id, skipped");
    console.log(msgs.parent_header);
    return;
  }
  let [podId, name] = msgs.parent_header.msg_id.split("#");
  // iracket use this to send stderr
  // FIXME there are many frames
  if (msgs.content.name === "stdout") {
    // console.log("ignore stdout stream");
    console.log("emitting stdout stream ..", msgs);
    socket.send(
      JSON.stringify({
        type: "stream",
        payload: {
          podId,
          // name: stdout or stderr
          // text:
          content: msgs.content,
        },
      })
    );
  } else if (msgs.content.name === "stderr") {
    console.log("emitting error stream ..");
    if (!name) {
      socket.send(
        JSON.stringify({
          type: "stream",
          payload: {
            podId,
            content: msgs.content,
          },
        })
      );
    } else {
      // FIXME this is stream for import/export. I should move it somewhere
      console.log("emitting other stream ..");
      socket.send(
        JSON.stringify({
          type: "stream",
          payload: {
            podId,
            content: msgs.content,
          },
        })
      );
    }
  } else {
    console.log(msgs);
    throw new Error(`Invalid stream type: ${msgs.content.name}`);
  }
}

let mq_client: Stomp.Client;
export class CodePodKernel {
  lang;
  startupFile;
  startupCode;
  image;
  fname;
  sessionId;
  wire;
  socket;
  mq_socket;
  useMQ;
  mapEval({ code, namespace }) {}
  mapAddImport({
    from,
    to,
    name,
  }: {
    from: string;
    to: string;
    name: string;
  }) {}
  mapAddImportNS({ nses, to }: { nses: [string]; to: string }) {}
  mapDeleteImport({ ns, name }: { ns: string; name: string }) {}
  mapEnsureImports({
    from,
    to,
    name,
  }: {
    from: string;
    to: string;
    name: string;
  }) {}
  constructor() {}
  async init({ sessionId, socket, useMQ }) {
    console.log("=== INIT!!");
    this.sessionId = sessionId;
    this.useMQ = useMQ;
    let network = process.env["KERNEL_NETWORK"] || "codepod";
    let name = `cpkernel_${network}_${sessionId}_${this.lang}`;
    // await removeContainer(name);
    console.log("loadOrCreateContainer");
    let ip = await loadOrCreateContainer(this.image, name, network);

    // FIXME I don't want to extend Kernel, I'm using composition
    console.log("connecting to zmq ..");
    this.wire = new ZmqWire(
      JSON.parse(readFileSync(this.fname).toString()),
      ip
    );

    if (useMQ) {
      if (!mq_client) {
        mq_client = Stomp.overTCP("localhost", 61613);
        mq_client.connect(
          "guest",
          "guest",
          function () {
            console.log("connected");
          },
          function () {
            console.log("error");
            throw new Error("Cannot connect to RabbitMQ server");
          },
          "/"
        );
      }
      this.mq_socket = new MyMqSocket(sessionId, mq_client);
    }

    if (socket) {
      // listen to IOPub here
      this.addSocket(socket);
    }
    // FIXME the path
    console.log("executing startup code ..");
    this.wire.sendShellMessage(
      constructExecuteRequest({ code: this.startupCode, msg_id: "CODEPOD" })
    );
    console.log("kernel initialized successfully");
    // so that we can chain methods
    return this;
  }
  async kill() {
    // FIXME dispose the this.wire
    //
    // FIXME actually I do not want to stop the connection. Instead, I want to
    // keep the kernel without the kernel. The kernel status should show unknow
    // on the browser. The browser wound need to reinit the kernel. So try to
    // differentiate connect and startKernel. For now, I'll just provide a way
    // to shutdown the kernels easily.
    //
    // remove container
    let network = process.env["KERNEL_NETWORK"] || "codepod";
    let name = `cpkernel_${network}_${this.sessionId}_${this.lang}`;
    console.log("Kill session received. Removing container", name);
    await removeContainer(name);
  }
  addSocket(socket) {
    if (this.socket === socket) {
      return;
    }
    this.socket = socket;
    // DEBUG
    if (this.useMQ) {
      socket = this.mq_socket;
    }
    this.wire.setOnIOPub((topic, msgs) => {
      // console.log("-----", topic, msgs);
      // iracket's topic seems to be an ID. I should use msg type instead
      switch (msgs.header.msg_type) {
        case "status":
          handleIOPub_status({ msgs, socket, lang: this.lang });
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
    this.wire.setOnShell((msgs) => {
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
              socket.send(
                JSON.stringify({ type: "IO:execute_reply", payload })
              );
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
                  lang: this.lang,
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
  runCode({ code, msg_id }) {
    this.wire.sendShellMessage(
      constructExecuteRequest({
        code,
        msg_id,
      })
    );
  }
  requestKernelStatus() {
    this.wire.sendShellMessage(
      constructMessage({ msg_type: "kernel_info_request" })
    );
  }
  interrupt() {
    this.wire.sendControlMessage(
      constructMessage({ msg_type: "interrupt_request" })
    );
  }
  // 2. runCode
  eval({ code, podId, namespace, midports }) {
    this.runCode({
      code: this.mapEval({ code, namespace }),
      msg_id: podId,
    });
  }
  evalRaw({ code, podId }) {
    this.runCode({
      code,
      msg_id: podId,
    });
  }
  // 4. addImport
  addImport({ id, from, to, name }) {
    this.runCode({
      code: this.mapAddImport({ from, to, name }),
      msg_id: id + "#" + name,
    });
  }
  addImportNS({ id, nses, to }) {
    this.runCode({
      code: this.mapAddImportNS({ nses, to }),
      // FIXME this id is the deck
      msg_id: id,
    });
  }
  // 5. deleteImport
  deleteImport({ id, ns, name }) {
    this.runCode({
      code: this.mapDeleteImport({ ns, name }),
      msg_id: id + "#" + name,
    });
  }
  // 6. ensureImports
  ensureImports({ id, from, to, names }) {
    for (let name of names) {
      // only python needs to re-evaluate for imports
      this.runCode({
        code: this.mapEnsureImports({ from, to, name }),
        msg_id: id + "#" + name,
      });
    }
  }

  // FIXME default implementation should throw errors
  // mapEval() {}
  // mapAddImport() {}
  // mapDeleteImport() {}
  // mapEnsureImports() {}
}

// FIXME this path is outside the cpkernel package
// const kernel_dir = "../../api/kernels";
// const kernel_dir = "/Users/hebi/Documents/GitHub/codepod/api/kernels";
// const kernel_dir = path.join(
//   dirname(fileURLToPath(import.meta.url)),
//   "../kernels"
// );
// const kernel_dir = path.join(path.resolve(), "./kernels");
const kernel_dir = path.join(__dirname, "../kernels");

interface EvalInput {
  code: string;
  namespace: string;
}

export class PythonKernel extends CodePodKernel {
  constructor() {
    super();
    this.lang = "python";
    this.startupFile = `${kernel_dir}/python/codepod.py`;
    this.fname = "./kernels/python/conn.json";
    console.log("reading startup code", this.lang);
    this.startupCode = readFileSync(this.startupFile, "utf8");
    console.log("startupCode:", this.startupCode);

    this.image = "codepod_kernel_python";
  }

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
  mapDeleteImport({ ns, name }: { ns: string; name: string }) {
    return `CODEPOD_EVAL("del ${name}", "${ns}")`;
  }
  mapEnsureImports({ from, to, name }) {
    return `CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${from}").__dict__["${name}"]\n0""", "${to}")`;
  }
}

export async function createKernel({
  lang,
  sessionId,
  socket,
  useMQ,
}: {
  lang: string;
  sessionId: string;
  socket: any;
  useMQ: boolean;
}) {
  return await new PythonKernel().init({ sessionId, socket, useMQ });
}
