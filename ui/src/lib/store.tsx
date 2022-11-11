import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";
import { createContext } from "react";

import { hashPod, computeNamespace } from "./utils";

import {
  normalize,
  doRemoteLoadRepo,
  doRemoteUpdatePod,
  doRemoteAddPod,
  doRemoteDeletePod,
} from "./fetch";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createRuntimeSlice, RuntimeSlice } from "./runtime";
import { ApolloClient } from "@apollo/client";
import { addAwarenessStyle } from "./styles";

// Tofix: can't connect to http://codepod.127.0.0.1.sslip.io/socket/, but it works well on webbrowser or curl
let serverURL;
if (window.location.protocol === "http:") {
  serverURL = `ws://${window.location.host}/socket`;
} else {
  serverURL = `wss://${window.location.host}/socket`;
}
console.log("yjs server url: ", serverURL);

export const RepoContext = createContext<StoreApi<
  RepoSlice & RuntimeSlice
> | null>(null);

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
  runtimeConnected: false,
  user: {},
  kernels: {
    python: {
      status: null,
    },
  },
  queueProcessing: false,
  ydoc: new Doc(),
  provider: null,
  socket: null,
  socketIntervalId: null,
  // keep different seletced info on each user themselves
  selected: null,
  //TODO: all presence information are now saved in clients map for future usage. create a modern UI to show those information from clients (e.g., online users)
  clients: new Map(),
  showLineNumbers: true,
};

export type Pod = {
  id: string;
  name: string;
  type: string;
  content: string;
  remoteHash?: string;
  dirty?: boolean;
  children: { id: string; type: string }[];
  parent?: string;
  result?: { html: string; text: string; count: number; image: string };
  status?: string;
  stdout?: string;
  stderr?: string;
  error?: { evalue: string; stacktrace: string[] } | null;
  lang: string;
  column?: number;
  raw?: boolean;
  fold?: boolean;
  thundar?: boolean;
  utility?: boolean;
  exports?: { [key: string]: string[] };
  imports?: {};
  reexports?: {};
  midports?: {};
  isSyncing: boolean;
  io: {};
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ns?: string;
  running?: boolean;
};

export interface RepoSlice {
  pods: Record<string, Pod>;
  id2parent: Record<string, string>;
  id2children: Record<string, string[]>;
  // runtime: string;
  repoId: string | null;
  // sessionId?: string;

  resetState: () => void;
  setRepo: (repoId: string) => void;
  loadRepo: (client: ApolloClient<object>, repoId: string) => void;
  setSessionId: (sessionId: string) => void;
  addError: (error: { type: string; msg: string }) => void;
  repoLoaded: boolean;
  repoName: string | null;
  queue: string[];
  showdiff: boolean;
  sessionId: string | null;
  runtimeConnected: boolean;
  kernels: Record<string, { status: string | null }>;
  // queueProcessing: boolean;
  socket: WebSocket | null;
  showLineNumbers: boolean;
  error: { type: string; msg: string } | null;
  provider?: WebsocketProvider | null;
  clients: Map<string, any>;
  user: any;
  ydoc: Doc;
  updatePod: ({ id, data }: { id: string; data: Partial<Pod> }) => void;
  remoteUpdateAllPods: (client) => void;
  clearError: () => void;
  foldAll: () => void;
  unfoldAll: () => void;
  setPodContent: ({ id, content }: { id: string; content: string }) => void;
  addPod: (
    client: ApolloClient<object> | null,
    { parent, index, anchor, shift, id, type, lang, x, y, width, height }: any
  ) => void;
  deletePod: (
    client,
    { id, toDelete }: { id: string; toDelete: any[] }
  ) => void;
  setPodResult: ({
    id,
    content,
    count,
  }: {
    id: string;
    content: { data: { html: string; text: string; image: string } };
    count: number;
  }) => void;
  setPodPosition: ({ id, x, y }: any) => void;
  setPodParent: ({ id, parent }: any) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  setUser: (user: any) => void;
  addClient: (clientId: any, name, color) => void;
  deleteClient: (clientId: any) => void;
  flipShowLineNumbers: () => void;
}

type BearState = RepoSlice & RuntimeSlice;

const createRepoSlice: StateCreator<
  RepoSlice & RuntimeSlice,
  [],
  [],
  RepoSlice
