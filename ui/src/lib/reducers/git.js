const myReducers = {
  gitStage: (state, action) => {
    let id = action.payload;
    state.pods[id].staged = state.pods[id].content;
  },
  gitUnstage: (state, action) => {
    let id = action.payload;
    state.pods[id].staged = state.pods[id].githead;
  },
  gitCommit: (state, action) => {
    // set for all pods
    for (const id of Object.keys(state.pods)) {
      state.pods[id].githead = state.pods[id].staged;
    }
  },
};

export default myReducers;
