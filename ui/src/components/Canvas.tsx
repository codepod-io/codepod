import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import Box from "@mui/material/Box";

import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext } from "../lib/store";
import { dbtype2nodetype, nodetype2dbtype } from "../lib/utils";
import {
  useNodesStateSynced,
  resetSelection,
  parent as commonParent,
} from "../lib/nodes";

import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import { YMap } from "yjs/dist/src/types/YMap";

const nanoid = customAlphabet(lowercase + numbers, 20);

const nodeTypes = { scope: ScopeNode, code: CodeNode, rich: RichNode };

const level2color = {
  0: "rgba(187, 222, 251, 0.5)",
  1: "rgba(144, 202, 249, 0.5)",
  2: "rgba(100, 181, 246, 0.5)",
  3: "rgba(66, 165, 245, 0.5)",
  4: "rgba(33, 150, 243, 0.5)",
  // default: "rgba(255, 255, 255, 0.2)",
  default: "rgba(240,240,240,0.25)",
};

function getAbsPos({ node, nodesMap }) {
  let x = node.position.x;
  let y = node.position.y;
  if (node.parentNode) {
    // FIXME performance.
    let [dx, dy] = getAbsPos({
      node: nodesMap.get(node.parentNode),
      nodesMap,
    });
    return [x + dx, y + dy];
  } else {
    return [x, y];
  }
}

/**
 * This hook will load nodes from zustand store into Yjs nodesMap using setNodes.
 * @returns None
 */
function store2nodes(id: string, level: number, { getId2children, getPod }) {
  let res: any[] = [];
  let children = getId2children(id) || [];
  const pod = getPod(id);
  if (id !== "ROOT") {
    res.push({
      id: id,
      type: dbtype2nodetype(pod.type),
      data: {
        // label: `ID: ${id}, parent: ${pods[id].parent}, pos: ${pods[id].x}, ${pods[id].y}`,
        label: id,
        name: pod.name,
        parent: pod.parent,
        level,
      },
      // position: { x: 100, y: 100 },
      position: { x: pod.x, y: pod.y },
      parentNode: pod.parent !== "ROOT" ? pod.parent : undefined,
      extent: "parent",
      style: {
        backgroundColor:
          pod.type !== "DECK"
            ? undefined
            : level2color[level] || level2color["default"],
      },
      width: pod.width || undefined,
      // for code node, don't set height, let it be auto
      height: pod.height || undefined,
      dragHandle: ".custom-drag-handle",
    });
  }
  for (const child of children) {
    res = res.concat(store2nodes(child, level + 1, { getId2children, getPod }));
  }
  return res;
}

/**
 * Copy and paste utility functions.
 * @param reactFlowWrapper
 * @returns
 */
