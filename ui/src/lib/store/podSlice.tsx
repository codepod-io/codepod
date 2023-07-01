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
  setPodContent: ({ id, content }: { id: string; content: string }) => void;
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
  setPodResult: ({
    id,
    content,
    count,
  }: {
    id: string;
    content: { data: { html: string; text: string; image: string } };
    count: number;
  }) => void;
  setPodDisplayData: ({ id, content, count }) => void;
  setPodExecuteReply: ({ id, result, count }) => void;
  setPodStdout: ({ id, stdout }: { id: string; stdout: string }) => void;
  setPodError: ({ id, ename, evalue, stacktrace }) => void;
  setPodStream: ({ id, content }) => void;
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
  setPodContent: ({ id, content }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
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
  setPodResult: setPodResult(set, get),
  setPodDisplayData: ({ id, content, count }) =>
    set(
      produce((state) => {
        // console.log("WS_DISPLAY_DATA", content);
        state.pods[id].result = {
          text: content.data["text/plain"],
          // FIXME hard coded MIME
          image: content.data["image/png"],
          count: count,
        };
        state.pods[id].dirty = true;
      })
    ),
  setPodExecuteReply: ({ id, result, count }) =>
    set(
      produce((state) => {
        // console.log("WS_EXECUTE_REPLY", action.payload);
        if (id in state.pods) {
          // state.pods[id].execute_reply = {
          //   text: result,
          //   count: count,
          // };
          // console.log("WS_EXECUTE_REPLY", result);
          state.pods[id].running = false;
          state.pods[id].lastExecutedAt = Date.now();
          if (!state.pods[id].result) {
            state.pods[id].result = {
              text: result,
              count: count,
            };
          }
        } else {
          // most likely this id is "CODEPOD", which is for startup code and
          // should not be send to the browser
          console.log("WARNING id not recognized", id);
        }
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
  setPodStream: ({ id, content }) =>
    set(
      produce((state) => {
        if (!(id in state.pods)) {
          console.warn("id is not found:", id);
          return;
        }
        // append
        let pod = state.pods[id];
        if (content.name === "stderr" && pod.lang === "racket") {
          // if (!pod.result) {
          //   pod.result = {};
          // }
          // pod.result.stderr = true;
          pod.error = {
            ename: "stderr",
            evalue: "stderr",
            stacktrace: "",
          };
        }
        pod.stdout += content.text;
        pod.dirty = true;
      })
    ),
  setPodExecuteResult: ({ id, result, name }) =>
    set(
      produce((state) => {
        state.pods[id].io[name] = { result };
      })
    ),
  setIOResult: ({ id, name, ename, evalue, stacktrace }) =>
    set(
      produce((state) => {
        console.log("IOERROR", { id, name, ename, evalue, stacktrace });
        state.pods[id].io[name] = {
          error: {
            ename,
            evalue,
            stacktrace,
          },
        };
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

function setPodResult(set, get) {
  return ({ id, content, count }) =>
    set(
      produce((state: MyState) => {
        if (id in state.pods) {
          let text = content.data["text/plain"];
          let html = content.data["text/html"];
          let file;
          if (text) {
            let match = text.match(/CODEPOD-link\s+(.*)"/);
            if (match) {
              let fname = match[1].substring(match[1].lastIndexOf("/") + 1);
              let url = `${window.location.protocol}//api.${window.location.host}/static/${match[1]}`;
              console.log("url", url);
              html = `<a target="_blank" style="color:blue" href="${url}" download>${fname}</a>`;
              file = url;
            }
            // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
            // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
          }
          state.pods[id].result = {
            text,
            html,
            // TODO a link to the file
            // file,
            count,
          };
          state.pods[id].dirty = true;
          // state.pods[id].running = false;
        } else {
          // most likely this id is "CODEPOD", which is for startup code and
          // should not be send to the browser
          console.log("WARNING id not recognized", id);
        }
      })
    );
}
