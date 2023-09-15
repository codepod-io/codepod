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
  NodeResizeControl,
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
import HeightIcon from "@mui/icons-material/Height";

import { ResizableBox } from "react-resizable";
import Ansi from "ansi-to-react";

import { useStore } from "zustand";
import { shallow } from "zustand/shallow";

import { RepoContext } from "../../lib/store";

import { MyMonaco } from "../MyMonaco";

import { Handles, level2fontsize } from "./utils";
import { timeDifference } from "../../lib/utils/utils";
import { ButtonGroup } from "@mui/material";

import { ConfirmDeleteButton } from "./utils";
import { useApolloClient } from "@apollo/client";

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
      Last run: {timeDifference(new Date(), new Date(lastExecutedAt))}
    </Box>
  );
}

export const ResultBlock = memo<any>(function ResultBlock({ id, layout }) {
  const [showOutput, setShowOutput] = useState(true);
  const [resultScroll, setResultScroll] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const store = useContext(RepoContext)!;
  // TODO run autolayout after result change.
  // TODO run autolayout when pod size changes caused by content change.
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const clearResults = useStore(store, (state) => state.clearResults);
  // monitor result change
  // FIXME performance: would this trigger re-render of all pods?
  const resultChanged = useStore(store, (state) => state.resultChanged[id]);
  // This is a dummy useEffect to indicate resultChanged is used.
  useEffect(() => {}, [resultChanged]);
  const resultMap = useStore(store, (state) => state.getResultMap());
  const result = resultMap.get(id);
  if (!result) {
    return null;
  }
  const results = result.data;
  const error = result.error;
  const running = result.running;
  const exec_count = result.exec_count;

  const lastExecutedAt = result.lastExecutedAt;

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
            <CheckCircleIcon style={{ marginTop: "5px" }} fontSize="small" />{" "}
            <Timer lastExecutedAt={lastExecutedAt} />
          </Box>
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
          {(exec_count || error) && showMenu && (
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

          {exec_count && (
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
          )}

          {results && results.length > 0 && (
            <Box
              sx={{
                display: "flex",
                fontSize: "0.8em",
                flexDirection: "column",
                alignItems: "left",
                borderTop: "1px solid rgb(214, 222, 230)",
              }}
            >
              {results.map((res, i) => {
                const combinedKey = `${res.type}-${i}`;
                switch (res.type) {
                  case "stream_stdout":
                    return (
                      <Box
                        component="pre"
                        whiteSpace="pre-wrap"
                        key={combinedKey}
                        sx={{ fontSize: "0.8em", margin: 0, padding: 0 }}
                      >
                        <Ansi>{res.text}</Ansi>
                      </Box>
                    );
                  case "stream_stderr":
                    return (
                      <Box
                        component="pre"
                        whiteSpace="pre-wrap"
                        key={combinedKey}
                        sx={{ fontSize: "0.8em", margin: 0, padding: 0 }}
                      >
                        <Ansi>{res.text}</Ansi>
                      </Box>
                    );
                  case "display_data":
                    // TODO html results
                    return (
                      <Box
                        component="pre"
                        whiteSpace="pre-wrap"
                        key={combinedKey}
                      >
                        {res.text}
                        {res.html && (
                          <div dangerouslySetInnerHTML={{ __html: res.html }} />
                        )}
                        {res.image && (
                          <img
                            src={`data:image/png;base64,${res.image}`}
                            alt="output"
                          />
                        )}
                      </Box>
                    );
                  case "execute_result":
                    return (
                      <Box
                        component="pre"
                        whiteSpace="pre-wrap"
                        key={combinedKey}
                        sx={{
                          fontSize: "0.8em",
                          margin: 0,
                          padding: 0,
                          borderTop: "1px solid rgb(214, 222, 230)",
                        }}
                      >
                        {res.text}
                        {res.html && (
                          <div dangerouslySetInnerHTML={{ __html: res.html }} />
                        )}
                      </Box>
                    );
                  default:
                    return <Box key="unknown">[WARN] Unknown Result</Box>;
                }
              })}
            </Box>
          )}
          {error && <Box color="red">{error?.evalue}</Box>}
          {error?.stacktrace && error?.stacktrace.length > 0 && (
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
  const yjsRun = useStore(store, (state) => state.yjsRun);
  const yjsRunChain = useStore(store, (state) => state.yjsRunChain);
  const apolloClient = useApolloClient();
  // right, bottom
  const editMode = useStore(store, (state) => state.editMode);
  const editing = editMode === "edit";

  const zoomLevel = useReactFlowStore((s) => s.transform[2]);
  const iconFontSize = zoomLevel < 1 ? `${1.5 * (1 / zoomLevel)}rem` : `1.5rem`;

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
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
      {editing && (
        <Tooltip title="Run (shift-enter)">
          <IconButton
            onClick={() => {
              yjsRun(id, apolloClient);
            }}
          >
            <PlayCircleOutlineIcon style={{ fontSize: iconFontSize }} />
          </IconButton>
        </Tooltip>
      )}
      {editing && (
        <Tooltip title="Run chain">
          <IconButton
            onClick={() => {
              yjsRunChain(id, apolloClient);
            }}
          >
            <KeyboardDoubleArrowRightIcon style={{ fontSize: iconFontSize }} />
          </IconButton>
        </Tooltip>
      )}
      {editing && (
        <Tooltip style={{ fontSize: iconFontSize }} title="Delete">
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
          <ViewComfyIcon style={{ fontSize: iconFontSize }} />
        </IconButton>
      </Tooltip>
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
  const editMode = useStore(store, (state) => state.editMode);
  const focusedEditor = useStore(store, (state) => state.focusedEditor);
  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateView = useStore(store, (state) => state.updateView);

  const nodesMap = useStore(store, (state) => state.getNodesMap());
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

  // A helper state to allow single-click a selected pod and enter edit mode.
  const [singleClickEdit, setSingleClickEdit] = useState(false);
  useEffect(() => {
    if (!selected) setSingleClickEdit(false);
  }, [selected, setSingleClickEdit]);

  const node = nodesMap.get(id);
  if (!node) return null;

  const fontSize = level2fontsize(
    node.data.level,
    contextualZoomParams,
    contextualZoom
  );

  if (contextualZoom && fontSize * zoomLevel < threshold) {
    // Return a collapsed block.
    let text = "<some code>";
    // let text = pod.content;
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
          height: node.height,
          width: node.width,
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

  return (
    <>
      <Box
        onMouseEnter={() => {
          setShowToolbar(true);
        }}
        onMouseLeave={() => {
          setShowToolbar(false);
        }}
        onClick={() => {
          if (singleClickEdit) {
            setFocusedEditor(id);
          } else {
            setSingleClickEdit(true);
          }
        }}
        onDoubleClick={() => {
          setFocusedEditor(id);
        }}
        sx={{
          cursor: "auto",
          fontSize,
        }}
        className={focusedEditor === id ? "nodrag" : "custom-drag-handle"}
      >
        <Box
          id={"reactflow_node_code_" + id}
          sx={{
            border: "1px #d6dee6",
            borderWidth: false // FIXME pod.ispublic
              ? "4px"
              : "2px",
            borderRadius: "4px",
            borderStyle: "solid",
            width: "100%",
            minWidth: "300px",
            // This is the key to let the node auto-resize w.r.t. the content.
            height: "auto",
            minHeight: "50px",
            backgroundColor: "rgb(244, 246, 248)",
            borderColor: false // FIXME pod.ispublic
              ? "green"
              : selected
              ? "#003c8f"
              : focusedEditor !== id
              ? "#d6dee6"
              : "#003c8f",
          }}
        >
          <NodeResizeControl
            style={{
              background: "transparent",
              border: "none",
              // make it above the pod
              zIndex: 100,
              // put it to the right-bottom corner, instead of right-middle.
              top: "100%",
              // show on hover
              opacity: showToolbar ? 1 : 0,
              color: "red",
            }}
            minWidth={300}
            minHeight={50}
            // this allows the resize happens in X-axis only.
            position="right"
            onResizeEnd={() => {
              // remove style.height so that the node auto-resizes.
              const node = nodesMap.get(id);
              if (node) {
                nodesMap.set(id, {
                  ...node,
                  style: { ...node.style, height: undefined },
                });
              }
              if (autoRunLayout) {
                autoLayoutROOT();
              }
            }}
          >
            <HeightIcon
              sx={{
                transform: "rotate(90deg)",
                position: "absolute",
                right: 5,
                bottom: 5,
              }}
            />
          </NodeResizeControl>
          <Box
            sx={{
              opacity: showToolbar ? 1 : 0,
            }}
          >
            <Handles
              width={node.width}
              height={node.height}
              parent={node.parentNode}
              xPos={xPos}
              yPos={yPos}
            />
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
                {id} at ({Math.round(xPos)}, {Math.round(yPos)}, w: {node.width}
                , h: {node.height}), parent: {node.parentNode} level:{" "}
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
                disabled={editMode === "view"}
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
            <Box
              sx={{
                // Put it 100% the width and height, above the following components.
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: focusedEditor === id ? -1 : 10,
              }}
            >
              {/* Overlay */}
            </Box>
            <MyMonaco id={id} fontSize={fontSize} />
            <ResultBlock id={id} layout={layout} />
          </Box>
        </Box>
      </Box>
    </>
  );
});
