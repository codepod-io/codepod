// from https://dev.to/aduranil/how-to-use-websockets-with-redux-a-step-by-step-guide-to-writing-understanding-connecting-socket-middleware-to-your-project-km3
import { io } from "socket.io-client";

import * as actions from "./wsActions";

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
        socket.on("status", (status) => {
          console.log("kernel status:", status);
          store.dispatch(actions.wsStatus(status));
        });
        // well, since it is already opened, this won't be called
        //
        // UPDATE it works, this will be called even after connection
        socket.on("connect", () => {
          console.log("connected");
          store.dispatch(actions.wsConnected());
          // request kernel status after connection
          store.dispatch(actions.wsRequestStatus());
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
          socket.emit("runCode", action.code, action.podId);
        } else {
          console.log("ERROR: not connected");
        }
        break;
      case "WS_REQUEST_STATUS":
        if (socket) {
          socket.emit("requestKernelStatus");
        } else {
          console.log("ERROR: not connected");
        }
        break;
      default:
        console.log("the next action:", action);
        return next(action);
    }
  };
};

export default socketMiddleware();
