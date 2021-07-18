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
export const wsRun = ({ lang, code, podId, sessionId }) => ({
  type: "WS_RUN",
  lang,
  code,
  podId,
  sessionId,
});
export const wsResult = ({ podId, result, count }) => ({
  type: "WS_RESULT",
  payload: { podId, result, count },
});
export const wsStdout = ({ podId, stdout }) => ({
  type: "WS_STDOUT",
  payload: { podId, stdout },
});
