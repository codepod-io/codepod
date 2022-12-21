import produce from "immer";
import { gql } from "@apollo/client";
import { createStore, StateCreator, StoreApi } from "zustand";

// FIXME cyclic import
import { RepoSlice } from "./store";
import { analyzeCode, analyzeCodeViaQuery } from "./parser";

/**
 * Collect symbol tables from all the pods in scope.
 */
function collectSymbolTables({
  id,
  get,
}: {
  id: string;
  get: () => RepoSlice & RuntimeSlice;
}) {
  let pods = get().pods;
  let pod = pods[id];
  if (!pod.parent) return {};
  let allSymbolTables = pods[pod.parent].children.map(({ id, type }) => {
    // FIXME make this consistent, CODE, POD, DECK, SCOPE; use enums
    if (pods[id].type === "CODE") {
      return pods[id].symbolTable || {};
    } else {
      // FIXME dfs, or re-export?
      let tables = pods[id].children
        .filter(({ id }) => pods[id].ispublic)
        .map(({ id }) => pods[id].symbolTable || {});
      return Object.assign({}, ...tables);
    }
  });
  let res = Object.assign({}, pods[id].symbolTable, ...allSymbolTables);
  return res;
}

/**
 * 1. parse the code, get: (defs, refs) to functions & variables
 * 2. consult symbol table to resolve them
 * 3. if all resolved, rewrite the code; otherwise, return null.
 * @param code
 * @param symbolTable
 * @returns
 */
function rewriteCode(id: string, get: () => RepoSlice & RuntimeSlice) {
  let pods = get().pods;
  let pod = pods[id];
  let code = pod.content;
  if (code.trim().startsWith("@export")) {
    code = code.replace("@export", " ".repeat("@export".length));
  }
  if (code.startsWith("!")) return code;
  // replace with symbol table
  let newcode = "";
  let index = 0;
  pod.annotations?.forEach((annotation) => {
    newcode += code.slice(index, annotation.startIndex);
    switch (annotation.type) {
      case "vardef":
      case "varuse":
        // directly replace with _SCOPE if we can resolve it
        if (annotation.origin) {
          newcode += `${annotation.name}_${pods[annotation.origin].parent}`;
        } else {
          newcode += annotation.name;
        }
        break;
      case "function":
      case "callsite":
        // directly replace with _SCOPE too
        if (annotation.origin) {
          newcode += `${annotation.name}_${pods[annotation.origin].parent}`;
        } else {
          console.log("function not found", annotation.name);
          newcode += annotation.name;
        }
        break;
      default:
        throw new Error("unknown annotation type: " + annotation.type);
    }
    index = annotation.endIndex;
  });
  newcode += code.slice(index);
  console.debug("newcode", newcode);
  return newcode;
}

function onMessage(set, get) {
  return (msg) => {
    // console.log("onMessage", msg.data || msg.body || undefined);
    // msg.data for websocket
    // msg.body for rabbitmq
    let { type, payload } = JSON.parse(msg.data || msg.body || undefined);
    console.log("got message", type, payload);
    switch (type) {
      case "output":
        console.log("output:", payload);
        break;
      case "stdout":
        {
          let { podId, stdout } = payload;
          get().setPodStdout({ id: podId, stdout });
        }
        break;
      case "execute_result":
        {
          let { podId, content, count } = payload;
          get().setPodResult({ id: podId, content, count });
        }
        break;
      case "display_data":
        {
          let { podId, content, count } = payload;
          get().setPodDisplayData({ id: podId, content, count });
        }
        break;
      case "execute_reply":
        {
          let { podId, result, count } = payload;
          get().setPodExecuteReply({ id: podId, result, count });
        }
        break;
      case "error":
        {
          let { podId, ename, evalue, stacktrace } = payload;
          get().setPodError({ id: podId, ename, evalue, stacktrace });
        }
        break;
      case "stream":
        {
          let { podId, content } = payload;
          get().setPodStream({ id: podId, content });
        }
        break;
      case "IO:execute_result":
        {
          let { podId, result, name } = payload;
          get().setPodExecuteResult({ id: podId, result, name });
        }
        break;
      case "IO:execute_reply":
        // CAUTION ignore
        break;
      case "IO:error":
        {
          let { podId, name, ename, evalue, stacktrace } = payload;
          get().setIOResult({ id: podId, name, ename, evalue, stacktrace });
        }
        break;
      case "status":
        {
          const { lang, status, id } = payload;
          get().setPodStatus({ id, lang, status });
        }

        break;
      case "interrupt_reply":
        // console.log("got interrupt_reply", payload);
        get().wsRequestStatus({ lang: payload.lang });
        break;
      default:
        console.log("WARNING unhandled message", { type, payload });
    }
  };
}

const onOpen = (set, get) => {
  return () => {
    console.log("connected");
    set({ runtimeConnected: true });
    // call connect kernel

    if (get().socketIntervalId) {
      clearInterval(get().socketIntervalId);
    }
    let id = setInterval(() => {
      if (get().socket) {
        console.log("sending ping ..");
        get().socket.send(JSON.stringify({ type: "ping" }));
      }
      // websocket resets after 60s of idle by most firewalls
    }, 30000);
    set({ socketIntervalId: id });

    // request kernel status after connection
    Object.keys(get().kernels).forEach((k) => {
      get().wsRequestStatus({
        lang: k,
        sessionId: get().sessionId,
      });
    });
  };
};

