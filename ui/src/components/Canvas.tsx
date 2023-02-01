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
import { useYjsObserver } from "../lib/nodes";

import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import { YMap } from "yjs/dist/src/types/YMap";

const nodeTypes = { scope: ScopeNode, code: CodeNode, rich: RichNode };

/**
 * This hook will load nodes from zustand store into Yjs nodesMap using setNodes.
 * @returns None
 */
function store2nodes(id: string, { getId2children, getPod }) {
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
      },
      // position: { x: 100, y: 100 },
      position: { x: pod.x, y: pod.y },
      parentNode: pod.parent !== "ROOT" ? pod.parent : undefined,
      style: {
        width: pod.width || undefined,
        height: pod.height || undefined,
      },
      width: pod.width || undefined,
      // for code node, don't set height, let it be auto
      height: pod.height || undefined,
      dragHandle: ".custom-drag-handle",
    });
  }
  for (const child of children) {
    res = res.concat(store2nodes(child, { getId2children, getPod }));
  }
  return res;
}

function verifyConsistency(nodes: Node[], nodesMap: YMap<Node>) {
  let keys = new Set(nodesMap.keys());
  let nodesMap2 = new Map<string, Node>();
  nodes.forEach((node) => nodesMap2.set(node.id, node));
  let keys2 = new Set(nodesMap2.keys());
  if (keys.size !== keys2.size) {
    console.error("key sizes are not the same", keys, keys2);
    return false;
  }
  for (let i = 0; i < keys.size; i++) {
    if (keys[i] !== keys2[i]) {
      console.error("keys are not the same", keys, keys2);
      return false;
    }
  }
  // verify the values
  for (let key of Array.from(keys)) {
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
      console.error("node id are not the same", node1.id, node2.id, "key", key);
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

    // FIXME: Number.EPSILON is still too huge to compare two floats
    if (Math.abs(node1.position.x - node2.position.x) > 0.01) {
      console.error(
        "node x are not the same",
        node1.position.x,
        node2.position.x
      );
      return false;
    }
    if (Math.abs(node1.position.y - node2.position.y) > 0.01) {
      console.error(
        "node y are not the same",
        node1.position.y,
        node2.position.y
      );
      return false;
    }
  }
  return true;
}

function useInitNodes() {
  const store = useContext(RepoContext)!;
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const getId2children = useStore(store, (state) => state.getId2children);
  const provider = useStore(store, (state) => state.provider);
  const [loading, setLoading] = useState(true);
  const updateView = useStore(store, (state) => state.updateView);
  const adjustLevel = useStore(store, (state) => state.adjustLevel);
  useEffect(() => {
    const init = () => {
      let nodes = store2nodes("ROOT", { getId2children, getPod });
      let isConsistent = verifyConsistency(nodes, nodesMap);
      if (!isConsistent) {
        console.warn(
          "The yjs server is not consistent with the database. Resetting the yjs server"
        );
        // throw new Error("Inconsistent state");
        //
        // CAUTION should not use nodesMap.clear(), as it would delete all
        // nodes! Both local and in database.
        let nodesMap2 = new Map<string, Node>();
        nodes.forEach((node) => nodesMap2.set(node.id, node));
        // Not only should we set nodes, but also delete.
        nodesMap.forEach((node, key) => {
          if (!nodesMap2.has(key)) {
            console.error(`Yjs has key ${key} that is not in database.`);
            // FIXME CAUTION This will delete the node in the database! Be
            // careful! For now, just log errors and do not delete.
            //
            nodesMap.delete(key);
          }
        });
        // add the nodes, so that the nodesMap is consistent with the database.
        nodes.forEach((node) => {
          nodesMap.set(node.id, node);
        });
      }
      // NOTE we have to trigger an update here, otherwise the nodes are not
      // rendered.
      // triggerUpdate();
      adjustLevel();
      updateView();
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

function usePaste(reactFlowWrapper) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");

  const reactFlowInstance = useReactFlow();

  const pasteBegin = useStore(store, (state) => state.pasteBegin);
  const onPasteMove = useStore(store, (state) => state.onPasteMove);
  const pasteEnd = useStore(store, (state) => state.pasteEnd);
  const cancelPaste = useStore(store, (state) => state.cancelPaste);
  const isPasting = useStore(store, (state) => state.isPasting);
  const isGuest = useStore(store, (state) => state.role === "GUEST");

  const resetSelection = useStore(store, (state) => state.resetSelection);

  useEffect(() => {
    if (!reactFlowWrapper.current) return;
    if (!isPasting) return;

    const mouseMove = (event) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      onPasteMove(position);
    };
    const mouseClick = (event) => {
      pasteEnd();
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
    };
  }, [
    cancelPaste,
    onPasteMove,
    pasteEnd,
    isPasting,
    reactFlowInstance,
    reactFlowWrapper,
  ]);

  const handlePaste = useCallback(
    (event) => {
      // avoid duplicated pastes
      if (isPasting || isGuest) return;

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

        // paste at the center of the pane
        const reactFlowBounds =
          reactFlowWrapper.current.getBoundingClientRect();
        let [posX, posY] = [
          reactFlowBounds.width / 2,
          reactFlowBounds.height / 2,
        ];

        const position = reactFlowInstance.project({ x: posX, y: posY });
        pasteBegin(position, data.data);
      } catch (e) {
        console.log("paste error", e);
      }
    },
    [
      isGuest,
      isPasting,
      pasteBegin,
      reactFlowInstance,
      reactFlowWrapper,
      resetSelection,
    ]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);
}

function useCut(reactFlowWrapper) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");

  const reactFlowInstance = useReactFlow();

  const cutEnd = useStore(store, (state) => state.cutEnd);
  const onCutMove = useStore(store, (state) => state.onCutMove);
  const cancelCut = useStore(store, (state) => state.cancelCut);
  const isCutting = useStore(store, (state) => state.isCutting);

  useEffect(() => {
    if (!reactFlowWrapper.current) return;
    if (!isCutting) return;

    const mouseMove = (event) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      onCutMove(position);
    };
    const mouseClick = (event) => {
      cutEnd();
    };
    const keyDown = (event) => {
      if (event.key !== "Escape") return;
      // delete the temporary node
      cancelCut();
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
    };
  }, [
    cancelCut,
    cutEnd,
    isCutting,
    onCutMove,
    reactFlowInstance,
    reactFlowWrapper,
  ]);
}

