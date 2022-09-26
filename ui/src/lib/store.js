import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";
import { io } from "socket.io-client";
import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import wsMiddleware from "./ws/middleware";
import podQueueMiddleware from "./queue/middleware";
import loadReducers from "./remote/load";
import wsReducers from "./ws/reducers";
import podReducers from "./reducers/pod";
import exportReducers from "./reducers/export";
import runtimeReducers from "./reducers/runtime";
import gitReducers from "./reducers/git";
import { hashPod } from "./utils";

// import actions and export them
import remoteReducers from "./remote/update";
import queueReducers from "./queue/queueActions";

export { remoteUpdateAllPods, remoteUpdatePod } from "./remote/update";

// FIXME safety
const nanoid = customAlphabet(nolookalikes, 10);

// TODO use a selector to compute and retrieve the status
// TODO this need to cooperate with syncing indicator
export function selectIsDirty(id) {
  return (state) => {
    let pod = state.repo.pods[id];
    // console.log("selectIsDirty");
    if (pod.remoteHash === hashPod(pod)) {
      return false;
    } else {
      return true;
    }
  };
}

// FIXME performance
export function selectNumDirty() {
  return (state) => {
    console.log("selectNumDirty");
    let res = 0;
    if (state.repo.repoLoaded) {
      for (const id in state.repo.pods) {
        if (state.repo.pods[id].dirty) {
          res += 1;
        }
      }
    }
    return res;
  };
}

const initialState = {
  repoId: null,
  repoLoaded: false,
  pods: {},
  id2parent: {},
  id2children: {},
  queue: [],
  showdiff: false,
  // sessionId: nanoid(),
  sessionId: null,
  sessionRuntime: {},
  activeRuntime: ["localhost:14321", ""],
  runtimeConnected: false,
  kernels: {
    // julia: {
    //   status: null,
    // },
    // racket: {
    //   status: null,
    // },
    python: {
      status: null,
    },
    // javascript: {
    //   status: null,
    // },
    // ts: {
    //   status: "NA",
    // },
  },
  queueProcessing: false,
};

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState,
  reducers: {
    resetState: () => initialState,
    resetSessionId: (state, action) => {
      state.sessionId = nanoid();
    },
    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },
    ensureSessionRuntime: (state, action) => {
      const { lang } = action.payload;
      if (!(lang in state.sessionRuntime)) {
        let socket = io(`http://${window.location.hostname}:4000`);
        socket.emit("spawn", state.sessionId, lang);
        state.sessionRuntime[lang] = socket;
      }
    },
    setRepo: (state, action) => {
      const { repoId } = action.payload;
      state.repoId = repoId;
    },
    setRepoConfig: (state, action) => {
      state.repoConfig = action.payload;
    },
    markClip: (state, action) => {
      let { id } = action.payload;
      let pod = state.pods[id];
      pod.clipped = pod.clipped ? false : true;
    },
    clearClip: (state, action) => {
      for (let [id, pod] of Object.entries(state.pods)) {
        pod.clipped = false;
      }
    },
    clearLastClip: (state, action) => {
      for (let [id, pod] of Object.entries(state.pods)) {
        pod.lastclip = false;
      }
    },
    ...podReducers,
    ...exportReducers,
    ...runtimeReducers,
    ...gitReducers,
    resetKernelStatus: (state, action) => {
      Object.entries(state.kernels).forEach(([k, v]) => {
        v.status = null;
      });
    },

    toggleRaw: (state, action) => {
      const id = action.payload;
      state.pods[id].raw = !state.pods[id].raw;
    },
    addPodQueue: (state, action) => {
      state.queue.push(action.payload);
    },
    addError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state, action) => {
      state.error = null;
    },
  },
  extraReducers: {
    ...queueReducers,
    ...loadReducers,
    ...remoteReducers,
    ...wsReducers,
  },
});

function isPodQueueAction(action) {
  const types = [
    repoSlice.actions.addPod.type,
    repoSlice.actions.deletePod.type,
  ];
  return types.includes(action.type);
}

// placeholder for now
export const userSlice = createSlice({
  name: "user",
  initialState: {
    id: null,
    name: null,
  },
  reducers: {},
});

// This is a middleware to set pod dirty status after certain pod operations.
const hashMiddleware = (storeAPI) => (next) => (action) => {
  // modify addPod action
  switch (action.type) {
    case repoSlice.actions.setPodPosition.type:
    case repoSlice.actions.setPodLang.type:
    case repoSlice.actions.setPodContent.type:
      // case repoSlice.actions.setPodParent.type:
      const result = next(action);
      // console.log("hashMiddleware", action.payload);
      let { id } = action.payload;
      let pod = storeAPI.getState().repo.pods[id];
      // console.log(pod);
      if (pod.remoteHash === hashPod(pod)) {
        storeAPI.dispatch(repoSlice.actions.setPodDirty({ id, dirty: false }));
      } else {
        storeAPI.dispatch(repoSlice.actions.setPodDirty({ id, dirty: true }));
      }
      return result;
      break;
    default:
      return next(action);
  }
};

export default configureStore({
  reducer: {
    repo: repoSlice.reducer,
    users: userSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      hashMiddleware,
      podQueueMiddleware,
      wsMiddleware
    ),
});
