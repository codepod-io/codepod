import { useCallback, useState, useRef, useEffect, memo } from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Controls,
  Handle,
} from "react-flow-renderer";
import Box from "@mui/material/Box";

import { useDispatch, useSelector } from "react-redux";

import Moveable from "react-moveable";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import { repoSlice } from "../../lib/store";

import * as qActions from "../../lib/queue/actions";

const nanoid = customAlphabet(nolookalikes, 10);

const ScopeNode = ({ data, id, isConnectable, selected }) => {
  // add resize to the node
  const dispatch = useDispatch();
  const ref = useRef(null);
  const [target, setTarget] = React.useState();
  const [frame, setFrame] = React.useState({
    translate: [0, 0],
  });
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
            data.onResize({
              id,
              width: e.width,
              height: e.height,
              offx: beforeTranslate[0],
              offy: beforeTranslate[1],
            });
            dispatch(
              repoSlice.actions.updatePod({
                id,
                data: {
                  width: e.width,
                  height: e.height,
                },
              })
            );
          }}
        />
      )}
    </Box>
  );
};

const CodeNode = memo(({ data, isConnectable }) => {
  return (
    <Box
      sx={{
        border: "solid 1px black",
        width: "100%",
        height: "100%",
        backgroundColor: "white",
      }}
    >
      <Handle type="target" position="top" isConnectable={isConnectable} />
      Code: {data?.label}
      <Handle type="source" position="bottom" isConnectable={isConnectable} />
    </Box>
  );
});

const nodeTypes = { scope: ScopeNode, code: CodeNode };

const NodeBar = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Box
      sx={{
        zIndex: 4,
        display: "flex",
        flexDirection: "row",
      }}
    >
      <Box
        className="dndnode input"
        sx={{
          cursor: "grab",
          zIndex: 4,
          border: "1px solid #aaa",
        }}
        onDragStart={(event) => onDragStart(event, "code")}
        draggable
      >
        Code
      </Box>
      <Box
        className="dndnode output"
        sx={{ cursor: "grab", ml: 2, border: "1px solid #aaa" }}
        onDragStart={(event) => onDragStart(event, "scope")}
        draggable
      >
        Scope
      </Box>
    </Box>
  );
};

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

  // the real pods
  const id2children = useSelector((state) => state.repo.id2children);
  const pods = useSelector((state) => state.repo.pods);

  const onResize = useCallback(
    ({ id, width, height, offx, offy }) => {
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

  function getRealNodes(id, level) {
    let res = [];
    let children = id2children[id];
    if (id !== "ROOT") {
      res.push({
        id: id,
        type: pods[id].type === "CODE" ? "code" : "scope",
        data: {
          // label: `ID: ${id}, parent: ${pods[id].parent}, pos: ${pods[id].x}, ${pods[id].y}`,
          label: id,
          onResize,
        },
        // position: { x: 100, y: 100 },
        position: { x: pods[id].x, y: pods[id].y },
        parentNode: pods[id].parent !== "ROOT" ? pods[id].parent : undefined,
        extent: "parent",
        level,
        style: {
          backgroundColor:
            pods[id].type == "CODE"
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
  }
  useEffect(() => {
    let nodes = getRealNodes("ROOT", -1);
    setNodes(nodes);
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

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const reactFlowWrapper = useRef(null);

  const dispatch = useDispatch();
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let type = event.dataTransfer.getData("application/reactflow");

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) {
        return;
      }

      let style;

      // if (type === "code") type = "default";
      if (type === "scope") {
        style = {
          backgroundColor: level2color[0],
          width: 300,
          height: 300,
        };
      } else {
        style = {
          width: 100,
          height: 100,
        };
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      let id = "CP" + nanoid();
      const newNode = {
        id,
        type,
        position,
        style,
        data: {
          label: id,
          onResize,
        },
        level: 0,
        extent: "parent",
      };

      setNodes((nds) => nds.concat(newNode));

      // add to pods
      dispatch(
        qActions.remoteAdd({
          id,
          parent: "ROOT",
          index: 0,
          type: type === "code" ? "CODE" : "DECK",
          lang: "python",
          x: position.x,
          y: position.y,
          width: style.width,
          height: style.height,
        })
      );
    },
    [reactFlowInstance]
  );

  function getAbsPos(node) {
    let x = node.position.x;
    let y = node.position.y;
    let parent = pods[node.parentNode];
    while (parent) {
      x += parent.x;
      y += parent.y;
      parent = pods[parent.parentNode];
    }
    return [x, y];
  }

  const getScopeAt = (x, y, id) => {
    // FIXME this nodes is not updated.
    // console.log("length of nodes", nodes.length);
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
  };

  const onNodeDragStop = useCallback(
    (event, node) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      console.log(event);
      // This mouse position is absolute within the canvas.
      const mousePos = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      // first, dispatch this to the store
      dispatch(
        repoSlice.actions.setPodPosition({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
        })
      );
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
      if (scope) {
        console.log("dropped into scope:", scope);
        dispatch(
          repoSlice.actions.setPodParent({
            id: node.id,
            parent: scope.id,
          })
        );

        // enlarge the parent node
        // FIXME this is not working, because we will have to enlarge all the ancestor nodes.
        // dispatch(repoSlice.actions.resizeScopeSize({ id: scope.id }));

        // 1. Put the node into the scope, i.e., set the parentNode field.
        // 2. Use position relative to the scope.
        setNodes((nds) =>
          nds.map((nd) => {
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
                  x: nd.positionAbsolute.x - scope.position.x,
                  y: nd.positionAbsolute.y - scope.position.y,
                },
              };
            }
            return nd;
          })
        );
      }
    },
    [reactFlowInstance]
  );

  const onNodesDelete = useCallback(
    (nodes) => {
      // remove from pods
      for (const node of nodes) {
        dispatch(qActions.remoteDelete({ id: node.id }));
      }
    },
    [reactFlowInstance]
  );

  return (
    <Box
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
      }}
    >
      <NodeBar />
      <Box sx={{ height: "100%" }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          // onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          fitView
          attributionPosition="top-right"
          maxZoom={5}
          onDrop={onDrop}
          onDragOver={onDragOver}
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
      </Box>
    </Box>
  );
}
