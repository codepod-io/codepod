import { createAsyncThunk } from "@reduxjs/toolkit";
import { repoSlice } from "../store";
import {
  doRemoteAddPod,
  doRemoteDeletePod,
  doRemotePastePod,
} from "../remote/fetch";

export const loopPodQueue = createAsyncThunk(
  "loopPodQueue",
  async (action, { dispatch, getState }) => {
    // process action, push to remote server
    const reponame = getState().repo.reponame;
    const username = getState().repo.username;
    switch (action.type) {
      case repoSlice.actions.addPod.type: {
        // push to remote
        let { parent, index } = action.payload;
        return await doRemoteAddPod({
          reponame,
          username,
          parent,
          index,
          pod: action.payload,
        });
      }

      case repoSlice.actions.deletePod.type: {
        const { id, toDelete } = action.payload;
        // delete pod id
        return await doRemoteDeletePod({ id, toDelete, reponame, username });
      }

      case "REMOTE_PASTE":
        {
          return await doRemotePastePod({ reponame, ...action.payload });
        }
        break;

      default:
        throw new Error("Invaid action in podQueue:" + action.type);
    }
  }
);

export default {
  [loopPodQueue.pending]: (state, action) => {
    state.queueProcessing = true;
  },
  [loopPodQueue.fulfilled]: (state, action) => {
    if (action.payload.errors) {
      // throw Error("Error:" + action.payload.errors[0].message);
      state.error = {
        type: "error",
        msg: "Error: loopPodQueue: " + action.payload.errors[0].message,
      };
    }
    state.queue.shift();
    state.queueProcessing = false;
  },
  [loopPodQueue.rejected]: (state, action) => {
    state.queueProcessing = false;
    throw Error("Loop pod queue rejected. Message:" + action.error.message);
  },
};
