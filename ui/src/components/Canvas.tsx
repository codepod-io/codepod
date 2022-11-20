import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
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
} from "react-flow-renderer";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";

import Grid from "@mui/material/Grid";

import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";
import Ansi from "ansi-to-react";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext } from "../lib/store";
import { useNodesStateSynced } from "../lib/nodes";

import { MyMonaco } from "./MyMonaco";
import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import styles from "./canvas.style.js";

const nanoid = customAlphabet(nolookalikes, 10);

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;
  // selected: boolean;
}
enum ToolTypes {
  delete,
  play,
  layout,
}
function ToolBox({ visible = true, data, onRunTask = (...args) => {} }) {
  // todo: need another design pattern to control visible
  if (!visible) {
    return null;
  }
  return (
    <Box
      sx={{
        display: "flex",
        marginLeft: "10px",
        borderRadius: "4px",
        position: "absolute",
        border: "solid 1px #d6dee6",
        right: "25px",
        top: "-15px",
        background: "white",
        zIndex: 250,
        justifyContent: "center",
      }}
    >
      <Tooltip title="Run (shift-enter)">
        <IconButton
          size="small"
          onClick={() => {
            onRunTask && onRunTask(ToolTypes.play, data);
          }}
        >
          <PlayCircleOutlineIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <IconButton
        size="small"
        onClick={() => {
          onRunTask && onRunTask(ToolTypes.delete, data);
        }}
      >
        <DeleteIcon fontSize="inherit" />
      </IconButton>
      <Tooltip title="Change layout">
        <IconButton
          size="small"
          onClick={() => {
            onRunTask && onRunTask(ToolTypes.layout, data);
          }}
        >
          <ViewComfyIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
const ScopeNode = memo<Props>(({ data, id, isConnectable }) => {
  // add resize to the node
  const ref = useRef(null);
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const updatePod = useStore(store, (state) => state.updatePod);
  const [target, setTarget] = useState<any>();
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const [frame] = useState({
    translate: [0, 0],
  });
  const selected = useStore(store, (state) => state.selected);

  const onResize = useCallback(({ width, height, offx, offy }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width, height };
      node.position.x += offx;
      node.position.y += offy;
      nodesMap.set(id, node);
    }
  }, []);

  useEffect(() => {
    setTarget(ref.current);
  }, []);
  return (
    <Box
      ref={ref}
      sx={{
        width: "100%",
        height: "100%",
        border: "1px solid black",
      }}
      className="custom-drag-handle"
    >
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        isConnectable={isConnectable}
      />
      {/* The header of scope nodes. */}
      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        Scope
      </Box>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={isConnectable}
      />
      {selected === id && (
        <Moveable
          target={target}
          resizable={true}
          keepRatio={false}
          throttleResize={1}
          renderDirections={["e", "s", "se"]}
          edge={false}
          zoom={1}
          origin={true}
          padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
          onResizeStart={(e) => {
            e.setOrigin(["%", "%"]);
            e.dragStart && e.dragStart.set(frame.translate);
          }}
          onResize={(e) => {
            const beforeTranslate = e.drag.beforeTranslate;
            frame.translate = beforeTranslate;
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
            onResize({
              width: e.width,
              height: e.height,
              offx: beforeTranslate[0],
              offy: beforeTranslate[1],
            });
            updatePod({
              id,
              data: {
                width: e.width,
                height: e.height,
              },
            });
          }}
        />
      )}
    </Box>
  );
});

// FIXME: the resultblock is rendered every time the parent codeNode changes (e.g., dragging), we may set the result number as a state of a pod to memoize the resultblock.

