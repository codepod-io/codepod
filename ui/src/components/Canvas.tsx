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
} from "react-flow-renderer";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import CircleIcon from "@mui/icons-material/Circle";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";

import Grid from "@mui/material/Grid";

import Moveable from "react-moveable";
import Ansi from "ansi-to-react";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext } from "../lib/store";
import { useNodesStateSynced } from "../lib/nodes";

import { MyMonaco } from "./MyMonaco";
import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";

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
  const updatePod = useStore(store, (state) => state.updatePod);
  const [target, setTarget] = React.useState<any>();
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const [frame] = React.useState({
    translate: [0, 0],
  });
  const setSelected = useStore(store, (state) => state.setSelected);
  const selected = useStore(store, (state) => state.selected);
  const { setNodes } = useReactFlow();

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
        className="custom-drag-handle"
        bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
      >
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid item xs={4}>
            <IconButton size="small">
              <CircleIcon sx={{ color: "red" }} fontSize="inherit" />
            </IconButton>
          </Grid>
          <Grid item xs={4}>
            <Box
              sx={{
                display: "flex",
                flexGrow: 1,
                justifyContent: "center",
              }}
            >
              Scope
            </Box>
          </Grid>
          <Grid item xs={4}></Grid>
        </Grid>
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

function ResultBlock({ pod, id }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const wsRun = useStore(store, (state) => state.wsRun);
  return (
    <Box>
      {pod.stdout && (
        <Box overflow="scroll" border="1px">
          {/* TODO separate stdout and stderr */}
          <Box bgcolor="lightgray">Stdout</Box>
          <Box whiteSpace="pre-wrap" fontSize="sm">
            <Ansi>{pod.stdout}</Ansi>
          </Box>
        </Box>
      )}
      {pod.running && <CircularProgress />}
      {pod.result && (
        <Box
          sx={{ display: "flex", flexDirection: "column" }}
          overflow="scroll"
        >
          {pod.result.html ? (
            <div dangerouslySetInnerHTML={{ __html: pod.result.html }}></div>
          ) : (
            pod.result.text && (
              <Box>
                <Box sx={{ display: "flex" }} bgcolor="lightgray">
                  Result: [{pod.result.count}]:
                </Box>
                <Box>
                  <Box component="pre" whiteSpace="pre-wrap">
                    {pod.result.text}
                  </Box>
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
      {pod.error && (
        <Box overflow="scroll" border="1px">
          <Box bgcolor="lightgray">Error</Box>
          <Box color="red">{pod.error.evalue}</Box>
          {pod.error.stacktrace && (
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
  const pod = useStore(store, (state) => state.pods[id]);
  const setPodContent = useStore(store, (state) => state.setPodContent);
  const updatePod = useStore(store, (state) => state.updatePod);
  const clearResults = useStore(store, (s) => s.clearResults);
  const wsRun = useStore(store, (state) => state.wsRun);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const ref = useRef(null);
  const [target, setTarget] = React.useState<any>(null);
  const [frame] = React.useState({
    translate: [0, 0],
  });
  // right, bottom
  const [layout, setLayout] = useState("right");
  const { setNodes } = useReactFlow();
  const selected = useStore(store, (state) => state.selected);
  const setSelected = useStore(store, (state) => state.setSelected);

  const onResize = useCallback(({ width, height, offx, offy }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width, height };
      node.position.x += offx;
      node.position.y += offy;
      nodesMap.set(id, node);
    }
  }, []);
  const onLayout = useCallback(({ height }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, height };
      nodesMap.set(id, node);
    }
  }, []);

  React.useEffect(() => {
    setTarget(ref.current);
  }, []);
  if (!pod) return <Box>ERROR</Box>;
  return (
    <Box
      sx={{
        border: "solid 1px black",
        width: "100%",
        height: "100%",
        backgroundColor: "white",
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
      <Box
        className="custom-drag-handle"
        bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
      >
        {/* Code: {data?.label} */}
        {/* pod */}
        <Box sx={{ display: "flex", flexGrow: 1 }}>
          <IconButton size="small">
            <CircleIcon sx={{ color: "red" }} fontSize="inherit" />
          </IconButton>
        </Box>
        <Box sx={{ display: "flex" }}>
          <Box sx={{ display: "flex" }}>
            <Tooltip title="Run (shift-enter)">
              <IconButton
                size="small"
                sx={{ color: "green" }}
                onClick={() => {
                  wsRun(id);
                }}
              >
                <PlayArrowIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: "flex" }}>
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
          value={pod.content || ""}
          id={pod.id}
          onChange={(value) => {
            setPodContent({ id: pod.id, content: value });
          }}
          lang={pod.lang || "javascript"}
          onRun={() => {
            clearResults(pod.id);
            wsRun(pod.id);
          }}
          onLayout={onLayout}
        />
        {(pod.stdout || pod.stderr || pod.result || pod.error) && (
          <Box
            className="nowheel"
            sx={{
              position: "absolute",
              top: layout === "right" ? 0 : "100%",
              left: layout === "right" ? "100%" : 0,
              maxHeight: "100%",
              maxWidth: "100%",
              minWidth: "100px",
              overflow: "scroll",
              backgroundColor: "white",
              border: "solid 1px blue",
              zIndex: 100,
            }}
          >
            <ResultBlock pod={pod} id={id} />
          </Box>
        )}
      </Box>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />

      {false && (
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
  const id2children = useStore(store, (state) => state.id2children);
  const pods = useStore(store, (state) => state.pods);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));

  const getRealNodes = useCallback(
    (id, level) => {
      let res: any[] = [];
      let children = id2children[id];
      if (id !== "ROOT") {
        res.push({
          id: id,
          type: pods[id].type === "CODE" ? "code" : "scope",
          data: {
            // label: `ID: ${id}, parent: ${pods[id].parent}, pos: ${pods[id].x}, ${pods[id].y}`,
            label: id,
          },
          // position: { x: 100, y: 100 },
          position: { x: pods[id].x, y: pods[id].y },
          parentNode: pods[id].parent !== "ROOT" ? pods[id].parent : undefined,
          extent: "parent",
          dragHandle: ".custom-drag-handle",
          level,
          style: {
            backgroundColor:
              pods[id].type === "CODE"
                ? undefined
                : level2color[level] || level2color["default"],
            width: pods[id].width,
            height: pods[id].height,
          },
        });
      }
      for (const child of children) {
        res = res.concat(getRealNodes(child, level + 1));
      }
      return res;
    },
    [id2children, pods]
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
          width: 300,
          height: 300,
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
        index: 0,
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
      let parent = pods[node.parent];
      while (parent) {
        x += parent.x;
        y += parent.y;
        if (parent.parent) {
          parent = pods[parent.parent];
        } else {
          break;
        }
      }
      return [x, y];
    },
    [pods]
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
            boxShadow: `${userColor} 0px 15px 25px`,
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
