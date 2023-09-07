import { createStore, StateCreator, StoreApi } from "zustand";
import { produce } from "immer";

import { MyState } from ".";
import { gql } from "@apollo/client";

export interface RepoSlice {
  repoName: string | null;
  repoNameSyncing: boolean;
  repoNameDirty: boolean;
  repoId: string | null;
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
  repoLoaded: boolean;
  collaborators: any[];
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  loadError: any;
  role: "OWNER" | "COLLABORATOR" | "GUEST";
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
  loadError: null,
  role: "GUEST",
  collaborators: [],
  isPublic: false,
  shareOpen: false,
  setShareOpen: (open: boolean) => set({ shareOpen: open }),

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
      refetchQueries: ["GetDashboardRepos"],
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
  repoLoaded: false,
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
});