function ResultBlock({ pod, id }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const wsRun = useStore(store, (state) => state.wsRun);
  return (
    <Box>
      {pod.result && (
        <Box
          sx={{ display: "flex", flexDirection: "column" }}
          overflow="scroll"
        >
          {pod.result.html ? (
            <div dangerouslySetInnerHTML={{ __html: pod.result.html }}></div>
          ) : (
            !pod.error && (
              <Box
                color="rgb(0, 183, 87)"
                sx={{
                  padding: "6px",
                  zIndex: 200,
                }}
              >
                <Box sx={styles["result-status__success"]}>
                  <CheckCircleIcon
                    style={{ marginTop: "5px" }}
                    fontSize="inherit"
                  />
                </Box>
              </Box>
            )
          )}
          {pod.result.image && (
            <img
              src={`data:image/png;base64,${pod.result.image}`}
              alt="output"
            />
          )}
        </Box>
      )}
      {pod.running && <CircularProgress />}
      {true && (
        <Box overflow="scroll" maxHeight="145px" border="1px">
          {/* <Box bgcolor="lightgray">Error</Box> */}
          {pod.stdout && (
            <Box whiteSpace="pre-wrap" fontSize="sm">
              <Ansi>{pod.stdout}</Ansi>
            </Box>
          )}
          {pod?.error && <Box color="red">{pod?.error?.evalue}</Box>}
          {pod?.error?.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              <Box whiteSpace="pre-wrap" fontSize="small">
                <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
const CodeNode = memo<Props>(({ data, id, isConnectable }) => {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // const pod = useStore(store, (state) => state.pods[id]);
  const wsRun = useStore(store, (state) => state.wsRun);
  const ref = useRef(null);
  const [target, setTarget] = useState<any>(null);
  const [frame] = useState({
    translate: [0, 0],
  });
  const [isEditorBlur, setIsEditorBlur] = useState(true);
  // right, bottom
  const [layout, setLayout] = useState("bottom");
  const { setNodes } = useReactFlow();
  // const selected = useStore(store, (state) => state.selected);
  const setSelected = useStore(store, (state) => state.setSelected);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const onResize = useCallback((e, data) => {
    const { size } = data;
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width: size.width };
      nodesMap.set(id, node);
      updatePod({
        id,
        data: {
          width: size.width,
          height: pod.height,
        },
      });
    }
  }, []);
  const onLayout = useCallback(({ height }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, height };
      nodesMap.set(id, node);
    }
  }, []);
  const updatePod = useStore(store, (state) => state.updatePod);
  const apolloClient = useApolloClient();
  const deletePod = useStore(store, (state) => state.deletePod);
  const deleteNodeById = (id) => {
    deletePod(apolloClient, { id: id, toDelete: [] });
    nodesMap.delete(id);
  };
  const runToolBoxTask = (type, data) => {
    switch (type) {
      case ToolTypes.delete:
        deleteNodeById(id);
        break;
      case ToolTypes.play:
        wsRun(data.id);
        break;
      case ToolTypes.layout:
        setLayout(layout === "bottom" ? "right" : "bottom");
        break;
    }
  };
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);
  const showResult = useStore(
    store,
    (state) =>
      state.pods[id]?.running ||
      state.pods[id]?.result ||
      state.pods[id]?.error ||
      state.pods[id]?.stdout ||
      state.pods[id]?.stderr
  );

  useEffect(() => {
    setTarget(ref.current);
  }, []);
  if (!pod) return null;
  // if (!pod) return <Box>ERROR</Box>;
  const isRightLayout = layout === "right";
  return (
    <ResizableBox onResizeStop={onResize} height={pod.height||100} width={pod.width} axis="x">
      <Box
        sx={{
          border: "solid 1px #d6dee6",
          borderRadius: "4px",
          width: "100%",
          height: "100%",
          backgroundColor: "rgb(244, 246, 248)",
          borderColor: isEditorBlur ? "#d6dee6" : "#3182ce",
        }}
        ref={ref}
      >
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          isConnectable={isConnectable}
        />
        {/* The header of code pods. */}
        <Box className="custom-drag-handle">
          <Box sx={styles["pod-index"]}>[{pod.index}]</Box>
          <ToolBox data={{ id }} onRunTask={runToolBoxTask}></ToolBox>
        </Box>

        <Box
          sx={{
            height: "90%",
          }}
          onClick={(e) => {
            // If the node is selected (for resize), the cursor is not shown. So
            // we need to deselect it when we re-focus on the editor.
            setSelected(null);
            setNodes((nds) =>
              applyNodeChanges(
                [
                  {
                    id,
                    type: "select",
                    selected: false,
                  },
                ],
                nds
              )
            );
          }}
        >
          <MyMonaco
            id={id}
            gitvalue=""
            onBlur={() => {
              setIsEditorBlur(true);
            }}
            onFocus={() => {
              setIsEditorBlur(false);
            }}
          />
          {showResult && (
            <Box
              className="nowheel"
              sx={{
                border: "solid 1px #d6dee6",
                borderRadius: "4px",
                position: "absolute",
                top: isRightLayout ? 0 : "100%",
                left: isRightLayout ? "100%" : 0,
                maxHeight: "150px",
                minWidth: isRightLayout ? "200px" : "100%",
                boxSizing: "border-box",
                backgroundColor: "white",
                zIndex: 100,
                padding: "0 10px",
              }}
            >
              <ResultBlock pod={pod} id={id} />
            </Box>
          )}
        </Box>
      </Box>
    </ResizableBox>
  );
});

