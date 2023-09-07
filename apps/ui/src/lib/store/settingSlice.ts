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
  setContextualZoomParams: (
    r: Record<any, number>,
    n: number,
    n1: number
  ) => void;
  restoreParamsDefault: () => void;
  contextualZoom: boolean;
  setContextualZoom: (b: boolean) => void;
  showLineNumbers?: boolean;
  setShowLineNumbers: (b: boolean) => void;
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
  contextualZoomParams: localStorage.getItem("contextualZoomParams")
    ? JSON.parse(localStorage.getItem("contextualZoomParams")!)
    : {
        0: 48,
        1: 32,
        2: 24,
        3: 16,
        next: 8,
        threshold: 16,
      },
  setContextualZoomParams: (
    contextualZoomParams: Record<any, number>,
    level: number,
    newSize: number
  ) => {
    let updatedParams;
    switch (level) {
      case 0:
        updatedParams = { ...contextualZoomParams, 0: newSize };
        break;
      case 1:
        updatedParams = { ...contextualZoomParams, 1: newSize };
        break;
      case 2:
        updatedParams = { ...contextualZoomParams, 2: newSize };
        break;
      case 3:
        updatedParams = { ...contextualZoomParams, 3: newSize };
        break;
      case 4:
        updatedParams = { ...contextualZoomParams, next: newSize };
        break;
    }
    set((state) => ({
      contextualZoomParams: {
        ...updatedParams,
      },
    }));
    localStorage.setItem(
      "contextualZoomParams",
      JSON.stringify({ ...updatedParams })
    );
  },
  restoreParamsDefault: () => {
    const updatedParams = {
      0: 48,
      1: 32,
      2: 24,
      3: 16,
      next: 8,
      threshold: 16,
    };
    set((state) => ({
      contextualZoomParams: {
        ...updatedParams,
      },
    }));
    localStorage.setItem(
      "contextualZoomParams",
      JSON.stringify({ ...updatedParams })
    );
  },
});
