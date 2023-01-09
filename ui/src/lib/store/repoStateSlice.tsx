import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import produce from "immer";
import { createContext } from "react";

import {
  normalize,
  doRemoteLoadRepo,
  doRemoteUpdatePod,
  doRemoteLoadVisibility,
  doRemoteUpdateVisibility,
  doRemoteAddCollaborator,
  doRemoteDeleteCollaborator,
} from "../fetch";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createRuntimeSlice, RuntimeSlice } from "./runtimeSlice";
import { ApolloClient } from "@apollo/client";
import { addAwarenessStyle } from "../styles";
import { Annotation } from "../parser";
import { MyState, Pod } from ".";

let serverURL;
if (window.location.protocol === "http:") {
  serverURL = `ws://${window.location.host}/socket`;
} else {
  serverURL = `wss://${window.location.host}/socket`;
}
console.log("yjs server url: ", serverURL);

export interface RepoStateSlice {
  pods: Record<string, Pod>;
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
  cutting: string | null;
  setShareOpen: (open: boolean) => void;
  setCutting: (id: string | null) => void;
  loadError: any;
  role: "OWNER" | "COLLABORATOR" | "GUEST";
  isPublic: boolean;
  updateVisibility: (
    client: ApolloClient<object>,
    isPublic: boolean
  ) => Promise<boolean>;
  loadVisibility: (client: ApolloClient<object>, repoId: string) => void;
  currentEditor: string | null;
  setCurrentEditor: (id: string | null) => void;
  setUser: (user: any) => void;
  addClient: (clientId: any, name, color) => void;
  deleteClient: (clientId: any) => void;
  // TODO: this belongs to podSlice
  remoteUpdateAllPods: (client) => void;
  showLineNumbers: boolean;
  flipShowLineNumbers: () => void;
  yjsConnecting: boolean;
  connectYjs: () => void;
  disconnectYjs: () => void;
}

export const createRepoStateSlice: StateCreator<
  MyState,
  [],
  [],
  RepoStateSlice
> = (set, get) => ({
  pods: {},
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
  cutting: null,
  showLineNumbers: false,
  setSessionId: (id) => set({ sessionId: id }),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setCurrentEditor: (id) => set({ currentEditor: id }),

  loadRepo: loadRepo(set, get),
  remoteUpdateAllPods: async (client) => {
    async function helper(id) {
      let pod = get().pods[id];
      if (!pod) return;
      pod.children?.map(({ id }) => helper(id));
      if (id !== "ROOT") {
        if (pod.dirty && !pod.isSyncing) {
          set(
            produce((state) => {
              // FIXME when doRemoteUpdatePod fails, this will be stuck.
              state.pods[id].isSyncing = true;
              // pod may be updated during remote syncing
              state.pods[id].dirty = false;
            })
          );
          await doRemoteUpdatePod(client, { pod, repoId: get().repoId });
          set(
            produce((state) => {
              state.pods[id].isSyncing = false;
            })
          );
        }
      }
    }
    await helper("ROOT");
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
});

function loadRepo(set, get) {
  return async (client, id) => {
    const { pods, name, error, userId, collaborators, isPublic } =
      await doRemoteLoadRepo({ id, client });
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
