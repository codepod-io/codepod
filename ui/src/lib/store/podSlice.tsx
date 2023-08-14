import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { ApolloClient } from "@apollo/client";

import { Pod, MyState } from ".";

export interface PodSlice {
  setPodFocus: (id: string) => void;
  setPodBlur: (id: string) => void;
  setPodName: ({ id, name }: { id: string; name: string }) => void;
  setPodResult: ({ id, type, content, count }) => void;
  setPodStdout: ({ id, stdout }: { id: string; stdout: string }) => void;
  setPodError: ({ id, ename, evalue, stacktrace }) => void;
  setPodStatus: ({ id, status, lang }) => void;
  clonePod: (id: string) => any;
}

export const createPodSlice: StateCreator<MyState, [], [], PodSlice> = (
  set,
  get
) => ({
  setPodName: ({ id, name }) =>
    set(
      produce((state: MyState) => {
        let pod = state.pods[id];
        if (pod && pod.name !== name) {
          pod.name = name;
          pod.dirty = true;
        }
      }),
      false,
      // @ts-ignore
      "setPodName"
    ),
  setPodStdout: ({ id, stdout }) =>
    set(
      produce((state) => {
        state.pods[id].stdout = stdout;
        state.pods[id].dirty = true;
      })
    ),
  setPodError: ({ id, ename, evalue, stacktrace }) =>
    set(
      produce((state: MyState) => {
        if (id === "CODEPOD") return;
        state.pods[id].error = {
          ename,
          evalue,
          stacktrace,
        };
        state.pods[id].dirty = true;
      })
    ),
  setPodStatus: ({ id, status, lang }) =>
    set(
      produce((state: MyState) => {
        // console.log("WS_STATUS", { lang, status });
        state.kernels[lang].status = status;
        // this is for racket kernel, which does not have a execute_reply
        if (lang === "racket" && status === "idle" && state.pods[id]) {
          state.pods[id].running = false;
        }
      })
    ),
  setPodFocus: (id: string) =>
    set(
      produce((state: MyState) => {
        if (state.pods[id]) {
          state.pods[id].focus = true;
        }
      })
    ),
  setPodBlur: (id: string) =>
    set(
      produce((state: MyState) => {
        if (state.pods[id]) {
          state.pods[id].focus = false;
        }
      })
    ),
  clonePod: (id: string) => {
    const pod = get().pods[id];
    return {
      ...pod,
      children: pod.children.map((child) => get().clonePod(child.id)),
    };
  },
  setPodResult({ id, type, content, count }) {
    if (get().pods[id]) {
      set(
        produce((state) => {
          if (state.pods[id].last_exec_end) {
            state.pods[id].result = [];
            state.pods[id].last_exec_end = false;
          }
          switch (type) {
            case "display_data":
              // console.log("WS_DISPLAY_DATA", content);
              state.pods[id].result.push({
                type,
                text: content.data["text/plain"],
                image: content.data["image/png"],
              });
              break;
            case "execute_result":
              // console.log("WS_EXECUTE_RESULT", content);
              state.pods[id].result.push({
                type,
                text: content.data["text/plain"],
              });
              break;
            case "stream":
              // console.log("WS_STREAM", content);
              state.pods[id].result.push({
                // content.name : "stdout" or "stderr"
                type: `${type}_${content.name}`,
                text: content.text,
              });
              break;
            case "execute_reply":
              state.pods[id].running = false;
              state.pods[id].lastExecutedAt = Date.now();
              state.pods[id].result.push({
                type,
                text: content,
              });
              state.pods[id].exec_count = count;
              state.pods[id].last_exec_end = true;
              break;
            default:
              break;
          }
          state.pods[id].dirty = true;
        })
      );
    }
  },
});
