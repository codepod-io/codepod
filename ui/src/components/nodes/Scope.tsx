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
  useStore as useReactFlowStore,
} from "reactflow";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ViewTimelineOutlinedIcon from "@mui/icons-material/ViewTimelineOutlined";
import CompressIcon from "@mui/icons-material/Compress";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import Moveable from "react-moveable";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";

import { NodeResizer, NodeResizeControl } from "reactflow";
import "@reactflow/node-resizer/dist/style.css";
import { ResizableBox } from "react-resizable";
import {
  ConfirmDeleteButton,
  Handles,
  ResizeIcon,
  level2fontsize,
} from "./utils";
import { CopyToClipboard } from "react-copy-to-clipboard";

function MyFloatingToolbar({ id }: { id: string }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
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
  const autoLayout = useStore(store, (state) => state.autoLayout);

  const zoomLevel = useReactFlowStore((s) => s.transform[2]);
  const iconFontSize = zoomLevel < 1 ? `${1.5 * (1 / zoomLevel)}rem` : `1.5rem`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
      }}
    >
      <Box
        className="custom-drag-handle"
        sx={{
          cursor: "grab",
          fontSize: iconFontSize,
          padding: "8px",
          display: "inline-flex",
        }}
      >
        <DragIndicatorIcon fontSize="inherit" />
      </Box>
      {!isGuest && (
        <Tooltip title="Run (shift-enter)">
          <IconButton
            onClick={() => {
              wsRunScope(id);
            }}
          >
            <PlayCircleOutlineIcon style={{ fontSize: iconFontSize }} />
          </IconButton>
        </Tooltip>
      )}
      {/* auto force layout */}
      {!isGuest && (
        <Tooltip title="force layout">
          <IconButton
            onClick={() => {
              autoLayout(id);
            }}
          >
            <ViewTimelineOutlinedIcon style={{ fontSize: iconFontSize }} />
          </IconButton>
        </Tooltip>
      )}
      {/* copy to clipbooard */}
      <CopyToClipboard
        text="dummy"
        options={{ debug: true, format: "text/plain", onCopy } as any}
      >
        <Tooltip title="Copy">
          <IconButton className="copy-button">
            <ContentCopyIcon
              style={{ fontSize: iconFontSize }}
              className="copy-button"
            />
          </IconButton>
        </Tooltip>
      </CopyToClipboard>

      {!isGuest && (
        <CopyToClipboard
          text="dummy"
          options={{ debug: true, format: "text/plain", onCopy: onCut } as any}
        >
          <Tooltip title="Cut">
            <IconButton>
              <ContentCutIcon style={{ fontSize: iconFontSize }} />
            </IconButton>
          </Tooltip>
        </CopyToClipboard>
      )}
      {!isGuest && (
        <Tooltip
          style={{ fontSize: iconFontSize }}
          title="Delete"
          className="nodrag"
        >
          <ConfirmDeleteButton
            handleConfirm={(e: any) => {
              // This does not work, will throw "Parent node
              // jqgdsz2ns6k57vich0bf not found" when deleting a scope.
              //
              // nodesMap.delete(id);
              //
              // But this works:
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          />
        </Tooltip>
      )}
      <Box
        className="custom-drag-handle"
        sx={{
          cursor: "grab",
          fontSize: iconFontSize,
          padding: "8px",
          display: "inline-flex",
        }}
      >
        <DragIndicatorIcon fontSize="inherit" />
      </Box>
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
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const inputRef = useRef<HTMLInputElement>(null);
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);

  const devMode = useStore(store, (state) => state.devMode);
  const isCutting = useStore(store, (state) => state.cuttingIds.has(id));
  const cursorNode = useStore(store, (state) => state.cursorNode);

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name || "" });
    if (inputRef?.current) {
      inputRef.current.value = data.name;
    }
  }, [data.name, id, setPodName]);

  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    if (cursorNode === id) {
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  }, [cursorNode]);
  const contextualZoom = useStore(store, (state) => state.contextualZoom);
  const contextualZoomParams = useStore(
    store,
    (state) => state.contextualZoomParams
  );
  const threshold = useStore(
    store,
    (state) => state.contextualZoomParams.threshold
  );
  const zoomLevel = useReactFlowStore((s) => s.transform[2]);
  const node = nodesMap.get(id);

  const fontSize = level2fontsize(
    node?.data.level,
    contextualZoomParams,
    contextualZoom
  );

  if (contextualZoom && fontSize * zoomLevel < threshold) {
    // Return a collapsed blcok.
    let text = node?.data.name ? `${node?.data.name}` : "A Scope";
    return (
      <Box
        sx={{
          fontSize: fontSize * 2,
          background: "#eee",
          borderRadius: "5px",
          border: "5px solid red",
          textAlign: "center",
          height: pod.height,
          width: pod.width,
          color: "deeppink",
        }}
        className="custom-drag-handle scope-block"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {text}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={ref}
      sx={{
        width: "100%",
        height: "100%",
        border: isCutting ? "dashed 2px red" : "solid 1px #d6dee6",
        borderColor: selected ? "#003c8f" : undefined,
        borderRadius: "4px",
        cursor: "auto",
        fontSize,
      }}
      onMouseEnter={() => {
        setShowToolbar(true);
      }}
      onMouseLeave={() => {
        setShowToolbar(false);
      }}
      className="custom-drag-handle"
    >
      {/* <NodeResizer color="#ff0071" minWidth={100} minHeight={30} /> */}
      <Box sx={{ opacity: showToolbar ? 1 : 0 }}>
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
      </Box>

      <Box
        sx={{
          opacity: showToolbar ? 1 : 0,
          marginLeft: "10px",
          borderRadius: "4px",
          position: "absolute",
          border: "solid 1px #d6dee6",
          right: "25px",
          top: "-60px",
          background: "white",
          zIndex: 250,
          justifyContent: "center",
        }}
      >
        <MyFloatingToolbar id={id} />
      </Box>
      <Box
        sx={{
          opacity: showToolbar ? 1 : 0,
        }}
      >
        <Handles pod={pod} xPos={xPos} yPos={yPos} />
      </Box>
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
          >
            {id} at ({xPos}, {yPos}), w: {pod.width}, h: {pod.height} parent:{" "}
            {pod.parent} level: {data.level} fontSize: {fontSize}
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
                fontSize,
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
                    fontSize,
                    width: pod.width,
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
