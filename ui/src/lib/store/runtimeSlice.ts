import produce from "immer";
import { ApolloClient, gql } from "@apollo/client";
import { createStore, StateCreator, StoreApi } from "zustand";

import { Edge, Node } from "reactflow";

// FIXME cyclic import
import { MyState } from ".";
import { analyzeCode, analyzeCodeViaQuery, Annotation } from "../parser";

/**
 * Collect symbol tables from all the pods in scope.
 */
function collectSymbolTables(
  id: string,
  get: () => MyState
): Record<string, string> {
  const nodesMap = get().getNodesMap();
  const nodes = Array.from<Node>(nodesMap.values());
  const parseResult = get().parseResult;
  const node = nodesMap.get(id);
  if (!node) return {};
  const isbridge = parseResult[id].isbridge;
  // Collect from parent scope.
  let parentId = node.parentNode;
  let allSymbolTables: Record<string, string>[] = [];
  // do this for all ancestor scopes.
  while (parentId) {
    const siblings = nodes
      .filter((node) => node.parentNode === parentId)
      .map((n) => n.id);
    const tables = siblings.map((sibId) => {
      // FIXME make this consistent, CODE, POD, DECK, SCOPE; use enums
      if (nodesMap.get(sibId)?.type === "CODE") {
        if (isbridge && sibId === id) {
          // The key to support recursive export bridge are:
          // 1. not to add the name to symbol table when resolving this bridge
          //    pod, so that we can correctly set name_thisScope =
          //    name_originScope.
          // 2. do add the name to symbol table when resolving other pods, so
          //    that other pods can see its definition.
          return {};
        } else {
          return parseResult[sibId].symbolTable || {};
        }
      } else {
        // FIXME dfs, or re-export?
        const children = nodes.filter((n) => n.parentNode === sibId);
        let tables = (children || [])
          .filter(({ id }) => parseResult[id].ispublic)
          .map(({ id }) => parseResult[id].symbolTable);
        return Object.assign({}, ...tables);
      }
    });
    allSymbolTables.push(Object.assign({}, ...tables));
    if (!parentId) break;
    // next iteration
    parentId = nodesMap.get(parentId)?.parentNode;
  }
  // collect from all ancestor scopes.
  // Collect from scopes by Arrows.
  const edges = get().edges;
  edges.forEach(({ source, target }) => {
    if (target === node.parentNode) {
      if (nodesMap.get(source)?.type === "CODE") {
        allSymbolTables.push(parseResult[target].symbolTable || {});
      } else {
        const children = nodes.filter((n) => n.parentNode === source);
        let tables = (children || [])
          .filter(({ id }) => parseResult[id].ispublic)
          .map(({ id }) => parseResult[id].symbolTable);
        allSymbolTables.push(Object.assign({}, ...tables));
      }
    }
  });
  // Combine the tables and return.
  let res: Record<string, string> = Object.assign(
    {},
    parseResult[id].symbolTable,
    ...allSymbolTables
  );
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
function rewriteCode(id: string, get: () => MyState): string | null {
  const nodesMap = get().getNodesMap();
  const node = nodesMap.get(id);
  const codeMap = get().getCodeMap();
  const parseResult = get().parseResult;
  if (!node) return null;
  if (!codeMap.has(id)) return null;
  let code = codeMap.get(id)!.toString();
  if (code.trim().startsWith("@export")) {
    code = code.replace("@export", " ".repeat("@export".length));
  }
  if (code.startsWith("!")) return code;
  // replace with symbol table
  let newcode = "";
  let index = 0;
  parseResult[id].annotations?.forEach((annotation) => {
    newcode += code.slice(index, annotation.startIndex);
    switch (annotation.type) {
      case "vardef":
      case "varuse":
        // directly replace with _SCOPE if we can resolve it
        if (annotation.origin) {
          newcode += `${annotation.name}_${
            nodesMap.get(annotation.origin)!.parentNode
          }`;
        } else {
          newcode += annotation.name;
        }
        break;
      case "function":
      case "callsite":
        // directly replace with _SCOPE too
        if (annotation.origin) {
          newcode += `${annotation.name}_${
            nodesMap.get(annotation.origin)!.parentNode
          }`;
        } else {
          console.log("function not found", annotation.name);
          newcode += annotation.name;
        }
        break;
      case "bridge":
        // replace "@export x" with "x_thisScope = x_originScope"
        if (annotation.origin) {
          newcode += `${annotation.name}_${nodesMap.get(id)!.parentNode} = ${
            annotation.name
          }_${nodesMap.get(annotation.origin)!.parentNode}`;
        } else {
          console.log("bridge not found", annotation.name);
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

async function spawnRuntime(client, sessionId: string) {
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

async function killRuntime(client, sessionId) {
  let res = await client.mutate({
    mutation: gql`
      mutation killRuntime($sessionId: String!) {
        killRuntime(sessionId: $sessionId)
      }
    `,
    variables: {
      sessionId,
    },
    refetchQueries: ["ListAllRuntimes", "GetRuntimeInfo"],
  });
  if (res.errors) {
    throw Error(
      `Error: ${
        res.errors[0].message
      }\n ${res.errors[0].extensions.exception.stacktrace.join("\n")}`
    );
  }
  return res.data.killRuntime;
}

export interface RuntimeSlice {
  sessionId: string | null;
  // From source pod id to target pod id.
  setSessionId: (sessionId: string) => void;
  runtimeConnecting: boolean;
  runtimeConnected: boolean;
  kernels: Record<string, { status: string | null }>;
  // queueProcessing: boolean;
  socket: WebSocket | null;
  socketIntervalId: number | null;
  wsConnect: (client, sessionId) => void;
  wsDisconnect: () => void;
  restartRuntime: (client: ApolloClient<any>, sessionId: string) => void;
  wsRequestStatus: ({ lang }) => void;
  parsePod: (id: string) => void;
  parseAllPods: () => void;
  resolvePod: (id) => void;
  resolveAllPods: () => void;
  runningId: string | null;
  wsRun: (id: string) => void;
  wsRunScope: (id: string) => void;
  wsSendRun: (id: string) => void;
  wsRunNext: () => void;
  chain: string[];
  wsRunChain: (id: string) => void;
  wsInterruptKernel: ({ lang }) => void;
  clearResults: (id) => void;
  clearAllResults: () => void;
  ensureResult(id: string): void;
  setRunning: (id) => void;
  parseResult: Record<
    string,
    {
      ispublic: boolean;
      isbridge: boolean;
      symbolTable: { [key: string]: string };
      annotations: Annotation[];
    }
  >;
}

export const createRuntimeSlice: StateCreator<MyState, [], [], RuntimeSlice> = (
  set,
  get
) => ({
  parseResult: {},
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),
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
  restartRuntime: async (client, sessionId) => {
    console.log("killing runtime ..");
    await killRuntime(client, sessionId);
    console.log("runtime killed, spawning new one ..");
    get().wsConnect(client, sessionId);
  },
  wsRequestStatus: wsRequestStatus(set, get),
  /**
   * Parse the code for defined variables and functions.
   * @param id paod
   */
  parsePod: (id) => {
    const nodesMap = get().getNodesMap();
    const codeMap = get().getCodeMap();
    set(
      produce((state: MyState) => {
        let analyze = get().scopedVars ? analyzeCode : analyzeCodeViaQuery;
        let { ispublic, isbridge, annotations } = analyze(
          codeMap.get(id)?.toString() || ""
        );
        state.parseResult[id] = {
          ispublic: false,
          isbridge: false,
          symbolTable: {},
          annotations: [],
        };
        state.parseResult[id].ispublic = ispublic;
        if (isbridge) state.parseResult[id].isbridge = isbridge;

        state.parseResult[id].symbolTable = Object.assign(
          {},
          ...annotations
            .filter(({ type }) =>
              ["function", "vardef", "bridge"].includes(type)
            )
            .map(({ name }) => ({
              [name]: id,
            }))
        );

        state.parseResult[id].annotations = annotations;
      })
    );
  },
  parseAllPods: () => {
    const nodesMap = get().getNodesMap();
    nodesMap.forEach((node) => {
      if (node.type === "CODE") get().parsePod(node.id);
    });
  },
  resolvePod: (id) => {
    // 1. collect symbol table
    let st = collectSymbolTables(id, get);
    // 2. resolve symbols
    set(
      produce((state: MyState) => {
        // update the origin field of the annotations
        state.parseResult[id].annotations.forEach((annotation) => {
          let { name } = annotation;
          if (st[name]) {
            annotation.origin = st[name];
          } else {
            annotation.origin = undefined;
          }
        });
      })
    );
  },
  resolveAllPods: () => {
    const nodesMap = get().getNodesMap();
    nodesMap.forEach((node) => {
      if (node.type === "CODE") get().resolvePod(node.id);
    });
  },
  // This runningId is a unique pod id indicating which pod is being run. The
  // state.pods[id].running is a indicator of the pod in the chain that is
  // scheduled to run.
  runningId: null,
  /**
   * Actually send the run request.
   */
  wsSendRun: async (id) => {
    if (get().runningId !== null) {
      // This should never happen: there shouldn't be another pod running.
      get().addError({
        type: "error",
        msg: "Another pod is running",
      });
      return;
    }
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return;
    }
    // Set this pod as running.
    set({ runningId: id });
    // Actually send the run request.
    // Analyze code and set symbol table
    get().parsePod(id);
    // update anontations according to st
    get().resolvePod(id);
    // rewrite the code
    const newcode = rewriteCode(id, get);

    // Run the code in remote kernel.
    get().setRunning(id);
    get().socket?.send(
      JSON.stringify({
        type: "runCode",
        payload: {
          lang: "python",
          code: newcode,
          raw: true,
          podId: id,
          sessionId: get().sessionId,
        },
      })
    );
  },
  // All pods are added to the chain before executing.
  chain: [],
  /**
   * Add a pod to the chain and run it.
   */
  wsRun: async (id) => {
    const nodesMap = get().getNodesMap();
    const nodes = Array.from<Node>(nodesMap.values());
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return;
    }
    const node = nodesMap.get(id);
    if (!node) return;
    // If this pod is a code pod, add it.
    if (node.type === "CODE") {
      // Add to the chain
      get().clearResults(id);
      get().setRunning(id);
      set({ chain: [...get().chain, id] });
    } else if (node.type === "SCOPE") {
      // If this pod is a scope, run all pods inside a scope by geographical order.
      // get the pods in the scope
      const children = nodes
        .filter((n) => n.parentNode === id)
        .map((n) => n.id);
      if (!children) return;
      // Sort by x and y positions, with the leftmost and topmost first.
      children.sort((a, b) => {
        let nodeA = nodesMap.get(a);
        let nodeB = nodesMap.get(b);
        if (nodeA && nodeB) {
          if (nodeA.position.y === nodeB.position.y) {
            return nodeA.position.x - nodeB.position.x;
          } else {
            return nodeA.position.y - nodeB.position.y;
          }
        } else {
          return 0;
        }
      });
      // add to the chain
      // set({ chain: [...get().chain, ...children.map(({ id }) => id)] });
      children.forEach((id) => get().wsRun(id));
    }
    get().wsRunNext();
  },
  wsRunScope: async (id) => {
    // This is a separate function only because we need to build the node2children map first.
    // DEPRECATED. node2children is removed.
    get().wsRun(id);
  },
  /**
   * Add the pod and all its downstream pods (defined by edges) to the chain and run the chain.
   * @param id the id of the pod to start the chain
   * @returns
   */
  wsRunChain: async (id) => {
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return;
    }
    // Get the chain: get the edges, and then get the pods
    const edgesMap = get().getEdgesMap();
    let edges = Array.from(edgesMap.values());
    // build a node2target map
    let node2target = {};
    edges.forEach(({ source, target }) => {
      // TODO support multiple targets
      node2target[source] = target;
    });
    // Get the chain
    let chain: string[] = [];
    let node = id;
    while (node) {
      // if the node is already in the chain, then there is a loop
      if (chain.includes(node)) break;
      get().clearResults(node);
      get().setRunning(node);
      chain.push(node);
      node = node2target[node];
    }
    set({ chain });
    get().wsRunNext();
  },
  wsRunNext: async () => {
    const codeMap = get().getCodeMap();
    // run the next pod in the chain
    if (get().runningId !== null) return;
    if (get().chain.length > 0) {
      // Run the first pod in the chain
      let chain = get().chain;
      let id = chain[0];
      console.log("running", id, "remaining number of pods:", chain.length - 1);
      // remove the first element
      set({ chain: chain.slice(1) });
      // If the pod is empty, the kernel won't reply. So, we need to skip it.
      if (
        codeMap.get(id)?.toString() === undefined ||
        codeMap.get(id)?.toString() === ""
      ) {
        get().ensureResult(id);
        set(
          produce((state: MyState) => {
            state.podResults[id].running = false;
          })
        );
      } else {
        get().wsSendRun(id);
      }
    }
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
      produce((state: MyState) => {
        state.podResults[id] = {
          result: [],
        };
      })
    );
  },
  ensureResult(id) {
    if (id in get().podResults) return;
    get().clearResults(id);
  },
  clearAllResults: () => {
    const nodesMap = get().getNodesMap();
    const nodes = Array.from(nodesMap);
    nodes.forEach(({ id }) => get().clearResults(id));
  },
  setRunning: (id) => {
    get().ensureResult(id);
    set(
      produce((state: MyState) => {
        state.podResults[id].running = true;
      })
    );
  },
});

let _ws_timeout = 1000;
let _max_ws_timeout = 10000;

function wsConnect(set, get: () => MyState) {
  return async (client, sessionId) => {
    if (get().runtimeConnecting) return;
    if (get().runtimeConnected) return;
    console.log(`connecting to runtime ${sessionId} ..`);
    set({ runtimeConnecting: true });

    // 0. ensure the runtime is created
    let runtimeCreated = await spawnRuntime(client, sessionId);
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
    console.log("connecting to websocket ..");
    let socket = new WebSocket(socket_url);
    // Set timeout.
    console.log(`Setting ${_ws_timeout} ms timeout.`);
    setTimeout(() => {
      if (get().runtimeConnecting) {
        console.log(`Websocket timed out, but still connecting. Reset socket.`);
        socket.close();
        set({ runtimeConnecting: false });
        _ws_timeout = Math.min(_ws_timeout * 2, _max_ws_timeout);
      }
    }, _ws_timeout);

    // socket.emit("spawn", state.sessionId, lang);

    // If the mqAddress is not supplied, use the websocket
    socket.onmessage = onMessage(set, get);

    // well, since it is already opened, this won't be called
    //
    // UPDATE it works, this will be called even after connection

    socket.onopen = () => {
      console.log("runtime connected");
      // reset timeout
      _ws_timeout = 1000;
      set({ runtimeConnected: true });
      set({ runtimeConnecting: false });
      set({ socket });
      // call connect kernel

      // request kernel status after connection
      Object.keys(get().kernels).forEach((k) => {
        get().wsRequestStatus({
          lang: k,
        });
      });
    };
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
      set({ runtimeConnecting: false });
      set({ socket: null });
    };
  };
}

function onMessage(set, get: () => MyState) {
  return (msg) => {
    // console.log("onMessage", msg.data || msg.body || undefined);
    // msg.data for websocket
    // msg.body for rabbitmq
    let { type, payload } = JSON.parse(msg.data || msg.body || undefined);
    console.debug("got message", type, payload);
    switch (type) {
      case "stream":
        {
          let { podId, content } = payload;
          get().setPodResult({
            id: podId,
            type,
            content,
            count: null,
          });
        }
        break;
      case "execute_result":
        {
          let { podId, content, count } = payload;
          get().setPodResult({
            id: podId,
            type,
            content,
            count,
          });
        }
        break;
      case "display_data":
        {
          let { podId, content } = payload;
          get().setPodResult({
            id: podId,
            type,
            content,
            count: null,
          });
        }
        break;
      case "execute_reply":
        {
          let { podId, result, count } = payload;
          get().setPodResult({
            id: podId,
            type,
            content: result,
            count,
          });
          set({ runningId: null });
          // Continue to run the chain if there is any.
          get().wsRunNext();
        }
        break;
      case "error":
        {
          let { podId, ename, evalue, stacktrace } = payload;
          get().setPodError({ id: podId, ename, evalue, stacktrace });
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
        console.warn("WARNING unhandled message", { type, payload });
    }
  };
}

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
