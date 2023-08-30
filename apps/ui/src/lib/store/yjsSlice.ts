import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import { produce } from "immer";
import { createContext } from "react";
import { MonacoCompletionProvider } from "../monacoCompletionProvider";
import { monaco } from "react-monaco-editor";

// import { IndexeddbPersistence } from "y-indexeddb";

import { Doc, Transaction } from "yjs";
import * as Y from "yjs";
import { WebsocketProvider } from "../utils/y-websocket";
import { createRuntimeSlice, RuntimeSlice } from "./runtimeSlice";
import { ApolloClient } from "@apollo/client";
import { addAwarenessStyle } from "../utils/utils";
import { Annotation } from "../parser";
import { MyState, Pod } from ".";

export async function registerUser(
  token: string
): Promise<{ api_key: string; name: string }> {
  const url = new URL("register_user/", "https://api.codeium.com");
  const response = await fetch(url.toString(), {
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

export interface YjsSlice {
  addError: (error: { type: string; msg: string }) => void;
  clearError: () => void;
  error: { type: string; msg: string } | null;
  provider?: WebsocketProvider | null;
  clients: Map<string, any>;
  user: any;
  ydoc: Doc;
  setUser: (user: any) => void;
  addClient: (clientId: any, name, color) => void;
  deleteClient: (clientId: any) => void;
  // A variable to avoid duplicate connection requests.
  yjsConnecting: boolean;
  // The status of yjs connection.
  yjsStatus?: string;
  connectYjs: (yjsWsUrl: string) => void;
  disconnectYjs: () => void;
  // The status of the uploading and syncing of actual Y.Doc.
  yjsSyncStatus?: string;
  setYjsSyncStatus: (status: string) => void;
  providerSynced: boolean;
  setProviderSynced: (synced: boolean) => void;
  runtimeChanged: boolean;
  toggleRuntimeChanged: () => void;
  resultChanged: Record<string, boolean>;
  toggleResultChanged: (id: string) => void;
}

export const createYjsSlice: StateCreator<MyState, [], [], YjsSlice> = (
  set,
  get
) => ({
  error: null,

  user: {},
  ydoc: new Doc(),
  provider: null,
  // keep different seletced info on each user themselves
  //TODO: all presence information are now saved in clients map for future usage. create a modern UI to show those information from clients (e.g., online users)
  clients: new Map(),
  addError: (error) => set({ error }),
  clearError: () => set({ error: null }),

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

  yjsConnecting: false,
  yjsStatus: undefined,
  yjsSyncStatus: undefined,
  providerSynced: false,
  setProviderSynced: (synced) => set({ providerSynced: synced }),
  setYjsSyncStatus: (status) => set({ yjsSyncStatus: status }),
  runtimeChanged: false,
  toggleRuntimeChanged: () =>
    set((state) => ({ runtimeChanged: !state.runtimeChanged })),
  resultChanged: {},
  toggleResultChanged: (id) =>
    set(
      produce((state: MyState) => {
        state.resultChanged[id] = !state.resultChanged[id];
      })
    ),
  connectYjs: (yjsWsUrl) => {
    if (get().yjsConnecting) return;
    if (get().provider) return;
    set({ yjsConnecting: true });
    console.log(`connecting yjs socket ${yjsWsUrl} ..`);
    const ydoc = new Doc();

    // TODO offline support
    // const persistence = new IndexeddbPersistence(get().repoId!, ydoc);
    // persistence.once("synced", () => {
    //   console.log("=== initial content loaded from indexedDB");
    // });

    // connect to primary database
    const provider = new WebsocketProvider(yjsWsUrl, get().repoId!, ydoc, {
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
    provider.once("synced", () => {
      console.log("Provider synced, setting initial content ...");
      get().adjustLevel();
      get().updateView();
      // Trigger initial results rendering.
      const resultMap = get().getResultMap();
      Array.from(resultMap.keys()).forEach((key) => {
        get().toggleResultChanged(key);
      });
      // Set observers to trigger future results rendering.
      resultMap.observe(
        (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
          // clearResults and setRunning is local change.
          // if (transaction.local) return;
          YMapEvent.changes.keys.forEach((change, key) => {
            // refresh result for pod key
            // FIXME performance on re-rendering: would it trigger re-rendering for all pods?
            get().toggleResultChanged(key);
          });
        }
      );
      // Set active runtime
      const runtimeMap = get().getRuntimeMap();
      if (runtimeMap.size > 0) {
        const runtimeList = Array.from(runtimeMap.keys());
        const activeInstances = runtimeList.filter((id) => {
          return runtimeMap.get(id)?.status !== undefined;
        });
        if (activeInstances) {
          get().setActiveRuntime(activeInstances[0]);
        } else {
          get().setActiveRuntime(runtimeList[0]);
        }
      }
      // Set up observers to trigger future runtime status changes.
      runtimeMap.observe(
        (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
          // delete runtime is a local change.
          // if (transaction.local) return;
          get().toggleRuntimeChanged();
        }
      );
      // Set synced flag to be used to ensure canvas rendering after yjs synced.
      get().setProviderSynced(true);
    });
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
