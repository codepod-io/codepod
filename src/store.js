import { configureStore } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";

export function selectSiblings(state, podId) {
  const res = [];
  for (var id = podId; id; id = state.pods.id2next[id]) {
    res.push(id);
  }
  return res;
}

export function selectTopLevel(state) {
  console.log(`headID: ${state.pods.headId}`);
  const ids = selectSiblings(state, state.pods.headId);
  console.log(`IDs: ${ids}`);
  return ids;
}

export function selectChildren(state, podId) {
  const first = state.pods.id2child[podId];
  return selectSiblings(state, first);
}

function selectPodById(state, id) {
  return state.pods.id2pod[id];
}

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    // pod and dock
    id2pod: {},
    id2dock: {},
    // hierarchy
    id2child: {},
    id2next: {},
    // head and tail
    headId: null,
    tailId: null,
  },
  reducers: {
    addDock: (state, action) => {
      const { name, anchorId, direction } = action.payload;
      const id = uuidv4();
      const dock = {
        id,
        name,
      };
      state.id2dock[id] = dock;
    },
    addPod: (state, action) => {
      const { name, content, anchorId, direction } = action.payload;
      const id = uuidv4();
      const pod = {
        id: id,
        name: name,
        content: content,
      };
      // FIXME this seems to remove the previous pods dictionary
      state.id2pod[id] = pod;
      // find the anchor
      if (!state.headId) {
        // FIXME this seems to create two instances, not to the same object reference
        state.headId = pod.id;
        state.tailId = pod.id;
      } else {
        // FIXME so many undfined errors. I'm switching to typescript
        //
        // UPDATE TypeScript only adds types, it does not seem to solve
        // undefined probelm. For that I probably have to use ReScript. However,
        // ReScript is not mature. So I'm using pure javascript for now.
        console.log(anchorId);
        console.log(state.tailId);
        const anchor = anchorId
          ? state.id2pod[anchorId]
          : state.id2pod[state.tailId];
        if (anchor === undefined) {
          throw new Error("Undefined anchor");
        }
        switch (direction) {
          case "NEXT": {
            state.id2next[pod.id] = state.id2next[anchor.id];
            state.id2next[anchor.id] = pod.id;
            break;
          }
          case "DOWN": {
            state.id2child[pod.id] = state.id2child[anchor.id];
            state.id2child[anchor.id] = pod.id;
            break;
          }
          default: {
            throw new Error(`Direction error ${direction}`);
          }
        }
      }
      // if anchor is a pod, insert next to it
      // if anchor is a dock, insert into the head of it

      // TODO save to db
      // TODO retrieve and set ID
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

export default configureStore({
  reducer: {
    pods: repoSlice.reducer,
    users: userSlice.reducer,
  },
});
