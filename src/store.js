import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";
import { retrievePods } from "./PodContext";

export function selectSiblings(state, podId) {
  const res = [];
  for (var id = podId; id; id = state.repo.id2next[id]) {
    res.push(id);
  }
  return res;
}

export function selectTopLevel(state) {
  console.log(`headID: ${state.repo.headId}`);
  const ids = selectSiblings(state, state.repo.headId);
  console.log(`IDs: ${ids}`);
  return ids;
}

export function selectChildren(state, podId) {
  const first = state.repo.id2child[podId];
  return selectSiblings(state, first);
}

function selectPodById(state, id) {
  return state.repo.id2pod[id];
}

export const switchRepo = createAsyncThunk("switchRepo", async (reponame) => {
  console.log(`switchRepo: ${reponame}`);
  // TODO FIXME before switching the repo, I need to make sure all current repo data is saved and synced.
  //
  // state.reponame = reponame;
  // retrieve
  const pods = await retrievePods(reponame);
  console.log("Got pods:");
  console.log(pods);
  return pods;
});

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    // pod and dock
    id2pod: {},
    id2dock: {},
    id2children: {
      ROOT: [],
    },
    id2parent: {},
  },
  reducers: {
    setRepoName: (state, action) => {
      state.reponame = action.payload;
    },
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
      const { name, content, parent, index } = action.payload;
      const id = uuidv4();
      const pod = {
        id: id,
        name: name,
        content: content,
      };
      // FIXME this seems to remove the previous pods dictionary
      state.id2pod[id] = pod;
      if (index === -1) {
        state.id2children[parent].push(id);
      } else {
        state.id2children[parent].splice(index, 0, id);
      }
      state.id2parent[id] = parent;

      // TODO save to db
      // TODO retrieve and set ID
    },
  },
  extraReducers: {
    [switchRepo.pending]: (state, action) => {
      console.log("switch repo pending ..");
    },
    [switchRepo.fulfilled]: (state, action) => {
      console.log("switch repo fullfilled");
      const pods = action.payload;
      pods.forEach((pod) => {
        state.id2pod[pod.id] = pod;
      });
    },
    [switchRepo.rejected]: (state, action) => {
      console.log("switch repo rejected");
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
    repo: repoSlice.reducer,
    users: userSlice.reducer,
  },
});
