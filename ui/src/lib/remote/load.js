import { createAsyncThunk } from "@reduxjs/toolkit";
import { doRemoteLoadRepo, doRemoteLoadGit } from "./fetch";
import { repoSlice } from "../store";
import { normalize } from "./fetch";

export const loadPodQueue = createAsyncThunk(
  "loadPodQueue",
  async ({ username, reponame }, { dispatch, getState }) => {
    return await doRemoteLoadRepo({ username, reponame });
  }
);

export const loadGit = createAsyncThunk(
  "loadGit",
  async ({ username, reponame }, { dispatch, getState }) => {
    return await doRemoteLoadGit({ username, reponame });
  }
);

export default {
  [loadPodQueue.pending]: (state, action) => {},
  [loadPodQueue.fulfilled]: (state, action) => {
    if (action.payload.errors) {
      throw Error(action.payload.errors[0].message);
    }
    // TODO the children ordered by index
    state.pods = normalize(action.payload.data.repo.pods);
    state.repoLoaded = true;
  },
  [loadPodQueue.rejected]: (state, action) => {
    throw Error(`ERROR: repo loading rejected ${action.error.message}`);
  },
  [loadGit.pending]: (state, action) => {},
  [loadGit.fulfilled]: (state, action) => {
    if (action.payload.errors) {
      throw Error(action.payload.errors[0].message);
    }
    // TODO the children ordered by index
    console.log("GitPod loaded");
    state.gitpods = {};
    for (const pod of action.payload.data.gitGetPods) {
      state.gitpods[pod.id] = {
        id: pod.id,
        content: JSON.parse(pod.content),
      };
    }
    state.gitLoaded = true;
  },
  [loadGit.rejected]: (state, action) => {
    throw Error(`ERROR: git loading rejected ${action.error.message}`);
  },
};
