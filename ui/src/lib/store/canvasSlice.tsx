/**
 * See this PR for how the Canvas data is maintained:
 * https://github.com/codepod-io/codepod/pull/205
 */

import { createStore, StateCreator, StoreApi } from "zustand";
import { MyState, Pod } from ".";

import { produce } from "immer";

import { ApolloClient, useApolloClient, gql } from "@apollo/client";

import { match, P } from "ts-pattern";

import { myNanoId, nodetype2dbtype, dbtype2nodetype } from "../utils";

import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
  MarkerType,
  NodeDragHandler,
  ReactFlowInstance,
  Position,
} from "reactflow";

import { hierarchy, HierarchyNode, stratify, tree } from "d3-hierarchy";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

import * as d3 from "d3";
import { scaleLinear } from "d3-scale";
import { flextree } from "d3-flextree";

// TODO add node's data typing.
type NodeData = {
  level?: number;
};

// FIXME put this into utils
const level2color = {
  0: "rgba(187, 222, 251, 0.5)",
  1: "rgba(144, 202, 249, 0.5)",
  2: "rgba(100, 181, 246, 0.5)",
  3: "rgba(66, 165, 245, 0.5)",
  4: "rgba(33, 150, 243, 0.5)",
  // default: "rgba(255, 255, 255, 0.2)",
  default: "rgba(240,240,240,0.25)",
};

/**
 * Creare the temporary nodes as well as the temporary pods based on the given pod.
 * @param pod
 * @param position
 * @param parent
 * @param level
 * @returns
 */
function createTemporaryNode(pod, position, parent = "ROOT", level = 0): any {
  const id = myNanoId();
  let style = {
    // create a temporary half-transparent pod
    opacity: 0.5,
    width: pod.width,
  };

  if (pod.type === "DECK") {
    style["height"] = pod.height!;
    style["backgroundColor"] = level2color[level] || level2color["default"];
  }

  const newNode = {
    id,
    type: dbtype2nodetype(pod.type),
    position,
    data: {
      label: id,
      parent,
      level,
    },
    extent: level > 0 ? "parent" : undefined,
    dragHandle: ".custom-drag-handle",
    width: pod.width,
    height: pod.height!,
    // Note: when the temporary node is finally sticked to the canvas, the click event will trigger drag event/position change of this node once and cause a bug because the node is not ready in the store and DB. just make it undraggable during moving to avoid this bug.
    draggable: false,
    style,
  };

  if (parent !== "ROOT") {
    newNode["parentNode"] = parent;
  }

  const newPod = { ...pod, parent, id, position, children: [] };
  const nodes = [[newNode, newPod]];
  pod.children.forEach((child) => {
    nodes.push(
      ...createTemporaryNode(child, { x: child.x, y: child.y }, id, level + 1)
    );
  });
  return nodes;
}

/**
 * The new reactflow nodes for context-menu's addXXX items.
 */
function createNewNode(type: "scope" | "code" | "rich", position): Node {
  let id = myNanoId();
  const newNode = {
    id,
    type,
    position,
    ...(type === "scope"
      ? {
          width: 600,
          height: 600,
          style: { backgroundColor: level2color[0], width: 600, height: 600 },
        }
      : { width: 300, style: { width: 300 } }),
    data: {
      label: id,
      name: "",
      parent: "ROOT",
      level: 0,
    },
    dragHandle: ".custom-drag-handle",
  };
  return newNode;
}

function getAbsPos(node: Node, nodesMap) {
  let x = node.position.x;
  let y = node.position.y;
  if (node.parentNode) {
    // FIXME performance.
    let [dx, dy] = getAbsPos(nodesMap.get(node.parentNode), nodesMap);
    return [x + dx, y + dy];
  } else {
    return [x, y];
  }
}

function getScopeAt(
  x: number,
  y: number,
  excludes: string[],
  nodes,
  nodesMap
): Node {
  const scope = nodes.findLast((node) => {
    let [x1, y1] = getAbsPos(node, nodesMap);
    return (
      node.type === "scope" &&
      x >= x1 &&
      !excludes.includes(node.id) &&
      x <= x1 + node.width &&
      y >= y1 &&
      y <= y1 + node.height
    );
  });
  return scope;
}

