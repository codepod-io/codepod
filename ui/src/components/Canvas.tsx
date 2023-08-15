import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
  ChangeEvent,
} from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  ReactFlowProvider,
  Edge,
  useViewport,
  XYPosition,
  useStore as useRfStore,
  useKeyPress,
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";

import Box from "@mui/material/Box";

import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext } from "../lib/store";
import { useYjsObserver } from "../lib/nodes";

import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import { YMap } from "yjs/dist/src/types/YMap";
import FloatingEdge from "./nodes/FloatingEdge";
import CustomConnectionLine from "./nodes/CustomConnectionLine";
import HelperLines from "./HelperLines";
import { getAbsPos, newNodeShapeConfig } from "../lib/store/canvasSlice";

const nodeTypes = { SCOPE: ScopeNode, CODE: CodeNode, RICH: RichNode };
const edgeTypes = {
  floating: FloatingEdge,
};

function getBestNode(
  nodes: Node[],
  from,
  direction: "up" | "down" | "left" | "right"
) {
  // find the best node to jump to from (x,y) in the given direction
  let bestNode: Node | null = null;
  let bestDistance = Infinity;
  nodes = nodes.filter((node) => {
    switch (direction) {
      case "up":
        return (
          node.position.y + node.height! / 2 <
          from.position.y + from.height! / 2
        );
      case "down":
        return (
          node.position.y + node.height! / 2 >
          from.position.y + from.height! / 2
        );
      case "left":
        return (
          node.position.x + node.width! / 2 < from.position.x + from.width! / 2
        );
      case "right":
        return (
          node.position.x + node.width! / 2 > from.position.x + from.width! / 2
        );
    }
  });
  for (let node of nodes) {
    // I should start from the edge, instead of the center
    const startPoint: XYPosition = (() => {
      // the center
      // return {
      //   x: from.position.x + from.width! / 2,
      //   y: from.position.y + from.height! / 2,
      // };
      // the edge depending on direction.
      switch (direction) {
        case "up":
          return {
            x: from.position.x + from.width! / 2,
            y: from.position.y,
          };
        case "down":
          return {
            x: from.position.x + from.width! / 2,
            y: from.position.y + from.height!,
          };
        case "left":
          return {
            x: from.position.x,
            y: from.position.y + from.height! / 2,
          };
        case "right":
          return {
            x: from.position.x + from.width!,
            y: from.position.y + from.height! / 2,
          };
      }
    })();
    let distance =
      Math.pow(node.position.x + node.width! / 2 - startPoint.x, 2) *
        (["left", "right"].includes(direction) ? 1 : 2) +
      Math.pow(node.position.y + node.height! / 2 - startPoint.y, 2) *
        (["up", "down"].includes(direction) ? 1 : 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = node;
    }
  }
  return bestNode;
}
function isInputDOMNode(event: KeyboardEvent): boolean {
  const target = (event.composedPath?.()?.[0] || event.target) as HTMLElement;
  const isInput =
    ["INPUT", "SELECT", "TEXTAREA"].includes(target?.nodeName) ||
    target?.hasAttribute("contenteditable");
  return isInput;
}
function useJump() {
  const store = useContext(RepoContext)!;

  const cursorNode = useStore(store, (state) => state.cursorNode);
  const setCursorNode = useStore(store, (state) => state.setCursorNode);

  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);

  const nodesMap = useStore(store, (state) => state.getNodesMap());

  const reactflow = useReactFlow();

  const wsRun = useStore(store, (state) => state.wsRun);
  const wsRunScope = useStore(store, (state) => state.wsRunScope);

  const handleKeyDown = (event) => {
    // This is a hack to address the extra propagation of "Esc" pressed in Rich node, https://github.com/codepod-io/codepod/pull/398#issuecomment-1655153696
    if (isInputDOMNode(event)) return false;
    // Only handle the arrow keys.
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Enter":
        break;
      default:
        return;
    }
    // Get the current cursor node.
    const id = cursorNode;
    if (!id) {
      console.log("No node selected");
      return; // Ignore arrow key presses if there's no selected node or if the user is typing in an input field
    }
    const pod = nodesMap.get(id);
    if (!pod) {
      console.log("pod is undefined");
      return;
    }

    // get the sibling nodes
    const siblings = Array.from(nodesMap.values()).filter(
      (node) => node.parentNode === pod.parentNode
    );
    const children = Array.from(nodesMap.values()).filter(
      (node) => node.parentNode === id
    );

    let to: null | Node = null;

    switch (event.key) {
      case "ArrowUp":
        if (event.shiftKey) {
          if (pod.parentNode) {
            to = nodesMap.get(pod.parentNode)!;
          } else {
            to = pod;
          }
        } else {
          to = getBestNode(siblings, pod, "up");
        }
        break;
      case "ArrowDown":
        if (event.shiftKey) {
          if (pod.type === "SCOPE") {
            to = pod;
            let minDist = Math.sqrt(
              (pod.height || 1) ** 2 + (pod.width || 1) ** 2
            );
            let childDist = 0;
            for (const child of children) {
              childDist = Math.sqrt(
                nodesMap.get(child.id)!.position.x ** 2 +
                  nodesMap.get(child.id)!.position.y ** 2
              );
              if (minDist > childDist) {
                minDist = childDist;
                to = nodesMap.get(child.id)!;
              }
            }
          } else {
            to = pod;
          }
        } else {
          to = getBestNode(siblings, pod, "down");
        }
        break;
      case "ArrowLeft":
        to = getBestNode(siblings, pod, "left");
        break;
      case "ArrowRight":
        to = getBestNode(siblings, pod, "right");
        break;
      case "Enter":
        if (pod.type == "CODE") {
          if (event.shiftKey) {
            // Hitting "SHIFT"+"Enter" will run the code pod
            wsRun(id);
          } else {
            // Hitting "Enter" on a Code pod will go to "Edit" mode.
            setFocusedEditor(id);
          }
        } else if (pod.type === "SCOPE") {
          if (event.shiftKey) {
            // Hitting "SHIFT"+"Enter" on a Scope will run the scope.
            wsRunScope(id);
          }
        } else if (pod.type === "RICH") {
          // Hitting "Enter" on a Rich pod will go to "Edit" mode.
          setFocusedEditor(id);
        }
        break;
      default:
        return;
    }

    if (to) {
      setCursorNode(to.id);

      // move the viewport to the to node
      // get the absolute position of the to node
      const pos = getAbsPos(to, nodesMap);

      reactflow.setCenter(pos.x + to.width! / 2, pos.y + to.height! / 2, {
        zoom: reactflow.getZoom(),
        duration: 800,
      });
    }

    event.preventDefault(); // Prevent default browser behavior for arrow keys
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cursorNode]);
}

