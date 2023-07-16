import { createStore, StateCreator, StoreApi } from "zustand";
import { MyState } from ".";

export interface SettingSlice {
  scopedVars?: boolean;
  setScopedVars: (b: boolean) => void;
  showAnnotations?: boolean;
  setShowAnnotations: (b: boolean) => void;
  devMode?: boolean;
  setDevMode: (b: boolean) => void;
  autoRunLayout?: boolean;
  setAutoRunLayout: (b: boolean) => void;
  contextualZoomParams: Record<any, number>;
  contextualZoom: boolean;
  setContextualZoom: (b: boolean) => void;
  level2fontsize: (level: number) => number;
  showLineNumbers?: boolean;
  setShowLineNumbers: (b: boolean) => void;
  autoCompletion?: boolean;
  setAutoCompletion: (b: boolean) => void;
  isCustomToken?: boolean;
  setIsCustomToken: (b: boolean) => void;
  zoomedFontSize?: number | number[] | string;
  setZoomedFontSize: (n: number | number[] | string) => void;
}

export const createSettingSlice: StateCreator<MyState, [], [], SettingSlice> = (
  set,
  get
) => ({
  scopedVars: localStorage.getItem("scopedVars")
    ? JSON.parse(localStorage.getItem("scopedVars")!)
    : true,
  showAnnotations: localStorage.getItem("showAnnotations")
    ? JSON.parse(localStorage.getItem("showAnnotations")!)
    : false,
  setScopedVars: (b: boolean) => {
    // set it
    set({ scopedVars: b });
    // also write to local storage
    localStorage.setItem("scopedVars", JSON.stringify(b));
  },
  setShowAnnotations: (b: boolean) => {
    // set it
    set({ showAnnotations: b });
    // also write to local storage
    localStorage.setItem("showAnnotations", JSON.stringify(b));
  },
  devMode: localStorage.getItem("devMode")
    ? JSON.parse(localStorage.getItem("devMode")!)
    : false,
  setDevMode: (b: boolean) => {
    // set it
    set({ devMode: b });
    // also write to local storage
    localStorage.setItem("devMode", JSON.stringify(b));
  },
  autoRunLayout: localStorage.getItem("autoRunLayout")
    ? JSON.parse(localStorage.getItem("autoRunLayout")!)
    : true,
  setAutoRunLayout: (b: boolean) => {
    set({ autoRunLayout: b });
    // also write to local storage
    localStorage.setItem("autoRunLayout", JSON.stringify(b));
  },

  contextualZoom: localStorage.getItem("contextualZoom")
    ? JSON.parse(localStorage.getItem("contextualZoom")!)
    : false,
  setContextualZoom: (b: boolean) => {
    set({ contextualZoom: b });
    // also write to local storage
    localStorage.setItem("contextualZoom", JSON.stringify(b));
  },
  showLineNumbers: localStorage.getItem("showLineNumbers")
    ? JSON.parse(localStorage.getItem("showLineNumbers")!)
    : false,
  setShowLineNumbers: (b: boolean) => {
    // set it
    set({ showLineNumbers: b });
    // also write to local storage
    localStorage.setItem("showLineNumbers", JSON.stringify(b));
  },
  // TODO Make it configurable.
  contextualZoomParams: {
    prev: 56,
    0: 48,
    1: 32,
    2: 24,
    3: 16,
    next: 8,
    threshold: 16,
  },
  level2fontsize: (level: number) => {
    // default font size
    if (!get().contextualZoom) return 16;
    // when contextual zoom is on
    switch (level) {
      case -1:
        return get().contextualZoomParams.prev;
      case 0:
        return get().contextualZoomParams[0];
      case 1:
        return get().contextualZoomParams[1];
      case 2:
        return get().contextualZoomParams[2];
      case 3:
        return get().contextualZoomParams[3];
      default:
        return get().contextualZoomParams.next;
    }
  },
  autoCompletion: localStorage.getItem("autoCompletion")
    ? JSON.parse(localStorage.getItem("autoCompletion")!)
    : false,
  setAutoCompletion: (b: boolean) => {
    // set it
    set({ autoCompletion: b });
    // also write to local storage
    localStorage.setItem("autoCompletion", JSON.stringify(b));
  },
  isCustomToken: localStorage.getItem("isCustomToken")
    ? JSON.parse(localStorage.getItem("isCustomToken")!)
    : false,
  setIsCustomToken: (b: boolean) => {
    // set it
    set({ isCustomToken: b });
    // also write to local storage
    localStorage.setItem("isCustomToken", JSON.stringify(b));
  },
  zoomedFontSize:
    localStorage.getItem("zoomedFontSize") !== undefined
      ? Number(JSON.parse(localStorage.getItem("zoomedFontSize")!))
      : 16,
  setZoomedFontSize: (n: number | number[] | string) => {
    set({ zoomedFontSize: n });
    localStorage.setItem("zoomedFontSize", JSON.stringify(n));
  },
});
