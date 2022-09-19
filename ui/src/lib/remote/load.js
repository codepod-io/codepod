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
    state.repoLoaded = true;
  },
  [loadRepoQueue.rejected]: (state, action) => {
    throw Error(`ERROR: repo loading rejected ${action.error.message}`);
  },
};
