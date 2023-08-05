import { createStore, StateCreator, StoreApi } from "zustand";
import produce from "immer";

import { doRemoteDeletePod } from "../fetch";

import { ApolloClient } from "@apollo/client";

import { Pod, MyState } from ".";

export interface PodSlice {
  getPod: (id: string) => Pod;
  getPods: () => Record<string, Pod>;
  getId2children: (id: string) => string[];
  setPodFocus: (id: string) => void;
  setPodBlur: (id: string) => void;
  setPodGeo: (
    id: string,
    {
      x,
      y,
      width,
      height,
      parent,
    }: {
      x?: number;
      y?: number;

      width?: number;

      height?: number;
      parent?: string;
    },
    dirty?: boolean
  ) => void;
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
  addPod: (pod: Pod) => void;
  deletePod: (
    client: ApolloClient<object> | null,
    { id }: { id: string }
  ) => Promise<void>;
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
  addPod: addPod(set, get),
  deletePod: deletePod(set, get),
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
  setPodGeo: (id, { x, y, width, height, parent }, dirty = true) =>
    set(
      produce((state) => {
        let pod = state.pods[id];

        // 0. check if the update is necessary. This is used to prevent dirty
        //    status from being reset at the beginning of canvas loading.
        if (
          (!x || pod.x === x) &&
          (!y || pod.y === y) &&
          (!width || pod.width === width) &&
          (!height || pod.height === height) &&
          (!parent || pod.parent === parent)
        ) {
          return;
        }
        // 1. check if parent is updated. If so, update the children list.
        if (parent && parent !== pod.parent) {
          if (!state.pods[parent]) {
            throw new Error(`parent pod ${parent} not found`);
          }
          const oldparent = state.pods[state.pods[id].parent];
          pod.parent = parent;
          state.pods[parent].children.push(state.pods[id]);
          let idx = oldparent.children.findIndex(({ id: _id }) => _id === id);
          oldparent.children.splice(idx, 1);
        }
        // 2. update x,y,width,height
        pod.x = x ?? pod.x;
        pod.y = y ?? pod.y;
        pod.width = width ?? pod.width;
        pod.height = height ?? pod.height;
        // Update the dirty flag.
        pod.dirty ||= dirty;
      }),
      false,
      // @ts-ignore
      "setPodGeo"
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
          if (state.pods[id].exec_count != count) {
            state.pods[id].result = [];
            state.pods[id].exec_count = count;
          }
          switch (type) {
            case "display_data":
              // console.log("WS_DISPLAY_DATA", content);
              state.pods[id].result.push({
                type,
                text: content.data["text/plain"],
                image: content.data["image/png"],
                count: count,
              });
              break;
            case "execute_result":
              // console.log("WS_EXECUTE_RESULT", content);
              state.pods[id].result.push({
                type,
                text: content.data["text/plain"],
                count: count,
              });
              break;
            case "stream":
              // console.log("WS_STREAM", content);
              state.pods[id].result.push({
                // content.name : "stdout" or "stderr"
                type: `${type}_${content.name}`,
                text: content.text,
                count: count,
              });
              break;
            case "execute_reply":
              state.pods[id].running = false;
              state.pods[id].lastExecutedAt = Date.now();
              state.pods[id].result.push({
                type,
                text: content,
                count: count,
              });
              state.pods[id].exec_count = count;
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

/**
 * This action won't set the dirty field. The "pod.dirty" field must be set
 * manually to indicate a DB syncing is necessary.
 */
function addPod(set, get: () => MyState) {
  return async (pod) => {
    set(
      produce((state: MyState) => {
        // 1. do local update
        if (!state.pods.hasOwnProperty(pod.id)) {
          state.pods[pod.id] = pod;
          // push this node
          // TODO the children no longer need to be ordered
          // TODO the frontend should handle differently for the children
          // state.pods[parent].children.splice(index, 0, id);
          state.pods[pod.parent].children.push({ id: pod.id, type: pod.type });
        }
      })
    );
  };
}

function deletePod(set, get) {
  return async (
    client: ApolloClient<object> | null,
    { id }: { id: string }
  ) => {
    const pods = get().pods;
    const ids: string[] = [];

    // get all ids to delete. Gathering them here is easier than on the server

    if (!pods[id]) return;

    const dfs = (id) => {
      const pod = pods[id];
      if (pod) {
        ids.push(id);
        pod.children.forEach(dfs);
      }
    };

    dfs(id);
    // pop in ids
    set(
      produce((state: MyState) => {
        // delete the link to parent
        const parent = state.pods[state.pods[id]?.parent!];
        if (parent) {
          const index = parent.children.map(({ id }) => id).indexOf(id);
          // update all other siblings' index
          // remove all
          parent.children.splice(index, 1);
        }
        ids.forEach((id) => {
          delete state.pods[id];
        });
      })
    );
    if (client) {
      await doRemoteDeletePod(client, ids);
    }
  };
}
