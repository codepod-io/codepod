import { createAsyncThunk } from "@reduxjs/toolkit";
import { doRemoteLoadRepo, doRemoteLoadGit } from "./fetch";
import { repoSlice } from "../store";
import { normalize } from "./fetch";

export const loadRepoQueue = createAsyncThunk(
  "loadRepoQueue",
  async ({ id }, {}) => {
    return await doRemoteLoadRepo({ id });
  }
);

export default {
  [loadRepoQueue.pending]: (state, action) => {},
  [loadRepoQueue.fulfilled]: (state, action) => {
    if (action.payload.errors) {
      throw Error(action.payload.errors[0].message);
    }
    // TODO the children ordered by index
    state.pods = normalize(action.payload.data.repo.pods);
    // fill in the parent/children relationships
    for (const id in state.pods) {
      let pod = state.pods[id];
      if (pod.parent) {
        state.id2parent[pod.id] = pod.parent.id;
      }
      state.id2children[pod.id] = pod.children.map((child) => child.id);
    }
    state.repoLoaded = true;
  },
  [loadRepoQueue.rejected]: (state, action) => {
    throw Error(`ERROR: repo loading rejected ${action.error.message}`);
  },
};
