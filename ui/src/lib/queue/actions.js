// actions
export const remoteAdd = (payload) => ({
  type: "REMOTE_ADD",
  payload,
});

export const remoteDelete = (payload) => ({
  type: "REMOTE_DELETE",
  payload,
});

// backward compatiblility
export const movePod = (payload) => ({
  type: "MOVE_POD",
  payload,
});

export const remotePaste = (payload) => ({
  type: "REMOTE_PASTE",
  payload,
});

export const startQueue = () => ({
  type: "START_QUEUE",
});
export const stopQueue = () => ({
  type: "STOP_QUEUE",
});
