import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MyState } from ".";

let serverURL;
if (window.location.protocol === "http:") {
  serverURL = `ws://${window.location.host}/socket`;
} else {
  serverURL = `wss://${window.location.host}/socket`;
}
console.log("yjs server url: ", serverURL);

export interface RepoMetaSlice {
  repoName: string | null;
  repoId: string | null;
  setRepo: (repoId: string) => void;
  setRepoName: (name: string) => void;
}

export const createRepoMetaSlice: StateCreator<
  RepoMetaSlice,
  [],
  [],
  RepoMetaSlice
> = (set, get) => ({
  repoId: null,
  repoName: null,
  setRepo: (repoId: string) =>
    set(
      produce((state: MyState) => {
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
  setRepoName: (name) => {
    set(
      produce((state) => {
        state.repoName = name;
      })
    );
  },
});
