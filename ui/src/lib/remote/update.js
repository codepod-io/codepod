import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";
import { hashPod } from "../utils";
import { repoSlice } from "../store";
import { doRemoteUpdatePod } from "./fetch";

export const remoteUpdateAllPods = createAsyncThunk(
  "remoteUpdateAllPods",
  (action, { dispatch, getState }) => {
    function helper(id) {
      let pod = getState().repo.pods[id];
      pod.children.map(({ id }) => helper(id));
      if (id !== "ROOT") {
        // console.log("hashPod at remoteUpdateAllPods");
        if (pod.remoteHash !== hashPod(pod)) {
          dispatch(remoteUpdatePod(pod));
        }
      }
    }
    helper("ROOT");
  }
);

export const remoteUpdatePod = createAsyncThunk(
  "remoteUpdatePod",
  async (pod, { dispatch, getState }) => {
    const reponame = getState().repo.reponame;
    const username = getState().repo.username;
    await doRemoteUpdatePod({ reponame, username, pod }).catch((err) => {
      dispatch(
        repoSlice.actions.addError({
          type: "error",
          msg: "doRemoteUpdatePod:" + err.message,
        })
      );
      return null;
    });
  }
);

export default {
  [remoteUpdatePod.pending]: (state, action) => {
    // CAUTION the payload is in action.meta.arg !! this is so weird
    //
    // CAUTION If something happens here, it will immediately cause the thunk to be
    // terminated and rejected to be dipatched
    state.pods[action.meta.arg.id].isSyncing = true;
  },
  [remoteUpdatePod.fulfilled]: (state, action) => {
    // set pod hash
    state.pods[action.meta.arg.id].remoteHash = hashPod(
      state.pods[action.meta.arg.id]
    );
    state.pods[action.meta.arg.id].isSyncing = false;
    state.pods[action.meta.arg.id].dirty = false;
  },
  [remoteUpdatePod.rejected]: (state, action) => {
    // TODO display some error message
    // TODO use enum instead of string?
    // state.pods[action.payload.id].status = "dirty";
    console.log(action.payload);
    throw new Error("updatePod rejected");
    throw new Error("updatePod rejected" + action.payload.errors[0].message);
  },
};