function getNodePositionInsideScope(
  node: Node,
  scope: Node,
  nodesMap
): XYPosition {
  // compute the actual position
  let [x, y] = getAbsPos(node, nodesMap);
  let [dx, dy] = getAbsPos(scope, nodesMap);
  x -= dx;
  y -= dy;
  // auto-align the node to, keep it bound in the scope
  // FIXME: it assumes the scope must be larger than the node

  x = Math.max(x, 0);
  x = Math.min(x, scope.width! - node.width!);
  y = Math.max(y, 0);
  y = Math.min(y, scope.height! - node.height!);
  return { x, y };
}

/**
 * Sort the nodes. The parent nodes will appear before the child nodes. This
 * function is used to adjust node levels (adjustLevel).
 * @param nodes
 * @param nodesMap
 * @returns
 */
function topologicalSort(nodes: Node[], nodesMap) {
  // sort according to the topological order
  let indegree = new Map();
  nodes.forEach((node) => {
    indegree[node.id] = 0;
  });
  nodes.forEach((node) => {
    if (node.parentNode) {
      // actually the max indegree is 1
      indegree[node.parentNode] += 1;
    }
  });
  let queue: Node[] = [];
  nodes.forEach((node) => {
    if (!indegree[node.id]) {
      // push all 0 indegree nodes
      queue.push(node);
    }
  });
  let sorted: Node[] = [];
  while (queue.length > 0) {
    let node = queue.shift()!;
    sorted.push(node);
    if (node.parentNode) {
      indegree[node.parentNode]--;
      if (!indegree[node.parentNode]) {
        queue.push(nodesMap.get(node.parentNode));
      }
    }
  }
  sorted.reverse();
  return sorted;
}

/**
 * The Zustand store slice.
 */
export interface CanvasSlice {
  nodes: Node[];
  edges: Edge[];

  dragHighlight?: string;
  setDragHighlight: (dropHighlight: string) => void;
  removeDragHighlight: () => void;

  selectedPods: Set<string>;
  selectionParent: string | undefined;
  selectPod: (id: string, selected: boolean) => void;
  resetSelection: () => boolean;

  updateView: () => void;
  updateEdgeView: () => void;

  isPaneFocused: boolean;
  setPaneFocus: () => void;
  setPaneBlur: () => void;

  addNode: (type: "code" | "scope" | "rich", position: XYPosition) => void;

  pastingNodes?: Node[];
  headPastingNodes?: Set<string>;
  mousePos?: XYPosition | undefined;
  isPasting: boolean;
  pasteBegin: (position: XYPosition, pod: Pod, cutting: boolean) => void;
  pasteEnd: (position: XYPosition, cutting: boolean) => void;
  cancelPaste: (cutting: boolean) => void;
  onPasteMove: (mousePos: XYPosition) => void;

  isCutting: boolean;
  cuttingIds: Set<string>;
  cutBegin: (id: string) => void;
  cutEnd: (position: XYPosition, reactFlowInstance: ReactFlowInstance) => void;
  onCutMove: (mousePos: XYPosition) => void;
  cancelCut: () => void;

  adjustLevel: () => void;
  getScopeAtPos: ({ x, y }: XYPosition, exclude: string) => Node | undefined;
  moveIntoScope: (nodeId: string, scopeId: string) => void;
  moveIntoRoot: (nodeId: string) => void;
  tempUpdateView: ({ x, y }: XYPosition) => void;

  onNodesChange: (client: ApolloClient<any>) => OnNodesChange;
  onEdgesChange: (client: ApolloClient<any>) => OnEdgesChange;
  onConnect: (client: ApolloClient<any>) => OnConnect;

  autoLayout: (scopeId: string) => void;
}

