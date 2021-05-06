import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";
import produce from "immer";
import { defaultTypeResolver } from "graphql";
import { gql } from "@apollo/client";

export const loadPodQueue = createAsyncThunk(
  "loadPodQueue",
  async ({ username, reponame }, { dispatch, getState }) => {
    // load from remote
    // const reponame = getState().repo.reponame;
    // const username = getState().repo.username;
    const query = `
    query Repo($reponame: String!, $username: String!) {
      repo(name: $reponame, username: $username) {
        name
        owner {
          name
        }
        root {
          id
        }
        pods {
          id
          type
          content
          children {
            id
          }
        }
      }
    }
  `;
    // return res
    const res = await fetch("http://localhost:4000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: query,
        variables: {
          reponame,
          username,
        },
      }),
    });
    return res.json();
  }
);

export const loopPodQueue = createAsyncThunk(
  "loopPodQueue",
  async (action, { getState }) => {
    console.log(`loopPodQueue`);
    // process action, push to remote server
    console.log(action);
    const reponame = getState().repo.reponame;
    const username = getState().repo.username;
    switch (action.type) {
      case repoSlice.actions.addPod.type:
        // push to remote
        console.log("fetching ..");
        const { type, id, parent, index } = action.payload;
        const query = `
          mutation addpod(
            $reponame: String
            $username: String
            $type: String
            $id: String
            $parent: String
          ) {
            addPod(
              reponame: $reponame
              username: $username
              type: $type
              id: $id
              parent: $parent
            ) {
              id
            }
          }
        `;
        // console.log("query", query);
        const res = await fetch("http://localhost:4000/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: query,
            variables: {
              reponame,
              username,
              type,
              id,
              parent,
            },
          }),
        });
        return res.json();
      default:
        throw new Error("Invaid action in podQueue", action);
    }
  }
);

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    username: null,
    root: null,
    pods: [],
    queue: [],
    queueProcessing: false,
  },
  reducers: {
    setRepo: (state, action) => {
      const { reponame, username } = action.payload;
      state.reponame = reponame;
      state.username = username;
    },
    addPod: (state, action) => {
      const { parent, index, type, id } = action.payload;
      const pod = {
        id: id,
        content: "",
        type: type,
        dirty: true,
        lastPosUpdate: Date.now(),
        parent: parent,
        children: [],
      };
      state.pods[id] = pod;
      if (!parent) {
        // this is root node
        state.root = id;
      } else {
        state.pods[parent].children.splice(index, 0, id);
      }
    },
    setPodContent: (state, action) => {
      const { id, content } = action.payload;
      state.pods[id].content = content;
      state.pods[id].dirty = true;
    },
    addPodQueue: (state, action) => {
      state.queue.push(action.payload);
    },
  },
  extraReducers: {
    [loopPodQueue.pending]: (state, action) => {
      console.log("--- switch repo pending ..", action);
      state.queueProcessing = true;
    },
    [loopPodQueue.fulfilled]: (state, action) => {
      console.log("--- switch repo fullfilled", action.payload.data);
      state.queue.shift();
      state.queueProcessing = false;
    },
    [loopPodQueue.rejected]: (state, action) => {
      console.log("--- ERROR: switch repo rejected:", action.error.message);
      throw Error("ERROR: switch repo rejected");
      state.queueProcessing = false;
    },
    [loadPodQueue.pending]: (state, action) => {
      state.repoLoading = true;
    },
    [loadPodQueue.fulfilled]: (state, action) => {
      console.log("load pod fullfilled", action.payload.data);
      // TODO I need to normalize it, e.g. set parent
      // TODO the children ordered by index
      function list2dict(pods) {
        const res = {};
        pods.forEach((pod) => {
          res[pod.id] = pod;
        });
        return res;
      }
      state.pods = list2dict(action.payload.data.repo.pods);
      state.root = action.payload.data.repo.root.id;
      state.repoLoading = false;
    },
    [loadPodQueue.rejected]: (state, action) => {
      throw Error("ERROR: repo loading rejected", action.error.message);
    },
  },
});

function isPodQueueAction(action) {
  const types = [repoSlice.actions.addPod.type];
  return types.includes(action.type);
}

function computeParentIndex({ pods, anchor, direction }) {
  let parent;
  let index;
  console.log("computeParentIndex", anchor, direction);

  if (anchor == null) {
    parent = null;
    index = -1;
  } else if (direction === "up") {
    parent = pods[anchor].parent;
    index = pods[parent].children.indexOf(anchor);
  } else if (direction === "down") {
    parent = pods[anchor].parent;
    index = pods[parent].children.indexOf(anchor) + 1;
  } else if (direction === "right") {
    parent = anchor;
    index = pods[parent].children.length;
  } else {
    throw new Error("Invalid:", anchor, direction);
  }
  return { parent, index };
}

const podQueueMiddleware = (storeAPI) => (next) => (action) => {
  // console.log("podQueue: dispatching", action);
  // modify addPod action
  if (action.type === repoSlice.actions.addPod.type) {
    // construct the ID here so that the client and the server got the same ID
    action = produce(action, (draft) => {
      const id = uuidv4();
      // modify other payloads
      const { anchor, direction } = action.payload;
      const { parent, index } = computeParentIndex({
        pods: storeAPI.getState().repo.pods,
        anchor,
        direction,
      });
      draft.payload.id = id;
      draft.payload.parent = parent;
      draft.payload.index = index;
    });
  }

  let result = next(action);
  console.log("podQueue: next state", storeAPI.getState());

  if (isPodQueueAction(action)) {
    storeAPI.dispatch(repoSlice.actions.addPodQueue(action));
    // schedule the queue
    const q = storeAPI.getState().repo.queue;
    if (q.length > 0 && !storeAPI.getState().repo.queueProcessing) {
      console.log("===", q[0]);
      storeAPI.dispatch(loopPodQueue(q[0]));
    }
  }

  return result;
};

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
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(podQueueMiddleware),
});
