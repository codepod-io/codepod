import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MyState } from ".";
import { gql } from "@apollo/client";

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
        mutation UpdateRepo($id: ID!, $name: String!) {
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
