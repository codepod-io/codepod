import crypto from "crypto";
import * as zmq from "zeromq";
import { v4 as uuidv4 } from "uuid";

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

export function handleIOPub_status({ msgs, socket, lang }) {
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

export function handleIOPub_display_data({ msgs, socket }) {
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

export function handleIOPub_execute_result({ msgs, socket }) {
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

export function handleIOPub_stdout({ msgs, socket }) {
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

export function handleIOPub_error({ msgs, socket }) {
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

export function handleIOPub_stream({ msgs, socket }) {
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
