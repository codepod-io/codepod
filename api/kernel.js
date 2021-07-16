// this file is used to create kernel process and act as proxy to communicate
// with the kernels using ZeroMQ

// import { spawn } from "node-pty";
import { spawn } from "child_process";

import zmq from "zeromq";
// const zmq = require("zeromq");
import net from "net";
import { readFile, readFileSync, writeFile, writeFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

function getFreePort() {
  return new Promise((resolve) => {
    // get one free pod
    var srv = net.createServer();
    srv.listen(0, function () {
      //   console.log("Listening on port " + srv.address().port);
      resolve(srv);
    });
  });
}

async function getAvailablePorts(n) {
  let srvs = [];
  for (let i = 0; i < n; i++) {
    srvs.push(getFreePort());
  }
  //   console.log(srvs);
  srvs = await Promise.all(srvs);
  //   console.log(srvs);
  let ports = srvs.map((srv) => srv.address().port);
  srvs.map((srv) => srv.close());
  //   console.log(ports);
  return ports;
}

// getAvailablePorts(5);

async function test() {
  let srv = getFreePort();
  console.log(srv);
  srv = await Promise.all([srv]);
  console.log(srv[0]);
  console.log(srv[0].address().port);
  srv.map((s) => s.address().port);
}

// test();

async function createNewConnSpec() {
  // get a list of free ports
  // well, the ports should be generated from the kernel side
  //
  // But, to be compatible with jupyter kernels, I need to do this
  let ports = await getAvailablePorts(5);
  let spec = {
    shell_port: ports[0],
    iopub_port: ports[1],
    stdin_port: ports[2],
    control_port: ports[3],
    hb_port: ports[4],
    ip: "127.0.0.1",
    key: "412d24d7-baca5d46b674d910851edd2f",
    // key: "",
    transport: "tcp",
    signature_scheme: "hmac-sha256",
    kernel_name: "julia-1.6",
  };
  return spec;
}

// writeConnFile();

//   let cmdArgs = {
//     display_name: "Julia 1.6.1",
//     argv: [
//       "/Applications/Julia-1.6.app/Contents/Resources/julia/bin/julia",
//       "-i",
//       "--color=yes",
//       "--project=@.",
//       "/Users/hebi/.julia/packages/IJulia/e8kqU/src/kernel.jl",
//       "{connection_file}",
//     ],
//     language: "julia",
//     env: {},
//     interrupt_mode: "signal",
//   };
async function startJuliaKernel(newSpec = false) {
  // 1. generate connection file
  let connFname = "/Users/hebi/Documents/GitHub/codepod/api/codepod-conn.json";
  let spec;
  if (newSpec) {
    spec = await createNewConnSpec();
    writeFileSync(connFname, JSON.stringify(spec));
  } else {
    spec = JSON.parse(readFileSync(connFname));
  }

  //   let juliaKernelFile =
  //     "/Users/hebi/Library/Jupyter/kernels/julia-1.6/kernel.json";
  let juliaKernelFile = "./kernel.json";
  // 2. cmd args
  let cmdArgs = JSON.parse(readFileSync(juliaKernelFile));
  //   console.log(cmdArgs);
  let argv = cmdArgs.argv
    .map((s) => s.replace("{connection_file}", connFname))
    .filter((x) => x.length > 0);
  console.log(argv);
  console.log(argv.join(" "));
  // spawn the process
  let proc = spawn(argv[0], argv.slice(1));
  proc.stdout.on("data", (data) => {
    console.log(`child stdout:\n${data}`);
  });

  proc.stderr.on("data", (data) => {
    console.error(`child stderr:\n${data}`);
  });
  //   proc.close();
  console.log("kernel process ID:", proc.pid);
  return spec;
}

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
    JSON.stringify({}),
  ];
}

function deserializeMsg(frames, key = null) {
  var i = 0;
  var idents = [];
  // FIXME I'm receiving all <IDS|MSG>
  console.log("----", frames.toString());

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

export function constructMessage(msg_type, content = {}) {
  return {
    header: {
      msg_id: uuidv4(),
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

export function constructExecuteRequest(code) {
  return constructMessage("execute_request", {
    // Source code to be executed by the kernel, one or more lines.
    code: code,
    silent: false,
    store_history: false,
    // XXX this does not seem to be used
    user_expressions: {
      x: "3+4",
    },
    allow_stdin: false,
    stop_on_error: true,
  });
}

export class JuliaKernel {
  constructor() {
    let connFname =
      "/Users/hebi/Documents/GitHub/codepod/api/codepod-conn.json";
    this.kernelSpec = JSON.parse(readFileSync(connFname));
    console.log(this.kernelSpec);
    let shell = new zmq.Request();
    shell.connect(`tcp://localhost:${this.kernelSpec.shell_port}`);
    let iopub = new zmq.Subscriber();
    iopub.connect(`tcp://localhost:${this.kernelSpec.iopub_port}`);
    //   pubsock.subscribe("execute_result");
    iopub.subscribe("");
    this.kernelSocks = {
      shell,
      iopub,
    };

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
    console.log("sending execute request ..");
    console.log(msg);
    // FIXME how to receive the message?
    //   sock.on("message", (msg) => {
    //     console.log("sock on:", msg);
    //   });
    // FIXME I probably need to wait until the server is started
    //   sock.send(msg);
    this.kernelSocks.shell.send(serializeMsg(msg, this.kernelSpec.key));

    //   console.log("waiting for response ..");
    //   let result = await sock.receive();
    //   console.log("result:", result);
  }

  async listenIOPub(func) {
    console.log("waiting for iopub");
    //   let msgs = await pubsock.receive();
    //   console.log(msgs);
    // FIXME this socket can only be listened here once!
    for await (const [topic, ...frames] of this.kernelSocks.iopub) {
      console.log(
        "received a message related to:",
        topic.toString(),
        "containing message:",
        frames.toString()
      );

      //   func(topic, frames);

      let msgs = deserializeMsg(frames, this.kernelSpec.key);
      console.log("deserialized", msgs);
      func(topic.toString(), msgs);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function gen() {
  let connFname = "/Users/hebi/Documents/GitHub/codepod/api/codepod-conn.json";
  let spec = await createNewConnSpec();
  writeFileSync(connFname, JSON.stringify(spec));
}

async function main() {
  //   let spec = await startJuliaKernel(true);
  //   connectKernel(kernelSpec);
  let kernel = new JuliaKernel();
  //   console.log("wait 8 sec ..");
  //   await sleep(8000);
  kernel.listenIOPub((topic, msgs) => {
    switch (topic) {
      case "status":
        kernelStatus = msgs.content.execution_state;
        break;
      case "execute_result":
        results[msgs.parent_header.msg_id] = msg.content.data["text/plain"];
        break;
      default:
        break;
    }
  });
  //   let msg = constructExecuteRequest("5+6");
  //   sendToKernel(kernelSpec, constructExecuteRequest("5+6"));
  kernel.sendShellMessage(constructMessage("kernel_info_request"));
}

// main();
