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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import CircleIcon from "@mui/icons-material/Circle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import Grid from "@mui/material/Grid";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import PlayDisabledIcon from "@mui/icons-material/PlayDisabled";
import DeleteIcon from "@mui/icons-material/Delete";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import { CopyToClipboard } from "react-copy-to-clipboard";
import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";
import Ansi from "ansi-to-react";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";

import { MyMonaco } from "../MyMonaco";
import { useApolloClient } from "@apollo/client";

import { NodeResizeControl, NodeResizer } from "reactflow";

import "@reactflow/node-resizer/dist/style.css";
import { ResizeIcon } from "./utils";

export const ResultBlock = memo<any>(function ResultBlock({ id }) {
  const store = useContext(RepoContext)!;
  const result = useStore(store, (state) => state.pods[id].result);
  const error = useStore(store, (state) => state.pods[id].error);
  const stdout = useStore(store, (state) => state.pods[id].stdout);
  const running = useStore(store, (state) => state.pods[id].running);
  const [showOutput, setShowOutput] = useState(true);
  return (
    <Box
      sx={{
        userSelect: "text",
        cursor: "auto",
      }}
    >
      {result && (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {result.html ? (
            <div dangerouslySetInnerHTML={{ __html: result.html }}></div>
          ) : (
            <>
              {!error && (
                <Box
                  color="rgb(0, 183, 87)"
                  sx={{
                    padding: "6px",
                    zIndex: 200,
                  }}
                >
                  <Box
                    sx={{
                      fontWeight: 500,
                      position: "absolute",
                      padding: "0 5px",
                      backgroundColor: "rgb(255, 255, 255)",
                      top: "-13.5px",
                      left: "15px",
                      height: "15px",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor:
                        "rgb(214, 222, 230) rgb(214, 222, 230) rgb(255, 255, 255)",
                      borderImage: "initial",
                      borderTopLeftRadius: "20px",
                      borderTopRightRadius: "20px",
                      display: "flex",
                      fontSize: "14px",
                    }}
                  >
                    <CheckCircleIcon
                      style={{ marginTop: "5px" }}
                      fontSize="inherit"
                    />
                  </Box>
                </Box>
              )}
            </>
          )}
          {result.image && (
            <img src={`data:image/png;base64,${result.image}`} alt="output" />
          )}
        </Box>
      )}

      {running && <CircularProgress />}
      {showOutput ? (
        <Box
          sx={{ paddingBottom: "2px" }}
          overflow="auto"
          maxHeight="140px"
          border="1px"
        >
          {/* <Box bgcolor="lightgray">Error</Box> */}
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={[
              {
                fontSize: 10,
                paddingTop: "3px",
                paddingBottom: "2px",
                lineHeight: "10px",
                zIndex: 201,
                position: "absolute",
                top: 0,
                right: 0,
              },
            ]}
            variant="text"
            size="small"
          >
            Hide output
          </Button>
          {stdout && (
            <Box whiteSpace="pre-wrap" sx={{ fontSize: 10, paddingBottom: 1 }}>
              <Ansi>{stdout}</Ansi>
            </Box>
          )}
          {result?.text && result?.count > 0 && (
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
                {result.text}
              </Box>
            </Box>
          )}
          {error && <Box color="red">{error?.evalue}</Box>}
          {error?.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              <Box whiteSpace="pre-wrap" sx={{ fontSize: 10 }}>
                <Ansi>{error.stacktrace.join("\n")}</Ansi>
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
          <Box
            sx={{
              fontSize: 10,
              color: "rgb(151, 151, 151)",
              whiteSpace: "pre",
              paddingTop: "2px",
            }}
          >
            This output has been hidden.{" "}
          </Box>
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={{
              fontSize: 10,
              paddingTop: "3px",
              paddingBottom: "2px",
              lineHeight: "10px",
              zIndex: 201,
            }}
            size="small"
            variant="text"
          >
            Show it
          </Button>
        </Box>
      )}
    </Box>
  );
});

function MyFloatingToolbar({ id, layout, setLayout }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  const devMode = useStore(store, (state) => state.devMode);
  // const pod = useStore(store, (state) => state.pods[id]);
  const wsRun = useStore(store, (state) => state.wsRun);
  const wsRunChain = useStore(store, (state) => state.wsRunChain);
  const wsRunNoRewrite = useStore(store, (state) => state.wsRunNoRewrite);
  // right, bottom
  const getPod = useStore(store, (state) => state.getPod);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const clonePod = useStore(store, (state) => state.clonePod);
  const setPaneFocus = useStore(store, (state) => state.setPaneFocus);

  const onCopy = useCallback(
    (clipboardData: any) => {
      const pod = clonePod(id);
      if (!pod) return;
      clipboardData.setData("text/plain", pod.content);
      clipboardData.setData(
        "application/json",
        JSON.stringify({
          type: "pod",
          data: pod,
        })
      );
      setPaneFocus();
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
    <Box
      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {!isGuest && (
        <Tooltip title="Run (shift-enter)">
          <IconButton
            size="small"
            onClick={() => {
              wsRun(id);
            }}
          >
            <PlayCircleOutlineIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      {!isGuest && (
        <Tooltip title="Run chain">
          <IconButton
            size="small"
            onClick={() => {
              wsRunChain(id);
            }}
          >
            <KeyboardDoubleArrowRightIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      {!isGuest && (
        <Tooltip title="Run without rewrite">
          <IconButton
            size="small"
            onClick={() => {
              wsRunNoRewrite(id);
            }}
          >
            <PlayDisabledIcon fontSize="inherit" />
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
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => {
              // Delete all edges connected to the node.
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
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
      <Box className="custom-drag-handle" sx={{ cursor: "grab" }}>
        <DragIndicatorIcon fontSize="small" />
      </Box>
    </Box>
  );
}

export const CodeNode = memo<NodeProps>(function ({
  data,
  id,
  isConnectable,
  selected,
  // note that xPos and yPos are the absolute position of the node
  xPos,
  yPos,
}) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  const devMode = useStore(store, (state) => state.devMode);
  // right, bottom
  const [layout, setLayout] = useState("bottom");
  const isRightLayout = layout === "right";
  const setPodName = useStore(store, (state) => state.setPodName);
  const setPodGeo = useStore(store, (state) => state.setPodGeo);
  const getPod = useStore(store, (state) => state.getPod);

  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateView = useStore(store, (state) => state.updateView);
  const isCutting = useStore(store, (state) => state.cuttingIds.has(id));

  const showResult = useStore(
    store,
    (state) =>
      state.pods[id]?.running ||
      state.pods[id]?.result ||
      state.pods[id]?.error ||
      state.pods[id]?.stdout ||
      state.pods[id]?.stderr
  );
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));

  const onResize = useCallback(
    (e, data) => {
      const { size } = data;
      const node = nodesMap.get(id);
      if (node) {
        node.style = { ...node.style, width: size.width };
        nodesMap.set(id, node);
        setPodGeo(
          id,
          {
            parent: node.parentNode ? node.parentNode : "ROOT",
            x: node.position.x,
            y: node.position.y,
            width: size.width!,
            height: node.height!,
          },
          true
        );
        updateView();
      }
    },
    [id, nodesMap, setPodGeo, updateView]
  );

  const [showToolbar, setShowToolbar] = useState(false);
  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  // if (!pod) throw new Error(`Pod not found: ${id}`);

  if (!pod) {
    // FIXME this will be fired when removing a node. Why?
    console.log("[WARN] CodePod rendering pod not found", id);
    return null;
  }

  // onsize is banned for a guest, FIXME: ugly code
  const Wrap = (child) =>
    isGuest ? (
      <>{child}</>
    ) : (
      <Box
        sx={{
          "& .react-resizable-handle": {
            opacity: showToolbar ? 1 : 0,
          },
        }}
      >
        <ResizableBox
          onResizeStop={onResize}
          height={pod.height || 100}
          width={pod.width || 0}
          axis={"x"}
          minConstraints={[200, 200]}
        >
          <Box
            sx={{
              "& .react-resizable-handle": {
                opacity: 1,
              },
            }}
          >
            {child}
          </Box>
        </ResizableBox>
      </Box>
    );

  return (
    <>
      <Box
        onMouseEnter={() => {
          setShowToolbar(true);
        }}
        onMouseLeave={() => {
          setShowToolbar(false);
        }}
        sx={{
          cursor: "auto",
        }}
      >
        {Wrap(
          <Box
            id={"reactflow_node_code_" + id}
            sx={{
              border: "1px #d6dee6",
              borderWidth: pod.ispublic ? "4px" : "2px",
              borderRadius: "4px",
              borderStyle: isCutting ? "dashed" : "solid",
              width: "100%",
              height: "100%",
              backgroundColor: "rgb(244, 246, 248)",
              borderColor: isCutting
                ? "red"
                : pod.ispublic
                ? "green"
                : selected
                ? "#003c8f"
                : !isPodFocused
                ? "#d6dee6"
                : "#5e92f3",
            }}
          >
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

            {/* The header of code pods. */}
            <Box>
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
                  {id} at ({Math.round(xPos)}, {Math.round(yPos)}, w:{" "}
                  {pod.width}, h: {pod.height})
                </Box>
              )}
              <Box
                sx={{
                  position: "absolute",
                  top: "-24px",
                  width: "50%",
                }}
              >
                <InputBase
                  inputRef={inputRef}
                  className="nodrag"
                  defaultValue={data.name || ""}
                  disabled={isGuest}
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
                  }}
                  inputProps={{
                    style: {
                      padding: "0px",
                      textOverflow: "ellipsis",
                    },
                  }}
                ></InputBase>
              </Box>
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
              >
                <MyFloatingToolbar
                  id={id}
                  layout={layout}
                  setLayout={setLayout}
                />
              </Box>
            </Box>
            <Box
              sx={{
                height: "90%",
                py: 1,
              }}
            >
              <MyMonaco id={id} gitvalue="" />
              {showResult && (
                <Box
                  className="nowheel"
                  // This also prevents the wheel event from bubbling up to the parent.
                  // onWheelCapture={(e) => {
                  //   e.stopPropagation();
                  // }}
                  sx={{
                    border: "solid 1px #d6dee6",
                    borderRadius: "4px",
                    position: "absolute",
                    top: isRightLayout ? 0 : "100%",
                    left: isRightLayout ? "100%" : 0,
                    maxHeight: "160px",
                    maxWidth: isRightLayout ? "300px" : "100%",
                    minWidth: isRightLayout ? "150px" : "100%",
                    boxSizing: "border-box",
                    backgroundColor: "white",
                    zIndex: 100,
                    padding: "0 10px",
                  }}
                >
                  <ResultBlock id={id} />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
});
