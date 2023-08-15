import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import produce from "immer";
import { createContext } from "react";
import { MonacoCompletionProvider } from "../monacoCompletionProvider";
import { monaco } from "react-monaco-editor";

import { IndexeddbPersistence } from "y-indexeddb";

import { Doc, Transaction } from "yjs";
import { WebsocketProvider } from "./y-websocket";
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
  // From source pod id to target pod id.
  setSessionId: (sessionId: string) => void;
  setRepoData: (repo: {
    id: string;
    name: string;
    userId: string;
    public: boolean;
    collaborators: [
      {
        id: string;
        email: string;
        firstname: string;
        lastname: string;
      }
    ];
  }) => void;
  addError: (error: { type: string; msg: string }) => void;
  clearError: () => void;
  repoLoaded: boolean;
  error: { type: string; msg: string } | null;
  provider?: WebsocketProvider | null;
  clients: Map<string, any>;
  user: any;
  ydoc: Doc;
  collaborators: any[];
  shareOpen: boolean;
  settingOpen: boolean;
  setShareOpen: (open: boolean) => void;
  setSettingOpen: (open: boolean) => void;
  loadError: any;
  role: "OWNER" | "COLLABORATOR" | "GUEST";
  isPublic: boolean;
  setUser: (user: any) => void;
  addClient: (clientId: any, name, color) => void;
  deleteClient: (clientId: any) => void;
  showLineNumbers: boolean;
  flipShowLineNumbers: () => void;
  // A variable to avoid duplicate connection requests.
  yjsConnecting: boolean;
  // The status of yjs connection.
  yjsStatus?: string;
  connectYjs: () => void;
  disconnectYjs: () => void;
  // The status of the uploading and syncing of actual Y.Doc.
  yjsSyncStatus?: string;
  setYjsSyncStatus: (status: string) => void;
}

export const createRepoStateSlice: StateCreator<
  MyState,
  [],
  [],
  RepoStateSlice
> = (set, get) => ({
  error: null,
  repoLoaded: false,
  user: {},
  ydoc: new Doc(),
  provider: null,
  // keep different seletced info on each user themselves
  //TODO: all presence information are now saved in clients map for future usage. create a modern UI to show those information from clients (e.g., online users)
  clients: new Map(),
  loadError: null,
  role: "GUEST",
  collaborators: [],
  isPublic: false,
  shareOpen: false,
  settingOpen: false,
  showLineNumbers: false,
  setSessionId: (id) => set({ sessionId: id }),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  setRepoData: (repo) =>
    set(
      produce((state: MyState) => {
        state.repoName = repo.name;
        state.isPublic = repo.public;
        state.collaborators = repo.collaborators;
        // set the user role in this repo FIXME this assumes state.user is
        // loaded. Very prone to errors, e.g., state,.user must be loaded before
        // repo data is loaded.
        if (repo.userId === state.user.id) {
          state.role = "OWNER";
        } else if (
          state.user &&
          repo.collaborators.findIndex(({ id }) => state.user.id === id) >= 0
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
        state.repoLoaded = true;
      })
    ),
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
  yjsConnecting: false,
  yjsStatus: undefined,
  yjsSyncStatus: undefined,
  setYjsSyncStatus: (status) => set({ yjsSyncStatus: status }),
  connectYjs: () => {
    if (get().yjsConnecting) return;
    if (get().provider) return;
    set({ yjsConnecting: true });
    console.log("connecting yjs socket ..");
    const ydoc = new Doc();

    // TODO offline support
    // const persistence = new IndexeddbPersistence(get().repoId!, ydoc);
    // persistence.once("synced", () => {
    //   console.log("=== initial content loaded from indexedDB");
    // });

    // connect to primary database
    const provider = new WebsocketProvider(serverURL, get().repoId!, ydoc, {
      // resyncInterval: 2000,
      //
      // BC is more complex to track our custom Uploading status and SyncDone events.
      disableBc: true,
      params: {
        token: localStorage.getItem("token") || "",
      },
    });
    provider.on("status", ({ status }) => {
      set({ yjsStatus: status });
      // FIXME need to show an visual indicator about this, e.g., prevent user
      // from editing if WS is not connected.
      //
      // FIXME do I need a hard disconnect to ensure the doc is always reloaded
      // from server when WS is re-connected?
      //
      // if (status === "disconnected") { // get().disconnectYjs(); //
      //   get().connectYjs();
      // }
    });
    provider.on("mySync", (status: "uploading" | "synced") => {
      set({ yjsSyncStatus: status });
    });
    // provider.on("connection-close", () => {
    //   console.log("connection-close");
    //   // set({ yjsStatus: "connection-close" });
    // });
    // provider.on("connection-error", () => {
    //   console.log("connection-error");
    //   set({ yjsStatus: "connection-error" });
    // });
    // provider.on("sync", (isSynced) => {
    //   console.log("=== syncing", isSynced);
    //   // set({ yjsStatus: "syncing" });
    // });
    // provider.on("synced", () => {
    //   console.log("=== synced");
    //   // set({ yjsStatus: "synced" });
    // });
    // max retry time: 10s
    provider.maxBackoffTime = 10000;
    provider.connect();
    set(
      produce((state: MyState) => {
        state.ydoc = ydoc;
        state.provider = provider;
        state.yjsConnecting = false;
      })
    );
  },
  disconnectYjs: () =>
    set(
      // clean up the connected provider after exiting the page
      produce((state: MyState) => {
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
