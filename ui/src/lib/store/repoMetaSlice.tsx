import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MyState } from ".";
import { gql } from "@apollo/client";

let serverURL;
if (window.location.protocol === "http:") {
  serverURL = `ws://${window.location.host}/socket`;
} else {
  serverURL = `wss://${window.location.host}/socket`;
}
console.log("yjs server url: ", serverURL);

export interface RepoMetaSlice {
  repoName: string | null;
  repoNameSyncing: boolean;
  repoNameDirty: boolean;
  repoId: string | null;
  setRepo: (repoId: string) => void;
  setRepoName: (name: string) => void;
  remoteUpdateRepoName: (client) => void;
}

export const createRepoMetaSlice: StateCreator<
  RepoMetaSlice,
  [],
  [],
  RepoMetaSlice
> = (set, get) => ({
  repoId: null,
  repoName: null,
  repoNameSyncing: false,
  repoNameDirty: false,
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
      produce((state: MyState) => {
        state.repoName = name;
        state.repoNameDirty = true;
      })
    );
  },
  remoteUpdateRepoName: async (client) => {
    if (get().repoNameSyncing) return;
    if (!get().repoNameDirty) return;
    let { repoId, repoName } = get();
    if (!repoId) return;
    // Prevent double syncing.
    set(
      produce((state: MyState) => {
        state.repoNameSyncing = true;
      })
    );
    // Do the actual syncing.
    await client.mutate({
      mutation: gql`
        mutation UpdateRepo($id: ID!, $name: String) {
          updateRepo(id: $id, name: $name)
        }
      `,
      variables: {
        id: repoId,
        name: repoName,
      },
      refetchQueries: ["GetRepos", "GetCollabRepos"],
    });
    set((state) =>
      produce(state, (state) => {
        state.repoNameSyncing = false;
        // Set it as synced IF the name is still the same.
        if (state.repoName === repoName) {
          state.repoNameDirty = false;
        }
      })
    );
  },
});
