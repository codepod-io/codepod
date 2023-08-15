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
  stdout?: string;
  stderr?: string;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

export interface PodSlice {
  // local reactive variable for pod result
  podResults: Record<string, PodResult>;
  podNames: Record<string, string>;
  setPodName: ({ id, name }: { id: string; name: string }) => void;
  setPodResult: ({ id, type, content, count }) => void;
  setPodStdout: ({ id, stdout }: { id: string; stdout: string }) => void;
  setPodError: ({ id, ename, evalue, stacktrace }) => void;
  setPodStatus: ({ id, status, lang }) => void;
}

export const createPodSlice: StateCreator<MyState, [], [], PodSlice> = (
  set,
  get
) => ({
  podResults: {},
  podNames: {},
  setPodName: ({ id, name }) => {
    set(
      produce((state: MyState) => {
        state.podNames[id] = name;
      })
    );
  },
  setPodStdout: ({ id, stdout }) => {
    get().ensureResult(id);
    set(
      produce((state: MyState) => {
        state.podResults[id].stdout = stdout;
      })
    );
  },
  setPodError: ({ id, ename, evalue, stacktrace }) => {
    get().ensureResult(id);
    set(
      produce((state: MyState) => {
        if (id === "CODEPOD") return;
        state.podResults[id].error = {
          ename,
          evalue,
          stacktrace,
        };
      })
    );
  },
  setPodStatus: ({ id, status, lang }) =>
    set(
      produce((state: MyState) => {
        // console.log("WS_STATUS", { lang, status });
        state.kernels[lang].status = status;
        // this is for racket kernel, which does not have a execute_reply
        // if (lang === "racket" && status === "idle" && state.pods[id]) {
        //   state.pods[id].running = false;
        // }
      })
    ),
  setPodResult({ id, type, content, count }) {
    const nodesMap = get().getNodesMap();
    const node = nodesMap.get(id);
    if (!node) {
      console.log("setPodResult: node not found", id);
      return;
    }
    get().ensureResult(id);
    set(
      produce((state: MyState) => {
        if (state.podResults[id].last_exec_end) {
          state.podResults[id].result = [];
          state.podResults[id].last_exec_end = false;
        }
        switch (type) {
          case "display_data":
            // console.log("WS_DISPLAY_DATA", content);
            state.podResults[id].result.push({
              type,
              text: content.data["text/plain"],
              image: content.data["image/png"],
            });
            break;
          case "execute_result":
            // console.log("WS_EXECUTE_RESULT", content);
            state.podResults[id].result.push({
              type,
              text: content.data["text/plain"],
            });
            break;
          case "stream":
            // console.log("WS_STREAM", content);
            state.podResults[id].result.push({
              // content.name : "stdout" or "stderr"
              type: `${type}_${content.name}`,
              text: content.text,
            });
            break;
          case "execute_reply":
            state.podResults[id].running = false;
            state.podResults[id].lastExecutedAt = new Date();
            state.podResults[id].result.push({
              type,
              text: content,
            });
            state.podResults[id].exec_count = count;
            state.podResults[id].last_exec_end = true;
            break;
          default:
            break;
        }
      })
    );
  },
});