function useCopyPaste(reactFlowWrapper) {
  const [pasting, setPasting] = useState<null | string>(null);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");

  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const isGuest = useStore(store, (state) => state.isGuest());

  const reactFlowInstance = useReactFlow();

  const cutting = useStore(store, (state) => state.cutting);
  const setCutting = useStore(store, (state) => state.setCutting);
  const addPod = useStore(store, (state) => state.addPod);
  const apolloClient = useApolloClient();
  const clientId = useStore(
    store,
    (state) => state.provider?.awareness?.clientID
  );
  const { checkNodesEndLocation } = useNodeLocation(reactFlowWrapper);

  const cancelPaste = useCallback(() => {
    if (!pasting) return;
    nodesMap.delete(pasting);
    setPasting(null);
    if (cutting) {
      // recover the hideen original node
      const node = nodesMap.get(cutting);
      if (node?.data?.hidden) {
        delete node.data.hidden;
        nodesMap.set(cutting, node);
      }
      setCutting(null);
    }
  }, [cutting, nodesMap, pasting, setCutting]);

  useEffect(() => {
    if (!pasting || !reactFlowWrapper.current) {
      return;
    }

    const mouseMove = (event) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      const node = nodesMap.get(pasting);
      if (!node) return;
      node.position = position;
      nodesMap.set(pasting, node);
    };
    const mouseClick = (event) => {
      const node = nodesMap.get(pasting);
      if (!node) return;
      const newNode = {
        ...node,
        width: node.width,
        height: node.height,
        // width must be set here otherwise a guest will see its width keeps increasing
        style: { ...node.style, opacity: 1, width: node.width! },
        data: {
          level: 0,
          name: node.data?.name,
          label: node.data?.label,
          parent: node.data?.parent,
        },
      };

      // update the new-added node's position since position in store.pod doesn't update during pasting
      const pod = { ...getPod(pasting), ...node.position };
      // delete the temporary node
      nodesMap.delete(pasting);
      // add the formal pod in place under root
      addPod(apolloClient, pod);
      nodesMap.set(pasting, newNode);

      // check if the formal node is located in a scope, if it is, change its parent
      const currentNode = reactFlowInstance.getNode(pasting);
      if (currentNode) {
        checkNodesEndLocation(event, [currentNode], "ROOT");
      }
      //clear the pasting state
      setPasting(null);
      // delete the original (hidden) node
      if (cutting) {
        nodesMap.delete(cutting);
        setCutting(null);
      }
    };
    const keyDown = (event) => {
      if (event.key !== "Escape") return;
      // delete the temporary node
      cancelPaste();
      //clear the pasting state
      event.preventDefault();
    };
    reactFlowWrapper.current.addEventListener("mousemove", mouseMove);
    reactFlowWrapper.current.addEventListener("click", mouseClick);
    document.addEventListener("keydown", keyDown);
    return () => {
      if (reactFlowWrapper.current) {
        reactFlowWrapper.current.removeEventListener("mousemove", mouseMove);
        reactFlowWrapper.current.removeEventListener("click", mouseClick);
      }
      document.removeEventListener("keydown", keyDown);
      // FIXME(XINYI): auto focus on pane after finishing pasting should be set
      // here, however, Escape triggers the tab selection on the element with
      // tabindex=0, shows a black border on the pane. So I disable it.
    };
  }, [
    addPod,
    apolloClient,
    cancelPaste,
    checkNodesEndLocation,
    cutting,
    getPod,
    nodesMap,
    pasting,
    reactFlowInstance,
    reactFlowWrapper,
    setCutting,
  ]);

  const createTemprorayNode = useCallback(
    (pod, position) => {
      const id = nanoid();
      const newNode = {
        id,
        type: "code",
        position,
        data: {
          name: pod?.name || "",
          label: id,
          parent: "ROOT",
          clientId,
          // the temporary pod should always be in the most front, set the level to a large number
          level: 114514,
        },
        extent: "parent" as "parent",
        parentNode: undefined,
        dragHandle: ".custom-drag-handle",
        width: pod.width,
        style: {
          // create a temporary half-transparent pod
          opacity: 0.5,
        },
      };

      // create an informal (temporary) pod in local, without remote addPod
      addPod(null, {
        id,
        parent: "ROOT",
        type: "CODE",
        children: [],
        lang: "python",
        x: position.x,
        y: position.y,
        width: pod.width,
        height: pod.height,
        content: pod.content,
        error: pod.error,
        stdout: pod.stdout,
        result: pod.result,
        name: pod.name,
      });

      nodesMap.set(id, newNode);
      setPasting(id);

      // make the pane unreachable by keyboard (escape), or a black border shows
      // up in the pane when pasting is canceled.
      const pane = document.getElementsByClassName("react-flow__pane")[0];
      if (pane && pane.hasAttribute("tabindex")) {
        pane.removeAttribute("tabindex");
      }
    },
    [addPod, clientId, nodesMap, setPasting]
  );

  const pasteCodePod = useCallback(
    (pod) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let [posX, posY] = [
        reactFlowBounds.width / 2,
        reactFlowBounds.height / 2,
      ];

      const position = reactFlowInstance.project({ x: posX, y: posY });
      position.x = (position.x - pod.width! / 2) as number;
      position.y = (position.y - (pod.height ?? 0) / 2) as number;

      createTemprorayNode(pod, position);
    },
    [createTemprorayNode, reactFlowInstance, reactFlowWrapper]
  );

  useEffect(() => {
    if (cutting) {
      // when a pod is being cut, generate a new temporary node and hide the
      // original node
      const node = nodesMap.get(cutting);
      if (!node) return;
      const position = node.positionAbsolute ?? node.position;
      createTemprorayNode(getPod(cutting), position);
      node.data.hidden = clientId;
      nodesMap.set(cutting, node);
    }
  }, [clientId, createTemprorayNode, cutting, getPod, nodesMap]);

  const handlePaste = useCallback(
    (event) => {
      // avoid duplicated pastes
      if (pasting || isGuest) return;

      // only paste when the pane is focused
      if (
        event.target?.className !== "react-flow__pane" &&
        document.activeElement?.className !== "react-flow__pane"
      )
        return;

      try {
        // the user clipboard data is unpreditable, may have application/json
        // from other source that can't be parsed by us, use try-catch here.
        const playload = event.clipboardData.getData("application/json");
        const data = JSON.parse(playload);
        if (data?.type !== "pod") {
          return;
        }
        // clear the selection, make the temporary front-most
        resetSelection();
        pasteCodePod(data.data);
      } catch (e) {
        console.log("paste error", e);
      }
    },
    [pasteCodePod, pasting, isGuest, resetSelection]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);
}

