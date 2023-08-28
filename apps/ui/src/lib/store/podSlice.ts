import { createStore, StateCreator, StoreApi } from "zustand";
import { produce } from "immer";

import { Pod, MyState } from ".";

export interface PodSlice {
  // local reactive variable for pod result
  podNames: Record<string, string>;
  setPodName: ({ id, name }: { id: string; name: string }) => void;
}

export const createPodSlice: StateCreator<MyState, [], [], PodSlice> = (
  set,
  get
) => ({
  podNames: {},
  setPodName: ({ id, name }) => {
    set(
      produce((state: MyState) => {
        state.podNames[id] = name;
      })
    );
  },
});
