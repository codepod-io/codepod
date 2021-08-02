import { configureStore, createAsyncThunk } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

import produce from "immer";

import sha256 from "crypto-js/sha256";
import { io } from "socket.io-client";
import wsMiddleware from "./wsMiddleware";
import { slackGetPlainText } from "../components/MySlate";
import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";
// FIXME safety
const nanoid = customAlphabet(nolookalikes, 10);

// FIXME performance for reading this from localstorage
const getAuthHeaders = () => {
  let authToken = localStorage.getItem("token") || null;
  if (!authToken) return null;
  return {
    authorization: `Bearer ${authToken}`,
  };
};

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
        pods {
          id
          type
          lang
          content
          result
          stdout
          error
          imports
          exports
          midports
          index
          parent {
            id
          }
          children {
            id
          }
        }
      }
    }
  `;
    // return res
    const res = await fetch("/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        query: query,
        variables: {
          reponame,
          username,
        },
      }),
    }).catch((err) => {
      dispatch(repoSlice.actions.addError({ type: "error", msg: err.message }));
      return null;
    });
    return res.json();
  }
);

function hashPod(pod) {
  return sha256(
    JSON.stringify({
      id: pod.id,
      content: pod.content,
      type: pod.type,
      lang: pod.lang,
      result: pod.result,
      stdout: pod.stdout,
      error: pod.error,
      imports: pod.imports,
      exports: pod.exports,
      midports: pod.midports,
    })
  ).toString();
}

// TODO use a selector to compute and retrieve the status
// TODO this need to cooperate with syncing indicator
export function selectIsDirty(id) {
  return (state) => {
    let pod = state.repo.pods[id];
    if (pod.remoteHash === hashPod(pod)) {
      return false;
    } else {
      return true;
    }
  };
}

function mapPods(pods, func) {
  function helper(id) {
    let pod = pods[id];
    if (id !== "ROOT") {
      func(pod);
    }
    pod.children.map(helper);
  }
  helper("ROOT");
}

// FIXME performance
export function selectNumDirty() {
  return (state) => {
    let res = 0;
    if (state.repo.repoLoaded) {
      mapPods(state.repo.pods, (pod) => {
        if (pod.remoteHash !== hashPod(pod)) {
          res += 1;
        }
      });
    }
    return res;
  };
}

function normalize(pods) {
  const res = {
    ROOT: {
      type: "DECK",
      id: "ROOT",
      children: [],
      // Adding this to avoid errors
      // XXX should I save these to db?
      exports: {},
      imports: {},
      midport: {},
      io: {},
    },
  };

  // add id map
  pods.forEach((pod) => {
    res[pod.id] = pod;
  });
  pods.forEach((pod) => {
    if (!pod.parent) {
      // add root
      res["ROOT"].children.push(pod.id);
      pod.parent = "ROOT";
    } else {
      // change parent.id format
      pod.parent = pod.parent.id;
    }
    // change children.id format
    pod.children = pod.children.map(({ id }) => id);
    // sort according to index
    pod.children.sort((a, b) => res[a].index - res[b].index);
    if (pod.type === "WYSIWYG" || pod.type === "CODE") {
      pod.content = JSON.parse(pod.content);
    }
    if (pod.result) {
      pod.result = JSON.parse(pod.result);
    }
    if (pod.error) {
      pod.error = JSON.parse(pod.error);
    }
    if (pod.imports) {
      pod.imports = JSON.parse(pod.imports);
    }
    if (pod.exports) {
      pod.exports = JSON.parse(pod.exports);
    }
    if (pod.midports) {
      pod.midports = JSON.parse(pod.midports);
    }
    pod.remoteHash = hashPod(pod);
  });
  pods.forEach((pod) => {
    pod.ns = computeNamespace(res, pod.id);
    // set IO
    pod.io = {};
  });
  return res;
}

async function doRemoteAddPod({ type, id, parent, index, reponame, username }) {
  const query = `
  mutation addPod(
    $reponame: String
    $username: String
    $type: String
    $id: String
    $parent: String
    $index: Int
  ) {
    addPod(
      reponame: $reponame
      username: $username
      type: $type
      id: $id
      parent: $parent
      index: $index
    ) {
      id
    }
  }
