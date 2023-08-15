/**
 * See this PR for how the Canvas data is maintained:
 * https://github.com/codepod-io/codepod/pull/205
 */

import { createStore, StateCreator, StoreApi } from "zustand";
import { MyState, Pod } from ".";

import { produce } from "immer";

import { useCallback, useEffect, useState, useContext } from "react";
import { useStore } from "zustand";
import { ApolloClient, useApolloClient, gql } from "@apollo/client";
import { Transaction, YEvent } from "yjs";

import { match, P } from "ts-pattern";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import * as Y from "yjs";

import { myNanoId, level2color } from "../utils";

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
} from "reactflow";
import { node } from "prop-types";
import { quadtree } from "d3-quadtree";
import { getHelperLines, level2fontsize } from "../../components/nodes/utils";
import { json2yxml, yxml2json } from "./y-utils";

// TODO add node's data typing.
export type NodeData = {
  level: number;
  name?: string;
};

const newScopeNodeShapeConfig = {
  width: 600,
  height: 600,
};

export const newNodeShapeConfig = {
  width: 300,
  // NOTE for import ipynb: we need to specify some reasonable height so that
  // the imported pods can be properly laid-out. 130 is a good one.
  // This number is also used in Canvas.tsx (refer to "A BIG HACK" in Canvas.tsx).
  height: 100,
};

/**
 * Creare the temporary nodes as well as the temporary pods based on the given pod.
 * @param pod
 * @param position
 * @param parent
 * @param level
 * @returns
 */
function createTemporaryNode(pod, position, parent?, level = 0): any {
  const id = myNanoId();
  let style = {
    // create a temporary half-transparent pod
    opacity: 0.5,
    width: pod.width,
  };

  if (pod.type === "SCOPE") {
    style["height"] = pod.height!;
    style["backgroundColor"] = level2color[level] || level2color["default"];
  }

  const newNode = {
    id,
    type: pod.type,
    position,
    data: {
      label: id,
      parent,
      level,
    },
    parentNode: parent,
    dragHandle: ".custom-drag-handle",
    width: pod.width,
    height: pod.height!,
    // Note: when the temporary node is finally sticked to the canvas, the click
    // event will trigger drag event/position change of this node once and cause
    // a bug because the node is not ready in the store and DB. just make it
    // undraggable during moving to avoid this bug.
    draggable: false,
    style,
  };

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
function createNewNode(
  type: "SCOPE" | "CODE" | "RICH",
  position
): Node<NodeData> {
  let id = myNanoId();
  const newNode = {
    id,
    type,
    position,
    ...(type === "SCOPE"
      ? {
          width: newScopeNodeShapeConfig.width,
          height: newScopeNodeShapeConfig.height,
          style: {
            backgroundColor: level2color[0],
            width: newScopeNodeShapeConfig.width,
            height: newScopeNodeShapeConfig.height,
          },
        }
      : {
          width: newNodeShapeConfig.width,
          // // Previously, we should not specify height, so that the pod can grow
          // // when content changes. But when we add auto-layout on adding a new
          // // node, unspecified height will cause  the node to be added always at
          // // the top-left corner (the reason is unknown). Thus, we have to
          // // specify the height here. Note that this height is a dummy value;
          // // the content height will still be adjusted based on content height.
          height: newNodeShapeConfig.height,
          // style: {
          //   width: newNodeShapeConfig.width,
          //   // It turns out that this height should not be specified to let the
          //   // height change automatically.
          //   //
          //   // height: 200
          // },
        }),
    data: {
      label: id,
      name: "",
      // FIXME the key "ROOT" is deprecated.
      parent: "ROOT",
      level: 0,
    },
    dragHandle: ".custom-drag-handle",
  };
  return newNode;
}

/**
 * Get the absoluate position of the node.
 */
export function getAbsPos(node: Node, nodesMap: Y.Map<Node>): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  while (node.parentNode) {
    node = nodesMap.get(node.parentNode)!;
    x += node.position.x;
    y += node.position.y;
  }
  return { x, y };
}

