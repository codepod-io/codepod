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
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import Moveable from "react-moveable";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";

import { NodeResizer, NodeResizeControl } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import { ResizableBox } from "react-resizable";
import { ResizeIcon } from "./utils";
import { CopyToClipboard } from "react-copy-to-clipboard";

function MyFloatingToolbar({ id }: { id: string }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const wsRunScope = useStore(store, (state) => state.wsRunScope);
  const clonePod = useStore(store, (state) => state.clonePod);

  const onCopy = useCallback(
    (clipboardData: any) => {
      const pod = clonePod(id);
      if (!pod) return;
      // set the plain text content of a scope as empty
      clipboardData.setData("text/plain", "");
      clipboardData.setData(
        "application/json",
        JSON.stringify({
          type: "pod",
          data: pod,
        })
      );
    },
    [clonePod, id]
  );

  const cutBegin = useStore(store, (state) => state.cutBegin);

  const onCut = useCallback(
    (clipboardData: any) => {
      onCopy(clipboardData);
      cutBegin(id);
    },
    [onCopy, cutBegin, id]
  );
  return (
    <Box>
      {!isGuest && (
        <Tooltip title="Run (shift-enter)">
          <IconButton
            size="small"
            onClick={() => {
              wsRunScope(id);
            }}
          >
            <PlayCircleOutlineIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      <CopyToClipboard
        text="dummy"
        options={{ debug: true, format: "text/plain", onCopy } as any}
      >
        <Tooltip title="Copy">
          <IconButton size="small" className="copy-button">
            <ContentCopyIcon fontSize="inherit" className="copy-button" />
          </IconButton>
        </Tooltip>
      </CopyToClipboard>

      {!isGuest && (
        <CopyToClipboard
          text="dummy"
          options={{ debug: true, format: "text/plain", onCopy: onCut } as any}
        >
          <Tooltip title="Cut">
            <IconButton size="small">
              <ContentCutIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </CopyToClipboard>
      )}
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
  );
}

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
  const setPodName = useStore(store, (state) => state.setPodName);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const inputRef = useRef<HTMLInputElement>(null);
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);

  const devMode = useStore(store, (state) => state.devMode);
  const isCutting = useStore(store, (state) => state.cuttingIds.has(id));

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name || "" });
    if (inputRef?.current) {
      inputRef.current.value = data.name;
    }
  }, [data.name, id, setPodName]);

  const [showToolbar, setShowToolbar] = useState(false);

  return (
    <Box
      ref={ref}
      sx={{
        width: "100%",
        height: "100%",
        border: isCutting ? "dashed 2px red" : "solid 1px #d6dee6",
        borderRadius: "4px",
      }}
      onMouseEnter={() => {
        setShowToolbar(true);
      }}
      onMouseLeave={() => {
        setShowToolbar(false);
      }}
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
          opacity: showToolbar ? 1 : 0,
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
        className="nodrag"
      >
        <MyFloatingToolbar id={id} />
      </Box>
      <Box
        sx={{
          opacity: showToolbar ? 1 : 0,
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
      </Box>
      {/* The header of scope nodes. */}
      <Box
        // bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
        className="custom-drag-handle"
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
            {id} at ({xPos}, {yPos}), w: {pod.width}, h: {pod.height} level:{" "}
            {data.level}
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
    </Box>
  );
});
