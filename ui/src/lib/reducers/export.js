export default {
  addPodExport: (state, action) => {
    let { id, name } = action.payload;
    // XXX at pod creation, remote pod in db gets null in exports/imports.
    // Thus this might be null. So create here to avoid errors.
    let pod = state.pods[id];
    if (!pod.exports) {
      pod.exports = {};
    }
    pod.exports[name] = false;
  },
  setPodExport: (state, action) => {
    // This is to support adjust export solely based on the input field. No more
    // close button.
    // TODO support add multiple exports by entering "aaa,bbb"
    let { id, name } = action.payload;
    let pod = state.pods[id];
    pod.exports = {};
    pod.exports[name] = false;
  },
  clearIO: (state, action) => {
    let { id, name } = action.payload;
    delete state.pods[id].io[name];
  },
  deletePodExport: (state, action) => {
    let { id, name } = action.payload;
    if (!(name in state.pods[state.pods[id].parent].imports)) {
      delete state.pods[id].exports[name];
    } else {
      state.error = {
        type: "error",
        msg: `${name} is actively exported. Un-export first before removing.`,
      };
    }
  },
  togglePodExport: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    pod.exports[name] = !pod.exports[name];
  },
  addPodImport: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    if (!pod.imports) {
      pod.imports = {};
    }
    pod.imports[name] = false;
  },
  deletePodImport: (state, action) => {
    let { id, name } = action.payload;
    delete state.pods[id].imports[name];
  },
  togglePodImport: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    pod.imports[name] = !pod.imports[name];
  },
  addPodMidport: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    if (!pod.midports) {
      pod.midports = {};
    }
    pod.midports[name] = false;
  },
  deletePodMidport: (state, action) => {
    let { id, name } = action.payload;
    if (state.pods[id].midports) {
      delete state.pods[id].midports[name];
    }
  },
  togglePodMidport: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    pod.midports[name] = !pod.midports[name];
  },
};