function getScopeAt(
  x: number,
  y: number,
  excludes: string[],
  nodes,
  nodesMap
): Node {
  const scope = nodes.findLast((node) => {
    let { x: x1, y: y1 } = getAbsPos(node, nodesMap);
    return (
      node.type === "SCOPE" &&
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
  nodesMap,
  nodeHeight: number = 0
): XYPosition {
  // compute the actual position
  let { x, y } = getAbsPos(node, nodesMap);
  let { x: dx, y: dy } = getAbsPos(scope, nodesMap);
  x -= dx;
  y -= dy;
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

  getNodesMap: () => Y.Map<Node<NodeData>>;
  getEdgesMap: () => Y.Map<Edge>;
  getCodeMap: () => Y.Map<Y.Text>;
  getRichMap: () => Y.Map<Y.XmlFragment>;

  dragHighlight?: string;
  setDragHighlight: (dropHighlight: string) => void;
  removeDragHighlight: () => void;

  selectedPods: Set<string>;
  selectionParent: string | undefined;
  selectPod: (id: string, selected: boolean) => void;
  resetSelection: () => boolean;

  handlePaste(event: ClipboardEvent, position: XYPosition): void;
  handleCopy(event: ClipboardEvent): void;

  focusedEditor: string | undefined;
  setFocusedEditor: (id?: string) => void;

  cursorNode: string | undefined;
  setCursorNode: (id?: string) => void;

  updateView: () => void;

  // onMove indicator
  moved: boolean;
  toggleMoved: () => void;
  // clicked-on-canvas indicator
  paneClicked: boolean;
  togglePaneClicked: () => void;
  nodeClicked: boolean;
  toggleNodeClicked: () => void;

  addNode: (
    type: "CODE" | "SCOPE" | "RICH",
    position: XYPosition,
    parent?: string
  ) => void;

  importLocalCode: (
    position: XYPosition,
    importScopeName: string,
    cellList: any[]
  ) => void;

  adjustLevel: () => void;
  getScopeAtPos: ({ x, y }: XYPosition, exclude: string) => Node | undefined;
  moveIntoScope: (nodeIds: string[], scopeId?: string) => void;

  helperLineHorizontal: number | undefined;
  helperLineVertical: number | undefined;
  setHelperLineHorizontal: (line: number | undefined) => void;
  setHelperLineVertical: (line: number | undefined) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  autoLayout: (scopeId?: string) => void;
  autoLayoutROOT: () => void;
  autoLayoutOnce: boolean;
  setAutoLayoutOnce: (b: boolean) => void;
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
    const nodesMap = get().getNodesMap();
    set(
      produce((state: MyState) => {
        if (selected) {
          const p = nodesMap.get(id)?.parentNode;
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

  focusedEditor: undefined,
  setFocusedEditor: (id?: string) =>
    set(
      produce((state: MyState) => {
        state.focusedEditor = id;
      })
    ),

  cursorNode: undefined,
  setCursorNode: (id?: string) =>
    set(
      produce((state: MyState) => {
        state.cursorNode = id;
      })
    ),
  getNodesMap() {
    return get().ydoc.getMap("rootMap").get("nodesMap") as Y.Map<
      Node<NodeData>
    >;
  },
  getEdgesMap() {
    return get().ydoc.getMap("rootMap").get("edgesMap") as Y.Map<Edge>;
  },
  getCodeMap() {
    return get().ydoc.getMap("rootMap").get("codeMap") as Y.Map<Y.Text>;
  },
  getRichMap() {
    return get().ydoc.getMap("rootMap").get("richMap") as Y.Map<Y.XmlFragment>;
  },
  /**
   * This function handles the real updates to the reactflow nodes to render.
   */
  updateView: () => {
    const nodesMap = get().getNodesMap();
    let selectedPods = get().selectedPods;
    let nodes = Array.from(nodesMap.values());
    nodes = nodes
      .sort((a: Node, b: Node) => a.data.level - b.data.level)
      .map((node) => ({
        ...node,
        style: {
          ...node.style,
          backgroundColor:
            node.type === "SCOPE" ? level2color[node.data.level] : undefined,
        },
        selected: selectedPods.has(node.id),
        // className: get().dragHighlight === node.id ? "active" : "",
        className: match(node.id)
          .with(get().dragHighlight, () => "active")
          .otherwise(() => undefined),
      }));

    set({ nodes });
    // edges view
    const edgesMap = get().getEdgesMap();
    set({ edges: Array.from(edgesMap.values()).filter((e) => e) });
  },

  addNode: (type, position, parent) => {
    let nodesMap = get().getNodesMap();
    let node = createNewNode(type, position);
    nodesMap.set(node.id, node);
    if (parent) {
      // we don't assign its parent when created, because we have to adjust its position to make it inside its parent.
      get().moveIntoScope([node.id], parent);
    }
    // Set initial width as about 30 characters.
    get().updateView();
    // run auto-layout
    if (get().autoRunLayout) {
      get().autoLayoutROOT();
    }
  },

  importLocalCode: (position, importScopeName, cellList) => {
    console.log("Sync imported Jupyter notebook or Python scripts");
    let nodesMap = get().getNodesMap();
    let scopeNode = createNewNode("SCOPE", position);
    // parent could be "ROOT" or a SCOPE node
    let parent = getScopeAt(
      position.x,
      position.y,
      [scopeNode.id],
      get().nodes,
      nodesMap
    );
    let podParent: any = undefined;
    if (parent !== undefined) {
      // update scopeNode
      scopeNode.parentNode = parent.id;
      scopeNode.data.level = parent.data.level + 1;
      podParent = parent.id;
    }

    scopeNode.data.name = importScopeName;
    nodesMap.set(scopeNode.id, scopeNode);

    let maxLineLength = 0;
    if (cellList.length > 0) {
      for (let i = 0; i < cellList.length; i++) {
        const cell = cellList[i];
        let newPos = {
          x: position.x + 50,
          y: position.y + 100 + i * 150,
        };

        let node = createNewNode(
          cell.cellType == "code" ? "CODE" : "RICH",
          newPos
        );
        let podContent = cell.cellType == "code" ? cell.cellSource : "";

        maxLineLength = Math.max(
          maxLineLength,
          Math.max(...podContent.split(/\r?\n/).map((line) => line.length))
        );

        let podRichContent = cell.cellType == "markdown" ? cell.cellSource : "";
        let execution_count = cell.execution_count || null;
        let podResults: {
          type?: string;
          html?: string;
          text?: string;
          image?: string;
        }[] = [];
        let podError = { ename: "", evalue: "", stacktrace: [] };
        for (const cellOutput of cell.cellOutputs) {
          switch (cellOutput["output_type"]) {
            case "stream":
              podResults.push({
                // "stream_stdout" or "stream_stderr"
                type: `${cellOutput["output_type"]}_${cellOutput["name"]}`,
                text: cellOutput["text"].join(""),
              });
              break;
            case "execute_result":
              podResults.push({
                type: cellOutput["output_type"],
                text: cellOutput["data"]["text/plain"].join(""),
              });
              break;
            case "display_data":
              podResults.push({
                type: cellOutput["output_type"],
                text: cellOutput["data"]["text/plain"].join(""),
                image: cellOutput["data"]["image/png"],
              });
              break;
            case "error":
              podError.ename = cellOutput["ename"];
              podError.evalue = cellOutput["evalue"];
              podError.stacktrace = cellOutput["traceback"];
              break;
            default:
              break;
          }
        }
        // move the created node to scope and configure the necessary node attributes
        const posInsideScope = getNodePositionInsideScope(
          node,
          scopeNode,
          nodesMap,
          node.height!
        );
        const fromLevel = node?.data.level;
        const toLevel = scopeNode.data.level + 1;
        const fromFontSize = level2fontsize(
          fromLevel,
          get().contextualZoomParams,
          get().contextualZoom
        );
        const toFontSize = level2fontsize(
          toLevel,
          get().contextualZoomParams,
          get().contextualZoom
        );
        const newWidth = node.width! * (toFontSize / fromFontSize);

        node.width = newWidth;
        node.data.level = toLevel;
        node.position = posInsideScope;
        node.parentNode = scopeNode.id;

        // update peer
        nodesMap.set(node.id, node);
      }
    }
    get().adjustLevel();
    // FIXME updateView() reset the pod width to 300, scope width to 400.
    get().updateView();
  },
  autoLayoutOnce: false,
  setAutoLayoutOnce: (b) => set({ autoLayoutOnce: b }),

  handleCopy(event) {
    // TODO get selected nodes recursively
    const nodesMap = get().getNodesMap();
    const nodes = Array.from(get().selectedPods).map((id) => nodesMap.get(id)!);
    if (nodes.length === 0) return;
    const codeMap = get().getCodeMap();
    const richMap = get().getRichMap();
    const contentMap: Record<string, string> = {};
    nodes.forEach((node) => {
      switch (node.type) {
        case "CODE":
          contentMap[node.id] = codeMap.get(node.id)!.toString();
          break;
        case "RICH":
          contentMap[node.id] = JSON.stringify(
            yxml2json(richMap.get(node.id)!)
          );
          break;
      }
    });
    // TODO get edges
    // set to clipboard
    // console.log("set clipboard", nodes[0]);
    event.clipboardData!.setData(
      "application/json",
      JSON.stringify({
        type: "pod",
        nodes: nodes,
        contentMap: contentMap,
      })
    );
    event.preventDefault();
  },
  handlePaste(event, position) {
    // 2. get clipboard data
    if (!event.clipboardData) return;
    const payload = event.clipboardData.getData("application/json");
    if (!payload) {
      console.warn("No payload");
      return;
    }
    const data = JSON.parse(payload);
    if (data.type !== "pod") return;
    const oldnodes = data.nodes as Node[];
    const contentMap = data.contentMap as Record<string, string>;

    const minX = Math.min(...oldnodes.map((s) => s.position.x));
    const minY = Math.min(...oldnodes.map((s) => s.position.y));

    // 3. construct new nodes
    const nodesMap = get().getNodesMap();
    const codeMap = get().getCodeMap();
    const richMap = get().getRichMap();

    const newnodes = oldnodes.map((n) => {
      const id = myNanoId();
      switch (n.type) {
        case "CODE":
          const ytext = new Y.Text(contentMap[n.id]);
          codeMap.set(id, ytext);
          break;
        case "RICH":
          // const yxml = richMap.get(n.id)!.clone();
          const yxml = json2yxml(JSON.parse(contentMap[n.id]));
          richMap.set(id, yxml);
          break;
        default:
          break;
      }

      const newNode = {
        ...n,
        id,
        position: {
          x: n.position.x - minX + position.x,
          y: n.position.y - minY + position.y,
        },
      };
      return newNode;
    });
    get().resetSelection();
    newnodes.forEach((n) => {
      nodesMap.set(n.id, n);
      get().selectPod(n.id, true);
    });
    get().updateView();
  },

  // NOTE: this does not mutate.
  getScopeAtPos: ({ x, y }, exclude) => {
    const nodesMap = get().getNodesMap();
    return getScopeAt(x, y, [exclude], get().nodes, nodesMap);
  },

  adjustLevel: () => {
    // adjust the levels of all nodes, using topoSort
    let nodesMap = get().getNodesMap();
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
  moveIntoScope: (nodeIds: string[], scopeId?: string) => {
    // move a node into a scope.
    // 1. update the node's parentNode & position
    let nodesMap = get().getNodesMap();
    for (const nodeId of nodeIds) {
      let node = nodesMap.get(nodeId);
      if (!node) {
        console.warn("Node not found", node);
        return;
      }
      if (node.parentNode === scopeId) {
        console.warn("Node already in scope", node);
        return;
      }
      console.log(`Moving ${nodeId} into scope ${scopeId}`);
      let fromLevel = node?.data.level;
      let toLevel: number;
      let position: XYPosition;
      if (!scopeId) {
        toLevel = 0;
        position = getAbsPos(node, nodesMap);
      } else {
        let scope = nodesMap.get(scopeId);
        if (!node || !scope) {
          console.warn("Scope not found", scope);
          return;
        }
        toLevel = scope.data.level + 1;
        // FIXME: since richNode and codeNode doesn't have height when it's created, we have to pass its height manually in case crash.
        const nodeHeight = nodesMap.get(nodeId)?.height || 0;
        position = getNodePositionInsideScope(
          node,
          scope,
          nodesMap,
          nodeHeight
        );
      }
      // need to adjust the node width according to the from and to scopes
      const fromFontSize = level2fontsize(
        fromLevel,
        get().contextualZoomParams,
        get().contextualZoom
      );
      const toFontSize = level2fontsize(
        toLevel,
        get().contextualZoomParams,
        get().contextualZoom
      );
      const newWidth = node.width! * (toFontSize / fromFontSize);
      // create the new node
      let newNode: Node = {
        ...node,
        position,
        parentNode: scopeId,
        width: newWidth,
        data: {
          ...node.data,
          level: toLevel,
        },
      };
      // update peer
      nodesMap.set(node.id, newNode);
    }
    get().adjustLevel();
    // update view
    get().updateView();
  },

  helperLineHorizontal: undefined,
  helperLineVertical: undefined,
  setHelperLineHorizontal: (line) => set({ helperLineHorizontal: line }),
  setHelperLineVertical: (line) => set({ helperLineVertical: line }),

  // I should modify nodesMap here
  onNodesChange: (changes: NodeChange[]) => {
    let nodesMap = get().getNodesMap();
    const nodes = get().nodes;

    // compute the helper lines
    get().setHelperLineHorizontal(undefined);
    get().setHelperLineVertical(undefined);

    // this will be true if it's a single node being dragged
    // inside we calculate the helper lines and snap position for the position where the node is being moved to
    if (
      changes.length === 1 &&
      changes[0].type === "position" &&
      changes[0].dragging &&
      changes[0].position
    ) {
      // For hierarchical pods, we only get helper lines within the same scope.
      const change = changes[0];
      const movingNode = nodesMap.get(change.id)!;

      // distance is the sensitivity for snapping to helper lines.
      const distance = 10;
      const helperLines = getHelperLines(
        changes[0],
        nodes.filter((n) => n.parentNode === movingNode.parentNode),
        distance
      );

      // adjust the position into absolute position
      if (movingNode.parentNode) {
        const parent = nodesMap.get(movingNode.parentNode)!;
        // const offset = parent?.positionAbsolute;
        // const offset = parent?.position;
        const offset = getAbsPos(parent, nodesMap);
        helperLines.vertical && (helperLines.vertical += offset?.x || 0);
        helperLines.horizontal && (helperLines.horizontal += offset?.y || 0);
      }

      // if we have a helper line, we snap the node to the helper line position
      // this is being done by manipulating the node position inside the change object
      changes[0].position.x =
        helperLines.snapPosition.x ?? changes[0].position.x;
      changes[0].position.y =
        helperLines.snapPosition.y ?? changes[0].position.y;

      // if helper lines are returned, we set them so that they can be displayed
      get().setHelperLineHorizontal(helperLines.horizontal);
      get().setHelperLineVertical(helperLines.vertical);
    }

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
          if (change.selected) {
            get().setCursorNode(change.id);
          }
          break;
        case "dimensions":
          {
            // Since CodeNode doesn't have a height, this dimension change will
            // be filed for CodeNode at the beginning or anytime the node height
            // is changed due to content height changes.
            const node = nextNodes.find((n) => n.id === change.id);
            if (!node) throw new Error("Node not found");
            nodesMap.set(change.id, node);
          }
          break;
        case "position":
          {
            const node = nextNodes.find((n) => n.id === change.id);
            if (!node) throw new Error("Node not found");
            nodesMap.set(change.id, node);
          }

          break;
        case "remove":
          // FIXME Would reactflow fire multiple remove for all nodes? If so,
          // do they have a proper order? Seems yes.
          // remove from yjs
          //
          // TODO remove from codeMap and richMap?
          nodesMap.delete(change.id);
          // remove from selected pods
          get().selectPod(change.id, false);
          // run auto-layout
          if (get().autoRunLayout) {
            get().autoLayoutROOT();
          }
          break;
        default:
          // should not reach here.
          throw new Error("Unknown change type");
      }
    });
    get().updateView();
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    // TODO sync with remote peer
    const edgesMap = get().getEdgesMap();
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
  onConnect: (connection: Connection) => {
    const edgesMap = get().getEdgesMap();
    if (!connection.source || !connection.target) return null;
    const edge = {
      // TODO This ID doesn't support multiple types of edges between the same nodes.
      id: `${connection.source}_${connection.target}`,
      source: connection.source,
      sourceHandle: "top",
      target: connection.target,
      targetHandle: "top",
    };
    edgesMap.set(edge.id, edge);
    get().updateView();
  },

  moved: false,
  toggleMoved: () => set({ moved: !get().moved }),
  paneClicked: false,
  togglePaneClicked: () => set({ paneClicked: !get().paneClicked }),
  nodeClicked: false,
  toggleNodeClicked: () => set({ nodeClicked: !get().nodeClicked }),

  autoLayoutROOT: () => {
    // get all scopes,
    console.debug("autoLayoutROOT");
    let nodesMap = get().getNodesMap();
    let nodes: Node[] = Array.from(nodesMap.values());
    nodes
      // sort the children so that the inner scope gets processed first.
      .sort((a: Node, b: Node) => b.data.level - a.data.level)
      .forEach((node) => {
        if (node.type === "SCOPE") {
          get().autoLayout(node.id);
        }
      });
    // Applying on ROOT scope is not ideal.
    get().autoLayout();
  },
  /**
   * Use d3-force to auto layout the nodes.
   */
  autoLayout: (scopeId) => {
    // 1. get all the nodes and edges in the scope
    let nodesMap = get().getNodesMap();
    const nodes = get().nodes.filter((node) => node.parentNode === scopeId);
    if (nodes.length == 0) return;
    const edges = get().edges;
    // consider the output box
    const id2height = new Map<string, number>();
    const id2width = new Map<string, number>();
    // Leave some room for the top toolbar.
    // FIXME fixed value.
    const paddingTopPod = 50;
    nodes.forEach((node) => {
      const bottom = document.querySelector(`#result-${node.id}-bottom`);
      const right = document.querySelector("#result-" + node.id + "-right");
      const boxheight = bottom?.clientHeight || 0;
      const boxwidth = right?.clientWidth || 0;
      // FIXME a scope's height is NaN
      id2height.set(node.id, (node.height || 0) + boxheight);
      id2width.set(node.id, (node.width || 0) + boxwidth);
      // id2height.set(node.id, node.height!);
    });
    // Save initial minimum offset of the nodes.
    let initOffX = Math.min(...nodes.map((node) => node.position.x));
    let initOffY = Math.min(...nodes.map((node) => node.position.y));

    const tmpNodes: NodeType[] = nodes.map((node) => ({
      id: node.id,
      x: node.position.x + id2width.get(node.id)! / 2,
      y: node.position.y + id2height.get(node.id)! / 2,
      width: id2width.get(node.id)!,
      height: id2height.get(node.id)! + paddingTopPod,
    }));
    const tmpEdges = edges.map((edge) => ({
      source: edge.source,
      source0: 0,
      target: edge.target,
      target0: 1,
    }));
    // 2. construct a D3 tree for the nodes and their connections
    // initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
    // const hierarchy = stratify<Node>()
    //   .id((d) => d.id)
    //   // get the id of each node by searching through the edges
    //   // this only works if every node has one connection
    //   .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(
    //   nodes
    // );
    const simulation = forceSimulation<NodeType>(tmpNodes)
      // .force(
      //   "link",
      //   forceLink(tmpEdges)
      //     .id((d: any) => d.id)
      //     .distance(20)
      //     .strength(0.5)
      // )
      // .force("charge", forceManyBody().strength(-1000))
      // .force("x", forceX())
      // .force("y", forceY())
      .force("collide", forceCollideRect())
      // .force("link", d3.forceLink(edges).id(d => d.id))
      // .force("charge", d3.forceManyBody())
      // .force("center", forceCenter(0, 0))
      .stop();
    simulation.tick(10);
    tmpNodes.forEach((node) => {
      node.x -= id2width.get(node.id)! / 2;
      node.y -= id2height.get(node.id)! / 2;
    });

    if (!scopeId) {
      // reset the node positions
      tmpNodes.forEach(({ id, x, y }) => {
        // FIXME I should assert here.
        if (nodesMap.has(id)) {
          nodesMap.set(id, {
            ...nodesMap.get(id)!,
            position: { x, y },
          });
        }
      });
    } else {
      // The nodes will all have new positions now. I'll need to make the graph to be top-left, i.e., the leftmost is 20, the topmost is 20.
      // get the min x and y
      let x1s = tmpNodes.map((node) => node.x);
      let minx = Math.min(...x1s);
      let y1s = tmpNodes.map((node) => node.y);
      let miny = Math.min(...y1s);
      // calculate the offset, leave 50 padding for the scope.
      // Leave some room at the top of the scope for inner pod toolbars.
      const paddingTop = 70;
      const paddingBottom = 50;
      const paddingLeft = 50;
      const paddingRight = 50;
      const offsetx = paddingLeft - minx;
      const offsety = paddingTop - miny;
      // move the nodes
      tmpNodes.forEach((node) => {
        node.x += offsetx;
        node.y += offsety;
      });
      // Apply the new positions
      // TODO need to transform the nodes to the center of the scope.
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
      // update the scope's size to enclose all the nodes
      x1s = tmpNodes.map((node) => node.x);
      minx = Math.min(...x1s);
      y1s = tmpNodes.map((node) => node.y);
      miny = Math.min(...y1s);
      const x2s = tmpNodes.map((node) => node.x + id2width.get(node.id)!);
      const maxx = Math.max(...x2s);
      const y2s = tmpNodes.map((node) => node.y + id2height.get(node.id)!);
      const maxy = Math.max(...y2s);
      const scope = nodesMap.get(scopeId)!;
      nodesMap.set(scopeId, {
        ...scope,
        position: {
          x: scope.position.x + initOffX - paddingLeft,
          y: scope.position.y + initOffY - paddingTop,
        },
        width: maxx - minx + paddingLeft + paddingRight,
        height: maxy - miny + paddingTop + paddingBottom,
        style: {
          ...scope!.style,
          width: maxx - minx + paddingLeft + paddingRight,
          height: maxy - miny + paddingTop + paddingBottom,
        },
      });
    }

    get().updateView();
  },
});

type NodeType = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function forceCollideRect() {
  let nodes;

  function force(alpha) {
    const padding = 5;
    const quad = quadtree(
      nodes,
      (d: NodeType) => d.x,
      (d) => d.y
    );
    for (const d of nodes) {
      quad.visit((q: any, x1, y1, x2, y2) => {
        let updated = false;
        if (q.data && q.data !== d) {
          let x = d.x - q.data.x,
            y = d.y - q.data.y,
            xSpacing = padding + (q.data.width + d.width) / 2,
            ySpacing = padding + (q.data.height + d.height) / 2,
            absX = Math.abs(x),
            absY = Math.abs(y),
            l,
            lx,
            ly;

          if (absX < xSpacing && absY < ySpacing) {
            l = Math.sqrt(x * x + y * y);

            lx = (absX - xSpacing) / l;
            ly = (absY - ySpacing) / l;

            // the one that's barely within the bounds probably triggered the collision
            if (Math.abs(lx) > Math.abs(ly)) {
              lx = 0;
            } else {
              ly = 0;
            }
            d.x -= x *= lx;
            d.y -= y *= ly;
            q.data.x += x;
            q.data.y += y;

            updated = true;
          }
        }
        return updated;
      });
    }
  }

  force.initialize = (_) => (nodes = _);

  return force;
}
