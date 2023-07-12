import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import produce from "immer";
import { createContext } from "react";
import { MonacoCompletionProvider } from "../monacoCompletionProvider";
import { monaco } from "react-monaco-editor";

import {
  normalize,
  doRemoteLoadRepo,
  doRemoteUpdatePod,
  doRemoteLoadVisibility,
  doRemoteUpdateVisibility,
  doRemoteAddCollaborator,
  doRemoteDeleteCollaborator,
  doRemoteAddPods,
  doRemoteUpdateCodeiumAPIKey,
} from "../fetch";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createRuntimeSlice, RuntimeSlice } from "./runtimeSlice";
import { ApolloClient } from "@apollo/client";
import { addAwarenessStyle } from "../styles";
import { Annotation } from "../parser";
import { MyState, Pod } from ".";
import { v4 as uuidv4 } from "uuid";

let serverURL;
if (window.location.protocol === "http:") {
  serverURL = `ws://${window.location.host}/socket`;
} else {
  serverURL = `wss://${window.location.host}/socket`;
}
console.log("yjs server url: ", serverURL);

const openTokenPage = () => {
  const PROFILE_URL = "https://www.codeium.com/profile";
  const params = new URLSearchParams({
    response_type: "token",
    redirect_uri: "chrome-show-auth-token",
    scope: "openid profile email",
    prompt: "login",
    redirect_parameters_type: "query",
    state: uuidv4(),
  });
  window.open(`${PROFILE_URL}?${params}`);
};

