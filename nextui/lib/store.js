import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    root: null,
    pods: [],
    queue: [],
    queueProcessing: false,
  },
  reducers: {
    setInit: (state, action) => {
      const { pods, root } = action.payload;
      state.pods = pods;
      state.root = root;
    },
    addRoot: (state, action) => {
      const id = uuidv4();
      const pod = {
        id: id,
        type: "deck",
        parent: null,
        dirty: true,
        children: [],
        lastPosUpdate: Date.now(),
      };

      state.pods[id] = pod;
      state.root = id;
    },
    addPod: (state, action) => {
      const { anchor, type, direction, content = "" } = action.payload;
      // construct
      const id = uuidv4();
      parent = {
        up: state.pods[anchor].parent,
        down: state.pods[anchor].parent,
        right: anchor,
      }[direction];
      const pod =
        type === "pod"
          ? {
              id: id,
              content: content,
              type: "pod",
              dirty: true,
              lastPosUpdate: Date.now(),
              parent: parent,
            }
          : {
              id: id,
              type: "deck",
              dirty: true,
              lastPosUpdate: Date.now(),
              parent: parent,
              children: [],
            };
      state.pods[id] = pod;
      // add
      switch (direction) {
        case "up":
          state.pods[parent].children.splice(
            state.pods[parent].children.indexOf(anchor),
            0,
            id
          );
          break;
        case "down":
          state.pods[parent].children.splice(
            state.pods[parent].children.indexOf(anchor) + 1,
            0,
            id
          );
          break;
        case "right":
          state.pods[parent].children.push(id);
          break;
        default:
          throw Error("Invalid direction");
      }

      // TODO save to db
      // TODO retrieve and set ID
    },
    setPodContent: (state, action) => {
      const { id, content } = action.payload;
      state.pods[id].content = content;
      state.pods[id].dirty = true;
    },
    addPodQueue: (state, action) => {
      console.log("add into queue");
      state.queue.push(action);
      console.log(state.queue);
    },
  },
  extraReducers: {
    [loopPodQueue.pending]: (state, action) => {
      console.log("switch repo pending ..");
      state.queueProcessing = true;
    },
    [loopPodQueue.fulfilled]: (state, action) => {
      console.log("switch repo fullfilled");
      state.queue.shift();
      state.queueProcessing = false;
    },
    [loopPodQueue.rejected]: (state, action) => {
      console.log("switch repo rejected");
      state.queueProcessing = false;
    },
  },
});

// placeholder for now
export const userSlice = createSlice({
  name: "user",
  initialState: {
    id: null,
    name: null,
  },
  reducers: {},
});

export const loopPodQueue = createAsyncThunk("loopPodQueue", async (action) => {
  console.log(`loopPodQueue`);
  // TODO process action, push to remote server
  return true;
});

function isPodQueueAction(action) {
  const types = [repoSlice.actions.addPod.type, repoSlice.actions.addRoot.type];
  return types.includes(action.type);
}

const podQueueMiddleware = (storeAPI) => (next) => (action) => {
  console.log("podQueue: dispatching", action);
  // hijact the pod related request
  if (isPodQueueAction(action)) {
    // when to invoke the queue?
    storeAPI.dispatch(repoSlice.actions.addPodQueue(action));
    // storeAPI.dispatch(loopPodQueue())
  }

  let result = next(action);
  console.log("podQueue: next state", storeAPI.getState());
  const q = storeAPI.getState().repo.queue;
  if (q.length > 0 && !storeAPI.getState().repo.queueProcessing) {
    storeAPI.dispatch(loopPodQueue(q[0]));
  }
  return result;
};

export default configureStore({
  reducer: {
    repo: repoSlice.reducer,
    users: userSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(podQueueMiddleware),
});