> = (set, get) => ({
  ...initialState,
  // FIXME should reset to inital state, not completely empty.
  resetState: () =>
    // FIXME before rest a state, first
    // 1. destroy/disconnect the provider, or it keep the awareness information of the exited page
    // 2. set state.provider = null, or it can't be assigned a new provider.
    set((state) => {
      console.log("user reset state provider", state.provider);
      if (state.provider) {
        state.provider.destroy();
        state.ydoc.destroy();
        state.provider = null;
      }
      return initialState;
    }),
  setRepo: (repoId: string) =>
    set(
      produce((state: BearState) => {
        state.repoId = repoId;
        state.ydoc = new Doc();
        // console.log("user reset state setrepo", repoId);
        if (state.provider) {
          console.log("emmm, provider exists", state.provider);
        } else {
          console.log("connecting yjs socket ..");
          state.provider = new WebsocketProvider(
            serverURL,
            state.repoId,
            state.ydoc
          );
          // max retry time: 10s
          state.provider.connect();
          state.provider.maxBackoffTime = 10000;
        }
      })
    ),
  setSessionId: (id) => set({ sessionId: id }),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setSelected: (id) => set({ selected: id }),
  addPod: async (
    client,
    { parent, index, anchor, shift, id, type, lang, x, y, width, height }
  ) => {
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
    const pod: Pod = {
      content: "",
      column: 1,
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
      // Prisma seems to throw error when I pass an empty list.
      //
      // UPDATE: the front-end checks children a lot. Thus I need to have this
      // field to avoid front-end crashes. I'm handling the empty list case in
      // the backend instead.
      children: [],
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
      produce((state: BearState) => {
        // 1. do local update
        if (!state.pods.hasOwnProperty(id)) {
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
        }
      })
    );
    // 2. do remote update
    if (client) {
      await doRemoteAddPod(client, {
        repoId: get().repoId,
        parent,
        index,
        pod,
      });
    }
  },
  deletePod: async (
    client,
    { id, toDelete }: { id: string; toDelete: string[] }
  ) => {
    const pods = get().pods;
    // get all ids to delete. Gathering them here is easier than on the server

    // TOFIX: check pods[id] exists before deleting
    const dfs = (id) => {
      const pod = pods[id];
      if (pod) {
        toDelete.push(id);
        pod.children.forEach(dfs);
      }
    };

    dfs(id);
    // pop in toDelete
    set(
      produce((state: BearState) => {
        // delete the link to parent
        const parent = state.pods[state.pods[id]?.parent!];
        if (parent) {
          const index = parent.children.map(({ id }) => id).indexOf(id);
          // update all other siblings' index
          // remove all
          parent.children.splice(index, 1);
        }
        toDelete.forEach((id) => {
          delete state.pods[id];
        });
      })
    );
    if (client) {
      await doRemoteDeletePod(client, { id, toDelete });
    }
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
      produce((state: BearState) => {
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
      produce((state: BearState) => {
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
  setPodStdout: ({ id, stdout }) =>
    set(
      produce((state) => {
        state.pods[id].stdout = stdout;
      })
    ),
  setPodResult: ({ id, content, count }) =>
    set(
      produce((state) => {
        if (id in state.pods) {
          let text = content.data["text/plain"];
          let html = content.data["text/html"];
          let file;
          if (text) {
            let match = text.match(/CODEPOD-link\s+(.*)"/);
            if (match) {
              let fname = match[1].substring(match[1].lastIndexOf("/") + 1);
              let url = `${window.location.protocol}//api.${window.location.host}/static/${match[1]}`;
              console.log("url", url);
              html = `<a target="_blank" style="color:blue" href="${url}" download>${fname}</a>`;
              file = url;
            }
            // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
            // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
          }
          state.pods[id].result = {
            text,
            html,
            file,
            count,
          };
          // state.pods[id].running = false;
        } else {
          // most likely this id is "CODEPOD", which is for startup code and
          // should not be send to the browser
          console.log("WARNING id not recognized", id);
        }
      })
    ),
  setPodDisplayData: ({ id, content, count }) =>
    set(
      produce((state) => {
        // console.log("WS_DISPLAY_DATA", content);
        state.pods[id].result = {
          text: content.data["text/plain"],
          // FIXME hard coded MIME
          image: content.data["image/png"],
          count: count,
        };
      })
    ),
  setPodExecuteReply: ({ id, result, count }) =>
    set(
      produce((state) => {
        // console.log("WS_EXECUTE_REPLY", action.payload);
        if (id in state.pods) {
          // state.pods[id].execute_reply = {
          //   text: result,
          //   count: count,
          // };
          // console.log("WS_EXECUTE_REPLY", result);
          state.pods[id].running = false;
          if (!state.pods[id].result) {
            state.pods[id].result = {
              text: result,
              count: count,
            };
          }
        } else {
          // most likely this id is "CODEPOD", which is for startup code and
          // should not be send to the browser
          console.log("WARNING id not recognized", id);
        }
      })
    ),
  setPodError: ({ id, ename, evalue, stacktrace }) =>
    set(
      produce((state) => {
        if (id === "CODEPOD") return;
        state.pods[id].error = {
          ename,
          evalue,
          stacktrace,
        };
      })
    ),
  setPodStream: ({ id, content }) =>
    set(
      produce((state) => {
        if (!(id in state.pods)) {
          console.log("WARNING id is not found:", id);
          return;
        }
        // append
        let pod = state.pods[id];
        if (content.name === "stderr" && pod.lang === "racket") {
          // if (!pod.result) {
          //   pod.result = {};
          // }
          // pod.result.stderr = true;
          pod.error = {
            ename: "stderr",
            evalue: "stderr",
            stacktrace: "",
          };
        }
        pod.stdout += content.text;
      })
    ),
  setPodExecuteResult: ({ id, result, name }) =>
    set(
      produce((state) => {
        state.pods[id].io[name] = { result };
      })
    ),
  setIOResult: ({ id, name, ename, evalue, stacktrace }) =>
    set(
      produce((state) => {
        console.log("IOERROR", { id, name, ename, evalue, stacktrace });
        state.pods[id].io[name] = {
          error: {
            ename,
            evalue,
            stacktrace,
          },
        };
      })
    ),
  setPodStatus: ({ id, status, lang }) =>
    set(
      produce((state) => {
        // console.log("WS_STATUS", { lang, status });
        state.kernels[lang].status = status;
        // this is for racket kernel, which does not have a execute_reply
        if (lang === "racket" && status === "idle" && state.pods[id]) {
          state.pods[id].running = false;
        }
      })
    ),
  setPodParent: ({ id, parent }) =>
    set(
      produce((state) => {
        // FIXME I need to modify many pods here.
        if (state.pods[id]?.parent === parent) return;
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
  loadRepo: async (client, id) => {
    const { pods, name } = await doRemoteLoadRepo({ id, client });
    set(
      produce((state) => {
        // TODO the children ordered by index
        state.pods = normalize(pods);
        state.repoName = name;
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
  remoteUpdateAllPods: async (client) => {
    async function helper(id) {
      let pod = get().pods[id];
      if (!pod) return;
      pod.children?.map(({ id }) => helper(id));
      if (id !== "ROOT") {
        // console.log("hashPod at remoteUpdateAllPods");
        if (pod.remoteHash !== hashPod(pod)) {
          await doRemoteUpdatePod(client, { pod });
          set(
            produce((state) => {
              let pod = state.pods[id];
              pod.remoteHash = hashPod(pod);
              pod.isSyncing = false;
              pod.dirty = false;
            })
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
  addClient: (clientID, name, color) =>
    set((state) => {
      if (!state.clients.has(clientID)) {
        addAwarenessStyle(clientID, color, name);
        return {
          clients: new Map(state.clients).set(clientID, {
            name: name,
            color: color,
          }),
        };
      }
      return { clients: state.clients };
    }),
  deleteClient: (clientID) =>
    set((state) => {
      const clients = new Map(state.clients);
      clients.delete(clientID);
      return { clients: clients };
    }),
  setUser: (user) =>
    set(
      produce((state: BearState) => {
        const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
        // if (!state.ydoc) state.ydoc = new Doc();
        if (state.provider) {
          const awareness = state.provider.awareness;
          awareness.setLocalStateField("user", { name: user.firstname, color });
        }
        state.user = { ...user, color };
      })
    ),
  flipShowLineNumbers: () =>
    set((state) => ({ showLineNumbers: !state.showLineNumbers })),
});

export const createRepoStore = () =>
  createStore<BearState>((...a) => ({
    ...createRepoSlice(...a),
    ...createRuntimeSlice(...a),
  }));
