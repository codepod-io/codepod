// from https://dev.to/aduranil/how-to-use-websockets-with-redux-a-step-by-step-guide-to-writing-understanding-connecting-socket-middleware-to-your-project-km3
import { io } from "socket.io-client";
import { Node } from "slate";

import * as actions from "./wsActions";

import { repoSlice } from "../lib/store";

const slackGetPlainText = (nodes) => {
  if (!nodes) {
    return "";
  }
  return nodes.map((n) => Node.string(n)).join("\n");
};

const socketMiddleware = () => {
  let socket = null;

  // the middleware part of this function
  return (store) => (next) => (action) => {
    switch (action.type) {
      case "WS_CONNECT":
        console.log("WS_CONNECT");
        if (socket !== null) {
          console.log("closing ..");
          socket.close();
        }
        console.log("connecting ..");

        // connect to the remote host
        // socket = new WebSocket(action.host);
        socket = io(`http://localhost:4000`);
        // socket.emit("spawn", state.sessionId, lang);

        // websocket handlers
        // socket.onmessage = onMessage(store);
        // socket.onclose = onClose(store);
        // socket.onopen = onOpen(store);
        socket.on("output", (data) => {
          console.log("output:", data);
        });
        socket.on("stdout", (data) => {
          store.dispatch(actions.wsStdout(data));
        });
        socket.on("execute_result", (data) => {
          store.dispatch(actions.wsResult(data));
        });
        socket.on("error", (data) => {
          store.dispatch(actions.wsError(data));
        });
        socket.on("stream", (data) => {
          store.dispatch(actions.wsStream(data));
        });
        socket.on("IO:execute_result", (data) => {
          store.dispatch(actions.wsIOResult(data));
        });
        socket.on("IO:error", (data) => {
          store.dispatch(actions.wsIOError(data));
        });
        socket.on("status", (lang, status) => {
          store.dispatch(actions.wsStatus(lang, status));
        });
        // well, since it is already opened, this won't be called
        //
        // UPDATE it works, this will be called even after connection

        socket.on("connect", () => {
          console.log("connected");
          store.dispatch(actions.wsConnected());
          // request kernel status after connection
          Object.keys(store.getState().repo.kernels).map((k) => {
            store.dispatch(actions.wsRequestStatus(k));
          });
        });
        // so I'm setting this
        // Well, I should probably not dispatch action inside another action
        // (even though it is in a middleware)
        //
        // I probably can dispatch the action inside the middleware, because
        // this is not a dispatch. It will not modify the store.
        //
        // store.dispatch(actions.wsConnected());
        socket.on("disconnect", () => {
          console.log("");
          store.dispatch(actions.wsDisconnected());
        });
        // TODO log other unhandled messages
        // socket.onMessage((msg)=>{
        //   console.log("received", msg)
        // })

        break;
      case "WS_DISCONNECT":
        if (socket !== null) {
          socket.close();
        }
        socket = null;
        console.log("websocket closed");
        break;
      case "NEW_MESSAGE":
        console.log("sending a message", action.msg);
        socket.send(
          JSON.stringify({ command: "NEW_MESSAGE", message: action.msg })
        );
        break;
      case "WS_RUN": {
        let pod = action.payload;
        if (!socket) {
          store.dispatch(repoSlice.actions.addError("Runtime not connected"));
          break;
        }
        // clear pod results
        store.dispatch(repoSlice.actions.clearResults(pod.id));
        // emit runCode command
        socket.emit("runCode", {
          lang: pod.lang,
          code: slackGetPlainText(pod.content),
          namespace: pod.ns,
          podId: pod.id,
          sessionId: "sessionId",
        });
        if (pod.exports) {
          // TODO update all parent imports
          // 1. get all active exports
          let names = Object.entries(pod.exports)
            .filter(([k, v]) => v)
            .map(([k, v]) => k);
          // 2. get to ancestors and update
          let pods = store.getState().repo.pods;
          // verify imports for id, and propagate
          function helper(id, names) {
            if (names.length == 0) return;
            // emit varify improt
            let pod = pods[id];
            console.log("ensureImports:", id, names);
            socket.emit("ensureImports", {
              names,
              lang: pod.lang,
              to: pod.ns,
              // FIXME keep consistent with computeNamespace
              from: pod.ns === "" ? `${pod.id}` : `${pod.ns}/${pod.id}`,
              id: pod.id,
            });
            // recurse
            helper(
              pod.parent,
              // update names
              Object.entries(pod.imports)
                // CAUTION k in names won't work and always return false for list of
                // strings
                .filter(([k, v]) => v && names.includes(k))
                .map(([k, v]) => k)
            );
          }
          helper(pod.parent, names);
        }
        break;
      }
      case "WS_RUN_ALL": {
        if (!socket) {
          store.dispatch(repoSlice.actions.addError("Runtime not connected"));
          break;
        }
        // get all pods
        let pods = store.getState().repo.pods;
        function helper(id) {
          let pod = pods[id];
          pod.children.map(helper);
          // evaluate child first, then parent
          if (id !== "ROOT") {
            // if the pod content code
            // console.log("ID:", pod.id);
            let code = slackGetPlainText(pod.content);
            // console.log("Code:", code);
            // FIXME check validity, i.e. have code, etc
            // import
            if (pod.imports) {
              for (const [k, v] of Object.entries(pod.imports)) {
                // store.dispatch(actions.wsToggleImport);
                // console.log("???", k, v);
                //
                // I don't need to check v, because v means whether this is
                // further exported to parent ns. As long as it is shown here,
                // it is exported from child.
                // console.log("addImport", k, v);
                socket.emit("addImport", {
                  lang: pod.lang,
                  // this is the child's ns, actually only related to current
                  // parent CAUTION but i'm computing it here. Should be
                  // extracted to somewhere
                  // from: pod.ns,
                  from: `${pod.ns}/${pod.id}`,
                  to: pod.ns,
                  id: pod.id,
                  name: k,
                });
              }
            }

            if (code) {
              store.dispatch(repoSlice.actions.clearResults(pod.id));
              socket.emit("runCode", {
                lang: pod.lang,
                code: slackGetPlainText(pod.content),
                namespace: pod.ns,
                podId: pod.id,
                sessionId: "sessionId",
              });
            }
          }
        }
        helper("ROOT");
        // run each one in order
        break;
      }
      case "WS_REQUEST_STATUS":
        if (socket) {
          // set to unknown
          store.dispatch(actions.wsStatus(action.lang, "uknown"));
          socket.emit("requestKernelStatus", action.lang);
        } else {
          console.log("ERROR: not connected");
        }
        break;
      case "WS_TOGGLE_EXPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(repoSlice.actions.addError("Runtime not connected"));
          break;
        }
        store.dispatch(repoSlice.actions.togglePodExport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // toggle for its parent
        if (pod.exports[name]) {
          store.dispatch(
            repoSlice.actions.addPodImport({ id: parent.id, name })
          );
          socket.emit("addImport", {
            lang: pod.lang,
            from: pod.ns,
            to: parent.ns,
            id: parent.id,
            name,
          });
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            socket.emit("deleteImport", {
              lang: pod.lang,
              id: parent.id,
              ns: parent.ns,
              name,
            });
            parent = pods[parent.parent];
          }
        }
        break;
      }
      case "WS_TOGGLE_IMPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(repoSlice.actions.addError("Runtime not connected"));
          break;
        }
        store.dispatch(repoSlice.actions.togglePodImport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // toggle for its parent
        if (pod.imports[name]) {
          store.dispatch(
            repoSlice.actions.addPodImport({ id: parent.id, name })
          );
          socket.emit("addImport", {
            lang: pod.lang,
            from: pod.ns,
            to: parent.ns,
            id: parent.id,
            name,
          });
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            socket.emit("deleteImport", {
              lang: pod.lang,
              ns: parent.ns,
              id: parent.id,
              name,
            });
            parent = pods[parent.parent];
          }
        }
        break;
      }
      default:
        return next(action);
    }
  };
};

export default socketMiddleware();
