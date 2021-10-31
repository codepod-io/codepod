import store, { repoSlice } from "../store";
import produce from "immer";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { loopPodQueue } from "./queueActions";

const nanoid = customAlphabet(nolookalikes, 10);

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

export default (storeAPI) => (next) => (action) => {
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
          const id = "CP" + nanoid();
          draft.id = id;
        });
        // do local update immediately
        let action1 = repoSlice.actions.addPod(payload);
        storeAPI.dispatch(action1);
        // do remote update, but in a queue
        storeAPI.dispatch(repoSlice.actions.addPodQueue(action1));
        if (payload.type === "DECK") {
          // if it is a new deck, we also add a new pod to it
          // CAUTION I cannot use the same name payload
          let payload2 = produce(payload, (draft) => {
            draft.parent = draft.id;
            draft.id = "CP" + nanoid();
            draft.type = "CODE";
            draft.index = 0;
          });
          let action2 = repoSlice.actions.addPod(payload2);
          // do local update immediately
          storeAPI.dispatch(action2);
          // add a remote queue
          storeAPI.dispatch(repoSlice.actions.addPodQueue(action2));
        }
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
      {
        throw new Error("MOVE_POD is deprecated");
        let { from, to } = action.payload;
        let from_pod = storeAPI.getState().repo.pods[from];
        let to_pod = storeAPI.getState().repo.pods[to];
        let new_pod = produce(from_pod, (draft) => {
          draft.parent = to_pod.parent;
          draft.index = to_pod.index + 1;
        });
        // this will assign a new ID
        // FIXME this won't assign new ID
        let action1 = repoSlice.actions.addPod(new_pod);
        storeAPI.dispatch(action1);
        storeAPI.dispatch(repoSlice.actions.addPodQueue(action1));
        let action2 = repoSlice.actions.deletePod({ id: from });
        storeAPI.dispatch(action2);
        storeAPI.dispatch(repoSlice.actions.addPodQueue(action2));
      }
      break;
    case "REMOTE_PASTE":
      {
        let { parent, index, column } = action.payload;
        let pods = store.getState().repo.pods;
        // get all clipped pods
        let clip = Object.entries(pods)
          .filter(([id, pod]) => pod.clipped)
          .map(([id, pod]) => id);
        if (clip.length == 0) {
          console.log("No clipped");
          return;
        }
        // clear last clip
        storeAPI.dispatch(repoSlice.actions.clearLastClip());
        for (let id of clip) {
          storeAPI.dispatch(
            repoSlice.actions.pastePod({ parent, index, column, id })
          );
          index += 1;
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
