import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import { v4 as uuidv4 } from "uuid";

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    root: 1,
    pods: {
      1: {
        id: 1,
        type: "deck",
        parent: null,
        children: [2, 3],
      },
      2: {
        id: 2,
        type: "pod",
        parent: 1,
        content: "pod 2",
      },
      3: {
        id: 3,
        type: "deck",
        parent: 1,
        children: [4],
      },
      4: {
        id: 4,
        type: "pod",
        parent: 3,
        content: "pod 3",
      },
    },
  },
  reducers: {
    addDeck: (state, action) => {
      const { parent } = action.payload;
      const id = uuidv4();
      const deck = {
        id: id,
        type: "deck",
        parent: parent,
        children: [],
      };
      state.pods[id] = deck;
      state.pods[parent].children.push(id);
    },
    addPod: (state, action) => {
      const { parent, content } = action.payload;
      const id = uuidv4();
      const pod = {
        id: id,
        content: content,
        type: "pod",
        parent: parent,
      };
      state.pods[id] = pod;
      state.pods[parent].children.push(id);

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