export const createCanvasSlice: StateCreator<MyState, [], [], CanvasSlice> = (
  set,
  get
) => ({
  nodes: [],
  edges: [],

  setDragHighlight: (dragHighlight) => set({ dragHighlight }),
  removeDragHighlight: () => set({ dragHighlight: undefined }),

  // the nodes being cutting (on the top level)
  cuttingIds: new Set(),
  // all temporary nodes created during cutting/pasting
  pastingNodes: [],
  // the nodes being pasting (on the top level)
  headPastingNodes: new Set(),
  // current mouse position, used to update the pasting nodes on the top level when moving the mouse
  mousePos: undefined,

  isPaneFocused: false,

  selectedPods: new Set(),
  selectionParent: undefined,
  selectPod: (id, selected) => {
    set(
      produce((state: MyState) => {
        if (selected) {
          const p = get().getPod(id)?.parent;
          // if you select a node that has a different parent, clear all previous selections
          if (
            state.selectionParent !== undefined &&
            state.selectionParent !== p
          ) {
            state.selectedPods.clear();
          }
          state.selectionParent = p;
          state.selectedPods.add(id);
        } else {
          if (!state.selectedPods.delete(id)) return;
          if (state.selectedPods.size === 0) state.selectionParent = undefined;
        }
      })
    );
    get().updateView();
  },
  // clear all selections
  resetSelection: () => {
    if (get().selectedPods.size === 0) return false;
    set(
      produce((state: MyState) => {
        state.selectedPods.clear();
        state.selectionParent = undefined;
      })
    );
    return true;
  },

  /**
   * This function handles the real updates to the reactflow nodes to render.
   */
  updateView: () => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let selectedPods = get().selectedPods;
    // We have different sources of nodes:
    // 1. those from nodesMap, synced with other users
    let nodes = Array.from(nodesMap.values());
    // We don't use clientId anymore to filter pasting nodes. Instead, we filter
    // out the nodes that is being cutted. But for now, we are now hiding it,
    // but giving it a "cutting" className to add a dashed red border.
    //
    // .filter((node) => node.id !== get().cuttingId)
    nodes = nodes
      .sort((a: Node, b: Node) => a.data.level - b.data.level)
      .map((node) => ({
        ...node,
        style: {
          ...node.style,
          backgroundColor:
            node.type === "scope" ? level2color[node.data.level] : undefined,
        },
        selected: selectedPods.has(node.id),
        // className: get().dragHighlight === node.id ? "active" : "",
        className: match(node.id)
          .with(get().dragHighlight, () => "active")
          .otherwise(() => undefined),
      }));
    // 2. show the temporary nodes, make the temporary nodes on the front-most
    nodes = nodes.concat(get().pastingNodes || []);

    const cursor = get().mousePos!;
    const movingNodes = get().headPastingNodes;
    if (cursor) {
      nodes = nodes.map((node) =>
        // update the position of top-level pasting nodes by the mouse position
        movingNodes?.has(node.id) ? { ...node, position: cursor } : node
      );
    }
    set({ nodes });
  },
  updateEdgeView: () => {
    const edgesMap = get().ydoc.getMap<Edge>("edges");
    set({ edges: Array.from(edgesMap.values()).filter((e) => e) });
  },

  addNode: (type, position, parent = "ROOT") => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let node = createNewNode(type, position);
    nodesMap.set(node.id, node);
    get().addPod({
      id: node.id,
      children: [],
      parent,
      type: nodetype2dbtype(node.type || ""),
      lang: "python",
      x: node.position.x,
      y: node.position.y,
      width: node.width!,
      height: node.height!,
      // For my local update, set dirty to true to push to DB.
      dirty: true,
      pending: true,
    });
    get().updateView();
  },

  isPasting: false,
  isCutting: false,

  pasteBegin: (position, pod, cutting = false) => {
    // 1. create temporary nodes and pods
    const nodes = createTemporaryNode(pod, position);
    // 2. add the temporary pods to store.pods
    nodes.forEach(([node, p]) =>
      get().addPod({
        ...p,
        dirty: false,
      })
    );
    set({
      // Only headPastingNodes moves with the mouse, because the other temporary nodes are children of the headPastingNodes.
      // For now, we can have only one headPastingNode on the top level.
      // TODO: support multiple headPastingNodes on the top level when implementing multi-select copy-paste
      headPastingNodes: new Set([nodes[0][0].id]),
      // Distinguish the state of cutting or pasting
      isPasting: !cutting,
      isCutting: cutting,
      // But we need to keep all the temporary nodes in the pastingNodes list to render them.
      pastingNodes: nodes.map(([node, pod]) => node),
    });
    get().updateView();
  },
  onPasteMove: (mousePos: XYPosition) => {
    // When the mouse moves, only the top-level nodes move with the mouse. We don't have to update all the view.
    get().tempUpdateView(mousePos);
  },
  pasteEnd: (position, cutting = false) => {
    // on drop, make this node into nodesMap. The nodesMap.observer will updateView.
    const leadingNodes = get().headPastingNodes;
    const pastingNodes = get().pastingNodes;
    if (!pastingNodes || !leadingNodes) return;
    let nodesMap = get().ydoc.getMap<Node>("pods");

    // clear the temporary nodes and the pasting/cutting state
    set(
      produce((state) => {
        state.pastingNode = undefined;
        state.headPastingNodes = new Set();
        state.pastingNodes = [];
        state.mousePos = undefined;
        if (cutting) state.isCutting = false;
        else state.isPasting = false;
      })
    );

    pastingNodes.forEach((node) => {
      set(
        produce((state) => {
          let pod = state.pods[node!.id];
          if (leadingNodes?.has(node.id)) {
            pod.x = position.x;
            pod.y = position.y;
          }
          pod.dirty = true;
          // this flag triggers the addPods call when updating all dirty pods
          pod.pending = true;
        })
      );

      // insert all nodes to the yjs map
      nodesMap.set(node.id, {
        ...(leadingNodes?.has(node.id) ? { ...node, position } : node),
        style: { ...node.style, opacity: 1 },
        draggable: true,
      });
    });
    // update view
    get().updateView();

    // check if the final position located in another scope
    leadingNodes.forEach((id) => {
      let scope = getScopeAt(
        position.x,
        position.y,
        [id],
        get().nodes,
        nodesMap
      );
      if (scope && scope.id !== id) {
        get().moveIntoScope(id, scope.id);
      }
    });
  },
  cancelPaste: (cutting = false) => {
    const pastingNodes = get().pastingNodes || [];
    set(
      produce((state) => {
        // Remove pastingNode from store.
        state.pastingNodes = [];
        state.headPastingNodes = new Set();
        pastingNodes.forEach((node) => {
          delete state.pods[node!.id];
        });
        // Clear pasting data and update view.
        state.pastingNode = undefined;
        state.mousePos = undefined;
        if (cutting) state.isCutting = false;
        else state.isPasting = false;
      })
    );
    get().updateView();
  },

  //   checkDropIntoScope: (event, nodes: Node[], project: XYPosition=>XYPosition) => {},
  // cut will:
  // 1. hide the original node
  // 2. create a dummy node that move with cursor
  cutBegin: (id) => {
    const pod = get().clonePod(id);
    if (!pod) return;

    // Store only the top-level cut nodes, for now, it contains only one element. But we will support multi-select cut-paste in the future.
    set({ cuttingIds: new Set([id]) });
    get().pasteBegin({ x: pod.x, y: pod.y }, pod, true);
  },
  onCutMove: (mousePos) => {
    get().onPasteMove(mousePos);
  },
  // 3. on drop, delete the original node and create a new node
  cutEnd: (position, reactFlowInstance) => {
    const cuttingIds = get().cuttingIds;

    if (!cuttingIds) return;

    reactFlowInstance.deleteElements({
      nodes: Array.from(cuttingIds).map((id) => ({ id })),
    });

    set({ cuttingIds: new Set() });

    get().pasteEnd(position, true);
  },
  cancelCut: () => {
    set({ cuttingIds: new Set() });
    get().cancelPaste(true);
  },

  // NOTE: this does not mutate.
  getScopeAtPos: ({ x, y }, exclude) => {
    const nodesMap = get().ydoc.getMap<Node>("pods");
    return getScopeAt(x, y, [exclude], get().nodes, nodesMap);
  },

  adjustLevel: () => {
    // adjust the levels of all nodes, using topoSort
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let nodes = Array.from(nodesMap.values());
    nodes = topologicalSort(nodes, nodesMap);
    // update nodes' level
    nodes.forEach((node) => {
      let newLevel = node.parentNode
        ? nodesMap.get(node.parentNode!)!.data.level + 1
        : 0;
      if (node.data.level !== newLevel) {
        nodesMap.set(node.id, {
          ...node,
          data: {
            ...node.data,
            level: newLevel,
          },
        });
      }
    });
  },
  moveIntoRoot: (nodeId: string) => {
    console.log("Moving into root", nodeId);
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let node = nodesMap.get(nodeId);
    if (!node) {
      console.warn("Node not found", node);
      return;
    }
    let newNode: Node = {
      ...node,
      parentNode: undefined,
      extent: undefined,
      data: {
        ...node.data,
        level: 0,
      },
    };
    nodesMap.set(node.id, newNode);
    // update zustand & db
    get().setPodGeo(node.id, { parent: "ROOT" }, true);
    get().adjustLevel();
    // update view
    get().updateView();
  },

  moveIntoScope: (nodeId: string, scopeId: string) => {
    console.log(`Moving ${nodeId} into scope ${scopeId}`);
    // move a node into a scope.
    // 1. update the node's parentNode & position
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let node = nodesMap.get(nodeId);
    let scope = nodesMap.get(scopeId);
    if (!node || !scope) {
      console.warn("Node or scope not found", node, scope);
      return;
    }
    // let [x, y] = getAbsPos(node, nodesMap);
    // let position = getNodePositionInsideParent(node, scope, { x, y });
    let position = getNodePositionInsideScope(node, scope, nodesMap);
    let newNode: Node = {
      ...node,
      position,
      parentNode: scope.id,
      extent: "parent",
      data: {
        ...node.data,
        level: scope.data.level + 1,
      },
    };
    // update peer
    nodesMap.set(node.id, newNode);
    // update zustand & db
    get().setPodGeo(node.id, { parent: scope.id, ...position }, true);
    get().adjustLevel();
    // update view
    get().updateView();
  },

  tempUpdateView: (position) => {
    const movingNodes = get().headPastingNodes;
    set({
      mousePos: position,
      nodes: get().nodes.map((node) =>
        movingNodes?.has(node.id) ? { ...node, position } : node
      ),
    });
  },

  // I should modify nodesMap here
  onNodesChange: (client) => (changes: NodeChange[]) => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
    const nodes = get().nodes;

    // I think this place update the node's width/height
    const nextNodes = applyNodeChanges(changes, nodes);

    changes.forEach((change) => {
      switch (change.type) {
        case "reset":
          break;
        case "add":
          throw new Error("Add node should not be handled here");
        case "select":
          get().selectPod(change.id, change.selected);
          break;
        case "dimensions":
          {
            // Since CodeNode doesn't have a height, this dimension change will
            // be filed for CodeNode at the beginning or anytime the node height
            // is changed due to content height changes.
            const node = nextNodes.find((n) => n.id === change.id);
            if (!node) throw new Error("Node not found");

            let geoData = {
              parent: node.parentNode ? node.parentNode : "ROOT",
              x: node.position.x,
              y: node.position.y,
              width: node.width!,
              height: node.height!,
            };
            // console.log(
            //   `node ${change.id} dimension changed, geoData ${JSON.stringify(
            //     geoData
            //   )}`
            // );
            // If Yjs doesn't have the node, it means that it's a cutting/pasting
            // node. We won't add it to Yjs here.
            if (
              get()
                .pastingNodes?.map((n) => n.id)
                .includes(change.id)
            ) {
              if (nodesMap.has(change.id)) {
                throw new Error(
                  "Node is cutting/pasting node but exists in Yjs"
                );
              }
              // still, we need to set the node, otherwise the height is not set.
              // update local
              set(
                produce((state: MyState) => {
                  state.pastingNodes = state.pastingNodes?.map((n) =>
                    n.id === change.id ? node : n
                  );
                })
              );
              // update local
              get().setPodGeo(node.id, geoData, false);
            } else {
              if (!nodesMap.has(change.id)) {
                throw new Error("Node not found in yjs.");
              }
              nodesMap.set(change.id, node);
              // update local
              get().setPodGeo(node.id, geoData, true);
            }
          }
          break;
        case "position":
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error("Node not found");
          // If Yjs doesn't have the node, it means that it's a cutting/pasting
          // node. We won't add it to Yjs here.
          let geoData = {
            parent: node.parentNode ? node.parentNode : "ROOT",
            x: node.position.x,
            y: node.position.y,
            width: node.width!,
            height: node.height!,
          };

          if (!nodesMap.has(change.id)) {
            throw new Error("Node not found in yjs.");
          }
          nodesMap.set(change.id, node);
          // update local
          get().setPodGeo(node.id, geoData, true);

          break;
        case "remove":
          // FIXME Would reactflow fire multiple remove for all nodes? If so,
          // do they have a proper order? Seems yes.
          // remove from yjs
          nodesMap.delete(change.id);
          // remove from store
          get().deletePod(client, { id: change.id });
          break;
        default:
          // should not reach here.
          throw new Error("Unknown change type");
      }
    });
    get().updateView();
  },
  onEdgesChange: (client) => (changes: EdgeChange[]) => {
    // TODO sync with remote peer
    const edgesMap = get().ydoc.getMap<Edge>("edges");
    // apply the changes. Especially for the "select" change.
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    // FIXME this will create edge with IDs. But I probably would love to control the IDs to save in DB.
    changes.forEach((change) => {
      // console.log("=== onEdgeChange", change.type, change);
      // TODO update nodesMap to sync with remote peers
      switch (change.type) {
        case "add":
          break;
        case "remove":
          const edge = edgesMap.get(change.id);
          if (!edge) throw new Error("Edge not found");
          remoteDeleteEdge({
            source: edge.source,
            target: edge.target,
            client,
          });
          edgesMap.delete(change.id);
          break;
        case "reset":
          break;
        case "select":
          break;
        default:
          throw new Error("NO REACH");
      }
    });
  },
  onConnect: (client) => (connection: Connection) => {
    const edgesMap = get().ydoc.getMap<Edge>("edges");
    if (!connection.source || !connection.target) return null;
    remoteAddEdge({
      source: connection.source,
      target: connection.target,
      client,
    });
    const edge = {
      id: `${connection.source}_${connection.target}`,
      source: connection.source,
      sourceHandle: "top",
      target: connection.target,
      targetHandle: "top",
    };
    edgesMap.set(edge.id, edge);
    get().updateEdgeView();
  },
  setPaneFocus: () => set({ isPaneFocused: true }),
  setPaneBlur: () => set({ isPaneFocused: false }),
  autoLayout: (scopeId: string) => myAutoLayout(scopeId, get),
});

