import { repoSlice } from "../store";
import produce from "immer";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { loopPodQueue } from "./queue";

const nanoid = customAlphabet(nolookalikes, 10);

export default (storeAPI) => (next) => (action) => {
  // modify addPod action
  let result;
  if (action.type === repoSlice.actions.addPod.type) {
    // construct the ID here so that the client and the server got the same ID
    action = produce(action, (draft) => {
      const id = "CP" + nanoid();
      draft.payload.id = id;
    });
    result = next(action);
    storeAPI.dispatch(repoSlice.actions.addPodQueue(action));
    if (action.payload.type === "DECK") {
      let action2 = produce(action, (draft) => {
        draft.payload.parent = draft.payload.id;
        draft.payload.id = "CP" + nanoid();
        draft.payload.type = "CODE";
        draft.payload.index = 0;
      });
      next(action2);
      storeAPI.dispatch(repoSlice.actions.addPodQueue(action2));
    }
  } else if (action.type === repoSlice.actions.deletePod.type) {
    action = produce(action, (draft) => {
      const { id } = draft.payload;
      const pods = storeAPI.getState().repo.pods;
      // get all ids to delete. Gathering them here is easier than on the server
      const dfs = (id) =>
        [id].concat(...pods[id].children.map((_id) => dfs(_id)));
      draft.payload.toDelete = dfs(id);
    });
    result = next(action);
    storeAPI.dispatch(repoSlice.actions.addPodQueue(action));
  } else if (action.type === "MOVE_POD") {
    let { from, to } = action.payload;
    let from_pod = storeAPI.getState().repo.pods[from];
    let to_pod = storeAPI.getState().repo.pods[to];
    let new_pod = produce(from_pod, (draft) => {
      draft.parent = to_pod.parent;
      draft.index = to_pod.index + 1;
    });
    // this will assign a new ID
    storeAPI.dispatch(repoSlice.actions.addPod(new_pod));
    storeAPI.dispatch(repoSlice.actions.deletePod({ id: from }));
  } else {
    result = next(action);
  }

  // schedule the queue
  const q = storeAPI.getState().repo.queue;
  if (q.length > 0 && !storeAPI.getState().repo.queueProcessing) {
    storeAPI.dispatch(loopPodQueue(q[0]));
  }

  return result;
};
