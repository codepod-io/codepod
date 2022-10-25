import create from "zustand";
import produce from "immer";

import { hashPod, computeNamespace } from "./utils";

import {
  normalize,
  doRemoteLoadRepo,
  doRemoteUpdatePod,
  doRemoteAddPod,
  doRemoteDeletePod,
} from "./remote/fetch";

import { createRuntimeSlice } from "./ws/middleware";

// TODO use a selector to compute and retrieve the status
// TODO this need to cooperate with syncing indicator
export function selectIsDirty(id) {
  return (state) => {
    let pod = state.pods[id];
    // console.log("selectIsDirty");
    if (pod.remoteHash === hashPod(pod)) {
      return false;
    } else {
      return true;
    }
  };
}

// FIXME performance
export function selectNumDirty() {
  return (state) => {
    let res = 0;
    if (state.repoLoaded) {
      for (const id in state.pods) {
        if (state.pods[id].dirty) {
          res += 1;
        }
      }
    }
    return res;
  };
}

const initialState = {
  repoId: null,
  error: null,
  repoLoaded: false,
  repoName: null,
  pods: {},
  id2parent: {},
  id2children: {},
  queue: [],
  showdiff: false,
  sessionId: null,
  sessionRuntime: {},
  activeRuntime: ["localhost:14321", ""],
  runtimeConnected: false,
  kernels: {
    python: {
      status: null,
    },
  },
  queueProcessing: false,
};

