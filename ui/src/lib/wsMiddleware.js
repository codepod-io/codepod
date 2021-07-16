import { io } from "socket.io-client";

import * as actions from "./wsActions";

const socketMiddleware = () => {
  let socket = null;

  const onOpen = (store) => (event) => {
    console.log("websocket open", event.target.url);
    store.dispatch(actions.wsConnected(event.target.url));
  };

  const onClose = (store) => () => {
    store.dispatch(actions.wsDisconnected());
  };

  const onMessage = (store) => (event) => {
    const payload = JSON.parse(event.data);
    console.log("receiving server message");

    // switch (payload.type) {
    //   case "update_game_players":
    //     store.dispatch(updateGame(payload.game, payload.current_player));
    //     break;
    //   default:
    //     break;
    // }
  };

  // the middleware part of this function
  return (store) => (next) => (action) => {
    switch (action.type) {
      case "WS_CONNECT":
        console.log("WS_CONNECT");
        if (socket !== null) {
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
        socket.on("execute_result", (data) => {
          console.log("execute result!!!", data);
        });

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
          socket.emit("runCode", action.code);
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
