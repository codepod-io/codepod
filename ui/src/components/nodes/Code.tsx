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
import { Handles, level2fontsize } from "./utils";
import { timeDifference } from "../../lib/utils";
import { ButtonGroup } from "@mui/material";

import { ConfirmDeleteButton } from "./utils";

function Timer({ lastExecutedAt }) {
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <Box
      sx={{
        padding: "5px",
      }}
    >
      Last run: {timeDifference(new Date(), lastExecutedAt)}
    </Box>
  );
}

export const ResultBlock = memo<any>(function ResultBlock({ id, layout }) {
  const store = useContext(RepoContext)!;
  const result = useStore(store, (state) => state.pods[id]?.result);
  const error = useStore(store, (state) => state.pods[id]?.error);
  const stdout = useStore(store, (state) => state.pods[id]?.stdout);
  const running = useStore(store, (state) => state.pods[id]?.running || false);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);

  const prevRunning = useRef(false);
  useEffect(() => {
    if (autoRunLayout) {
      if (prevRunning.current != running) {
        autoLayoutROOT();
        prevRunning.current = running;
      }
    }
  }, [running]);

  const lastExecutedAt = useStore(
    store,
    (state) => state.pods[id]?.lastExecutedAt
  );
  const [showOutput, setShowOutput] = useState(true);
  const hasResult = useStore(
    store,
    (state) =>
      state.pods[id]?.running ||
      state.pods[id]?.result ||
      state.pods[id]?.error ||
      state.pods[id]?.stdout ||
      state.pods[id]?.stderr
  );
  const [resultScroll, setResultScroll] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const clearResults = useStore(store, (state) => state.clearResults);
  if (!hasResult) return <></>;
  return (
    <Box
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
      // This ID is used for autolayout.
      //
      // TODO save result box position to DB.
      id={layout === "right" ? `result-${id}-right` : `result-${id}-bottom`}
      // This also prevents the wheel event from bubbling up to the parent.
      // onWheelCapture={(e) => {
      //   e.stopPropagation();
      // }}
      className={showOutput && resultScroll ? "nowheel" : ""}
      sx={{
        border:
          showOutput && resultScroll ? "solid 1px red" : "solid 1px #d6dee6",
        borderRadius: "4px",
        position: "absolute",
        top: layout === "right" ? 0 : "100%",
        left: layout === "right" ? "100%" : 0,
        ...(layout === "right"
          ? { minWidth: "250px" }
          : { maxWidth: "100%", minWidth: "100%" }),
        boxSizing: "border-box",
        backgroundColor: "white",
        zIndex: 100,
        padding: "0 10px",
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
              {lastExecutedAt && !error && (
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
                      // FIXME: Why not a complete oval?
                      // borderBottomLeftRadius: "20px",
                      // borderBottomRightRadius: "20px",
                      display: "flex",
                      fontSize: "0.8em",
                    }}
                  >
                    <CheckCircleIcon
                      style={{ marginTop: "5px" }}
                      fontSize="inherit"
                    />{" "}
                    <Timer lastExecutedAt={lastExecutedAt} />
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
          maxHeight="1000px"
          border="1px"
        >
          {/* FIXME result?.count is not correct, always 0 or 1. */}
          {(stdout || (result?.text && result?.count > 0) || error) &&
            showMenu && (
              <ButtonGroup
                sx={{
                  // border: '1px solid #757ce8',
                  fontSize: "0.8em",
                  backgroundColor: "white",
                  zIndex: 201,
                  position: "absolute",
                  top: "10px",
                  right: "25px",
                  // "& .MuiButton-root": {
                  //   fontSize: ".9em",
                  //   paddingTop: 0,
                  //   paddingBottom: 0,
                  // },
                }}
                variant="contained"
                size="small"
                aria-label="outlined primary button group"
                // orientation="vertical"
              >
                <Box
                  sx={{
                    color: "primary.main",
                    fontWeight: "bold",
                    display: "flex",
                    padding: "5px 5px",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Output options:
                </Box>
                <Button
                  onClick={() => {
                    setResultScroll(!resultScroll);
                  }}
                >
                  {resultScroll ? "Unfocus" : "Focus"}
                </Button>
                <Button
                  onClick={() => {
                    setShowOutput(!showOutput);
                  }}
                >
                  Hide
                </Button>
                <Button
                  onClick={() => {
                    clearResults(id);
                  }}
                >
                  Clear
                </Button>
              </ButtonGroup>
            )}

          {stdout && (
            <Box
              whiteSpace="pre-wrap"
              sx={{ fontSize: "0.8em", paddingBottom: 1 }}
            >
              <Ansi>{stdout}</Ansi>
            </Box>
          )}
          {result?.text && result?.count > 0 && (
            <Box
              sx={{
                display: "flex",
                fontSize: "0.8em",
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
              <Box whiteSpace="pre-wrap" sx={{ fontSize: "0.8em" }}>
                <Ansi>{error.stacktrace.join("\n")}</Ansi>
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            padding: "10px",
            display: "flex",
            justifyContent: "center",
            alignItems: "bottom",
          }}
        >
          <Box
            sx={{
              fontSize: "0.8em",
              color: "rgb(151, 151, 151)",
              whiteSpace: "pre",
              paddingTop: "2px",
            }}
          >
            Output hidden.{" "}
          </Box>
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={{
              fontSize: "0.8em",
              // lineHeight: "8px",
              zIndex: 201,
            }}
            size="small"
            variant="contained"
          >
            Reveal
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
  // right, bottom
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
      <Box
        className="custom-drag-handle"
        sx={{
          cursor: "grab",
          fontSize: "1.5rem",
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
            onClick={() => {
              wsRunChain(id);
            }}
          >
            <KeyboardDoubleArrowRightIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      <CopyToClipboard
        text="dummy"
        options={{ debug: true, format: "text/plain", onCopy } as any}
      >
        <Tooltip title="Copy">
          <IconButton className="copy-button">
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
            <IconButton>
              <ContentCutIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </CopyToClipboard>
      )}
      {!isGuest && (
        <Tooltip title="Delete">
          <ConfirmDeleteButton
            handleConfirm={() => {
              // Delete all edges connected to the node.
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          />
        </Tooltip>
      )}
      <Tooltip title="Change layout">
        <IconButton
          onClick={() => {
            setLayout(layout === "bottom" ? "right" : "bottom");
          }}
        >
          <ViewComfyIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Box
        className="custom-drag-handle"
        sx={{
          cursor: "grab",
          fontSize: "1.5rem",
          padding: "8px",
          display: "inline-flex",
        }}
      >
        <DragIndicatorIcon fontSize="inherit" />
      </Box>
    </Box>
  );
}

export const CodeNode = memo<NodeProps>(function ({
  data,
  id,
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
  const setPodName = useStore(store, (state) => state.setPodName);
  const setPodGeo = useStore(store, (state) => state.setPodGeo);
  const getPod = useStore(store, (state) => state.getPod);

  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const cursorNode = useStore(store, (state) => state.cursorNode);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateView = useStore(store, (state) => state.updateView);
  const exec_count = useStore(
    store,
    (state) => state.pods[id]?.result?.count || " "
  );
  const isCutting = useStore(store, (state) => state.cuttingIds.has(id));

  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);

  const prevLayout = useRef(layout);
  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    if (autoRunLayout) {
      // Run auto-layout when the output box layout changes.
      if (prevLayout.current != layout) {
        autoLayoutROOT();
        prevLayout.current = layout;
      }
    }
  }, [layout]);

  useEffect(() => {
    if (cursorNode === id) {
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  }, [cursorNode]);

  const onResizeStop = useCallback(
    (e, data) => {
      const { size } = data;
      const node = nodesMap.get(id);
      if (node) {
        // new width
        nodesMap.set(id, {
          ...node,
          width: size.width,
          style: { ...node.style, width: size.width },
        });
        setPodGeo(
          id,
          {
            parent: node.parentNode ? node.parentNode : "ROOT",
            x: node.position.x,
            y: node.position.y,
            // new width
            width: size.width!,
            height: node.height!,
          },
          true
        );
        updateView();
        if (autoRunLayout) {
          autoLayoutROOT();
        }
      }
    },
    [id, nodesMap, setPodGeo, updateView, autoLayoutROOT]
  );

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  const zoomLevel = useReactFlowStore((s) => s.transform[2]);
  const contextualZoom = useStore(store, (state) => state.contextualZoom);
  const contextualZoomParams = useStore(
    store,
    (state) => state.contextualZoomParams
  );
  const threshold = useStore(
    store,
    (state) => state.contextualZoomParams.threshold
  );

  // if (!pod) throw new Error(`Pod not found: ${id}`);

  if (!pod) {
    // FIXME this will be fired when removing a node. Why?
    console.log("[WARN] CodePod rendering pod not found", id);
    return null;
  }

  const node = nodesMap.get(id);

  const fontSize = level2fontsize(
    node?.data.level,
    contextualZoomParams,
    contextualZoom
  );

  if (contextualZoom && fontSize * zoomLevel < threshold) {
    // Return a collapsed block.
    let text = pod.content;
    if (text) {
      const index = text.indexOf("\n");
      if (index !== -1) {
        text = text.substring(0, index);
      }
    }
    text = text || "Empty";
    return (
      <Box
        sx={{
          fontSize: fontSize * 2,
          background: "#eee",
          borderRadius: "5px",
          border: "5px solid red",
          // Offset the border to prevent the node height from changing.
          margin: "-5px",
          textAlign: "center",
          height: pod.height,
          width: pod.width,
          color: "green",
        }}
        className="custom-drag-handle"
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
          onResizeStop={onResizeStop}
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
          fontSize,
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
              <Handles pod={pod} xPos={xPos} yPos={yPos} />
            </Box>

            {/* The header of code pods. */}
            <Box>
              {devMode && (
                <Box
                  sx={{
                    position: "absolute",
                    userSelect: "text",
                    cursor: "auto",
                    // place it at the top left corner, above the pod
                    top: 0,
                    left: 0,
                    transform: "translate(0, -100%)",
                    background: "rgba(255, 255, 255, 0.8)",
                    padding: "5px",
                    lineHeight: "1.2",
                    color: "#000",
                  }}
                  className="nodrag"
                >
                  {id} at ({Math.round(xPos)}, {Math.round(yPos)}, w:{" "}
                  {pod.width}, h: {pod.height}), parent: {pod.parent} level:{" "}
                  {node?.data.level} fontSize: {fontSize}
                </Box>
              )}
              {/* We actually don't need the name for a pod. Users can just write comments. */}
              <Box
                sx={{
                  position: "absolute",
                  // place it at the top left corner, above the pod
                  top: 0,
                  left: 0,
                  transform: "translate(0, -100%)",
                  padding: "5px",
                  lineHeight: "1.2",
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
                  color: "#8b8282",
                  textAlign: "left",
                  paddingLeft: "5px",
                  fontSize: "12px",
                }}
              >
                [{exec_count}]
              </Box>
              <Box
                sx={{
                  opacity: showToolbar ? 1 : 0,
                  borderRadius: "4px",
                  position: "absolute",
                  border: "solid 1px #d6dee6",
                  // put it in the top right corner, above the pod
                  top: 0,
                  right: 0,
                  transform: "translate(0, -100%)",
                  background: "white",
                  zIndex: 10,
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
              <MyMonaco id={id} fontSize={fontSize} />

              <ResultBlock id={id} layout={layout} />
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
});