/**
 * Helper functions to manipulate node locations.
 * @returns {checkNodesEndLocation}
 */
const useNodeLocation = (reactFlowWrapper) => {
  const store = useContext(RepoContext)!;
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const nodes = useReactFlow().getNodes();
  const reactFlowInstance = useReactFlow();
  const getPod = useStore(store, (state) => state.getPod);

  /**
   * Check bounding boxes of all scopes.
   */
  const getScopeAt = useCallback(
    (x: number, y: number, ids: string[]) => {
      const scope = nodes.reverse().find((node) => {
        let [x1, y1] = getAbsPos({ node, nodesMap });
        return (
          node.type === "scope" &&
          x >= x1 &&
          !ids.includes(node.id) &&
          x <= x1 + node.width &&
          y >= y1 &&
          y <= y1 + node.height
        );
      });
      return scope;
    },
    [nodes, nodesMap]
  );

  /**
   * @param {string} node The node to be moved.
   * @param {string} event The event that triggered the move.
   *
   * This function is called when a node is moved. It will do two things:
   * 1. Update the position of the node in the redux store.
   * 2. Check if the node is moved into a scope. If so, update the parent of the node.
   */
  const checkNodesEndLocation = useCallback(
    (event, nodes: Node[], commonParent: string | undefined) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      // This mouse position is absolute within the canvas.
      const mousePos = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const scope = getScopeAt(
        mousePos.x,
        mousePos.y,
        nodes.map((n) => n.id)
      );

      // FIXME: a better way to do this: check if the commonParent is the ancestor of the scope
      if (commonParent !== undefined && commonParent !== "ROOT") {
        const currentParent = nodesMap.get(commonParent);
        if (currentParent) {
          console.log("currentParent", currentParent);
          if (
            mousePos.x < currentParent.positionAbsolute!.x ||
            mousePos.x >
              currentParent.positionAbsolute!.x + currentParent.width! ||
            mousePos.y < currentParent.positionAbsolute!.y ||
            mousePos.y >
              currentParent.positionAbsolute!.y + currentParent.height!
          ) {
            // the mouse is outside the current parent, the nodes can't be dragged out
            // console.log("Cannot drop outside parent scope");
            // but position should also be updated
            return;
          }
        }
      }

      // no target scope, or the target scope is the same as the current parent
      if (!scope || scope.id === commonParent) {
        // only update position and exit, avoid updating parentNode
        return;
      }

      // update the level of a node as well as its all descendants
      function updateLevel(id: string, level: number) {
        const node = nodesMap.get(id);
        if (node) {
          node.data.level = level;
          node.style!.backgroundColor = level2color[level];
          nodesMap.set(id, node);
          getPod(id)?.children.forEach(({ id }) => updateLevel(id, level + 1));
        }
      }

      // check if this position is inside parent scope
      nodes.forEach((node) => {
        let absX = node.position.x;
        let absY = node.position.y;

        console.log("dropped into scope:", scope);
        // compute the actual position
        let [dx, dy] = getAbsPos({ node: scope, nodesMap });
        absX = node.positionAbsolute!.x - dx;
        absY = node.positionAbsolute!.y - dy;
        // auto-align the node to, keep it bound in the scope
        // FIXME: it assumes the scope must be larger than the node

        absX = Math.max(absX, 0);
        absX = Math.min(absX, scope.width! - node.width!);
        absY = Math.max(absY, 0);
        absY = Math.min(absY, scope.height! - node.height!);

        const currentNode = nodesMap.get(node.id);
        if (currentNode) {
          currentNode.parentNode = scope.id;
          currentNode.data!.parent = scope.id;
          currentNode.position = { x: absX, y: absY };
          nodesMap.set(node.id, currentNode);
        }

        updateLevel(node.id, scope.data.level + 1);
      });
    },
    [reactFlowWrapper, reactFlowInstance, getScopeAt, nodesMap, getPod]
  );
  return { checkNodesEndLocation };
};

