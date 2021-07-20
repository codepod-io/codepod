// from https://dev.to/aduranil/how-to-use-websockets-with-redux-a-step-by-step-guide-to-writing-understanding-connecting-socket-middleware-to-your-project-km3
import { io } from "socket.io-client";

import * as actions from "./wsActions";

import { repoSlice } from "../lib/store";

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
          console.log("execute result!!!", data);
          store.dispatch(actions.wsResult(data));
        });
        socket.on("error", (data) => {
          store.dispatch(actions.wsError(data));
        });
        socket.on("stream", (data) => {
          store.dispatch(actions.wsStream(data));
        });
        socket.on("status", (lang, status) => {
          console.log("kernel status:", status);
          store.dispatch(actions.wsStatus(lang, status));
        });
        // well, since it is already opened, this won't be called
        //
        // UPDATE it works, this will be called even after connection
        socket.on("connect", () => {
          console.log("connected");
          store.dispatch(actions.wsConnected());
          // request kernel status after connection
          store.dispatch(actions.wsRequestStatus("julia"));
          store.dispatch(actions.wsRequestStatus("racket"));
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
      case "WS_RUN":
        console.log("run code");
        if (socket) {
          socket.emit("runCode", action.payload);
        } else {
          console.log("ERROR: not connected");
          store.dispatch(
            actions.wsSimpleError({
              podId: action.payload.podId,
              msg: "Runtime not connected",
            })
          );
        }
        break;
      case "WS_REQUEST_STATUS":
        if (socket) {
          socket.emit("requestKernelStatus", action.lang);
        } else {
          console.log("ERROR: not connected");
        }
        break;
      case "WS_TOGGLE_EXPORT": {
        let { id, name } = action.payload;
        store.dispatch(repoSlice.actions.togglePodExport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // toggle for its parent
        if (pod.exports[name]) {
          store.dispatch(
            repoSlice.actions.addPodImport({ id: parent.id, name })
          );
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            parent = pods[parent.parent];
          }
        }
        break;
      }
      case "WS_TOGGLE_IMPORT": {
        let { id, name } = action.payload;
        store.dispatch(repoSlice.actions.togglePodImport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // toggle for its parent
        if (pod.imports[name]) {
          store.dispatch(
            repoSlice.actions.addPodImport({ id: parent.id, name })
          );
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
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