export async function registerUser(
  token: string
): Promise<{ api_key: string; name: string }> {
  const url = new URL("register_user/", "https://api.codeium.com");
  const response = await fetch(url, {
    body: JSON.stringify({ firebase_id_token: token }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  const user = await response.json();
  return user as { api_key: string; name: string };
}

export interface RepoStateSlice {
  pods: Record<string, Pod>;
  // From source pod id to target pod id.
  arrows: { source: string; target: string }[];
  id2parent: Record<string, string>;
  id2children: Record<string, string[]>;
  setSessionId: (sessionId: string) => void;
  addError: (error: { type: string; msg: string }) => void;
  loadRepo: (client: ApolloClient<object>, repoId: string) => void;
  clearError: () => void;
  repoLoaded: boolean;
  error: { type: string; msg: string } | null;
  provider?: WebsocketProvider | null;
  clients: Map<string, any>;
  user: any;
  ydoc: Doc;
  collaborators: any[];
  addCollaborator: (client: ApolloClient<object>, email: string) => any;
  deleteCollaborator: (client: ApolloClient<object>, id: string) => any;
  shareOpen: boolean;
  settingOpen: boolean;
  cutting: string | null;
  setShareOpen: (open: boolean) => void;
  setSettingOpen: (open: boolean) => void;
  setCutting: (id: string | null) => void;
  loadError: any;
  role: "OWNER" | "COLLABORATOR" | "GUEST";
  isPublic: boolean;
  updateVisibility: (
    client: ApolloClient<object>,
    isPublic: boolean
  ) => Promise<boolean>;
  updateAPIKey: (
    client: ApolloClient<object>,
    apiKey: string
  ) => Promise<boolean>;
  loadVisibility: (client: ApolloClient<object>, repoId: string) => void;
  currentEditor: string | null;
  setCurrentEditor: (id: string | null) => void;
  setUser: (user: any) => void;
  addClient: (clientId: any, name, color) => void;
  deleteClient: (clientId: any) => void;
  // TODO: this belongs to podSlice
  remoteUpdateAllPods: (client) => void;
  addPods: (client, repoId: string, pods: Pod[]) => void;
  showLineNumbers: boolean;
  flipShowLineNumbers: () => void;
  yjsConnecting: boolean;
  connectYjs: () => void;
  disconnectYjs: () => void;
}

let unregister: any = null;

export const createRepoStateSlice: StateCreator<
  MyState,
  [],
  [],
  RepoStateSlice
> = (set, get) => ({
  pods: {},
  arrows: [],
  id2parent: {},
  id2children: {},
  error: null,
  repoLoaded: false,
  user: {},
  ydoc: new Doc(),
  provider: null,
  // keep different seletced info on each user themselves
  // to fixed maco editor command bug
  currentEditor: null,
  //TODO: all presence information are now saved in clients map for future usage. create a modern UI to show those information from clients (e.g., online users)
  clients: new Map(),
  loadError: null,
  role: "GUEST",
  collaborators: [],
  isPublic: false,
  shareOpen: false,
  settingOpen: false,
  cutting: null,
  showLineNumbers: false,
  setSessionId: (id) => set({ sessionId: id }),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setCurrentEditor: (id) => set({ currentEditor: id }),

  loadRepo: loadRepo(set, get),
  remoteUpdateAllPods: async (client) => {
    // The pods that haven't been inserted to the database yet
    const pendingPods = Object.values(get().pods).filter(
      (pod) => (pod.dirty || pod.dirtyPending) && pod.pending
    );

    // First insert all pending pods and ignore their relationship for now
    if (pendingPods.length > 0) {
      try {
        await get().addPods(client, get().repoId || "", pendingPods);

        pendingPods.forEach((pod) => {
          set(
            produce((state) => {
              state.pods[pod.id].pending = false;
            })
          );
        });
      } catch (e) {
        console.log("add pods error", e);
      }
    }

    // update all dirty pods
    async function helper(id) {
      let pod = get().pods[id];
      if (!pod) return;
      pod.children?.map(({ id }) => helper(id));
      if (id !== "ROOT") {
        if ((pod.dirty || pod.dirtyPending) && !pod.isSyncing) {
          set(
            produce((state) => {
              // FIXME when doRemoteUpdatePod fails, this will be stuck.
              state.pods[id].isSyncing = true;
              // Transfer the dirty status from dirty to dirtyPending. This is
              // because pod may be updated during remote syncing, and the flag
              // might be cleared by a successful return, causing unsaved
              // content.
              state.pods[id].dirty = false;
              state.pods[id].dirtyPending = true;
            })
          );
          try {
            const res = await doRemoteUpdatePod(client, {
              pod,
              repoId: get().repoId,
            });
            set(
              produce((state) => {
                state.pods[id].isSyncing = false;
                // pod may be updated during remote syncing
                // clear dirty flag only when remote update is successful
                if (res) state.pods[id].dirtyPending = false;
              })
            );
          } catch (e) {
            set(
              produce((state) => {
                state.pods[id].isSyncing = false;
              })
            );
            console.log("remote update pod error", e, pod);
          }
        }
      }
    }
    await helper("ROOT");
  },
  addPods: async (client, repoId: string, pods: Pod[]) => {
    // const newPods = pods.map((id) => get().pods[id]);
    await doRemoteAddPods(client, { repoId, pods });
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
      produce((state: MyState) => {
        const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
        state.user = { ...user, color };
      })
    ),
  flipShowLineNumbers: () =>
    set((state) => ({ showLineNumbers: !state.showLineNumbers })),

  setShareOpen: (open: boolean) => set({ shareOpen: open }),
  setSettingOpen: (open: boolean) => set({ settingOpen: open }),
  loadVisibility: async (client, repoId) => {
    if (!repoId) return;
    const { collaborators, isPublic } = await doRemoteLoadVisibility(client, {
      repoId: get().repoId,
    });
    set(
      produce((state) => {
        state.collaborators = collaborators;
        state.isPublic = isPublic;
      })
    );
  },
  updateVisibility: async (client, isPublic) => {
    const res = await doRemoteUpdateVisibility(client, {
      repoId: get().repoId,
      isPublic,
    });
    console.log(res);
    if (res) await get().loadVisibility(client, get().repoId || "");
    return res;
  },
  addCollaborator: async (client, email) => {
    const { success, error } = await doRemoteAddCollaborator(client, {
      repoId: get().repoId,
      email,
    });
    if (success) {
      await get().loadVisibility(client, get().repoId || "");
    }
    return { success, error };
  },
  deleteCollaborator: async (client, collaboratorId) => {
    const { success, error } = await doRemoteDeleteCollaborator(client, {
      repoId: get().repoId,
      collaboratorId,
    });
    if (success) {
      await get().loadVisibility(client, get().repoId || "");
    }
    return { success, error };
  },
  setCutting: (id: string | null) => set({ cutting: id }),
  yjsConnecting: false,
  connectYjs: () => {
    if (get().yjsConnecting) return;
    if (get().provider) return;
    set({ yjsConnecting: true });
    console.log("connecting yjs socket ..");
    set(
      produce((state) => {
        state.ydoc = new Doc();
        state.provider = new WebsocketProvider(
          serverURL,
          state.repoId,
          state.ydoc
        );
        // max retry time: 10s
        state.provider.connect();
        state.provider.maxBackoffTime = 10000;

        state.yjsConnecting = false;
      })
    );
  },
  disconnectYjs: () =>
    set(
      // clean up the connected provider after exiting the page
      produce((state) => {
        console.log("disconnecting yjs socket ..");
        if (state.provider) {
          state.provider.destroy();
          // just for debug usage, remove it later
          state.provider = null;
        }
        state.ydoc.destroy();
      })
    ),
  updateAPIKey: async (client, apiKey) => {
    const { success } = await doRemoteUpdateCodeiumAPIKey(client, {
      apiKey,
    });
    try {
      if (success) {
        set({ user: { ...get().user, codeiumAPIKey: apiKey } });
        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.log(e);
      return false;
    }
  },
});

function loadRepo(set, get) {
  return async (client, id) => {
    const { pods, edges, name, error, userId, collaborators, isPublic } =
      await doRemoteLoadRepo(client, id);
    set(
      produce((state: MyState) => {
        // TODO the children ordered by index
        if (error) {
          // TOFIX: If you enter a repo by URL directly, it may throw a repo not found error because of your user info is not loaded in time.
          console.log("ERROR", error, id);
          state.loadError = error;
          return;
        }
        state.pods = normalize(pods);
        state.arrows = edges;
        state.repoName = name;
        state.isPublic = isPublic;
        state.collaborators = collaborators;
        // set the user role in this repo
        if (userId === state.user.id) {
          state.role = "OWNER";
        } else if (
          state.user &&
          collaborators.findIndex(({ id }) => state.user.id === id) >= 0
        ) {
          state.role = "COLLABORATOR";
        } else {
          state.role = "GUEST";
        }
        // only set the local awareness when the user is an owner or a collaborator
        if (state.provider && state.role !== "GUEST") {
          console.log("set awareness", state.user.firstname);
          const awareness = state.provider.awareness;
          awareness.setLocalStateField("user", {
            name: state.user.firstname,
            color: state.user.color,
          });
        }

        // fill in the parent/children relationships
        for (const id in state.pods) {
          let pod = state.pods[id];
          if (pod.parent) {
            state.id2parent[pod.id] = pod.parent;
          }
          state.id2children[pod.id] = pod.children.map((child) => child.id);
        }
        state.repoLoaded = true;
      })
    );
  };
}
