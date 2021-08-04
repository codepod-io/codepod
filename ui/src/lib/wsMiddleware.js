import * as actions from "./wsActions";

import { repoSlice } from "../lib/store";

const socketMiddleware = () => {
  let socket = null;
  let socket_intervalId = null;

  // the middleware part of this function
  return (store) => (next) => (action) => {
    switch (action.type) {
      case "WS_CONNECT":
        console.log("WS_CONNECT");
        if (socket !== null) {
          console.log("already connected, skip");
          // store.dispatch(
          //   repoSlice.actions.addError({
          //     type: "warning",
          //     msg: "Already connected.",
          //   })
          // );
          // socket.close();
          break;
        }
        // reset kernel status
        store.dispatch(repoSlice.actions.resetKernelStatus());
        console.log("connecting ..");

        // connect to the remote host
        // socket = new WebSocket(action.host);
        //
        // I canont use "/ws" for a WS socket. Thus I need to detect what's the
        // protocol used here, so that it supports both dev and prod env.
        let socket_url;
        if (window.location.protocol === "http:") {
          socket_url = `ws://${window.location.host}/ws`;
        } else {
          socket_url = `wss://${window.location.host}/ws`;
        }
        socket = new WebSocket(socket_url);
        // socket.emit("spawn", state.sessionId, lang);

        // websocket handlers
        // socket.onmessage = onMessage(store);
        // socket.onclose = onClose(store);
        // socket.onopen = onOpen(store);
        socket.onmessage = (msg) => {
          // console.log("onmessage", msg.data);
          let { type, payload } = JSON.parse(msg.data);
          switch (type) {
            case "output":
              {
                console.log("output:", payload);
              }
              break;
            case "stdout":
              {
                store.dispatch(actions.wsStdout(payload));
              }
              break;
            case "execute_result":
              {
                store.dispatch(actions.wsResult(payload));
              }
              break;
            case "execute_reply":
              {
                store.dispatch(actions.wsExecuteReply(payload));
              }
              break;
            case "error":
              {
                store.dispatch(actions.wsError(payload));
              }
              break;
            case "stream":
              {
                store.dispatch(actions.wsStream(payload));
              }
              break;
            case "IO:execute_result":
              {
                store.dispatch(actions.wsIOResult(payload));
              }
              break;
            case "IO:error":
              {
                store.dispatch(actions.wsIOError(payload));
              }
              break;
            case "status":
              {
                // console.log("Received status:", payload);
                store.dispatch(actions.wsStatus(payload));
              }
              break;
            default:
              console.log("WARNING unhandled message", { type, payload });
          }
        };
        // well, since it is already opened, this won't be called
        //
        // UPDATE it works, this will be called even after connection

        socket.onopen = () => {
          console.log("connected");
          store.dispatch(actions.wsConnected());
          // call connect kernel

          if (socket_intervalId) {
            clearInterval(socket_intervalId);
          }
          socket_intervalId = setInterval(() => {
            if (socket) {
              console.log("sending ping ..");
              socket.send(JSON.stringify({ type: "ping" }));
            }
            // websocket resets after 60s of idle by most firewalls
          }, 30000);

          // request kernel status after connection
          Object.keys(store.getState().repo.kernels).map((k) => {
            store.dispatch(
              actions.wsRequestStatus({
                lang: k,
                sessionId: store.getState().repo.sessionId,
              })
            );
            // wait 1s and resend. The kernel needs to rebind the socket to
            // IOPub, which takes sometime and the status result might not send
            // back. This will ensure the browser gets a fairly consistent
            // status report upon connection.
            // [100, 1000, 5000].map((t) => {
            //   setTimeout(() => {
            //     console.log(`Resending after ${t} ms ..`);
            //     store.dispatch(
            //       actions.wsRequestStatus({
            //         lang: k,
            //         sessionId: store.getState().repo.sessionId,
            //       })
            //     );
            //   }, t);
            // });
          });
        };
        // so I'm setting this
        // Well, I should probably not dispatch action inside another action
        // (even though it is in a middleware)
        //
        // I probably can dispatch the action inside the middleware, because
        // this is not a dispatch. It will not modify the store.
        //
        // store.dispatch(actions.wsConnected());
        socket.onclose = () => {
          console.log("Disconnected ..");
          store.dispatch(actions.wsDisconnected());
          socket = null;
        };
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
        let id = action.payload;
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        let pod = store.getState().repo.pods[id];
        // clear pod results
        store.dispatch(repoSlice.actions.clearResults(pod.id));
        store.dispatch(repoSlice.actions.setRunning(pod.id));
        // emit runCode command
        socket.send(
          JSON.stringify({
            type: "runCode",
            payload: {
              lang: pod.lang,
              raw: pod.raw,
              code: pod.content,
              namespace: pod.ns,
              podId: pod.id,
              sessionId: store.getState().repo.sessionId,
              midports:
                pod.midports &&
                Object.keys(pod.midports).filter((k) => pod.midports[k]),
            },
          })
        );
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
            socket.send(
              JSON.stringify({
                type: "ensureImports",
                payload: {
                  names,
                  lang: pod.lang,
                  to: pod.ns,
                  // FIXME keep consistent with computeNamespace
                  from: pod.ns === "" ? `${pod.id}` : `${pod.ns}/${pod.id}`,
                  id: pod.id,
                  sessionId: store.getState().repo.sessionId,
                },
              })
            );
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
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
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
                socket.send(
                  JSON.stringify({
                    type: "addImport",
                    payload: {
                      lang: pod.lang,
                      // this is the child's ns, actually only related to current
                      // parent CAUTION but i'm computing it here. Should be
                      // extracted to somewhere
                      // from: pod.ns,
                      from: `${pod.ns}/${pod.id}`,
                      to: pod.ns,
                      id: pod.id,
                      name: k,
                      sessionId: store.getState().repo.sessionId,
                    },
                  })
                );
              }
            }

            if (pod.type === "CODE" && pod.content && pod.lang) {
              store.dispatch(repoSlice.actions.clearResults(pod.id));
              socket.send(
                JSON.stringify({
                  type: "runCode",
                  payload: {
                    lang: pod.lang,
                    code: pod.content,
                    namespace: pod.ns,
                    podId: pod.id,
                    sessionId: store.getState().repo.sessionId,
                  },
                })
              );
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
          store.dispatch(actions.wsStatus({ status: null, ...action.payload }));
          socket.send(
            JSON.stringify({
              type: "requestKernelStatus",
              payload: {
                sessionId: store.getState().repo.sessionId,
                ...action.payload,
              },
            })
          );
        } else {
          console.log("ERROR: not connected");
        }
        break;
      case "WS_TOGGLE_MIDPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        store.dispatch(repoSlice.actions.togglePodMidport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // just send socket
        if (pod.midports[name]) {
          // this name is then ready to be exported!
          store.dispatch(repoSlice.actions.addPodExport({ id, name }));
          // it is exported, then run the pod again
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: pod.content,
                namespace: pod.ns,
                podId: pod.id,
                sessionId: store.getState().repo.sessionId,
                midports:
                  pod.midports &&
                  Object.keys(pod.midports).filter((k) => pod.midports[k]),
              },
            })
          );
        } else {
          // FIXME should call removePodExport and update all parents
          // store.dispatch(actions.wsToggleExport)
          //
          // FIXME also, the Slate editor action should do some toggle as well
          store.dispatch(repoSlice.actions.deletePodExport({ id, name }));
          // it is deleted, run delete
          socket.send(
            JSON.stringify({
              type: "deleteMidport",
              payload: {
                lang: pod.lang,
                id: pod.id,
                ns: pod.ns,
                name,
                sessionId: store.getState().repo.sessionId,
              },
            })
          );
        }
        break;
      }
      case "WS_TOGGLE_EXPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            // FIXME this shoudl be warning
            repoSlice.actions.addError({
              type: "warning",
              msg: "Runtime not connected. Not evaluated.",
            })
          );
          // break;
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
          socket?.send(
            JSON.stringify({
              type: "addImport",
              payload: {
                lang: pod.lang,
                from: pod.ns,
                to: parent.ns,
                id: parent.id,
                name,
              },
            })
          );
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            socket?.send(
              JSON.stringify({
                type: "deleteImport",
                payload: {
                  lang: pod.lang,
                  id: parent.id,
                  ns: parent.ns,
                  name,
                },
              })
            );
            parent = pods[parent.parent];
          }
        }
        break;
      }
      case "WS_TOGGLE_IMPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "warning",
              msg: "Runtime not connected. Not evaluated.",
            })
          );
          // break;
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
          socket?.send(
            JSON.stringify({
              type: "addImport",
              payload: {
                lang: pod.lang,
                from: pod.ns,
                to: parent.ns,
                id: parent.id,
                name,
              },
            })
          );
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            socket?.send(
              JSON.stringify({
                type: "deleteImport",
                payload: {
                  lang: pod.lang,
                  ns: parent.ns,
                  id: parent.id,
                  name,
                },
              })
            );
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
