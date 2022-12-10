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
} from "reactflow";
import "reactflow/dist/style.css";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import CircleIcon from "@mui/icons-material/Circle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Grid from "@mui/material/Grid";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";

import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";
import Ansi from "ansi-to-react";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext, RoleType } from "../lib/store";
import { useNodesStateSynced } from "../lib/nodes";

import { MyMonaco } from "./MyMonaco";
import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import styles from "./canvas.style.js";
import { ShareProjDialog } from "./ShareProjDialog";
import { analyzeCode } from "../lib/parser";

const nanoid = customAlphabet(nolookalikes, 10);

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;

  // selected: boolean;
}

const ScopeNode = memo<Props>(({ data, id, isConnectable }) => {
  // add resize to the node
  const ref = useRef(null);
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const flow = useReactFlow();
  const updatePod = useStore(store, (state) => state.updatePod);
  const [target, setTarget] = React.useState<any>();
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const [frame] = React.useState({
    translate: [0, 0],
  });
  const selected = useStore(store, (state) => state.pods[id]?.selected);
  const role = useStore(store, (state) => state.role);

  const deleteNodeById = useCallback(
    (id: string) => {
      flow.deleteElements({
        nodes: [
          {
            id,
          },
        ],
      });
    },
    [flow]
  );

  const onResize = useCallback(({ width, height, offx, offy }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width, height };
      node.position.x += offx;
      node.position.y += offy;
      nodesMap.set(id, node);
    }
  }, []);

  React.useEffect(() => {
    setTarget(ref.current);
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        width: "100%",
        height: "100%",
        border: "solid 1px #d6dee6",
        borderRadius: "4px",
      }}
      className="custom-drag-handle"
    >
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
        {role !== RoleType.GUEST && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e: any) => {
                e.stopPropagation();
                e.preventDefault();
                deleteNodeById(id);
              }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
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
      {selected && role !== RoleType.GUEST && (
        <Moveable
          target={target}
          resizable={true}
          keepRatio={false}
          throttleResize={1}
          renderDirections={["e", "s", "se"]}
          edge={false}
          zoom={1}
          origin={false}
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
  const [showOutput, setShowOutput] = useState(true);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  return (
    <Box
      sx={{
        minHeight: pod.height,
      }}
    >
      {pod.result && (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {pod.result.html ? (
            <div dangerouslySetInnerHTML={{ __html: pod.result.html }}></div>
          ) : (
            <>
              {!pod.error && (
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
              )}
            </>
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
      {showOutput ? (
        <Box
          sx={{ paddingBottom: "2px" }}
          overflow="scroll"
          maxHeight="145px"
          border="1px"
        >
          {/* <Box bgcolor="lightgray">Error</Box> */}
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={[
              styles["hidden-btn"],
              {
                position: "absolute",
                top: 0,
                right: 0,
                zIndex: 201,
              },
            ]}
            variant="text"
            size="small"
          >
            Hide output
          </Button>
          {pod.stdout && (
            <Box whiteSpace="pre-wrap" sx={{ fontSize: 10, paddingBottom: 1 }}>
              <Ansi>{pod.stdout}</Ansi>
            </Box>
          )}
          {pod?.result?.text && pod?.result?.count > 0 && (
            <Box
              sx={{
                display: "flex",
                fontSize: 10,
                flexDirection: "row",
                alignItems: "center",
                borderTop: "1px solid rgb(214, 222, 230)",
              }}
            >
              <Box component="pre" whiteSpace="pre-wrap">
                {pod.result.text}
              </Box>
            </Box>
          )}
          {pod?.error && <Box color="red">{pod?.error?.evalue}</Box>}
          {pod?.error?.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              <Box whiteSpace="pre-wrap" sx={{ fontSize: 10 }}>
                <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            paddingBottom: "5px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box sx={styles["hidden-hint"]}>This output has been hidden. </Box>
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={styles["hidden-btn"]}
            size="small"
            variant="text"
          >
            Show it
          </Button>
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
  const clearResults = useStore(store, (s) => s.clearResults);
  const ref = useRef(null);
  const [target, setTarget] = React.useState<any>(null);
  const [frame] = React.useState({
    translate: [0, 0],
  });
  // right, bottom
  const [layout, setLayout] = useState("bottom");
  const isRightLayout = layout === "right";
  const { setNodes } = useReactFlow();
  // const selected = useStore(store, (state) => state.selected);
  const setPodSelected = useStore(store, (state) => state.setPodSelected);
  const setCurrentEditor = useStore(store, (state) => state.setCurrentEditor);
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);
  const role = useStore(store, (state) => state.role);
  const width = useStore(store, (state) => state.pods[id]?.width);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);

  const showResult = useStore(
    store,
    (state) =>
      state.pods[id]?.running ||
      state.pods[id]?.result ||
      state.pods[id]?.error ||
      state.pods[id]?.stdout ||
      state.pods[id]?.stderr
  );
  const onResize = useCallback((e, data) => {
    const { size } = data;
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width: size.width };
      nodesMap.set(id, node);
    }
  }, []);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const apolloClient = useApolloClient();
  const deletePod = useStore(store, (state) => state.deletePod);
  const deleteNodeById = (id) => {
    deletePod(apolloClient, { id: id, toDelete: [] });
    nodesMap.delete(id);
  };

  useEffect(() => {
    setTarget(ref.current);
  }, []);
  if (!pod) return null;

  // onsize is banned for a guest, FIXME: ugly code
  const Wrap = (child) =>
    role === RoleType.GUEST ? (
      <>{child}</>
    ) : (
      <ResizableBox
        onResizeStop={onResize}
        height={pod.height || 100}
        width={width}
        axis={"x"}
        minConstraints={[200, 200]}
      >
        {child}
      </ResizableBox>
    );

  return Wrap(
    <Box
      sx={{
        border: "solid 1px #d6dee6",
        borderWidth: pod.ispublic ? "4px" : "2px",
        borderRadius: "4px",
        width: "100%",
        height: "100%",
        backgroundColor: "rgb(244, 246, 248)",
        borderColor: pod.ispublic
          ? "green"
          : !isPodFocused
          ? "#d6dee6"
          : "#3182ce",
      }}
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
          {role !== RoleType.GUEST && (
            <Tooltip title="Run (shift-enter)">
              <IconButton
                size="small"
                onClick={() => {
                  clearResults(id);
                  wsRun(id);
                }}
              >
                <PlayCircleOutlineIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          {role !== RoleType.GUEST && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => {
                  deleteNodeById(id);
                }}
              >
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Change layout">
            <IconButton
              size="small"
              onClick={() => {
                setLayout(layout === "bottom" ? "right" : "bottom");
              }}
            >
              <ViewComfyIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Box
        sx={{
          height: "90%",
        }}
        onClick={(e) => {
          // If the node is selected (for resize), the cursor is not shown. So
          // we need to deselect it when we re-focus on the editor.
          setPodSelected(id, false);
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
        <MyMonaco id={id} gitvalue="" />
        {showResult && (
          <Box
            className="nowheel"
            sx={{
              border: "solid 1px #d6dee6",
              borderRadius: "4px",
              position: "absolute",
              top: isRightLayout ? 0 : "100%",
              left: isRightLayout ? "100%" : 0,
              maxHeight: "158px",
              maxWidth: isRightLayout ? "300px" : "100%",
              minWidth: isRightLayout ? "150px" : "100%",
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
  );
});

const nodeTypes = { scope: ScopeNode, code: CodeNode };

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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const repoId = useStore(store, (state) => state.repoId);
  const repoName = useStore(store, (state) => state.repoName);
  const role = useStore(store, (state) => state.role);
  const provider = useStore(store, (state) => state.provider);

  const getRealNodes = useCallback(
    (id, level) => {
      let res: any[] = [];
      let children = getId2children(id) || [];
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
          level,
          style: {
            backgroundColor:
              pod.type === "CODE"
                ? undefined
                : level2color[level] || level2color["default"],
            width: pod.width || undefined,
            // for code node, don't set height, let it be auto
            height: pod.height || undefined,
          },
          dragHandle: ".custom-drag-handle",
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
    const init = () => {
      let nodes = getRealNodes("ROOT", -1);
      nodes.forEach((node) => {
        if (!nodesMap.has(node.id)) {
          console.log("add node", node.id, node);
          nodesMap.set(node.id, node);
        }
      });
      setNodes(Array.from(nodesMap.values()));
    };

    if (!provider) return;
    if (provider.synced) {
      init();
    } else {
      provider.once("synced", init);
    }
    // check if the nodesMap on the websocket has already been initialized with node info

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

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
          width: 300,
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
        //otherwise, throws a lot of warnings, see https://reactflow.dev/docs/guides/troubleshooting/#only-child-nodes-can-use-a-parent-extent
        parentNode: undefined,
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

    [addPod, apolloClient, nodesMap, reactFlowInstance]
  );

  const getScopeAt = useCallback(
    (x, y, id) => {
      const scope = nodes.findLast((node) => {
        let [x1, y1] = getAbsPos({ node, nodesMap });
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
    },
    [nodesMap, setNodes, userColor]
  );

  const onNodeDragStop = useCallback(
    (event, node: Node) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      // This mouse position is absolute within the canvas.
      const mousePos = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      // check if this position is inside parent scope
      if (
        mousePos.x < node.positionAbsolute!.x ||
        mousePos.y < node.positionAbsolute!.y ||
        mousePos.x > node.positionAbsolute!.x + node.width! ||
        mousePos.y > node.positionAbsolute!.y + node.height!
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
        let [dx, dy] = getAbsPos({ node: scope, nodesMap });
        absX = node.positionAbsolute!.x - dx;
        absY = node.positionAbsolute!.y - dy;
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
    },
    // We need to monitor nodes, so that getScopeAt can have all the nodes.
    [
      reactFlowInstance,
      getScopeAt,
      setPodPosition,
      nodesMap,
      setNodes,
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
    [apolloClient, deletePod]
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
          nodesDraggable={role !== RoleType.GUEST}
          // disable node delete on backspace when the user is a guest.
          deleteKeyCode={role === RoleType.GUEST ? null : "Backspace"}
          multiSelectionKeyCode={"Control"}
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
            <Controls showInteractive={role !== RoleType.GUEST} />

            <Background />
          </Box>
        </ReactFlow>
        {showContextMenu && (
          <CanvasContextMenu
            x={points.x}
            y={points.y}
            addCode={() => addNode(client.x, client.y, "code")}
            addScope={() => addNode(client.x, client.y, "scope")}
            onShareClick={() => {
              setShowShareDialog(true);
            }}
          />
        )}
        <ShareProjDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          title={repoName || ""}
          id={repoId || ""}
        />
      </Box>
    </Box>
  );
}
