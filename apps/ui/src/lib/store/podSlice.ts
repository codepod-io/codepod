import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import * as Y from "yjs";

import { Pod, MyState } from ".";

type PodResult = {
  exec_count?: number;
  last_exec_end?: boolean;
  result: {
    type?: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: Date;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

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
