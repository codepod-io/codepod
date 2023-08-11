import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { ApolloClient } from "@apollo/client";

import { Pod, MyState } from ".";

export interface PodSlice {
  getPod: (id: string) => Pod;
  getPods: () => Record<string, Pod>;
  getId2children: (id: string) => string[];
  setPodFocus: (id: string) => void;
  setPodBlur: (id: string) => void;
  setPodName: ({ id, name }: { id: string; name: string }) => void;
  setPodContent: (
    { id, content }: { id: string; content: string },
    // Whether to perform additional verification of whether content ==
    // pod.content before setting the dirty flag..
    verify?: boolean
  ) => void;
  setPodRichContent: ({
    id,
    richContent,
  }: {
    id: string;
    richContent: string;
  }) => void;
  initPodContent: ({ id, content }: { id: string; content: string }) => void;
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
  getPod: (id: string) => get().pods[id],
  getPods: () => get().pods,
  getId2children: (id: string) => get().id2children[id],
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
  setPodContent: ({ id, content }, verify = false) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (verify) {
          if (JSON.stringify(pod.content) === JSON.stringify(content)) {
            return;
          }
        }
        pod.content = content;
        pod.dirty = true;
      }),
      false,
      // @ts-ignore
      "setPodContent"
    ),
  setPodRichContent: ({ id, richContent }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (pod.type != "RICH") {
          return;
        }
        pod.richContent = richContent;
      }),
      false,
      // @ts-ignore
      "setPodRichContent"
    ),
  initPodContent: ({ id, content }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.content = content;
      }),
      false,
      // @ts-ignore
      "initPodContent"
    ),
  setPodRender: ({ id, value }) =>
    set(
      produce((state) => {
        state.pods[id].render = value;
      })
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
      produce((state) => {
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
      produce((state) => {
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
      produce((state) => {
        if (state.pods[id]) {
          state.pods[id].focus = true;
        }
      })
    ),
  setPodBlur: (id: string) =>
    set(
      produce((state) => {
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
