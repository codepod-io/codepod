// modules/websocket.js

export const wsConnect = (host) => ({ type: "WS_CONNECT", host });
export const wsConnecting = (host) => ({ type: "WS_CONNECTING", host });
export const wsConnected = () => ({ type: "WS_CONNECTED" });
export const wsDisconnect = () => ({ type: "WS_DISCONNECT" });
export const wsDisconnected = () => ({ type: "WS_DISCONNECTED" });
export const wsStatus = (lang, status) => ({
  type: "WS_STATUS",
  payload: { lang, status },
});
export const wsRequestStatus = (lang) => ({ type: "WS_REQUEST_STATUS", lang });
export const wsRun = (payload) => ({
  type: "WS_RUN",
  payload,
});
export const wsResult = ({ podId, result, count }) => ({
  type: "WS_RESULT",
  payload: { podId, result, count },
});
export const wsStdout = ({ podId, stdout }) => ({
  type: "WS_STDOUT",
  payload: { podId, stdout },
});
export const wsError = (payload) => ({
  type: "WS_ERROR",
  payload,
});
export const wsStream = (payload) => ({
  type: "WS_STREAM",
  payload,
});
export const wsSimpleError = (payload) => ({
  type: "WS_SIMPLE_ERROR",
  payload,
});

export const wsToggleExport = (payload) => ({
  type: "WS_TOGGLE_EXPORT",
  payload,
});

export const wsToggleImport = (payload) => ({
  type: "WS_TOGGLE_IMPORT",
  payload,
});