`;
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        reponame,
        username,
        type,
        id,
        index,
        parent,
      },
    }),
  });
  return res.json();
}

async function doRemoteDeletePod({ id, toDelete }) {
  const query = `
  mutation deletePod(
    $id: String,
    $toDelete: [String]
  ) {
    deletePod(id: $id, toDelete: $toDelete)
  }`;
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        id,
        toDelete,
      },
    }),
  });
  return res.json();
}

export const remoteUpdateAllPods = createAsyncThunk(
  "remoteUpdateAllPods",
  (action, { dispatch, getState }) => {
    function helper(id) {
      let pod = getState().repo.pods[id];
      pod.children.map(helper);
      if (id !== "ROOT") {
        if (pod.remoteHash !== hashPod(pod)) {
          dispatch(remoteUpdatePod(pod));
        }
      }
    }
    helper("ROOT");
  }
);

export const remoteUpdatePod = createAsyncThunk(
  "remoteUpdatePod",
  async (pod, { dispatch }) => {
    const res = await fetch("/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        query: `
        mutation updatePod($id: String, $content: String, $type: String, $lang: String,
                           $result: String, $stdout: String, $error: String,
                           $imports: String, $exports: String, $midports: String) {
          updatePod(id: $id, content: $content, type: $type, lang: $lang,
                    result: $result, stdout: $stdout, error: $error,
                    imports: $imports, exports: $exports, midports: $midports) {
            id
          }
        }`,
        variables: {
          ...pod,
          content: JSON.stringify(pod.content),
          result: JSON.stringify(pod.result),
          error: JSON.stringify(pod.error),
          imports: JSON.stringify(pod.imports),
          exports: JSON.stringify(pod.exports),
          midports: JSON.stringify(pod.midports),
        },
      }),
    }).catch((err) => {
      dispatch(repoSlice.actions.addError({ type: "error", msg: err.message }));
      return null;
    });
    return res.json();
  }
);

export const loopPodQueue = createAsyncThunk(
  "loopPodQueue",
  async (action, { dispatch, getState }) => {
    // process action, push to remote server
    const reponame = getState().repo.reponame;
    const username = getState().repo.username;
    switch (action.type) {
      case repoSlice.actions.addPod.type: {
        // push to remote
        const { type, id, parent, index } = action.payload;
        return await doRemoteAddPod({
          type,
          id,
          parent,
          index,
          reponame,
          username,
        }).catch((err) => {
          dispatch(
            repoSlice.actions.addError({ type: "error", msg: err.message })
          );
          return null;
        });
      }

      case repoSlice.actions.deletePod.type: {
        const { id, toDelete } = action.payload;
        // delete pod id
        return await doRemoteDeletePod({ id, toDelete }).catch((err) => {
          dispatch(
            repoSlice.actions.addError({ type: "error", msg: err.message })
          );
          return null;
        });
      }

      default:
        throw new Error("Invaid action in podQueue:" + action.type);
    }
  }
);

function computeNamespace(pods, id) {
  let res = [];
  while (id !== "ROOT") {
    res.push(id);
    id = pods[id].parent;
  }
  return res.slice(1).reverse().join("/");
}

export const repoSlice = createSlice({
  name: "repo",
  // TODO load from server
  initialState: {
    reponame: null,
    username: null,
    repoLoaded: false,
    pods: {},
    queue: [],
    // sessionId: nanoid(),
    sessionId: null,
    sessionRuntime: {},
    runtimeConnected: false,
    kernels: {
      julia: {
        status: null,
      },
      racket: {
        status: null,
      },
      python: {
        status: null,
      },
      javascript: {
        status: null,
      },
      // ts: {
      //   status: "NA",
      // },
    },
    queueProcessing: false,
  },
  reducers: {
    resetSessionId: (state, action) => {
      state.sessionId = nanoid();
    },
    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },
    ensureSessionRuntime: (state, action) => {
      const { lang } = action.payload;
      if (!(lang in state.sessionRuntime)) {
        let socket = io(`http://${window.location.hostname}:4000`);
        socket.emit("spawn", state.sessionId, lang);
        state.sessionRuntime[lang] = socket;
      }
    },
    setRepo: (state, action) => {
      const { reponame, username } = action.payload;
      state.reponame = reponame;
      state.username = username;
    },
    addPod: (state, action) => {
      let { parent, index, type, id, lang } = action.payload;
      if (!parent) {
        parent = "ROOT";
      }
      // update all other siblings' index
      // FIXME this might cause other pods to be re-rendered
      state.pods[parent].children.forEach((id) => {
        if (state.pods[id].index >= index) {
          state.pods[id].index += 1;
        }
      });
      const pod = {
        id,
        type,
        index,
        parent,
        content: "",
        result: "",
        stdout: "",
        error: null,
        lang: lang,
        raw: false,
        exports: {},
        imports: {},
        midports: {},
        isSyncing: false,
        lastPosUpdate: Date.now(),
        children: [],
        io: {},
      };
      // compute the remotehash
      pod.remoteHash = hashPod(pod);
      state.pods[id] = pod;
      // push this node
      // TODO the children no longer need to be ordered
      // TODO the frontend should handle differently for the children
      // state.pods[parent].children.splice(index, 0, id);
      state.pods[parent].children.push(id);
      // DEBUG sort-in-place
      // TODO I can probably insert
      // CAUTION the sort expects -1,0,1, not true/false
      state.pods[parent].children.sort(
        (a, b) => state.pods[a].index - state.pods[b].index
      );
      pod.ns = computeNamespace(state.pods, id);
    },
    deletePod: (state, action) => {
      const { id, toDelete } = action.payload;
      // delete the link to parent
      const parent = state.pods[state.pods[id].parent];
      const index = parent.children.indexOf(id);

      // update all other siblings' index
      parent.children.forEach((id) => {
        if (state.pods[id].index >= index) {
          state.pods[id].index -= 1;
        }
      });
      // remove all
      parent.children.splice(index, 1);
      toDelete.forEach((id) => {
        state.pods[id] = undefined;
      });
    },
    setPodContent: (state, action) => {
      const { id, content } = action.payload;
      state.pods[id].content = content;
    },
    clearResults: (state, action) => {
      const id = action.payload;
      state.pods[id].result = "";
      state.pods[id].stdout = "";
      state.pods[id].error = null;
    },
    setPodType: (state, action) => {
      const { id, type } = action.payload;
      let pod = state.pods[id];
      if (type === "WYSIWYG" && typeof pod.content === "string") {
        pod.content = [
          {
            type: "paragraph",
            children: [
              {
                text: pod.content,
              },
            ],
          },
        ];
      }
      if (type === "CODE" && Array.isArray(pod.content)) {
        console.log("Converting to code, this will lose styles");
        pod.content = slackGetPlainText(pod.content);
      }
      pod.type = type;
    },
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
    resetKernelStatus: (state, action) => {
      Object.entries(state.kernels).forEach(([k, v]) => {
        v.status = null;
      });
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
    setPodLang: (state, action) => {
      const { id, lang } = action.payload;
      state.pods[id].lang = lang;
    },
    toggleRaw: (state, action) => {
      const id = action.payload;
      state.pods[id].raw = !state.pods[id].raw;
    },
    addPodQueue: (state, action) => {
      state.queue.push(action.payload);
    },
    addError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state, action) => {
      state.error = null;
    },
  },
  extraReducers: {
    [loopPodQueue.pending]: (state, action) => {
      state.queueProcessing = true;
    },
    [loopPodQueue.fulfilled]: (state, action) => {
      if (action.payload.errors) {
        // throw Error("Error:" + action.payload.errors[0].message);
        state.error = {
          type: "error",
          msg: "Error:" + action.payload.errors[0].message,
        };
      }
      state.queue.shift();
      state.queueProcessing = false;
    },
    [loopPodQueue.rejected]: (state, action) => {
      state.queueProcessing = false;
      throw Error("Loop pod queue rejected. Message:" + action.error.message);
    },
    [loadPodQueue.pending]: (state, action) => {},
    [loadPodQueue.fulfilled]: (state, action) => {
      if (action.payload.errors) {
        throw Error(action.payload.errors[0].message);
      }
      // TODO the children ordered by index
      state.pods = normalize(action.payload.data.repo.pods);
      state.repoLoaded = true;
    },
    [loadPodQueue.rejected]: (state, action) => {
      throw Error("ERROR: repo loading rejected", action.error.message);
    },
    [remoteUpdatePod.pending]: (state, action) => {
      // CAUTION the payload is in action.meta.arg !! this is so weird
      //
      // CAUTION If something happens here, it will immediately cause the thunk to be
      // terminated and rejected to be dipatched
      state.pods[action.meta.arg.id].isSyncing = true;
    },
    [remoteUpdatePod.fulfilled]: (state, action) => {
      // set pod hash
      state.pods[action.meta.arg.id].remoteHash = hashPod(
        state.pods[action.meta.arg.id]
      );
      state.pods[action.meta.arg.id].isSyncing = false;
    },
    [remoteUpdatePod.rejected]: (state, action) => {
      // TODO display some error message
      // TODO use enum instead of string?
      // state.pods[action.payload.id].status = "dirty";
      console.log(action.payload);
      throw new Error("updatePod rejected");
      throw new Error("updatePod rejected" + action.payload.errors[0].message);
    },
    WS_STATUS: (state, action) => {
      const { lang, status } = action.payload;
      // console.log("WS_STATUS", { lang, status });
      state.kernels[lang].status = status;
    },
    WS_CONNECTED: (state, action) => {
      state.runtimeConnected = true;
    },
    WS_DISCONNECTED: (state, action) => {
      state.runtimeConnected = false;
    },
    WS_RESULT: (state, action) => {
      let { podId, result, count } = action.payload;
      // console.log("podId", podId)
      if (podId in state.pods) {
        state.pods[podId].result = {
          text: result,
          count: count,
        };
      } else {
        // most likely this podId is "CODEPOD", which is for startup code and
        // should not be send to the browser
        console.log("WARNING podId not recognized", podId);
      }
    },
    WS_STDOUT: (state, action) => {
      let { podId, stdout } = action.payload;
      // FIXME this is stream
      // FIXME this is base64 encoded
      state.pods[podId].stdout = stdout;
    },
    WS_ERROR: (state, action) => {
      let { podId, ename, evalue, stacktrace } = action.payload;
      if (podId === "CODEPOD") return;
      state.pods[podId].error = {
        ename,
        evalue,
        stacktrace,
      };
    },
    WS_STREAM: (state, action) => {
      let { podId, text } = action.payload;
      if (!(podId in state.pods)) {
        console.log("WARNING podId is not found:", podId);
      }
      // append
      state.pods[podId].stdout += text;
    },
    WS_IO_RESULT: (state, action) => {
      let { podId, result, name } = action.payload;
      // if (!("io" in state.pods[podId])) {
      //   state.pods[podId].io = {};
      // }
      state.pods[podId].io[name] = { result };
    },
    WS_IO_ERROR: (state, action) => {
      let { podId, name, ename, evalue, stacktrace } = action.payload;
      state.pods[podId].io[name] = {
        error: {
          ename,
          evalue,
          stacktrace,
        },
      };
    },
  },
});

