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
  useReactFlow
} from "react-flow-renderer";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

import Moveable from "react-moveable";
import Ansi from "ansi-to-react";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";

import { MyMonaco } from "../MyMonaco";

const nanoid = customAlphabet(nolookalikes, 10);

const ScopeNode = memo(({ data, id, isConnectable, selected }) => {
  // add resize to the node
  const ref = useRef(null);
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const updatePod = useStore(store, (state) => state.updatePod);
  const [target, setTarget] = React.useState();
  const [frame] = React.useState({
    translate: [0, 0],
  });
  const { setNodes } = useReactFlow();

  const onResize = useCallback(
    ({width, height, offx, offy }) => {
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === id) {
            // CAUTION I have to return a new object here.
            node.style = { ...node.style, width, height };
            node.position.x += offx;
            node.position.y += offy;
          }
          return node;
        });
      });
    },
    [setNodes]
  );

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
      <Handle type="target" position="top" isConnectable={isConnectable} />
      Scope: {data?.label}
      <Handle type="source" position="bottom" isConnectable={isConnectable} />
      {selected && (
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
              id,
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

const CodeNode = memo(({ data, id, isConnectable, selected }) => {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const pod = useStore(store, (state) => state.pods[id]);
  const setPodContent = useStore(store, (state) => state.setPodContent);
  const updatePod = useStore(store, (state) => state.updatePod);
  const clearResults = useStore(store, (s) => s.clearResults);
  const wsRun = useStore(store, (state) => state.wsRun);
  const ref = useRef(null);
  const [target, setTarget] = React.useState();
  const [frame] = React.useState({
    translate: [0, 0],
  });
  const { setNodes } = useReactFlow();

  const onResize = useCallback(
    ({width, height, offx, offy }) => {
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === id) {
            // CAUTION I have to return a new object here.
            node.style = { ...node.style, width, height };
            node.position.x += offx;
            node.position.y += offy;
          }
          return node;
        });
      });
    },
    [setNodes]
  );

  React.useEffect(() => {
    setTarget(ref.current);
  }, []);
  return ((pod!==undefined) &&
    <Box
      sx={{
        border: "solid 1px black",
        width: "100%",
        height: "100%",
        backgroundColor: "white",
      }}
      ref={ref}
    >
      <Handle type="target" position="top" isConnectable={isConnectable} />
      <Box className="custom-drag-handle">Code: {data?.label}</Box>
      <Box
        sx={{
          height: "90%",
        }}
        onClick={(e) => {
          // If the node is selected (for resize), the cursor is not shown. So
          // we need to deselect it when we re-focus on the editor.
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
          gitvalue={pod.staged}
          // pod={pod}
          onChange={(value) => {
            setPodContent({ id: pod.id, content: value });
          }}
          lang={pod.lang || "javascript"}
          onRun={() => {
            clearResults(pod.id);
            wsRun(pod.id);
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "100px",
            height: "100px",
            backgroundColor: "white",
            border: "solid 1px blue",
            zIndex: 100,
          }}
        >
          <Box sx={{ display: "flex" }}>
            <Tooltip title="Run (shift-enter)">
              <IconButton
                size="small"
                sx={{ color: "green" }}
                onClick={() => {
                  wsRun(id);
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {pod.stdout && (
            <Box overflow="scroll" maxHeight="200px" border="1px">
              {/* TODO separate stdout and stderr */}
              <Box>Stdout/Stderr:</Box>
              <Box whiteSpace="pre-wrap" fontSize="sm">
                <Ansi>{pod.stdout}</Ansi>
              </Box>
            </Box>
          )}
          {pod.running && <CircularProgress />}
          {pod.result && (
            <Box
              sx={{ display: "flex" }}
              direction="column"
              overflow="scroll"
              maxHeight="200px"
            >
              {pod.result.html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: pod.result.html }}
                ></div>
              ) : (
                pod.result.text && (
                  <Box>
                    <Box sx={{ display: "flex" }} color="gray" mr="1rem">
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
            <Box overflow="scroll" maxHeight="3xs" border="1px" bg="gray.50">
              <Box color="red">Error: {pod.error.evalue}</Box>
              {pod.error.stacktrace && (
                <Box>
                  <Box>StackTrace</Box>
                  <Box whiteSpace="pre-wrap" fontSize="sm">
                    <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <Handle type="source" position="bottom" isConnectable={isConnectable} />
      {selected && (
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

export function Deck({ props }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // the real pods
  const id2children = useStore(store, (state) => state.id2children);
  const pods = useStore(store, (state) => state.pods);

  const getRealNodes = useCallback(
    (id, level) => {
      let res = [];
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
    setNodes(nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const reactFlowWrapper = useRef(null);

  const addPod = useStore(store, (state) => state.addPod);
  const setPodPosition = useStore(store, (state) => state.setPodPosition);
  const setPodParent = useStore(store, (state) => state.setPodParent);
  const remoteDelete = useStore(store, (state) => state.deletePod);

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

      setNodes((nds) => nds.concat(newNode));

      // add to pods
      addPod({
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
    },
    [addPod, reactFlowInstance]
  );

  const getAbsPos = useCallback(
    (node) => {
      let x = node.position.x;
      let y = node.position.y;
      let parent = pods[node.parentNode];
      while (parent) {
        x += parent.x;
        y += parent.y;
        parent = pods[parent.parentNode];
      }
      return [x, y];
    },
    [pods]
  );

  const getScopeAt = useCallback(
    (x, y, id) => {
      const scope = nodes.findLast((node) => {
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
        setPodParent({
          id: node.id,
          parent: scope.id,
        });

        // enlarge the parent node
        // FIXME this is not working, because we will have to enlarge all the ancestor nodes.
        // dispatch(repoSlice.actions.resizeScopeSize({ id: scope.id }));

        // 1. Put the node into the scope, i.e., set the parentNode field.
        // 2. Use position relative to the scope.
        setNodes((nds) =>
          nds
            .map((nd) => {
              if (nd.id === node.id) {
                return {
                  ...nd,
                  parentNode: scope.id,
                  level: scope.level + 1,
                  style: {
                    ...nd.style,
                    backgroundColor: level2color[scope.level + 1],
                  },
                  position: {
                    x: absX,
                    y: absY,
                  },
                };
              }
              return nd;
            })
            // Sort the nodes by level, so that the scope is rendered first.
            .sort((a, b) => a.level - b.level)
        );
      }
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
        remoteDelete({ id: node.id });
      }
    },
    [remoteDelete]
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
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          fitView
          attributionPosition="top-right"
          maxZoom={5}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          zoomOnScroll={false}
          panOnScroll={true}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.background) return n.style.background;
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
          <Box
            sx={{
              left: `${points.x}px`,
              top: `${points.y}px`,
              zIndex: 100,
              position: "absolute",
              boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
              // width: '200px',
              backgroundColor: "#fff",
              borderRadius: "5px",
              boxSizing: "border-box",
            }}
          >
            <Stack>
              <Button
                onClick={() => {
                  addNode(client.x, client.y, "code");
                }}
              >
                New Code{" "}
              </Button>
              <Button
                onClick={() => {
                  addNode(client.x, client.y, "scope");
                }}
              >
                New Scope{" "}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