const useNodeOperations = (reactFlowWrapper) => {
  const store = useContext(RepoContext)!;
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const reactFlowInstance = useReactFlow();
  const addPod = useStore(store, (state) => state.addPod);
  const apolloClient = useApolloClient();
  const addNode = useCallback(
    (x: number, y: number, type: "code" | "scope" | "rich") => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let style = {};
      let width;
      let height;

      switch (type) {
        case "scope":
          style = { backgroundColor: level2color[0] };
          width = 600;
          height = 600;
          break;
        case "code":
        case "rich":
          width = 300;
          // we must not set the height here, otherwise the auto layout will not work
          break;
        default:
          throw new Error(`unknown type ${type}`);
      }

      const position = reactFlowInstance.project({
        x: x - reactFlowBounds.left,
        y: y - reactFlowBounds.top,
      });
      let id = nanoid();
      const newNode = {
        id,
        type,
        position,
        width,
        height,
        // IMPORTANT: the width and height must be set here, otherwise the auto
        // layout will not work.
        style: { ...style, width, height },
        data: {
          label: id,
          name: "",
          parent: "ROOT",
          level: 0,
        },
        extent: "parent" as "parent",
        //otherwise, throws a lot of warnings, see
        //https://reactflow.dev/docs/guides/troubleshooting/#only-child-nodes-can-use-a-parent-extent
        parentNode: undefined,
        dragHandle: ".custom-drag-handle",
      };

      // setNodes((nds) => nds.concat(newNode));

      // add to pods
      addPod(apolloClient, {
        id,
        parent: "ROOT",
        type: nodetype2dbtype(type),
        children: [],
        lang: "python",
        x: position.x,
        y: position.y,
        width,
        height,
        dirty: true,
      });

      nodesMap.set(id, newNode);
    },

    [addPod, apolloClient, nodesMap, reactFlowInstance, reactFlowWrapper]
  );
  return { addNode };
};

function verifyConsistency(nodes: Node[], nodesMap: YMap<Node>) {
  let keys = new Set(nodesMap.keys());
  let nodesMap2 = new Map<string, Node>();
  nodes.forEach((node) => nodesMap2.set(node.id, node));
  let keys2 = new Set(nodesMap2.keys());
  if (keys.size !== keys2.size) {
    console.error("keys are not the same", keys, keys2);
    return false;
  }
  for (let i = 0; i < keys.size; i++) {
    if (keys[i] !== keys2[i]) {
      console.error("keys are not the same", keys, keys2);
      return false;
    }
  }
  // verify the values
  keys.forEach((key) => {
    let node1 = nodesMap.get(key);
    let node2 = nodesMap2.get(key);
    if (!node1) {
      console.error("node1 is undefined");
      return false;
    }
    if (!node2) {
      console.error("node2 is undefined");
      return false;
    }
    if (node1.id !== node2.id) {
      console.error("node id are not the same", node1.id, node2.id);
      return false;
    }
    if (node1.parentNode !== node2.parentNode) {
      console.error(
        "node parent are not the same",
        node1.parentNode,
        node2.parentNode
      );
      return false;
    }
    if (node1.position.x !== node2.position.x) {
      console.error(
        "node x are not the same",
        node1.position.x,
        node2.position.x
      );
      return false;
    }
    if (node1.position.y !== node2.position.y) {
      console.error(
        "node y are not the same",
        node1.position.y,
        node2.position.y
      );
      return false;
    }
  });
  return true;
}

