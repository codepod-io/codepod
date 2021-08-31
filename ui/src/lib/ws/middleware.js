import * as actions from "./actions";

import { repoSlice } from "../store";
import Stomp from "stompjs";
function getAllUtils({ id, pods }) {
  // get all utils for id
  // get children utils nodes
  if (id === "ROOT") return {};
  const res = Object.assign(
    {},
    ...pods[id].children
      .filter(({ id }) => pods[id].utility)
      .map(({ id, type }) => {
        if (type === "DECK") {
          // if this is a deck, use its children's exports
          return {
            [`${pods[id].ns}/${id}`]: Object.assign(
              {},
              ...pods[id].children.map(({ id }) => pods[id].exports)
            ),
          };
        } else {
          // if this is a pod, just use its export
          return { [`${pods[id].ns}/${id}`]: pods[id].exports };
        }
      })
  );
  // keep to go to parents
  return Object.assign(res, getAllUtils({ id: pods[id].parent, pods }));
}

function getDeckExports({ id, pods }) {
  if (pods[id].type !== "DECK") return {};
  // console.log("EXP", id, pods[id].exports);
  // pods[id].children.forEach(({ id }) => {
  //   console.log("ch", id, pods[id].exports);
  // });
  return {
    [`${pods[id].ns}/${id}`]: Object.assign(
      {},
      ...pods[id].children.map(({ id }) => pods[id].exports)
    ),
  };
}

function handleRunTree({ id, storeAPI, socket }) {
  // get all pods
  console.log("handleRunTree", { id, storeAPI, socket });
  function helper(id) {
    let pods = storeAPI.getState().repo.pods;
    let pod = pods[id];
    // - if it is test deck, it should be evaluated after the parent
    // - if it is a utility deck, it should be evaluated first and import to
    // parent's subtree
    //
    // 1. get all the utility decks/pods, and evaluate
    const util_pods = pod.children.filter(({ id }) => pods[id].utility);
    util_pods.map(({ id }) => helper(id));
    // 2. get all the non-test children and evaluate
    pod.children
      .filter(({ id }) => !pods[id].utility && !pods[id].thundar)
      .map(({ id }) => helper(id));
    // 3. evaluate this current node
    if (id !== "ROOT") {
      const utils = getAllUtils({ id, pods });
      // if (Object.keys(utils).length > 0) {
      //   console.log("All utils", utils);
      // }
      // add imports
      // FIXME performance. Should really just import once
      for (const [ns, exports] of Object.entries(utils)) {
        for (const [k, v] of Object.entries(exports)) {
          if (v) {
            socket.send(
              JSON.stringify({
                type: "addImport",
                payload: {
                  lang: pod.lang,
                  from: ns,
                  to: pod.ns,
                  id: pod.id,
                  name: k,
                  sessionId: storeAPI.getState().repo.sessionId,
                },
              })
            );
          }
        }
      }
      // actually run the code
      if (pod.type === "CODE" && pod.content && pod.lang && !pod.thundar) {
        storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));
        storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
        socket.send(
          JSON.stringify({
            type: "runCode",
            payload: {
              lang: pod.lang,
              code: pod.content,
              namespace: pod.ns,
              podId: pod.id,
              sessionId: storeAPI.getState().repo.sessionId,
            },
          })
        );
      }
      // FIXME now each run only exports one level up. I need to run it multiple
      // times to export to parent successfully
      if (pod.exports) {
        for (const [k, v] of Object.entries(pod.exports)) {
          if (v) {
            socket.send(
              JSON.stringify({
                type: "addImport",
                payload: {
                  lang: pod.lang,
                  from: pod.ns,
                  to: storeAPI.getState().repo.pods[pod.parent].ns,
                  id: pod.id,
                  name: k,
                  sessionId: storeAPI.getState().repo.sessionId,
                },
              })
            );
          }
        }
      }
    }
    // 4. get all the test decks and evaluate with imports
    const deck_exports = getDeckExports({ id: pod.id, pods });
    // if (Object.keys(deck_exports).length > 0) {
    //   console.log("deck exports:", deck_exports);
    // }
    pod.children
      .filter(({ id }) => pods[id].thundar)
      .map(({ id }) => {
        // console.log("thundar", id);
        // just evaluate here
        // get all exports of this pod and add import to these testing pods
        for (const [ns, exports] of Object.entries(deck_exports)) {
          if (exports) {
            for (const [k, v] of Object.entries(exports)) {
              if (v) {
                const payload = {
                  // FIXME pod.lang is null for DECK
                  lang: pod.lang,
                  from: ns,
                  // FIXME the pod.ns for DECK and POD needs rework
                  to: `${pod.ns}/${pod.id}/${id}`,
                  id: id,
                  name: k,
                  sessionId: storeAPI.getState().repo.sessionId,
                };
                // console.log("Import", payload);
                socket.send(
                  JSON.stringify({
                    type: "addImport",
                    payload,
                  })
                );
              }
            }
          }
        }
        helper(id);
      });
  }
  helper(id);
}

