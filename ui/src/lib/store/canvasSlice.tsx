import { createStore, StateCreator, StoreApi } from "zustand";
import { MyState, Pod } from ".";

import { produce } from "immer";

import { useCallback, useEffect, useState, useContext } from "react";
import { useStore } from "zustand";
import { ApolloClient, useApolloClient } from "@apollo/client";
import { Transaction, YEvent } from "yjs";

import { match, P } from "ts-pattern";

import { myNanoId, nodetype2dbtype } from "../utils";

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
} from "reactflow";

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
 * The temporary reactflow nodes for paste/cut.
 * @param pod
 * @param position
 * @returns
 */
function createTemporaryNode(pod, position) {
  const id = myNanoId();
  const newNode = {
    id,
    type: "code",
    position,
    data: {
      label: id,
      parent: "ROOT",
      level: 0,
    },
    dragHandle: ".custom-drag-handle",
    width: pod.width,
    style: {
      // create a temporary half-transparent pod
      opacity: 0.5,
      width: pod.width,
    },
  };
  return newNode;
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

  addNode: (type: "code" | "scope" | "rich", position: XYPosition) => void;

  pastingNode?: Node;
  isPasting: boolean;
  pasteBegin: (position: XYPosition, pod: Pod) => void;
  pasteEnd: () => void;
  cancelPaste: () => void;
  onPasteMove: (mousePos: XYPosition) => void;

  cuttingId?: string;
  isCutting: boolean;
  cuttingNode?: Node;
  cutBegin: (id: string) => void;
  cutEnd: () => void;
  onCutMove: (mousePos: XYPosition) => void;
  cancelCut: () => void;

  adjustLevel: () => void;
  getScopeAtPos: ({ x, y }: XYPosition, exclude: string) => Node | undefined;
  moveIntoScope: (nodeId: string, scopeId: string) => void;
  moveIntoRoot: (nodeId: string) => void;

  onNodesChange: (client: ApolloClient<any>) => OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export const createCanvasSlice: StateCreator<MyState, [], [], CanvasSlice> = (
  set,
  get
) => ({
  nodes: [],
  edges: [],

  setDragHighlight: (dragHighlight) => set({ dragHighlight }),
  removeDragHighlight: () => set({ dragHighlight: undefined }),

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
    // 2. those from cuttingNode, pastingNode, which are temporary nodes
    nodes = nodes.concat(get().cuttingNode || [], get().pastingNode || []);
    set({ nodes });
  },

  addNode: (type, mousePos) => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let node = createNewNode(type, mousePos);
    nodesMap.set(node.id, node);
    get().addPod({
      id: node.id,
      children: [],
      parent: "ROOT",
      type: nodetype2dbtype(node.type || ""),
      lang: "python",
      x: node.position.x,
      y: node.position.y,
      width: node.width!,
      height: node.height!,
      // For my local update, set dirty to true to push to DB.
      dirty: true,
    });
    get().updateView();
  },

  isPasting: false,
  isCutting: false,

  pasteBegin: (position, pod) => {
    // 1. create a temporary node to move with cursor
    // 2. set pastingId to the random node's ID, so that we can move it around.
    let pastingNode = createTemporaryNode(pod, position);
    // TODO need to add this to zustand store.pods, otherwise the CodeNode won't be rendered.
    // FIXME don't forget to remove this node from store.pods when is cancelled
    get().addPod({
      id: pastingNode.id,
      children: [],
      parent: "ROOT",
      lang: "python",
      type: nodetype2dbtype(pastingNode.type),
      x: position.x,
      y: position.y,
      error: pod.error,
      stdout: pod.stdout,
      result: pod.result,
      name: pod.name,
      content: pod.content,
      dirty: false,
    });
    set({ pastingNode, isPasting: true });
    // make the pane unreachable by keyboard (escape), or a black border shows
    // up in the pane when pasting is canceled.
    const pane = document.getElementsByClassName("react-flow__pane")[0];
    if (pane && pane.hasAttribute("tabindex")) {
      pane.removeAttribute("tabindex");
    }
  },
  onPasteMove: (mousePos) => {
    let pastingNode = get().pastingNode;
    if (!pastingNode) return;
    set({ pastingNode: { ...pastingNode, position: mousePos } });
    get().updateView();
  },
  pasteEnd: () => {
    // on drop, make this node into nodesMap. The nodesMap.observer will updateView.
    let pastingNode = get().pastingNode;
    if (!pastingNode) return;
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let position = pastingNode.position;

    nodesMap.set(pastingNode.id, {
      ...pastingNode,
      style: { ...pastingNode.style, opacity: 1 },
    });
    // update zustand and db
    set(
      produce((state) => {
        let pod = state.pods[pastingNode!.id];
        pod.x = position.x;
        pod.y = position.y;
        pod.dirty = true;
        state.pastingNode = undefined;
        state.isPasting = false;
      })
    );
    // update view
    get().updateView();
    let scope = getScopeAt(
      position.x,
      position.y,
      [pastingNode.id],
      get().nodes,
      nodesMap
    );
    if (scope && scope.id !== pastingNode.parentNode) {
      get().moveIntoScope(pastingNode.id, scope.id);
    }
  },
  cancelPaste: () => {
    let pastingNode = get().pastingNode;
    if (!pastingNode) return;
    set(
      produce((state) => {
        // Remove pastingNode from store.
        delete state.pods[pastingNode!.id];
        // Clear pasting data and update view.
        state.pastingNode = undefined;
        state.isPasting = false;
      })
    );
    get().updateView();
  },

  //   checkDropIntoScope: (event, nodes: Node[], project: XYPosition=>XYPosition) => {},
  // cut will:
  // 1. hide the original node
  // 2. create a dummy node that move with cursor
  cutBegin: (id) => {
    let pod = get().pods[id];
    let cuttingNode = createTemporaryNode(pod, { x: pod.x, y: pod.y });
    get().addPod({
      id: cuttingNode.id,
      children: [],
      parent: "ROOT",
      lang: "python",
      type: nodetype2dbtype(cuttingNode.type),
      x: pod.x,
      y: pod.y,
      error: pod.error,
      stdout: pod.stdout,
      result: pod.result,
      name: pod.name,
      content: pod.content,
      dirty: false,
    });
    set({ cuttingId: id, cuttingNode, isCutting: true });
    get().updateView();
    // FIXME not working for cancelCut
    // make the pane unreachable by keyboard (escape), or a black border shows
    // up in the pane when pasting is canceled.
    const pane = document.getElementsByClassName("react-flow__pane")[0];
    if (pane && pane.hasAttribute("tabindex")) {
      pane.removeAttribute("tabindex");
    }
  },
  onCutMove: (mousePos) => {
    let cuttingNode = get().cuttingNode;
    if (!cuttingNode) return;
    set({ cuttingNode: { ...cuttingNode, position: mousePos } });
    get().updateView();
  },
  // 3. on drop, set the original node to the new position
  cutEnd: () => {
    let cuttingNode = get().cuttingNode;
    let cuttingId = get().cuttingId;
    if (!cuttingNode || !cuttingId) return;
    // Set the original node to the new position.
    // Update peers.
    let nodesMap = get().ydoc.getMap<Node>("pods");
    let node = nodesMap.get(cuttingId)!;
    let position = cuttingNode.position;
    nodesMap.set(cuttingId, {
      ...node,
      position,
      style: { ...node.style, opacity: 1 },
    });
    set(
      produce((state) => {
        // Remove the cuttingNode from the store.
        delete state.pods[cuttingNode!.id];
        // We need to remove parent's children field as well.
        //
        // TODO refactor this: the children field updates are in different
        // spaces (deletePod, setPodGeo, here), hard to maintain. The children
        // seems to be used only in runtime gather symbol table.
        let parent = state.pods[cuttingNode!.parentNode ?? "ROOT"];
        if (parent) {
          const index = parent.children
            .map(({ id }) => id)
            .indexOf(cuttingNode!.id);
          parent.children.splice(index, 1);
        }
        // Sync the original node to the DB.
        let orig = state.pods[cuttingId!];
        orig.x = position.x;
        orig.y = position.y;
        orig.dirty = true;
      })
    );
    // Clear cutting data and update view.
    set({ cuttingId: undefined, cuttingNode: undefined, isCutting: false });
    get().updateView();
    let scope = getScopeAt(
      position.x,
      position.y,
      [cuttingId],
      get().nodes,
      nodesMap
    );
    if (scope) {
      if (scope.id !== cuttingNode.parentNode) {
        get().moveIntoScope(cuttingId, scope.id);
      }
    } else {
      // move out of scope
      get().moveIntoRoot(cuttingId);
    }
  },
  cancelCut: () => {
    // Clear cutting data and update view.
    let cuttingNode = get().cuttingNode;
    if (!cuttingNode) return;
    set(
      produce((state) => {
        // Remove the cuttingNode from the store.
        delete state.pods[cuttingNode!.id];
        // Clear cutting data.
        state.cuttingNode = undefined;
        state.cuttingId = undefined;
        state.isCutting = false;
      })
    );
    get().updateView();
  },

  // NOTE: this does not mutate.
  getScopeAtPos: ({ x, y }, exclude) => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
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

  // I should modify nodesMap here
  onNodesChange: (client) => (changes: NodeChange[]) => {
    let nodesMap = get().ydoc.getMap<Node>("pods");
    const nodes = get().nodes;

    // I think this place update the node's width/height
    const nextNodes = applyNodeChanges(changes, nodes);

    changes.forEach((change) => {
      // console.log("onNodesChange", change.type);
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
              [get().cuttingNode?.id, get().pastingNode?.id].includes(change.id)
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
                  if (state.cuttingNode?.id === change.id) {
                    state.cuttingNode = node;
                  } else {
                    state.pastingNode = node;
                  }
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
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "black",
          },
          style: {
            stroke: "black",
            strokeWidth: 3,
          },
        },
        get().edges
      ),
    });
  },
});
