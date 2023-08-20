import produce from "immer";
import { ApolloClient, gql } from "@apollo/client";
import { createStore, StateCreator, StoreApi } from "zustand";

import { Edge, Node } from "reactflow";
import * as Y from "yjs";

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

export type RuntimeInfo = {
  status?: string;
  wsStatus?: string;
};

type PodResult = {
  exec_count?: number;
  last_exec_end?: boolean;
  data: {
    type: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: Date;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

export interface RuntimeSlice {
  apolloClient?: ApolloClient<any>;
  setApolloClient: (client: ApolloClient<any>) => void;

  parsePod: (id: string) => void;
  parseAllPods: () => void;
  resolvePod: (id) => void;
  resolveAllPods: () => void;
  yjsRun: (id: string) => void;
  yjsRunChain: (id: string) => void;
  clearResults: (id) => void;
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
  getRuntimeMap(): Y.Map<RuntimeInfo>;
  getResultMap(): Y.Map<PodResult>;
  activeRuntime?: string;
  setActiveRuntime(id: string): void;
  yjsSendRun(ids: string[]): void;
  isRuntimeReady(): boolean;
}

export const createRuntimeSlice: StateCreator<MyState, [], [], RuntimeSlice> = (
  set,
  get
) => ({
  apolloClient: undefined,
  setApolloClient: (client) => set({ apolloClient: client }),
  parseResult: {},

  // new yjs-based runtime
  getRuntimeMap() {
    return get().ydoc.getMap("rootMap").get("runtimeMap") as Y.Map<RuntimeInfo>;
  },
  getResultMap() {
    return get().ydoc.getMap("rootMap").get("resultMap") as Y.Map<PodResult>;
  },
  activeRuntime: undefined,
  setActiveRuntime(id: string) {
    set({ activeRuntime: id });
  },
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
  isRuntimeReady() {
    const runtimeMap = get().getRuntimeMap();
    const activeRuntime = get().activeRuntime;
    if (!activeRuntime) {
      get().addError({
        type: "error",
        msg: "No active runtime",
      });
      return false;
    }
    const runtime = runtimeMap.get(activeRuntime);
    if (runtime?.wsStatus !== "connected") {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return false;
    }
    return true;
  },
  yjsSendRun(ids) {
    const activeRuntime = get().activeRuntime!;
    let specs = ids.map((id) => {
      // Actually send the run request.
      // Analyze code and set symbol table
      get().parsePod(id);
      // update anontations according to st
      get().resolvePod(id);
      const newcode = rewriteCode(id, get);
      return { podId: id, code: newcode };
    });
    // FIXME there's no control over duplicate runnings. This causes two
    // problems:
    // 1. if you click fast enough, you will see multiple results.
    // 2. if a pod takes time to run, it will be shown completed after first run
    //    finishes, but second run results could keep come after that.

    // const resultMap = get().getResultMap();
    // if (resultMap.get(id)?.running) {
    //   console.warn(`Pod ${id} is already running.`);
    //   return;
    // }
    specs = specs.filter(({ podId, code }) => {
      if (code) {
        get().clearResults(podId);
        get().setRunning(podId);
        return true;
      }
      return false;
    });
    if (specs) {
      get().apolloClient?.mutate({
        mutation: gql`
          mutation RunChain($specs: [RunSpecInput], $runtimeId: String) {
            runChain(specs: $specs, runtimeId: $runtimeId)
          }
        `,
        variables: {
          runtimeId: activeRuntime,
          specs,
        },
      });
    }
  },
  yjsRun: (id) => {
    if (!get().isRuntimeReady()) return;
    const nodesMap = get().getNodesMap();
    const nodes = Array.from<Node>(nodesMap.values());
    const node = nodesMap.get(id);
    if (!node) return;
    const chain = getDescendants(node, nodes);
    get().yjsSendRun(chain);
  },
  /**
   * Add the pod and all its downstream pods (defined by edges) to the chain and run the chain.
   * @param id the id of the pod to start the chain
   * @returns
   */
  yjsRunChain: async (id) => {
    if (!get().isRuntimeReady()) return;
    // Get the chain: get the edges, and then get the pods
    const edgesMap = get().getEdgesMap();
    let edges = Array.from<Edge>(edgesMap.values());
    // build a node2target map
    let node2target = {};
    edges.forEach(({ source, target }) => {
      // TODO support multiple targets
      node2target[source] = target;
    });
    // Get the chain
    let chain: string[] = [];
    let nodeid = id;
    while (nodeid) {
      // if the nodeid is already in the chain, then there is a loop
      if (chain.includes(nodeid)) break;
      chain.push(nodeid);
      nodeid = node2target[nodeid];
    }
    get().yjsSendRun(chain);
  },
  clearResults: (id) => {
    const resultMap = get().getResultMap();
    resultMap.delete(id);
  },
  setRunning: (id) => {
    set(
      produce((state: MyState) => {
        const resultMap = get().getResultMap();
        resultMap.set(id, { running: true, data: [] });
      })
    );
  },
});

/**
 * Get all code pods inside a scope by geographical order.
 */
function getDescendants(node: Node, nodes: Node[]): string[] {
  if (node.type === "CODE") return [node.id];
  if (node.type === "SCOPE") {
    let children = nodes.filter((n) => n.parentNode === node.id);
    children.sort((a, b) => {
      if (a.position.y === b.position.y) {
        return a.position.x - b.position.x;
      } else {
        return a.position.y - b.position.y;
      }
    });
    return ([] as string[]).concat(
      ...children.map((n) => getDescendants(n, nodes))
    );
  }
  return [];
}
