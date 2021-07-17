// modules/websocket.js

export const wsConnect = (host) => ({ type: "WS_CONNECT", host });
export const wsConnecting = (host) => ({ type: "WS_CONNECTING", host });
export const wsConnected = () => ({ type: "WS_CONNECTED" });
export const wsDisconnect = () => ({ type: "WS_DISCONNECT" });
export const wsDisconnected = () => ({ type: "WS_DISCONNECTED" });
export const wsStatus = (status) => ({
  type: "WS_STATUS",
  payload: { status },
});
export const wsRequestStatus = () => ({ type: "WS_REQUEST_STATUS" });
export const wsRun = (code) => ({ type: "WS_RUN", code });