function useInitNodes({ triggerUpdate }) {
  const store = useContext(RepoContext)!;
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const getId2children = useStore(store, (state) => state.getId2children);
  const provider = useStore(store, (state) => state.provider);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const init = () => {
      let nodes = store2nodes("ROOT", -1, { getId2children, getPod });
      // Verify that the nodes are the same as the remote database
      if (nodesMap.size !== nodes.length) {
        console.info(
          "The yjs server is empty but database is not. Initializing the yjs server."
        );
        nodes.forEach((node) => {
          if (!nodesMap.has(node.id)) {
            nodesMap.set(node.id, node);
          }
        });
      }
      let isConsistent = verifyConsistency(nodes, nodesMap);
      if (!isConsistent) {
        console.warn(
          "The yjs server is not consistent with the database. Resetting the yjs server"
        );
        // throw new Error("Inconsistent state");
        nodes.forEach((node) => {
          if (!nodesMap.has(node.id)) {
            nodesMap.set(node.id, node);
          }
        });
      }
      // NOTE we have to trigger an update here, otherwise the nodes are not
      // rendered.
      triggerUpdate();
      setLoading(false);
    };

    if (!provider) return;
    if (provider.synced) {
      init();
    } else {
      provider.once("synced", init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);
  return { loading };
}

/**
 * The canvas.
 * @returns
 */
function CanvasImpl() {
  const { nodes, onNodesChange, triggerUpdate } = useNodesStateSynced();
  const [edges, setEdges] = useState<any[]>([]);

  const reactFlowWrapper = useRef<any>(null);
  const { loading } = useInitNodes({ triggerUpdate });
  useCopyPaste(reactFlowWrapper);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoId = useStore(store, (state) => state.repoId);
  const isGuest = useStore(store, (state) => state.isGuest());

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shareOpen = useStore(store, (state) => state.shareOpen);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);

  const { checkNodesEndLocation } = useNodeLocation(reactFlowWrapper);
  const { addNode } = useNodeOperations(reactFlowWrapper);

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
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
          eds
        )
      ),
    [setEdges]
  );

  // Check if the nodes can be dropped into a scope when moving ends
  // const checkNodesEndLocation = useCallback

  const onNodeDragStop = useCallback(
    // handle nodes list as multiple nodes can be dragged together at once
    (event, _n: Node, nodes: Node[]) => {
      checkNodesEndLocation(event, nodes, commonParent);
    },
    [checkNodesEndLocation]
  );

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [client, setClient] = useState({ x: 0, y: 0 });

  const onPaneContextMenu = (event) => {
    console.log("onPaneContextMenu", event);
    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
    console.log(showContextMenu, points, client);
  };

  useEffect(() => {
    const handleClick = (e) => {
      setShowContextMenu(false);
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [setShowContextMenu]);

  const onPaneClick = (event) => {
    // focus
    event.target.tabIndex = 0;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Box
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
      }}
    >
      <Box sx={{ height: "100%" }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          // onPaneMouseMove={onPaneMouseMove}
          attributionPosition="top-right"
          maxZoom={10}
          minZoom={0.1}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          zoomOnScroll={false}
          panOnScroll={true}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={!isGuest}
          // disable node delete on backspace when the user is a guest.
          deleteKeyCode={isGuest ? null : "Backspace"}
          multiSelectionKeyCode={isMac ? "Meta" : "Control"}
          // TODO restore previous viewport
          defaultViewport={{ zoom: 1, x: 0, y: 0 }}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.borderColor) return n.style.borderColor;
                if (n.type === "code") return "#d6dee6";
                if (n.type === "scope") return "#f4f6f8";

                return "#d6dee6";
              }}
              nodeColor={(n) => {
                if (n.style?.backgroundColor) return n.style.backgroundColor;

                return "#f4f6f8";
              }}
              nodeBorderRadius={2}
            />
            <Controls showInteractive={!isGuest} />

            <Background />
          </Box>
        </ReactFlow>
        {showContextMenu && (
          <CanvasContextMenu
            x={points.x}
            y={points.y}
            addCode={() => addNode(client.x, client.y, "code")}
            addScope={() => addNode(client.x, client.y, "scope")}
            addRich={() => addNode(client.x, client.y, "rich")}
            onShareClick={() => {
              setShareOpen(true);
            }}
          />
        )}
        {shareOpen && <ShareProjDialog open={shareOpen} id={repoId || ""} />}
      </Box>
    </Box>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasImpl />
    </ReactFlowProvider>
  );
}
