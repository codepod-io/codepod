import { useCallback, useState, useRef, useEffect, memo } from "react";
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

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

const nanoid = customAlphabet(nolookalikes, 10);

import initialNodes from "./nodes.js";
import initialEdges from "./edges.js";

import { repoSlice } from "../../lib/store";

import * as qActions from "../../lib/queue/actions";

const ScopeNode = memo(({ data, isConnectable }) => {
  return (
    <>
      <Handle type="target" position="top" isConnectable={isConnectable} />
      Scope: {data?.label}
      <Handle type="source" position="bottom" isConnectable={isConnectable} />
    </>
  );
});

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
        data: { label: id },
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
      // first, dispatch this to the store
      dispatch(
        repoSlice.actions.setPodPosition({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
        })
      );
      // Check which group is at this position.
      const scope = getScopeAt(
        node.positionAbsolute.x,
        node.positionAbsolute.y,
        node.id
      );
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

        // put the node into the scope, i.e., set the parentNode field.
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
                // position: {
                //   x: nd.position.x - scope.position.x,
                //   y: nd.position.y - scope.position.y,
                // },
              };
            }
            return nd;
          })
        );
        // set the node's position to be relative to the parent node.
        let [scope_x, scope_y] = getAbsPos(scope);
        setNodes((nds) =>
          applyNodeChanges(
            [
              {
                id: node.id,
                type: "position",
                position: {
                  x: node.positionAbsolute.x - scope_x,
                  y: node.positionAbsolute.y - scope_y,
                },
              },
            ],
            nds
          )
        );
      }
    },
    [pods]
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
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          fitView
          attributionPosition="top-right"
          maxZoom={5}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
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