export function useCopyPaste() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const rfDomNode = useRfStore((state) => state.domNode);
  const reactFlowInstance = useReactFlow();
  const handleCopy = useStore(store, (state) => state.handleCopy);
  const handlePaste = useStore(store, (state) => state.handlePaste);

  const posRef = useRef<XYPosition>({ x: 0, y: 0 });
  useEffect(() => {
    if (rfDomNode) {
      const onMouseMove = (event: MouseEvent) => {
        const bounds = rfDomNode.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - (bounds?.left ?? 0),
          y: event.clientY - (bounds?.top ?? 0),
        });
        posRef.current = position;
      };

      rfDomNode.addEventListener("mousemove", onMouseMove);

      return () => {
        rfDomNode.removeEventListener("mousemove", onMouseMove);
      };
    }
  }, [rfDomNode]);

  const paste = useCallback(
    (event) => {
      handlePaste(event, posRef.current);
    },
    [handlePaste, posRef]
  );

  // bind copy/paste events
  useEffect(() => {
    if (!rfDomNode) return;
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", paste);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", paste);
    };
  }, [handleCopy, handlePaste, rfDomNode]);
}

/**
 * The ReactFlow instance keeps re-rendering when nodes change. Thus, we're
 * using this wrapper component to load the useXXX functions only once.
 */