const createRepoSlice = (set, get) => ({
  ...initialState,
  // FIXME should reset to inital state, not completely empty.
  resetState: () => set(initialState),
  setRepo: (repoId) => set({ repoId }),
  setSessionId: (id) => set({ sessionId: id }),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  addPod: async ({
    parent,
    index,
    anchor,
    shift,
    id,
    type,
    lang,
    x,
    y,
    width,
    height,
  }) => {
    if (index === undefined) {
      index = get().pods[parent].children.findIndex(({ id }) => id === anchor);
      if (index === -1) throw new Error("Cannot find anchoar pod:", anchor);
      index += shift | 0;
    }

    if (!parent) {
      parent = "ROOT";
    }
    // update all other siblings' index
    // FIXME this might cause other pods to be re-rendered
    const pod = {
      content: "",
      column: 1,
      result: "",
      stdout: "",
      error: null,
      lang: "python",
      raw: false,
      fold: false,
      thundar: false,
      utility: false,
      name: "",
      exports: {},
      imports: {},
      reexports: {},
      midports: {},
      isSyncing: false,
      lastPosUpdate: Date.now(),
      // Prisma seems to throw error when I pass an empty list.
      // children: [],
      io: {},
      // from payload
      parent,
      index,
      id,
      type,
      x,
      y,
      width,
      height,
    };
    // compute the remotehash
    pod.remoteHash = hashPod(pod);
    set(
      produce((state) => {
        // 1. do local update
        state.pods[id] = pod;
        // push this node
        // TODO the children no longer need to be ordered
        // TODO the frontend should handle differently for the children
        // state.pods[parent].children.splice(index, 0, id);
        state.pods[parent].children.splice(index, 0, { id, type: pod.type });
        // DEBUG sort-in-place
        // TODO I can probably insert
        // CAUTION the sort expects -1,0,1, not true/false
        pod.ns = computeNamespace(state.pods, id);
      })
    );
    // 2. do remote update
    await doRemoteAddPod({
      repoId: get().repoId,
      parent,
      index,
      pod,
    });
  },
  deletePod: async ({ id, toDelete }) => {
    const pods = get().pods;
    // get all ids to delete. Gathering them here is easier than on the server
    const dfs = (id) =>
      [id].concat(...pods[id].children.map(({ id }) => dfs(id)));
    // pop in toDelete
    toDelete = dfs(id);
    set(
      produce((state) => {
        // delete the link to parent
        const parent = state.pods[state.pods[id].parent];
        const index = parent.children.map(({ id }) => id).indexOf(id);

        // update all other siblings' index
        // remove all
        parent.children.splice(index, 1);
        toDelete.forEach((id) => {
          delete state.pods[id];
        });
      })
    );
    await doRemoteDeletePod({ id, toDelete });
  },
  setPodType: ({ id, type }) =>
    set(
      produce((state) => {
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
          // FIXME replace?
          // pod.content = slackGetPlainText(pod.content);
        }
        pod.type = type;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  toggleFold: ({ id }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.fold) {
          // adapter for adding fold field
          pod.fold = true;
        } else {
          pod.fold = !pod.fold;
        }
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  foldAll: () =>
    set(
      produce((state) => {
        for (const [, pod] of Object.entries(state.pods)) {
          if (pod) {
            pod.fold = true;
            pod.dirty = pod.remoteHash !== hashPod(pod);
          }
        }
      })
    ),
  unfoldAll: () =>
    set(
      produce((state) => {
        for (const [, pod] of Object.entries(state.pods)) {
          pod.fold = false;
          pod.dirty = pod.remoteHash !== hashPod(pod);
        }
      })
    ),
  toggleThundar: ({ id }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.thundar) {
          pod.thundar = true;
        } else {
          pod.thundar = !pod.thundar;
        }
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  toggleUtility: ({ id }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.utility) {
          pod.utility = true;
        } else {
          pod.utility = !pod.utility;
        }
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  setName: ({ id, name }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.name = name;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  setPodLang: ({ id, lang }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.lang = lang;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  setPodContent: ({ id, content }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.content = content;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  setPodRender: ({ id, value }) =>
    set(
      produce((state) => {
        state.pods[id].render = value;
      })
    ),
  setPodPosition: ({ id, x, y }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.x = x;
        pod.y = y;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      })
    ),
  setPodDirty: ({ id, dirty }) =>
    set(
      produce((state) => {
        state.pods[id].dirty = dirty;
      })
    ),
  updatePod: ({ id, data }) =>
    set(
      produce((state) => {
        state.pods[id] = { ...state.pods[id], ...data };
        state.pods[id].dirty = true;
      })
    ),
  setPodParent: ({ id, parent }) =>
    set(
      produce((state) => {
        // FIXME I need to modify many pods here.
        state.pods[id].parent = parent;
        // FXME I'm marking all the pods as dirty here.
        state.pods[id].dirty = true;
        state.pods[parent].children.push(state.pods[id]);
        const oldparent = state.pods[state.pods[id].parent];
        if (oldparent) {
          let idx = oldparent.children.findIndex((_id) => _id === id);
          if (idx >= 0) {
            oldparent.children.splice(idx, 1);
            oldparent.dirty = true;
          }
        }
        // return [id, parent, oldparent];
      })
    ),
  resizeScopeSize: ({ id }) =>
    set(
      produce((state) => {
        // Use the children pod size to compute the new size of the scope.
        // I would simply add the children size together, and add a margin.
        let width = 0;
        let height = 0;
        state.pods[id].children?.forEach((child) => {
          width += state.pods[child.id].width;
          height += state.pods[child.id].height;
        });
        state.pods[id].width = Math.max(state.pods[id].width, width + 20);
        state.pods[id].height = Math.max(state.pods[id].height, height + 20);
        state.pods[id].dirty = true;
      })
    ),
  loadRepo: async (id) => {
    const response = await doRemoteLoadRepo({ id });
    if (response.errors) {
      throw Error(response.errors[0].message);
    }
    set(
      produce((state) => {
        // TODO the children ordered by index
        state.pods = normalize(response.data.repo.pods);
        // fill in the parent/children relationships
        for (const id in state.pods) {
          let pod = state.pods[id];
          if (pod.parent) {
            state.id2parent[pod.id] = pod.parent.id;
          }
          state.id2children[pod.id] = pod.children.map((child) => child.id);
        }
        state.repoLoaded = true;
      })
    );
  },
  remoteUpdateAllPods: async () => {
    async function helper(id) {
      let pod = get().pods[id];
      pod.children.map(({ id }) => helper(id));
      if (id !== "ROOT") {
        // console.log("hashPod at remoteUpdateAllPods");
        if (pod.remoteHash !== hashPod(pod)) {
          await doRemoteUpdatePod({ pod })
            .catch((err) => {
              console.log("ERROR: doRemoteUpdatePod:" + err.message);
            })
            .then(() =>
              set(
                produce((state) => {
                  let pod = state.pods[id];
                  pod.remoteHash = hashPod(pod);
                  pod.isSyncing = false;
                  pod.dirty = false;
                })
              )
            );
        }
      }
    }
    await helper("ROOT");
    // FIXME replace?
    // set pod hash
    // state.pods[action.meta.arg.id].remoteHash = hashPod(
    //   state.pods[action.meta.arg.id]
    // );
    // state.pods[action.meta.arg.id].isSyncing = false;
    // state.pods[action.meta.arg.id].dirty = false;
  },
});

export const useRepoStore = create((...a) => ({
  ...createRepoSlice(...a),
  ...createRuntimeSlice(...a),
}));