const socketMiddleware = () => {
  let socket = null;
  let socket_intervalId = null;
  let mq_client = null;

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

        // if (mq_client) {
        //   mq_client.disconnect()
        // }
        console.log("connecting to stomp ..");
        mq_client = Stomp.over(new WebSocket("ws://codepod.test:15674/ws"));
        // remove debug messages
        mq_client.debug = () => {};
        mq_client.connect(
          "guest",
          "guest",
          function () {
            console.log("connected");
            mq_client.subscribe(store.getState().repo.sessionId, (msg) => {
              let { type, payload } = JSON.parse(msg.body);
              // console.log("got message", type, payload);
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
                case "IO:execute_reply":
                  {
                    // CAUTION ignore
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
                case "interrupt_reply":
                  {
                    // console.log("got interrupt_reply", payload);
                    store.dispatch(
                      actions.wsRequestStatus({ lang: payload.lang })
                    );
                  }
                  break;
                default:
                  console.log("WARNING unhandled message", { type, payload });
              }
            });
          },
          function () {
            console.log("error connecting RabbitMQ");
          },
          "/"
        );

        // websocket handlers
        // socket.onmessage = onMessage(store);
        // socket.onclose = onClose(store);
        // socket.onopen = onOpen(store);

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
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        handleRunTree({ id: action.payload, storeAPI: store, socket });
        break;
      }
      case "WS_RUN_TREE":
        {
          if (!socket) {
            store.dispatch(
              repoSlice.actions.addError({
                type: "error",
                msg: "Runtime not connected",
              })
            );
            break;
          }
          handleRunTree({ id: action.payload, storeAPI: store, socket });
        }
        break;
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
          pod.children.map(({ id }) => helper(id));
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
      case "WS_INTERRUPT_KERNEL":
        {
          if (!socket) {
            store.dispatch(
              repoSlice.actions.addError({
                type: "error",
                msg: "Runtime not connected",
              })
            );
            break;
          }
          socket.send(
            JSON.stringify({
              type: "interruptKernel",
              payload: {
                sessionId: store.getState().repo.sessionId,
                ...action.payload,
              },
            })
          );
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
        store.dispatch(repoSlice.actions.clearIO({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        // toggle for its parent
        if (pod.exports[name]) {
          console.log("sending addImport ..");
          socket.send(
            JSON.stringify({
              type: "addImport",
              payload: {
                lang: pod.lang,
                from: pod.ns,
                to: pods[pod.parent].ns,
                id: id,
                sessionId: store.getState().repo.sessionId,
                name,
              },
            })
          );
        } else {
          socket?.send(
            JSON.stringify({
              type: "deleteImport",
              payload: {
                lang: pod.lang,
                id,
                ns: pods[pod.parent].ns,
                sessionId: store.getState().repo.sessionId,
                name,
              },
            })
          );
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
