import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext } from "react";

import { Annotation } from "../parser";
import { PodSlice, createPodSlice } from "./podSlice";
import { RepoSlice, createRepoSlice } from "./repoSlice";
import { SettingSlice, createSettingSlice } from "./settingSlice";
import { YjsSlice, createYjsSlice } from "./yjsSlice";
import { RuntimeSlice, createRuntimeSlice } from "./runtimeSlice";
import { CanvasSlice, createCanvasSlice } from "./canvasSlice";

import { enableMapSet } from "immer";

enableMapSet();

export type Pod = {
  id: string;
  name?: string;
  type: "CODE" | "SCOPE" | "RICH";
  content?: string;
  richContent?: string;
  dirty?: boolean;
  // A temporary dirty status used during remote API syncing, so that new dirty
  // status is not cleared by API returns.
  dirtyPending?: boolean;
  isSyncing?: boolean;
  children: { id: string; type: string }[];
  parent: string;
  result?: {
    type?: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  exec_count?: number;
  last_exec_end?: boolean;
  status?: string;
  stdout?: string;
  stderr?: string;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
  lastExecutedAt?: Date;
  lang: string;
  column?: number;
  raw?: boolean;
  fold?: boolean;
  symbolTable?: { [key: string]: string };
  annotations?: Annotation[];
  ispublic?: boolean;
  isbridge?: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
  ns?: string;
  running?: boolean;
  focus?: boolean;
  pending?: boolean;
};

export type MyState = PodSlice &
  RepoSlice &
  YjsSlice &
  RuntimeSlice &
  SettingSlice &
  CanvasSlice;

export const RepoContext = createContext<StoreApi<MyState> | null>(null);

export const createRepoStore = () =>
  createStore(
    devtools<MyState>((...a) => ({
      ...createPodSlice(...a),
      ...createRepoSlice(...a),
      ...createYjsSlice(...a),
      ...createSettingSlice(...a),
      ...createRuntimeSlice(...a),
      ...createCanvasSlice(...a),
    }))
  );
