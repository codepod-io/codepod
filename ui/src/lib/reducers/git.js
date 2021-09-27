export default {
  gitStage: (state, action) => {
    let id = action.payload;
    state.pods[id].staged = state.pods[id].content;
  },
  gitUnstage: (state, action) => {
    let id = action.payload;
    state.pods[id].staged = state.pods[id].githead;
  },
  toggleDiff: (state, action) => {
    state.showdiff = !state.showdiff;
  },
};