const nodeTypes = { scope: ScopeNode, code: CodeNode };

const level2color = {
  0: "rgba(255, 0, 0, 0.2)",
  1: "rgba(255, 0, 255, 0.2)",
  2: "rgba(0, 255, 255, 0.2)",
  3: "rgba(0, 255, 0, 0.2)",
  4: "rgba(255, 255, 0, 0.2)",
  // default: "rgba(255, 255, 255, 0.2)",
  default: "rgba(240,240,240,0.25)",
};

export function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesStateSynced([]);
  const [edges, setEdges] = useState<any[]>([]);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // the real pods
  const getId2children = useStore(store, (state) => state.getId2children);
  // const pods = useStore(store, (state) => state.pods);
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));

  const getRealNodes = useCallback(
    (id, level) => {
      let res: any[] = [];
      let children = getId2children(id) || [];
      console.log("getChildren", id, children);
      const pod = getPod(id);
      if (id !== "ROOT") {
        res.push({
          id: id,
          type: pod.type === "CODE" ? "code" : "scope",
          data: {
            // label: `ID: ${id}, parent: ${pods[id].parent}, pos: ${pods[id].x}, ${pods[id].y}`,
            label: id,
          },
          // position: { x: 100, y: 100 },
          position: { x: pod.x, y: pod.y },
          parentNode: pod.parent !== "ROOT" ? pod.parent : undefined,
          extent: "parent",
          dragHandle: ".custom-drag-handle",
          level,
          style: {
            backgroundColor:
              pod.type === "CODE"
                ? undefined
                : level2color[level] || level2color["default"],
            width: 700,
            // for code node, don't set height, let it be auto
            height: pod.height || undefined,
          },
        });
      }
      for (const child of children) {
        res = res.concat(getRealNodes(child, level + 1));
      }
      return res;
    },
    [getId2children, getPod]
  );
  useEffect(() => {
    let nodes = getRealNodes("ROOT", -1);
    // setNodes(nodes);
    // check if the nodesMap on the websocket has already been initialized with node info
    nodes.forEach((node) => {
      if (!nodesMap.has(node.id)) {
        nodesMap.set(node.id, node);
      }
    });
    setNodes(Array.from(nodesMap.values()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // const onNodesChange = useCallback(
  //   (changes) => {
  //     setNodes((nds) => applyNodeChanges(changes, nds));
  //   },
  //   [setNodes]
  // );

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

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const reactFlowWrapper = useRef<any>(null);

  const addPod = useStore(store, (state) => state.addPod);
  const apolloClient = useApolloClient();
  const setPodPosition = useStore(store, (state) => state.setPodPosition);
  const setPodParent = useStore(store, (state) => state.setPodParent);
  const deletePod = useStore(store, (state) => state.deletePod);
  const userColor = useStore(store, (state) => state.user?.color);

  const addNode = useCallback(
    (x, y, type) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let style;

      // if (type === "code") type = "default";
      if (type === "scope") {
        style = {
          backgroundColor: level2color[0],
          width: 600,
          height: 600,
        };
      } else {
        style = {
          width: 700,
          // we must not set the height here, otherwise the auto layout will not work
          height: undefined,
        };
      }

      const position = reactFlowInstance.project({
        x: x - reactFlowBounds.left,
        y: y - reactFlowBounds.top,
      });
      let id = "pod_" + nanoid();
      const newNode = {
        id,
        type,
        position,
        style,
        data: {
          label: id,
        },
        level: 0,
        extent: "parent",
        dragHandle: ".custom-drag-handle",
      };

      // setNodes((nds) => nds.concat(newNode));
      // add to pods
      addPod(apolloClient, {
        id,
        parent: "ROOT",
        index: nodesMap.size + 1,
        type: type === "code" ? "CODE" : "DECK",
        lang: "python",
        x: position.x,
        y: position.y,
        width: style.width,
        height: style.height,
      });

      nodesMap.set(id, newNode as any);
    },

    [addPod, reactFlowInstance]
  );

  const getAbsPos = useCallback(
    (node) => {
      let x = node.position.x;
      let y = node.position.y;
      let parent = getPod(node.parent);
      while (parent) {
        x += parent.x;
        y += parent.y;
        if (parent.parent) {
          parent = getPod(parent.parent);
        } else {
          break;
        }
      }
      return [x, y];
    },
    [getPod]
  );

  const getScopeAt = useCallback(
    (x, y, id) => {
      // FIXME should be fineLast, but findLast cannot pass TS compiler.
      const scope = nodes.find((node) => {
        let [x1, y1] = getAbsPos(node);
        return (
          node.type === "scope" &&
          node.id !== id &&
          x >= x1 &&
          x <= x1 + node.style.width &&
          y >= y1 &&
          y <= y1 + node.style.height
        );
      });
      return scope;
    },
    [getAbsPos, nodes]
  );

  /**
   * @param {string} x The position relative to the parent.
   * @param {string} y
   * @param {Node} parent The parent node.
   * @param {list} nodes A list of all nodes.
   * @returns {x,y} The absolute position of the node.
   */
  const getAbsolutePos = useCallback((x, y, parent, nodes) => {
    x -= parent.position.x;
    y -= parent.position.y;
    if (parent.parentNode) {
      // FIXME performance.
      parent = nodes.find((n) => n.id === parent.parentNode);
      return getAbsolutePos(x, y, parent, nodes);
    } else {
      return { x, y };
    }
  }, []);

  /**
   * @param {string} node The node to be moved.
   * @param {string} event The event that triggered the move.
   *
   * This function is called when a node is moved. It will do two things:
   * 1. Update the position of the node in the redux store.
   * 2. Check if the node is moved into a scope. If so, update the parent of the node.
   */

  const onNodeDragStart = useCallback(
    (_, node) => {
      const currentNode = nodesMap.get(node.id);

      if (currentNode) {
        nodesMap.set(node.id, {
          ...currentNode,
          // selected: false,
          style: {
            ...currentNode.style,
            // boxShadow: `${userColor} 0px 15px 25px`,
          },
        });
      }
      setNodes((nds) =>
        applyNodeChanges(
          [
            {
              id: node.id,
              type: "select",
              selected: true,
            },
          ],
          nds
        )
      );
    },
    [userColor]
  );

  const onNodeDragStop = useCallback(
    (event, node) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      // This mouse position is absolute within the canvas.
      const mousePos = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      // check if this position is inside parent scope
      if (
        mousePos.x < node.positionAbsolute.x ||
        mousePos.y < node.positionAbsolute.y ||
        mousePos.x > node.positionAbsolute.x + node.width ||
        mousePos.y > node.positionAbsolute.y + node.height
      ) {
        // console.log("Cannot drop outside parent scope");
        return;
      }
      // Check which group is at this position.
      const scope = getScopeAt(mousePos.x, mousePos.y, node.id);
      let absX = node.position.x;
      let absY = node.position.y;
      if (scope) {
        console.log("dropped into scope:", scope);
        // compute the actual position
        let { x: _absX, y: _absY } = getAbsolutePos(
          node.positionAbsolute.x,
          node.positionAbsolute.y,
          scope,
          nodes
        );
        absX = _absX;
        absY = _absY;
      }
      // first, dispatch this to the store
      setPodPosition({
        id: node.id,
        x: absX,
        y: absY,
      });

      if (scope) {
        // TOFIX: to enable collaborative editing, consider how to sync dropping scope immediately.
        setPodParent({
          id: node.id,
          parent: scope.id,
        });

        // enlarge the parent node
        // FIXME this is not working, because we will have to enlarge all the ancestor nodes.
        // dispatch(repoSlice.actions.resizeScopeSize({ id: scope.id }));

        // 1. Put the node into the scope, i.e., set the parentNode field.
        // 2. Use position relative to the scope.
        // setNodes((nds) =>
        //   nds
        //     .map((nd) => {
        //       if (nd.id === node.id) {
        //         return {
        //           ...nd,
        //           parentNode: scope.id,
        //           level: scope.level + 1,
        //           style: {
        //             ...nd.style,
        //             backgroundColor: level2color[scope.level + 1],
        //           },
        //           position: {
        //             x: absX,
        //             y: absY,
        //           },
        //         };
        //       }
        //       return nd;
        //     })
        //     // Sort the nodes by level, so that the scope is rendered first.
        //     .sort((a, b) => a.level - b.level)

        // );
      }

      const currentNode = nodesMap.get(node.id);
      if (currentNode) {
        if (scope) {
          currentNode.style!.backgroundColor = level2color[scope.level + 1];
          (currentNode as any).level = scope.level + 1;
          currentNode.parentNode = scope.id;
        }
        currentNode.position = { x: absX, y: absY };

        if (currentNode.style!["boxShadow"]) {
          delete currentNode.style!.boxShadow;
        }

        nodesMap.set(node.id, currentNode);
      }

      setNodes((nds) =>
        applyNodeChanges(
          [
            {
              id: node.id,
              type: "select",
              selected: true,
            },
          ],
          nds
        )
      );
    },
    // We need to monitor nodes, so that getScopeAt can have all the nodes.
    [
      reactFlowInstance,
      getScopeAt,
      setPodPosition,
      getAbsolutePos,
      nodes,
      setPodParent,
    ]
  );

  const onNodesDelete = useCallback(
    (nodes) => {
      // remove from pods
      for (const node of nodes) {
        deletePod(apolloClient, { id: node.id, toDelete: [] });
      }
    },
    [deletePod]
  );

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [client, setClient] = useState({ x: 0, y: 0 });

  const onPaneContextMenu = (event) => {
    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const handleClick = () => setShowContextMenu(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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
          onInit={setReactFlowInstance}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          fitView
          attributionPosition="top-right"
          maxZoom={5}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          zoomOnScroll={false}
          panOnScroll={true}
          connectionMode={ConnectionMode.Loose}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.background) return n.style.background as string;
                if (n.type === "code") return "#0041d0";
                if (n.type === "scope") return "#ff0072";

                return "#1a192b";
              }}
              nodeColor={(n) => {
                if (n.style?.backgroundColor) return n.style.backgroundColor;

                return "#1a192b";
              }}
              nodeBorderRadius={2}
            />
            <Controls />

            <Background />
          </Box>
        </ReactFlow>
        {showContextMenu && (
          <CanvasContextMenu
            x={points.x}
            y={points.y}
            addCode={() => addNode(client.x, client.y, "code")}
            addScope={() => addNode(client.x, client.y, "scope")}
          />
        )}
      </Box>
    </Box>
  );
}