async function spawnRuntime({ client, sessionId }) {
  // load from remote
  console.log("spawnRuntime");
  let res = await client.mutate({
    mutation: gql`
      mutation spawnRuntime($sessionId: String!) {
        spawnRuntime(sessionId: $sessionId)
      }
    `,
    variables: {
      sessionId,
    },
    // refetchQueries with array of strings are known not to work in many
    // situations, ref:
    // https://lightrun.com/answers/apollographql-apollo-client-refetchqueries-not-working-when-using-string-array-after-mutation
    //
    // refetchQueries: ["listAllRuntimes"],
    refetchQueries: ["ListAllRuntimes", "GetRuntimeInfo"],
  });
  console.log("spawnRuntime res", res);
  if (res.errors) {
    throw Error(
      `Error: ${
        res.errors[0].message
      }\n ${res.errors[0].extensions.exception.stacktrace.join("\n")}`
    );
  }
  return res.data.spawnRuntime;
}

export interface RuntimeSlice {
  wsConnect: (client, sessionId) => void;
  wsDisconnect: () => void;
  wsRequestStatus: ({ lang }) => void;
  parsePod: (id: string) => void;
  scopedVars?: boolean;
  setScopedVars: (b: boolean) => void;
  showAnnotations?: boolean;
  setShowAnnotations: (b: boolean) => void;
  parseAllPods: () => void;
  resolvePod: (id) => void;
  resolveAllPods: () => void;
  wsRun: (id) => void;
  wsInterruptKernel: ({ lang }) => void;
  clearResults: (id) => void;
  clearAllResults: () => void;
  setRunning: (id) => void;
  addPodExport: (id, exports, reexports) => void;
  clearAllExports: () => void;
  setPodExport: ({ id, exports, reexports }) => void;
  clearIO: (id) => void;
  deletePodExport: (id) => void;
  clearPodExport: (id) => void;
  togglePodExport: (id) => void;
  toggleDeckExport: (id) => void;
  addPodImport: (id, imports) => void;
  deletePodImport: (id) => void;
  togglePodImport: (id) => void;
}

export const createRuntimeSlice: StateCreator<
  RuntimeSlice & RepoSlice,
  [],
  [],
  RuntimeSlice
