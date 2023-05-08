import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext } from "react";

import { Annotation } from "../parser";
import { PodSlice, createPodSlice } from "./podSlice";
import { RepoMetaSlice, createRepoMetaSlice } from "./repoMetaSlice";
import { SettingSlice, createSettingSlice } from "./settingSlice";
import { RepoStateSlice, createRepoStateSlice } from "./repoStateSlice";
import { RuntimeSlice, createRuntimeSlice } from "./runtimeSlice";
import { CanvasSlice, createCanvasSlice } from "./canvasSlice";

import { enableMapSet } from "immer";

enableMapSet();

export type Pod = {
  id: string;
  name?: string;
  type: "CODE" | "SCOPE" | "RICH";
  content?: string;
  dirty?: boolean;
  isSyncing?: boolean;
  children: { id: string; type: string }[];
  parent: string;
  result?: { html?: string; text?: string; count: number; image?: string };
  status?: string;
  stdout?: string;
  stderr?: string;
  error?: { evalue: string; stacktrace: string[] } | null;
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
  RepoMetaSlice &
  RepoStateSlice &
  RuntimeSlice &
  SettingSlice &
  CanvasSlice;

export const RepoContext = createContext<StoreApi<MyState> | null>(null);

export const createRepoStore = () =>
  createStore(
    devtools<MyState>((...a) => ({
      ...createPodSlice(...a),
      ...createRepoMetaSlice(...a),
      ...createRepoStateSlice(...a),
      ...createSettingSlice(...a),
      ...createRuntimeSlice(...a),
      ...createCanvasSlice(...a),
    }))
  );
