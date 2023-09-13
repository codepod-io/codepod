import { createStore, StateCreator, StoreApi } from "zustand";
import { produce } from "immer";

import { MyState } from ".";
import { gql } from "@apollo/client";

export interface RepoSlice {
  repoName: string | null;
  repoNameSyncing: boolean;
  repoNameDirty: boolean;
  repoId: string | null;
  editMode: "view" | "edit";
  setEditMode: (mode: "view" | "edit") => void;
  setRepo: (repoId: string) => void;
  setRepoName: (name: string) => void;
  remoteUpdateRepoName: (client) => void;
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
  collaborators: any[];
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  isPublic: boolean;
}

export const createRepoSlice: StateCreator<MyState, [], [], RepoSlice> = (
  set,
  get
) => ({
  repoId: null,
  repoName: null,
  repoNameSyncing: false,
  repoNameDirty: false,
  collaborators: [],
  isPublic: false,
  shareOpen: false,
  setShareOpen: (open: boolean) => set({ shareOpen: open }),

  editMode: "view",
  setEditMode: (mode) => set({ editMode: mode }),

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
  // FIXME refactor out this function
  setRepoData: (repo) =>
    set(
      produce((state: MyState) => {
        state.repoName = repo.name;
        state.isPublic = repo.public;
        state.collaborators = repo.collaborators;
      })
    ),
});