function CanvasImplWrap() {
  useYjsObserver();
  useCopyPaste();
  useJump();
  return (
    <Box sx={{ height: "100%" }}>
      <CanvasImpl />
      <ViewportInfo />
    </Box>
  );
}

function ViewportInfo() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const { x, y, zoom } = useViewport();
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "white",
        padding: 1,
        fontSize: 12,
        borderRadius: 1,
        zIndex: 100,
      }}
    >
      {`x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, zoom: ${zoom.toFixed(2)}`}
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
  const onNodesChange = useStore(store, (state) => state.onNodesChange);
  const onEdgesChange = useStore(store, (state) => state.onEdgesChange);
  const onConnect = useStore(store, (state) => state.onConnect);
  const moveIntoScope = useStore(store, (state) => state.moveIntoScope);
  const setDragHighlight = useStore(store, (state) => state.setDragHighlight);
  const removeDragHighlight = useStore(
    store,
    (state) => state.removeDragHighlight
  );
  const updateView = useStore(store, (state) => state.updateView);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);

  const addNode = useStore(store, (state) => state.addNode);
  const importLocalCode = useStore(store, (state) => state.importLocalCode);

  const selectedPods = useStore(store, (state) => state.selectedPods);

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
  const [parentNode, setParentNode] = useState(undefined);

  const moved = useStore(store, (state) => state.moved);
  const paneClicked = useStore(store, (state) => state.paneClicked);
  const nodeClicked = useStore(store, (state) => state.nodeClicked);
  useEffect(() => {
    setShowContextMenu(false);
  }, [moved, paneClicked, nodeClicked]);
  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onPaneContextMenu = (event) => {
    event.preventDefault();
    setShowContextMenu(true);
    setParentNode(undefined);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu = (event, node) => {
    if (node?.type !== "SCOPE") return;

    event.preventDefault();
    setShowContextMenu(true);
    setParentNode(node.id);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
  };

  const getScopeAtPos = useStore(store, (state) => state.getScopeAtPos);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoLayoutOnce = useStore(store, (state) => state.setAutoLayoutOnce);
  const autoLayoutOnce = useStore(store, (state) => state.autoLayoutOnce);

  const helperLineHorizontal = useStore(
    store,
    (state) => state.helperLineHorizontal
  );
  const helperLineVertical = useStore(
    store,
    (state) => state.helperLineVertical
  );
  const toggleMoved = useStore(store, (state) => state.toggleMoved);
  const togglePaneClicked = useStore(store, (state) => state.togglePaneClicked);
  const toggleNodeClicked = useStore(store, (state) => state.toggleNodeClicked);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleItemClick = () => {
    fileInputRef!.current!.click();
    fileInputRef!.current!.value = "";
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileName = e.target.files[0].name;
    console.log("Import Jupyter Notebook or Python scripts: ", fileName);
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const fileContent =
        typeof e.target!.result === "string"
          ? e.target!.result
          : Buffer.from(e.target!.result!).toString();
      let cellList: any[] = [];
      let importScopeName = "";
      switch (fileName.split(".").pop()) {
        case "ipynb":
          cellList = JSON.parse(String(fileContent)).cells.map((cell) => ({
            cellType: cell.cell_type,
            cellSource: cell.source.join(""),
            cellOutputs: cell.outputs || [],
            execution_count: cell.execution_count || 0,
          }));
          importScopeName = fileName.substring(0, fileName.length - 6);
          break;
        case "py":
          cellList = [{ cellType: "code", cellSource: String(fileContent) }];
          break;
        default:
          return;
      }

      importLocalCode(
        project({ x: client.x, y: client.y }),
        importScopeName,
        cellList
      );
      setAutoLayoutOnce(true);
    };
    fileReader.readAsText(e.target.files[0], "UTF-8");
  };

  useEffect(() => {
    // A BIG HACK: we run autolayout once at SOME point after ImportLocalCode to
    // let reactflow calculate the height of pods, then layout them properly.
    if (
      autoLayoutOnce &&
      nodes.filter((node) => node.height === newNodeShapeConfig.height)
        .length == 0
    ) {
      autoLayoutROOT();
      setAutoLayoutOnce(false);
    }
  }, [autoLayoutOnce, nodes]);

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
          onMove={() => {
            toggleMoved();
            // Hide the Rich node drag handle when moving.
            const elems = document.getElementsByClassName("global-drag-handle");
            Array.from(elems).forEach((elem) => {
              (elem as HTMLElement).style.display = "none";
            });
          }}
          onPaneClick={() => {
            togglePaneClicked();
          }}
          onNodeClick={() => {
            toggleNodeClicked();
          }}
          onNodeDragStop={(event, node) => {
            removeDragHighlight();
            let mousePos = project({ x: event.clientX, y: event.clientY });
            let scope = getScopeAtPos(mousePos, node.id);
            let toScope = scope?.id;
            const parentScope = node.parentNode;
            if (selectedPods.size > 0 && parentScope !== toScope) {
              moveIntoScope(Array.from(selectedPods), toScope);
              // update view manually to remove the drag highlight.
              updateView();
            }
            // run auto layout on drag stop
            if (autoRunLayout) {
              autoLayoutROOT();
            }
          }}
          onNodeDrag={(event, node) => {
            let mousePos = project({ x: event.clientX, y: event.clientY });
            let scope = getScopeAtPos(mousePos, node.id);
            if (scope) {
              // The view is updated at the node position change.
              setDragHighlight(scope.id);
            } else {
              removeDragHighlight();
            }
          }}
          attributionPosition="top-right"
          maxZoom={10}
          minZoom={0.1}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          // custom edge for easy connect
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            style: { strokeWidth: 3, stroke: "black" },
            type: "floating",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "black",
            },
          }}
          connectionLineComponent={CustomConnectionLine}
          connectionLineStyle={{
            strokeWidth: 3,
            stroke: "black",
          }}
          // end custom edge

          zoomOnScroll={false}
          panOnScroll={true}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={!isGuest}
          // disable node delete on backspace when the user is a guest.
          deleteKeyCode={isGuest ? null : "Backspace"}
          multiSelectionKeyCode={isMac ? "Meta" : "Control"}
          selectionMode={SelectionMode.Partial}
          // TODO restore previous viewport
          defaultViewport={{ zoom: 1, x: 0, y: 0 }}
          proOptions={{ hideAttribution: true }}
          disableKeyboardA11y={true}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.borderColor) return n.style.borderColor;
                if (n.type === "CODE") return "#d6dee6";
                if (n.type === "SCOPE") return "#f4f6f8";

                return "#d6dee6";
              }}
              nodeColor={(n) => {
                if (n.style?.backgroundColor) return n.style.backgroundColor;

                return "#f4f6f8";
              }}
              nodeBorderRadius={2}
            />
            <Controls showInteractive={!isGuest} />

            <HelperLines
              horizontal={helperLineHorizontal}
              vertical={helperLineVertical}
            />

            <Background />
            <Background
              id="1"
              gap={10}
              color="#f1f1f1"
              variant={BackgroundVariant.Lines}
            />
            <Background
              id="2"
              gap={100}
              offset={1}
              color="#ccc"
              variant={BackgroundVariant.Lines}
            />
          </Box>
        </ReactFlow>
        <input
          type="file"
          accept=".ipynb, .py"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => handleFileInputChange(e)}
        />
        {showContextMenu && (
          <CanvasContextMenu
            x={points.x}
            y={points.y}
            addCode={() => {
              addNode(
                "CODE",
                project({ x: client.x, y: client.y }),
                parentNode
              );
              setShowContextMenu(false);
            }}
            addScope={() => {
              addNode(
                "SCOPE",
                project({ x: client.x, y: client.y }),
                parentNode
              );
              setShowContextMenu(false);
            }}
            addRich={() => {
              addNode(
                "RICH",
                project({ x: client.x, y: client.y }),
                parentNode
              );
              setShowContextMenu(false);
            }}
            handleImportClick={() => {
              // handle CanvasContextMenu "import Jupyter notebook" click
              handleItemClick();
              setShowContextMenu(false);
            }}
            onShareClick={() => {
              setShareOpen(true);
              setShowContextMenu(false);
            }}
            parentNode={null}
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
