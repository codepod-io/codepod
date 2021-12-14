import { readFileSync } from "fs";

// import * as pty from "node-pty";
let pty = {};

import {
  constructMessage,
  constructExecuteRequest,
  createKernel,
} from "./kernel";

export const listenOnRepl = (() => {
  let procs = {};
  return (socket) => {
    // FIXME kill previous julia process?
    throw new Error("Deprecated");
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
  };
})();

export const listenOnKernelManagement = (() => {
  let kernelTerminals = {
    julia: null,
    racket: null,
  };

  return (socket) => {
    socket.on("kernelTerminalSpawn", (lang) => {
      throw new Error("Deprecated");
      // if (!kernelTerminals[lang]) {
      // kernelTerminals[lang].kill();
      let container_name = `${lang}_kernel_1`;
      let cmd = `/usr/local/bin/docker exec -it ${container_name} bash -c '/start.sh'`;
      console.log("====== spawning ", cmd);
      // console.log(cmd.split(" ")[0]);
      // console.log(cmd.split(" ").splice(1));
      // let proc = pty.spawn(cmd.split()[0], cmd.split().splice(1));
      let proc = pty.spawn("docker", [
        "exec",
        "-it",
        `${lang}_kernel_1`,
        "bash",
        "-c",
        "'/start.sh'",
      ]);
      // let proc = pty.spawn("julia");
      kernelTerminals[lang] = proc;
      // }
      console.log("setting callback ..");
      kernelTerminals[lang].onData((data) => {
        // console.log("-----", data);
        socket.emit("kernelTerminalOutput", {
          lang,
          data,
        });
      });
    });

    socket.on("kernelTerminalInput", ({ lang, data }) => {
      // console.log("received input ..");
      if (kernelTerminals[lang]) {
        kernelTerminals[lang].write(data);
      }
    });
  };
})();

let sessions = {};

// return a list of [(<sessionId>, <lang>)] pairs
function listMyKernels(username) {
  let res = [];
  for (let sessionId of Object.keys(sessions).filter((id) =>
    id.startsWith(username)
  )) {
    res = res.concat(
      Object.keys(sessions[sessionId]).map((lang) => (sessionId, lang))
    );
  }
  return res;
}

export function listMySessions(username) {
  return Object.keys(sessions).filter((id) => id.startsWith(username));
}

export async function killSession(sessionId) {
  let session = sessions[sessionId];
  if (session) {
    for (let lang of Object.keys(session)) {
      if (session[lang]) {
        // FIXME should have awaited here. But I want
        // 1. parallel
        // 2. just set the whole thing to undefined, ignoring if actually stopped
        session[lang].kill();
      }
      delete session[lang];
    }
    delete sessions[sessionId];
  }
}

async function killKernel({ sessionId, lang }) {
  // FIXME only allow to kill one's own kernel
  let kernel = sessions[sessionId]?.[lang];
  if (kernel) {
    await kernel.kill();
    // FIXME handle errors
    sessions[sessionId][lang] = undefined;
  }
}

async function getSessionKernel({ sessionId, lang, socket, useMQ }) {
  if (!sessionId || !lang) {
    console.log("sesisonId or lang is undefined", sessionId, lang);
    return null;
  }
  if (!(sessionId in sessions)) {
    sessions[sessionId] = {};
  }
  let session = sessions[sessionId];
  // so that we don't try to create the container twice and get errors
  if (session[lang] === "spawning") {
    console.log("Kernel is being spawning.. returning null");
    return null;
  }
  if (session[lang]) {
    console.log("Returning existing kernel ..");
    return session[lang];
  }
  // FIXME what if the process never finish?
  session[lang] = "spawning";
  console.log("spawning kernel ..");
  let kernel = await createKernel({ lang, sessionId, socket, useMQ });
  console.log("returning the newly spawned kernel");
  session[lang] = kernel;
  return kernel;
}

export function listenOnMessage(socket, useMQ = false) {
  socket.on("message", async (msg) => {
    let { type, payload } = JSON.parse(msg.toString());
    if (type === "ping") return;
    let { sessionId, lang } = payload;
    let kernel = await getSessionKernel({ sessionId, lang, socket, useMQ });
    if (!kernel) {
      console.log("ERROR: kernel error");
      return;
    }
    kernel.addSocket(socket);
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
        kernel.requestKernelStatus();
        break;
      case "interruptKernel":
        {
          kernel.interrupt();
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
      case "deleteMidport": {
        let { lang, id, ns, name } = payload;
        if (lang !== "js") {
          throw new Error("Only js supprot deleteMidport.");
        }
        let code1 = `CODEPOD.deleteNames("${ns}", ["${name}"])`;
        console.log("js wrapper code:", code1);
        kernels[lang].sendShellMessage(
          constructExecuteRequest({
            code: code1,
            msg_id: id,
          })
        );
      }
      default:
        console.log("WARNING unhandled message", { type, payload });
    }
  });
}