async function remoteAddEdge({ client, source, target }) {
  const mutation = gql`
    mutation addEdge($source: ID!, $target: ID!) {
      addEdge(source: $source, target: $target)
    }
  `;
  await client.mutate({
    mutation,
    variables: {
      source,
      target,
    },
  });
  return true;
}

async function remoteDeleteEdge({ client, source, target }) {
  const mutation = gql`
    mutation deleteEdge($source: ID!, $target: ID!) {
      deleteEdge(source: $source, target: $target)
    }
  `;
  await client.mutate({
    mutation,
    variables: {
      source,
      target,
    },
  });
  return true;
}

function myAutoLayout(scopeId, get: () => MyState) {
  forceLayout(scopeId, get);
  // flextreeLayout(scopeId, get);
}

// type SimNode = HierarchyNode<{ url: string; name: string }> &
//   SimulationNodeDatum;

// const root = hierarchy(tree);
// const links = root.links();
// const nodes = root.descendants();

function forceLayout(scopeId, get: () => MyState) {
  const nodes = get().nodes.filter((node) => node.parentNode === scopeId);
  const edges = get().edges;
  const tmpNodes = nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    r: (node.width! + node.height!) / 2,
    width: node.width,
    height: node.height,
  }));
  const tmpEdges = edges.map((edge) => ({
    source: edge.source,
    source0: 0,
    target: edge.target,
    target0: 1,
  }));
  const nodesMap = get().ydoc.getMap<Node>("pods");
  // 2. construct a D3 tree for the nodes and their connections
  // initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
  // const hierarchy = stratify<Node>()
  //   .id((d) => d.id)
  //   // get the id of each node by searching through the edges
  //   // this only works if every node has one connection
  //   .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(
  //   nodes
  // );
  const simulation = forceSimulation(tmpNodes)
    .force(
      "link",
      forceLink(tmpEdges)
        .id((d: any) => d.id)
        .distance(300)
        .strength(0.5)
    )
    // .force("charge", forceManyBody().strength(-1000))
    .force("x", forceX())
    .force("y", forceY())
    .force("collide", forceCollide(200))
    // .force("link", d3.forceLink(edges).id(d => d.id))
    // .force("charge", d3.forceManyBody())
    // .force("center", d3.forceCenter())
    .stop();
  simulation.tick(3000);
  // get the new positions
  // TODO need to transform the nodes to the center of the scope.
  const scope = nodesMap.get(scopeId);
  tmpNodes.forEach(({ id, x, y }) => {
    // FIXME I should assert here.
    if (nodesMap.has(id)) {
      nodesMap.set(id, {
        ...nodesMap.get(id)!,
        // position: { x: x + scope!.position!.x, y: y + scope!.position!.y },
        position: { x, y },
      });
    }
  });
  get().updateView();
}

