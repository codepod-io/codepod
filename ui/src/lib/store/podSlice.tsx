import { createStore, StateCreator, StoreApi } from "zustand";
import { devtools } from "zustand/middleware";
import produce from "immer";
import { createContext } from "react";

import {
  normalize,
  doRemoteLoadRepo,
  doRemoteUpdatePod,
  doRemoteAddPod,
  doRemoteDeletePod,
  doRemoteLoadVisibility,
  doRemoteUpdateVisibility,
  doRemoteAddCollaborator,
  doRemoteDeleteCollaborator,
} from "../fetch";

import { Doc } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createRuntimeSlice, RuntimeSlice } from "./runtimeSlice";
import { ApolloClient } from "@apollo/client";
import { addAwarenessStyle } from "../styles";
import { Annotation } from "../parser";

import { Pod, MyState } from ".";

export interface PodSlice {
  getPod: (id: string) => Pod;
  getPods: () => Record<string, Pod>;
  getId2children: (string) => string[];
  setPodFocus: (id: string) => void;
  setPodBlur: (id: string) => void;
  updatePod: ({ id, data }: { id: string; data: Partial<Pod> }) => void;
  setPodName: ({ id, name }: { id: string; name: string }) => void;
  setPodContent: ({ id, content }: { id: string; content: string }) => void;
  initPodContent: ({ id, content }: { id: string; content: string }) => void;
  addPod: (client: ApolloClient<object> | null, pod: Pod) => void;
  deletePod: (
    client: ApolloClient<object> | null,
    { id, toDelete }: { id: string; toDelete: string[] }
  ) => Promise<void>;
  setPodPosition: ({
    id,
    x,
    y,
    dirty,
  }: {
    id: string;
    x: number;
    y: number;
    dirty: boolean;
  }) => void;
  setPodParent: ({
    id,
    parent,
    dirty,
  }: {
    id: string;
    parent: string;
    dirty: boolean;
  }) => void;
  setPodResult: ({
    id,
    content,
    count,
  }: {
    id: string;
    content: { data: { html: string; text: string; image: string } };
    count: number;
  }) => void;
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
  setPodLang: ({ id, lang }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.lang = lang;
        pod.dirty = true;
      }),
      false,
      // @ts-ignore
      "setPodLang"
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
  setPodPosition: ({ id, x, y, dirty = true }) =>
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.x = x;
        pod.y = y;
        pod.dirty ||= dirty;
      }),
      false,
      // @ts-ignore
      "setPodPosition"
    ),
  updatePod: ({ id, data }) =>
    set(
      produce((state) => {
        state.pods[id] = { ...state.pods[id], ...data };
        state.pods[id].dirty = true;
      }),
      false,
      // @ts-ignore
      "updatePod"
    ),
  setPodStdout: ({ id, stdout }) =>
    set(
      produce((state) => {
        state.pods[id].stdout = stdout;
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
  setPodParent: ({ id, parent, dirty = true }) =>
    set(
      produce((state) => {
        // FIXME I need to modify many pods here.
        if (state.pods[id]?.parent === parent) return;
        const oldparent = state.pods[state.pods[id].parent];
        state.pods[id].parent = parent;
        // FXME I'm marking all the pods as dirty here.
        state.pods[id].dirty ||= dirty;
        state.pods[parent].children.push(state.pods[id]);
        let idx = oldparent.children.findIndex(({ id: _id }) => _id === id);
        oldparent.children.splice(idx, 1);
      }),
      false,
      // @ts-ignore
      "setPodParent"
    ),
  resizeScope: ({ id }) =>
    set(
      produce((state) => {
        // Use the children pod size to compute the new size of the scope.
        // I would simply add the children size together, and add a margin.
        let width = 0;
        let height = 0;
        state.pods[id].children?.forEach((child) => {
          width += state.pods[child.id].width;
          height += state.pods[child.id].height;
        });
        state.pods[id].width = Math.max(state.pods[id].width, width + 20);
        state.pods[id].height = Math.max(state.pods[id].height, height + 20);
        state.pods[id].dirty = true;
      }),
      false,
      // @ts-ignore
      "resizeScope"
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
});

function addPod(set, get: () => MyState) {
  return async (client, pod) => {
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
    // 2. do remote update
    if (client) {
      await doRemoteAddPod(client, {
        repoId: get().repoId,
        parent: pod.parent,
        pod,
      });
    }
  };
}

function deletePod(set, get) {
  return async (
    client: ApolloClient<object> | null,
    { id, toDelete }: { id: string; toDelete: string[] }
  ) => {
    const pods = get().pods;

    // get all ids to delete. Gathering them here is easier than on the server

    if (!pods[id]) return;

    const dfs = (id) => {
      const pod = pods[id];
      if (pod) {
        toDelete.push(id);
        pod.children.forEach(dfs);
      }
    };

    dfs(id);
    // pop in toDelete
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
        toDelete.forEach((id) => {
          delete state.pods[id];
        });
      })
    );
    if (client) {
      await doRemoteDeletePod(client, { id, toDelete });
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
          // state.pods[id].running = false;
        } else {
          // most likely this id is "CODEPOD", which is for startup code and
          // should not be send to the browser
          console.log("WARNING id not recognized", id);
        }
      })
    );
}
