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
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import DeleteIcon from "@mui/icons-material/Delete";
import Moveable from "react-moveable";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";

import { NodeResizer, NodeResizeControl } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import { ResizableBox } from "react-resizable";
import { ResizeIcon } from "./utils";

export const ScopeNode = memo<NodeProps>(function ScopeNode({
  data,
  id,
  isConnectable,
  selected,
  xPos,
  yPos,
}) {
  // add resize to the node
  const ref = useRef(null);
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  const setPodName = useStore(store, (state) => state.setPodName);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const inputRef = useRef<HTMLInputElement>(null);

  const devMode = useStore(store, (state) => state.devMode);

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name || "" });
    if (inputRef?.current) {
      inputRef.current.value = data.name;
    }
  }, [data.name, id, setPodName]);

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
      {/* <NodeResizer color="#ff0071" minWidth={100} minHeight={30} /> */}
      <NodeResizeControl
        style={{
          background: "transparent",
          border: "none",
        }}
        minWidth={100}
        minHeight={50}
      >
        <ResizeIcon />
      </NodeResizeControl>
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
        {!isGuest && (
          <Tooltip title="Delete" className="nodrag">
            <IconButton
              size="small"
              onClick={(e: any) => {
                // This does not work, will throw "Parent node
                // jqgdsz2ns6k57vich0bf not found" when deleting a scope.
                //
                // nodesMap.delete(id);
                //
                // But this works:
                reactFlowInstance.deleteElements({ nodes: [{ id }] });
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
      {/* The header of scope nodes. */}
      <Box
        // bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
      >
        {devMode && (
          <Box
            sx={{
              position: "absolute",
              top: "-48px",
              userSelect: "text",
              cursor: "auto",
            }}
            className="nodrag"
          >
            {id} at ({xPos}, {yPos}), level: {data.level}
          </Box>
        )}
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid item xs={4}>
            {/* <IconButton size="small">
                <CircleIcon sx={{ color: "red" }} fontSize="inherit" />
              </IconButton> */}
          </Grid>
          <Grid item xs={4}>
            <Box
              sx={{
                display: "flex",
                flexGrow: 1,
                justifyContent: "center",
              }}
            >
              <InputBase
                className="nodrag"
                defaultValue={data.name || "Scope"}
                onBlur={(e) => {
                  const name = e.target.value;
                  if (name === data.name) return;
                  const node = nodesMap.get(id);
                  if (node) {
                    nodesMap.set(id, {
                      ...node,
                      data: { ...node.data, name },
                    });
                  }
                  // setPodName({ id, name });
                }}
                inputRef={inputRef}
                disabled={isGuest}
                inputProps={{
                  style: {
                    padding: "0px",
                    textAlign: "center",
                    textOverflow: "ellipsis",
                  },
                }}
              ></InputBase>
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
    </Box>
  );
});