// function rectangularCollide() {
//   function force(alpha) {
//     const nodes = this.nodes();
//     const quadtree = d3
//       .quadtree()
//       .extent((d) => [
//         [d.x - d.width / 2, d.y - d.height / 2],
//         [d.x + d.width / 2, d.y + d.height / 2],
//       ])
//       .addAll(nodes);

//     for (const node of nodes) {
//       const x0 = node.x - node.width / 2;
//       const y0 = node.y - node.height / 2;
//       const x1 = x0 + node.width;
//       const y1 = y0 + node.height;

//       quadtree.visit((other, x0n, y0n, x1n, y1n) => {
//         if (other !== node) {
//           const vx = node.x - other.x;
//           const vy = node.y - other.y;
//           const dx = Math.max(
//             0,
//             Math.abs(vx) - node.width / 2 - other.width / 2
//           );
//           const dy = Math.max(
//             0,
//             Math.abs(vy) - node.height / 2 - other.height / 2
//           );

//           if (dx || dy) {
//             const mag = Math.sqrt(dx * dx + dy * dy);
//             const sx = vx / mag;
//             const sy = vy / mag;
//             const penetration = Math.max(
//               0,
//               mag - node.width / 2 - other.width / 2,
//               mag - node.height / 2 - other.height / 2
//             );