/**
 * The ReactFlow instance keeps re-rendering when nodes change. Thus, we're
 * using this wrapper component to load the useXXX functions only once.
 */
function CanvasImplWrap() {
  // This wrapper is not the exact same <div> as the reactFlowWrapper in
  // CanvasImpl, but they are exactly the same when using the bounding-box.
  const reactFlowWrapper = useRef<any>(null);

  useYjsObserver();
  usePaste(reactFlowWrapper);
  useCut(reactFlowWrapper);

  const { loading } = useInitNodes();
  if (loading) return <div>Loading...</div>;
  return (
    <Box sx={{ height: "100%" }} ref={reactFlowWrapper}>
      <CanvasImpl />
    </Box>
  );
}

/**
 * The canvas.
 * @returns
 */
function CanvasImpl() {
  const reactFlowWrapper = useRef<any>(null);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");

  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const apolloClient = useApolloClient();
  const onNodesChange = useStore(store, (state) =>
    state.onNodesChange(apolloClient)
  );
  const onEdgesChange = useStore(store, (state) => state.onEdgesChange);
  const onConnect = useStore(store, (state) => state.onConnect);
  const moveIntoScope = useStore(store, (state) => state.moveIntoScope);
  const setDragHighlight = useStore(store, (state) => state.setDragHighlight);
  const removeDragHighlight = useStore(
    store,
    (state) => state.removeDragHighlight
  );

  const addNode = useStore(store, (state) => state.addNode);
  const reactFlowInstance = useReactFlow();

  const project = useCallback(
    ({ x, y }) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      return reactFlowInstance.project({
        x: x - reactFlowBounds.left,
        y: y - reactFlowBounds.top,
      });
    },
    [reactFlowInstance]
  );

  const repoId = useStore(store, (state) => state.repoId);
  const isGuest = useStore(store, (state) => state.role === "GUEST");

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shareOpen = useStore(store, (state) => state.shareOpen);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [client, setClient] = useState({ x: 0, y: 0 });

  const onPaneContextMenu = (event) => {
    console.log("onPaneContextMenu", event);
    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
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

  const getScopeAtPos = useStore(store, (state) => state.getScopeAtPos);

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
          onNodeDragStop={(event, node) => {
            // removeDragHighlight();
            let mousePos = project({ x: event.clientX, y: event.clientY });
            // check if the mouse is still inside this node. If not, the user
            // has beenn trying to move a pod out.
            if (
              mousePos.x < node.positionAbsolute!.x ||
              mousePos.y < node.positionAbsolute!.y ||
              mousePos.x > node.positionAbsolute!.x + node.width! ||
              mousePos.y > node.positionAbsolute!.y + node.height!
            ) {
              console.log("Cannot drop outside parent scope");
              return;
            }
            let scope = getScopeAtPos(mousePos, node.id);
            if (scope && scope.id !== node.parentNode) {
              moveIntoScope(node.id, scope.id);
            }
          }}
          onNodeDrag={(event, node) => {
            let mousePos = project({ x: event.clientX, y: event.clientY });
            let scope = getScopeAtPos(mousePos, node.id);
            if (scope) {
              setDragHighlight(scope.id);
            } else {
              removeDragHighlight();
            }
          }}
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
            addCode={() =>
              addNode("code", project({ x: client.x, y: client.y }))
            }
            addScope={() =>
              addNode("scope", project({ x: client.x, y: client.y }))
            }
            addRich={() =>
              addNode("rich", project({ x: client.x, y: client.y }))
            }
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
      <CanvasImplWrap />
    </ReactFlowProvider>
  );
}