function isPodQueueAction(action) {
  const types = [
    repoSlice.actions.addPod.type,
    repoSlice.actions.deletePod.type,
  ];
  return types.includes(action.type);
}

const podQueueMiddleware = (storeAPI) => (next) => (action) => {
  // modify addPod action
  if (action.type === repoSlice.actions.addPod.type) {
    // construct the ID here so that the client and the server got the same ID
    action = produce(action, (draft) => {
      const id = "CP" + nanoid();
      draft.payload.id = id;
    });
  } else if (action.type === repoSlice.actions.deletePod.type) {
    action = produce(action, (draft) => {
      const { id } = draft.payload;
      const pods = storeAPI.getState().repo.pods;
      // get all ids to delete. Gathering them here is easier than on the server
      const dfs = (id) =>
        [id].concat(...pods[id].children.map((_id) => dfs(_id)));
      draft.payload.toDelete = dfs(id);
    });
  }

  let result = next(action);

  if (isPodQueueAction(action)) {
    storeAPI.dispatch(repoSlice.actions.addPodQueue(action));
    // schedule the queue
    const q = storeAPI.getState().repo.queue;
    if (q.length > 0 && !storeAPI.getState().repo.queueProcessing) {
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
    getDefaultMiddleware().concat(podQueueMiddleware, wsMiddleware),
});
