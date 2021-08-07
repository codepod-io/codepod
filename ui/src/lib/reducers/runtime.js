export default {
  clearResults: (state, action) => {
    const id = action.payload;
    state.pods[id].result = "";
    state.pods[id].stdout = "";
    state.pods[id].error = null;
  },
  clearAllResults: (state, action) => {
    Object.keys(state.pods).forEach((id) => {
      state.pods[id].result = "";
      state.pods[id].stdout = "";
      state.pods[id].error = null;
    });
  },

  setRunning: (state, action) => {
    let id = action.payload;
    state.pods[id].running = true;
  },
};
