import { createStore, StateCreator, StoreApi } from "zustand";
import { MyState } from ".";

export interface SettingSlice {
  scopedVars?: boolean;
  setScopedVars: (b: boolean) => void;
  showAnnotations?: boolean;
  setShowAnnotations: (b: boolean) => void;
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
});
