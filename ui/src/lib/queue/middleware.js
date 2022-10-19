import store, { repoSlice } from "../store";
import produce from "immer";

import { loopPodQueue } from "./queueActions";

let intervalId = null;

function start(storeAPI) {
  if (!intervalId) {
    console.log("starting remote update queue ..");
    intervalId = setInterval(() => {
      // schedule the queue
      const q = storeAPI.getState().repo.queue;
      if (q.length > 0 && !storeAPI.getState().repo.queueProcessing) {
        storeAPI.dispatch(loopPodQueue(q[0]));
      }
    }, 1000);
  }
}

function stop() {
  if (intervalId) {
    console.log("stopping remote update queue ..");
    clearInterval(intervalId);
    intervalId = null;
  }
}

const myMiddleware = (storeAPI) => (next) => (action) => {
  // modify addPod action
  switch (action.type) {
    case "START_QUEUE":
      start(storeAPI);
      break;
    case "STOP_QUEUE":
      stop();
      break;
    case "REMOTE_ADD":
      {
        // construct the ID here so that the client and the server got the same ID
        let payload = produce(action.payload, (draft) => {
          let { parent, index, anchor, shift } = draft;
          if (index === undefined) {
            index = storeAPI
              .getState()
              .repo.pods[parent].children.findIndex(({ id }) => id === anchor);
            if (index === -1)
              throw new Error("Cannot find anchoar pod:", anchor);
            index += shift | 0;
            draft.index = index;
          }
        });
        // do local update immediately
        let action1 = repoSlice.actions.addPod(payload);
        storeAPI.dispatch(action1);
        // do remote update, but in a queue
        storeAPI.dispatch(repoSlice.actions.addPodQueue(action1));
      }
      break;
    case "REMOTE_DELETE":
      {
        let payload = produce(action.payload, (draft) => {
          const { id } = draft;
          const pods = storeAPI.getState().repo.pods;
          // get all ids to delete. Gathering them here is easier than on the server
          const dfs = (id) =>
            [id].concat(...pods[id].children.map(({ id }) => dfs(id)));
          // pop in toDelete
          draft.toDelete = dfs(id);
        });
        let action1 = repoSlice.actions.deletePod(payload);
        storeAPI.dispatch(action1);
        storeAPI.dispatch(repoSlice.actions.addPodQueue(action1));
      }
      break;
    case "MOVE_POD":
      throw new Error("MOVE_POD is deprecated");

    case "REMOTE_PASTE":
      {
        let { parent, index, anchor, shift, column } = action.payload;
        let pods = store.getState().repo.pods;
        // get all clipped pods
        let clip = Object.entries(pods)
          .filter(([id, pod]) => pod.clipped)
          .map(([id, pod]) => id);
        if (clip.length === 0) {
          console.log("No clipped");
          return;
        }
        // clear last clip
        storeAPI.dispatch(repoSlice.actions.clearLastClip());
        // compute index
        if (index === undefined) {
          index = storeAPI
            .getState()
            .repo.pods[parent].children.findIndex(({ id }) => id === anchor);
          if (index === -1) throw new Error("Cannot find anchoar pod:", anchor);
          index += shift | 0;
        }
        let tmpindex = index;
        for (let id of clip) {
          storeAPI.dispatch(
            repoSlice.actions.pastePod({ parent, index: tmpindex, column, id })
          );
          tmpindex += 1;
        }
        storeAPI.dispatch(
          repoSlice.actions.addPodQueue({
            type: "REMOTE_PASTE",
            payload: {
              clip,
              parent,
              index,
              column,
            },
          })
        );
      }
      break;
    default:
      return next(action);
  }
};

export default myMiddleware;