> = (set, get) => ({
  wsConnect: async (client, sessionId) => {
    // 0. ensure the runtime is created
    // let sessionId = get().sessionId;
    console.log("sessionId", sessionId);
    let runtimeCreated = await spawnRuntime({ client, sessionId });
    if (!runtimeCreated) {
      throw Error("ERROR: runtime not ready");
    }
    // 1. get the socket
    console.log("WS_CONNECT");
    // FIXME socket should be disconnected when leaving the repo page.
    if (get().socket !== null) {
      console.log("already connected, disconnecting first..");
      get().wsDisconnect();
      // Sleep 100ms for the socket to be disconnected.
      await new Promise((r) => setTimeout(r, 100));
    }
    // reset kernel status
    set({
      kernels: {
        python: {
          status: null,
        },
      },
    });
    console.log("connecting ..");

    // connect to the remote host
    // socket = new WebSocket(action.host);
    //
    // I canont use "/ws" for a WS socket. Thus I need to detect what's the
    // protocol used here, so that it supports both dev and prod env.
    let socket_url;
    if (window.location.protocol === "http:") {
      socket_url = `ws://${window.location.host}/runtime/${sessionId}`;
    } else {
      socket_url = `wss://${window.location.host}/runtime/${sessionId}`;
    }
    console.log("socket_url", socket_url);
    let socket = new WebSocket(socket_url);
    set({ socket });
    // socket.emit("spawn", state.sessionId, lang);

    // If the mqAddress is not supplied, use the websocket
    socket.onmessage = onMessage(set, get);

    // well, since it is already opened, this won't be called
    //
    // UPDATE it works, this will be called even after connection

    socket.onopen = onOpen(set, get);
    // so I'm setting this
    // Well, I should probably not dispatch action inside another action
    // (even though it is in a middleware)
    //
    // I probably can dispatch the action inside the middleware, because
    // this is not a dispatch. It will not modify the store.
    //
    // store.dispatch(actions.wsConnected());
    socket.onclose = () => {
      console.log("Disconnected ..");
      set({ runtimeConnected: false });
      set({ socket: null });
    };
  },
  wsDisconnect: () => {
    get().socket?.close();
  },
  wsRequestStatus: ({ lang }) => {
    if (get().socket) {
      // set to unknown
      set(
        produce((state) => {
          state.kernels[lang].status = null;
        })
      );
      console.log("Sending requestKernelStatus ..");
      get().socket?.send(
        JSON.stringify({
          type: "requestKernelStatus",
          payload: {
            sessionId: get().sessionId,
            lang,
          },
        })
      );
    } else {
      console.log("ERROR: not connected");
    }
  },
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
  /**
   * Parse the code for defined variables and functions.
   * @param id paod
   */
  parsePod: (id) => {
    set(
      produce((state) => {
        let analyze = get().scopedVars ? analyzeCode : analyzeCodeViaQuery;
        let { ispublic, annotations } = analyze(state.pods[id].content);
        state.pods[id].ispublic = ispublic;

        state.pods[id].symbolTable = Object.assign(
          {},
          ...annotations
            .filter(({ type }) => ["function", "vardef"].includes(type))
            .map(({ name }) => ({
              [name]: id,
            }))
        );

        state.pods[id].annotations = annotations;
      })
    );
  },
  parseAllPods: () => {
    Object.keys(get().pods).forEach((id) => {
      if (get().pods[id].type === "code") {
        get().parsePod(id);
      }
    });
  },
  resolvePod: (id) => {
    // 1. collect symbol table
    let st = collectSymbolTables({ id, get });
    // 2. resolve symbols
    set(
      produce((state) => {
        // update the origin field of the annotations
        state.pods[id].annotations.forEach((annotation) => {
          let { name } = annotation;
          if (st[name]) {
            annotation.origin = st[name];
          } else {
            annotation.origin = null;
          }
        });
      })
    );
  },
  resolveAllPods: () => {
    Object.keys(get().pods).forEach((id) => {
      if (get().pods[id].type === "code") {
        get().resolvePod(id);
      }
    });
  },
  wsRun: async (id) => {
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return;
    }
    // Analyze code and set symbol table
    get().parsePod(id);
    // update anontations according to st
    get().resolvePod(id);
    // rewrite the code
    const newcode = rewriteCode(id, get);
    // Run the code in remote kernel.
    get().setRunning(id);
    let pod = get().pods[id];
    get().socket?.send(
      JSON.stringify({
        type: "runCode",
        payload: {
          lang: pod.lang,
          code: newcode,
          namespace: pod.ns,
          raw: true,
          podId: pod.id,
          sessionId: get().sessionId,
        },
      })
    );
  },
  wsInterruptKernel: ({ lang }) => {
    get().socket!.send(
      JSON.stringify({
        type: "interruptKernel",
        payload: {
          sessionId: get().sessionId,
          lang,
        },
      })
    );
  },
  clearResults: (id) => {
    set(
      produce((state) => {
        state.pods[id].result = null;
        state.pods[id].stdout = "";
        state.pods[id].error = null;
      })
    );
  },
  clearAllResults: () => {
    set(
      produce((state) => {
        Object.keys(state.pods).forEach((id) => {
          state.pods[id].result = null;
          state.pods[id].stdout = "";
          state.pods[id].error = null;
        });
      })
    );
  },
  setRunning: (id) => {
    set(
      produce((state) => {
        state.pods[id].running = true;
      })
    );
  },
  // ==========
  // exports
  addPodExport: ({ id, name }) => {
    set(
      produce((state) => {
        // XXX at pod creation, remote pod in db gets null in exports/imports.
        // Thus this might be null. So create here to avoid errors.
        let pod = state.pods[id];
        if (!pod.exports) {
          pod.exports = {};
        }
        pod.exports[name] = false;
      })
    );
  },
  clearAllExports: () => {
    set(
      produce((state) => {
        for (let [, pod] of Object.entries(state.pods)) {
          (pod as any).exports = {};
          (pod as any).reexports = {};
        }
      })
    );
  },
  setPodExport: ({ id, exports, reexports }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.exports = Object.assign(
          {},
          ...exports.map((name) => ({ [name]: pod.exports[name] || [] }))
        );
        pod.reexports = reexports;
        // add the reexports use reference to the origin
        for (let [name, origid] of Object.entries(reexports)) {
          if (state.pods[origid as string].exports[name].indexOf(id) === -1) {
            state.pods[origid as string].exports[name].push(id);
          }
        }
      })
    );
  },
  clearIO: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].io[name];
      })
    );
  },
  deletePodExport: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].exports[name];
      })
    );
  },
  clearPodExport: ({ id }) => {
    set(
      produce((state) => {
        state.pods[id].exports = null;
      })
    );
  },
  togglePodExport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.exports[name] = !pod.exports[name];
      })
    );
  },
  toggleDeckExport: ({ id }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        // this is only for deck
        // state.pods[id].exports = {};
        if (!pod.exports) {
          pod.exports = {};
        }
        if (!state.pods[id].exports["self"]) {
          pod.exports["self"] = true;
        } else {
          pod.exports["self"] = false;
        }
      })
    );
  },
  addPodImport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.imports) {
          pod.imports = {};
        }
        pod.imports[name] = false;
      })
    );
  },
  deletePodImport: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].imports[name];
      })
    );
  },
  togglePodImport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.imports[name] = !pod.imports[name];
      })
    );
  },
  addPodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.midports) {
          pod.midports = {};
        }
        pod.midports[name] = false;
      })
    );
  },
  deletePodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        if (state.pods[id].midports) {
          delete state.pods[id].midports[name];
        }
      })
    );
  },
  togglePodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.midports[name] = !pod.midports[name];
      })
    );
  },
});