//             node.x -= sx * penetration * alpha;
//             node.y -= sy * penetration * alpha;
//           }
//         }

//         return x0n > x1 || x0 > x1n || y0n > y1 || y0 > y1n;
//       });
//     }
//   }

//   force.initialize = function (nodes) {
//     this.nodes(nodes);
//   };

//   return force;
// }

function flextreeLayout(scopeId: string, get: () => MyState) {
  const nodes = get().nodes.filter((node) => node.parentNode === scopeId);
  const edges = get().edges;
  const nodesMap = get().ydoc.getMap<Node>("pods");
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(
    nodes
  );
  const layout = flextree();
  const tree = layout.hierarchy(hierarchy);
  layout(tree);
  tree.each((node) => console.log(`(${node.x}, ${node.y})`));
}

function treeLayout(scopeId: string, get: () => MyState) {
  // Auto layout all nodes inside a scope.
  // 1. gather all nodes
  const nodes = get().nodes.filter((node) => node.parentNode === scopeId);
  const edges = get().edges;
  const nodesMap = get().ydoc.getMap<Node>("pods");
  // 2. construct a D3 tree for the nodes and their connections
  // initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
  const layout = tree<Node>()
    // the node size configures the spacing between the nodes ([width, height])
    .nodeSize([130, 120])
    // .nodeSize((n: Node) => {
    //   return [n.width, n.height]
    // })
    // this is needed for creating equal space between all nodes
    .separation(() => 100);
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(
    nodes
  );

  // run the layout algorithm with the hierarchy data structure
  // 3. call d3's layout function
  const root = layout(hierarchy);
  // 4. retrieve the coordinates and set to the ReactFlow nodes.
  nodes.forEach((node) => {
    const { x, y } = root.find((d) => d.id === node.id) || {
      x: node.position.x,
      y: node.position.y,
    };
    nodesMap.set(node.id, {
      ...node,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      position: { x, y },
      style: { opacity: 1 },
    });
  });
  get().updateView();
}
