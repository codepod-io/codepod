import { readFileSync } from "fs";

import * as pty from "node-pty";

import {
  constructMessage,
  constructExecuteRequest,
  createKernel,
} from "./kernel.js";

export const listenOnRepl = (() => {
  let procs = {};
  return (socket) => {
    // FIXME kill previous julia process?
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

const getSessionKernel = (() => {
  let sessions = {};
  return ({ sessionId, lang }) => {
    if (!sessionId || !lang) {
      console.log("sesisonId or lang is undefined", sessionId, lang);
      return null;
    }
    if (!(sessionId in sessions)) {
      sessions[sessionId] = {};
    }
    let session = sessions[sessionId];
    if (session[lang]) return session[lang];
    let kernel = createKernel(lang);
    if (kernel) {
      session[lang] = kernel;
      return kernel;
    }
  };
})();

export const listenOnSessionManagement = (() => {
  return (socket) => {
    socket.on("connectKernel", (socketId, { sessionId, lang }) => {
      // console.log("==== connectKernel", socketId, sessionId, lang);
      let kernel = getSessionKernel({ sessionId, lang });
      if (!kernel) {
        console.log("ERROR: kernel error");
        return;
      }
      kernel.wire.listenIOPub((topic, msgs) => {
        // console.log("-----", topic, msgs);
        // iracket's topic seems to be an ID. I should use msg type instead
        switch (msgs.header.msg_type) {
          case "status": {
            socket.emit("status", {
              lang: lang,
              status: msgs.content.execution_state,
            });
            break;
          }
          case "execute_result": {
            console.log("emitting execute_result ..");
            let [podId, name] = msgs.parent_header.msg_id.split("#");
            let payload = {
              podId,
              name,
              result: msgs.content.data["text/plain"],
              count: msgs.content.execution_count,
            };
            if (name) {
              console.log("emitting IO result");
              socket.emit("IO:execute_result", payload);
            } else {
              socket.emit("execute_result", payload);
            }
            break;
          }
          case "stdout": {
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
                socket.emit("IO:stdout", payload);
              } else {
                socket.emit("stdout", payload);
              }
            }
            break;
          }
          case "error": {
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
              socket.emit("IO:error", payload);
            } else {
              socket.emit("error", payload);
            }
            break;
          }
          case "stream": {
            if (!msgs.parent_header.msg_id) {
              console.log("No msg_id, skipped");
              console.log(msgs.parent_header);
              break;
            }
            let [podId, name] = msgs.parent_header.msg_id.split("#");
            // iracket use this to send stderr
            // FIXME there are many frames
            if (msgs.content.name === "stdout") {
              // console.log("ignore stdout stream");
              console.log("emitting stdout stream ..");
              socket.emit("stream", {
                podId,
                text: msgs.content.text,
              });
            } else if (msgs.content.name === "stderr") {
              console.log("emitting error stream ..");
              if (!name) {
                socket.emit("stream", {
                  podId,
                  text: msgs.content.text,
                });
              } else {
                // FIXME this is stream for import/export. I should move it somewhere
                socket.emit("stream", {
                  podId,
                  text: msgs.content.text,
                });
              }
            } else {
              console.log(msgs);
              throw new Error(`Invalid stream type: ${msgs.content.name}`);
            }
            break;
          }
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
    });
  };
})();

export const listenOnRunCode = (() => {
  return (socket) => {
    socket.on(
      "runCode",
      ({ sessionId, lang, raw, code, podId, namespace, midports }) => {
        console.log("runCode", sessionId, lang);
        let kernel = getSessionKernel({ sessionId, lang });
        if (!kernel) {
          console.log("kernel error");
          return;
        }
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
    );

    socket.on("requestKernelStatus", ({ sessionId, lang }) => {
      console.log("requestKernelStatus", sessionId, lang);
      let kernel = getSessionKernel({ sessionId, lang });
      if (kernel) {
        kernel.requestKernelStatus();
      } else {
        console.log("ERROR: kernel error");
      }
    });

    socket.on("ensureImports", ({ lang, id, from, to, names }) => {});

    socket.on("addImport", ({ lang, id, from, to, name }) => {
      console.log("received addImport");
    });
    socket.on("deleteImport", ({ lang, id, name, ns }) => {
      console.log("received deleteImport");
    });
    socket.on("deleteMidport", ({ lang, id, ns, name }) => {
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
    });
  };
})();
