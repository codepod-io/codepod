import produce from "immer";
import { gql } from "@apollo/client";
import { createStore, StateCreator, StoreApi } from "zustand";

// FIXME cyclic import
import { MyState } from ".";
import { analyzeCode, analyzeCodeViaQuery } from "../parser";

/**
 * Collect symbol tables from all the pods in scope.
 */
function collectSymbolTables({ id, get }: { id: string; get: () => MyState }) {
  let pods = get().pods;
  let pod = pods[id];
  if (!pod.parent) return {};
  let allSymbolTables = pods[pod.parent].children.map(({ id, type }) => {
    // FIXME make this consistent, CODE, POD, DECK, SCOPE; use enums
    if (pods[id].type === "CODE") {
      return pods[id].symbolTable || {};
    } else {
      // FIXME dfs, or re-export?
      let tables = (pods[id].children || [])
        .filter(({ id }) => pods[id].ispublic)
        .map(({ id }) => pods[id].symbolTable);
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
function rewriteCode(id: string, get: () => MyState) {
  let pods = get().pods;
  let pod = pods[id];
  if (!pod.content) return;
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

async function spawnRuntime({ client, sessionId }) {
  // load from remote
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
  sessionId: string | null;
  runtimeConnecting: boolean;
  runtimeConnected: boolean;
  kernels: Record<string, { status: string | null }>;
  // queueProcessing: boolean;
  socket: WebSocket | null;
  socketIntervalId: number | null;
  wsConnect: (client, sessionId) => void;
  wsDisconnect: () => void;
  wsRequestStatus: ({ lang }) => void;
  parsePod: (id: string) => void;
  parseAllPods: () => void;
  resolvePod: (id) => void;
  resolveAllPods: () => void;
  wsRun: (id) => void;
  wsInterruptKernel: ({ lang }) => void;
  clearResults: (id) => void;
  clearAllResults: () => void;
  setRunning: (id) => void;
}

export const createRuntimeSlice: StateCreator<MyState, [], [], RuntimeSlice> = (
  set,
  get
) => ({
  sessionId: null,
  kernels: {
    python: {
      status: null,
    },
  },
  runtimeConnecting: false,
  runtimeConnected: false,
  socket: null,
  socketIntervalId: null,
  wsConnect: wsConnect(set, get),
  wsDisconnect: () => {
    get().socket?.close();
  },
  wsRequestStatus: wsRequestStatus(set, get),
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
      if (get().pods[id].type === "CODE") {
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
      if (get().pods[id].type === "CODE") {
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
});

function wsConnect(set, get: () => MyState) {
  return async (client, sessionId) => {
    if (get().runtimeConnecting) return;
    if (get().runtimeConnected) return;
    console.log(`connecting to runtime ${sessionId} ..`);
    set({ runtimeConnecting: true });

    // 0. ensure the runtime is created
    let runtimeCreated = await spawnRuntime({ client, sessionId });
    if (!runtimeCreated) {
      throw Error("ERROR: runtime not ready");
    }
    // 1. get the socket
    // FIXME socket should be disconnected when leaving the repo page.
    if (get().socket !== null) {
      throw new Error("socket already connected");
    }
    // reset kernel status
    set({
      kernels: {
        python: {
          status: null,
        },
      },
    });

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

    set({ runtimeConnecting: false });
  };
}

function onMessage(set, get) {
  return (msg) => {
    // console.log("onMessage", msg.data || msg.body || undefined);
    // msg.data for websocket
    // msg.body for rabbitmq
    let { type, payload } = JSON.parse(msg.data || msg.body || undefined);
    console.debug("got message", type, payload);
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
    console.log("runtime connected");
    set({ runtimeConnected: true });
    // call connect kernel

    if (get().socketIntervalId) {
      clearInterval(get().socketIntervalId);
    }
    let id = setInterval(() => {
      if (get().socket) {
        console.log("sending ping for runtime ..");
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

function wsRequestStatus(set, get) {
  return ({ lang }) => {
    if (get().socket) {
      // set to unknown
      set(
        produce((state: MyState) => {
          state.kernels[lang].status = null;
        })
      );
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
  };
}
