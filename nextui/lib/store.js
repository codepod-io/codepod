import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    root: null,
    pods: [],
  },
  reducers: {
    setInit: (state, action) => {
      const { pods, root } = action.payload;
      state.pods = pods;
      state.root = root;
    },
    addRoot: (state, action) => {
      const id = uuidv4();
      const pod = {
        id: id,
        type: "deck",
        parent: null,
        children: [],
      };

      state.pods[id] = pod;
      state.root = id;
    },
    addPod: (state, action) => {
      const { anchor, type, direction, content = "" } = action.payload;
      // construct
      const id = uuidv4();
      parent = {
        up: state.pods[anchor].parent,
        down: state.pods[anchor].parent,
        right: anchor,
      }[direction];
      const pod =
        type === "pod"
          ? {
              id: id,
              content: content,
              type: "pod",
              parent: parent,
            }
          : {
              id: id,
              type: "deck",
              parent: parent,
              children: [],
            };
      state.pods[id] = pod;
      // add
      switch (direction) {
        case "up":
          state.pods[parent].children.splice(
            state.pods[parent].children.indexOf(anchor),
            0,
            id
          );
          break;
        case "down":
          state.pods[parent].children.splice(
            state.pods[parent].children.indexOf(anchor) + 1,
            0,
            id
          );
          break;
        case "right":
          state.pods[parent].children.push(id);
          break;
        default:
          throw Error("Invalid direction");
      }

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
    repo: repoSlice.reducer,
    users: userSlice.reducer,
  },
});
