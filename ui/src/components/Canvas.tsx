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
import Grid from "@mui/material/Grid";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";
import Ansi from "ansi-to-react";

import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

import { useStore } from "zustand";

import { RepoContext, RoleType } from "../lib/store";
import {
  useNodesStateSynced,
  resetSelection,
  parent as commonParent,
} from "../lib/nodes";

import { MyMonaco } from "./MyMonaco";
import { useApolloClient } from "@apollo/client";
import { CanvasContextMenu } from "./CanvasContextMenu";
import styles from "./canvas.style.js";
import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./RichNode";

const nanoid = customAlphabet(lowercase + numbers, 20);

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;
  selected: boolean;
  // note that xPos and yPos are the absolute position of the node
  xPos: number;
  yPos: number;
}

const ScopeNode = memo<Props>(function ScopeNode({
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
  const flow = useReactFlow();
  const setPodName = useStore(store, (state) => state.setPodName);
  const updatePod = useStore(store, (state) => state.updatePod);
  const setPodPosition = useStore(store, (state) => state.setPodPosition);
  const setPodParent = useStore(store, (state) => state.setPodParent);
  const [target, setTarget] = React.useState<any>();
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const [frame] = React.useState({
    translate: [0, 0],
  });
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const role = useStore(store, (state) => state.role);
  const inputRef = useRef<HTMLInputElement>(null);

  const deleteNodeById = useCallback(
    (id: string) => {
      flow.deleteElements({
        nodes: [
          {
            id,
          },
        ],
      });
    },
    [flow]
  );

  const onResize = useCallback(({ width, height, offx, offy }) => {
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width, height };
      node.position.x += offx;
      node.position.y += offy;
      nodesMap.set(id, node);
    }
  }, []);

  useEffect(() => {
    setTarget(ref.current);
  }, []);

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name || "" });
    if (inputRef?.current) {
      inputRef.current.value = data.name;
    }
  }, [data.name, id, setPodName]);

  useEffect(() => {
    // get relative position
    const node = nodesMap.get(id);
    if (node?.position) {
      // update pods[id].position but don't trigger DB update (dirty: false)
      setPodPosition({
        id,
        x: node.position.x,
        y: node.position.y,
        dirty: false,
      });
    }
  }, [xPos, yPos, setPodPosition, id]);

  useEffect(() => {
    if (data.parent && data.parent !== "ROOT") {
      setPodParent({ id, parent: data.parent, dirty: false });
    }
  }, [data.parent, setPodParent, id]);

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
        {role !== RoleType.GUEST && (
          <Tooltip title="Delete" className="nodrag">
            <IconButton
              size="small"
              onClick={(e: any) => {
                e.stopPropagation();
                e.preventDefault();
                deleteNodeById(id);
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
        className="custom-drag-handle"
        // bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
      >
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
                disabled={role === RoleType.GUEST}
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
      {selected && role !== RoleType.GUEST && (
        <Moveable
          target={target}
          resizable={true}
          keepRatio={false}
          throttleResize={1}
          renderDirections={["e", "s", "se"]}
          edge={false}
          zoom={1}
          origin={false}
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

// FIXME: the resultblock is rendered every time the parent codeNode changes (e.g., dragging), we may set the result number as a state of a pod to memoize the resultblock.

function ResultBlock({ pod, id }) {
  const store = useContext(RepoContext);
  const [showOutput, setShowOutput] = useState(true);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  return (
    <Box
      sx={{
        minHeight: pod.height,
      }}
    >
      {pod.result && (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {pod.result.html ? (
            <div dangerouslySetInnerHTML={{ __html: pod.result.html }}></div>
          ) : (
            <>
              {!pod.error && (
                <Box
                  color="rgb(0, 183, 87)"
                  sx={{
                    padding: "6px",
                    zIndex: 200,
                  }}
                >
                  <Box sx={styles["result-status__success"]}>
                    <CheckCircleIcon
                      style={{ marginTop: "5px" }}
                      fontSize="inherit"
                    />
                  </Box>
                </Box>
              )}
            </>
          )}
          {pod.result.image && (
            <img
              src={`data:image/png;base64,${pod.result.image}`}
              alt="output"
            />
          )}
        </Box>
      )}

      {pod.running && <CircularProgress />}
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
              styles["hidden-btn"],
              {
                position: "absolute",
                top: 0,
                right: 0,
                zIndex: 201,
              },
            ]}
            variant="text"
            size="small"
          >
            Hide output
          </Button>
          {pod.stdout && (
            <Box whiteSpace="pre-wrap" sx={{ fontSize: 10, paddingBottom: 1 }}>
              <Ansi>{pod.stdout}</Ansi>
            </Box>
          )}
          {pod?.result?.text && pod?.result?.count > 0 && (
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
                {pod.result.text}
              </Box>
            </Box>
          )}
          {pod?.error && <Box color="red">{pod?.error?.evalue}</Box>}
          {pod?.error?.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              <Box whiteSpace="pre-wrap" sx={{ fontSize: 10 }}>
                <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
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
          <Box sx={styles["hidden-hint"]}>This output has been hidden. </Box>
          <Button
            onClick={() => {
              setShowOutput(!showOutput);
            }}
            sx={styles["hidden-btn"]}
            size="small"
            variant="text"
          >
            Show it
          </Button>
        </Box>
      )}
    </Box>
  );
}

const CodeNode = memo<Props>(function ({
  data,
  id,
  isConnectable,
  selected,
  xPos,
  yPos,
}) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // const pod = useStore(store, (state) => state.pods[id]);
  const wsRun = useStore(store, (state) => state.wsRun);
  const clearResults = useStore(store, (s) => s.clearResults);
  const ref = useRef(null);
  const [target, setTarget] = React.useState<any>(null);
  const [frame] = React.useState({
    translate: [0, 0],
  });
  // right, bottom
  const [layout, setLayout] = useState("bottom");
  const isRightLayout = layout === "right";
  const setPodName = useStore(store, (state) => state.setPodName);
  const setPodPosition = useStore(store, (state) => state.setPodPosition);
  const setCurrentEditor = useStore(store, (state) => state.setCurrentEditor);
  const setPodParent = useStore(store, (state) => state.setPodParent);
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);
  const role = useStore(store, (state) => state.role);
  const width = useStore(store, (state) => state.pods[id]?.width);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const index = useStore(
    store,
    (state) => state.pods[id]?.result?.count || " "
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const showResult = useStore(
    store,
    (state) =>
      state.pods[id]?.running ||
      state.pods[id]?.result ||
      state.pods[id]?.error ||
      state.pods[id]?.stdout ||
      state.pods[id]?.stderr
  );
  const onResize = useCallback((e, data) => {
    const { size } = data;
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width: size.width };
      nodesMap.set(id, node);
    }
  }, []);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const apolloClient = useApolloClient();
  const deletePod = useStore(store, (state) => state.deletePod);
  const deleteNodeById = (id) => {
    deletePod(apolloClient, { id: id, toDelete: [] });
    nodesMap.delete(id);
  };

  useEffect(() => {
    setTarget(ref.current);
  }, []);

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  useEffect(() => {
    // get relative position
    const node = nodesMap.get(id);
    if (node?.position) {
      // update pods[id].position but don't trigger DB update (dirty: false)
      setPodPosition({
        id,
        x: node.position.x,
        y: node.position.y,
        dirty: false,
      });
    }
  }, [xPos, yPos, setPodPosition, id]);

  useEffect(() => {
    if (data.parent !== undefined) {
      setPodParent({ id, parent: data.parent, dirty: false });
    }
  }, [data.parent, setPodParent, id]);

  const getPicture = async (pod) => {
    const requesOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: pod.content }),
      mode: "no-cors" as RequestMode,
      accept: "image/png",
    };
    const res = await fetch("http://localhost:3099/api/cook", requesOptions);
    const pic = await res.blob();
    // navigator.clipboard.write([new ClipboardItem({ "image/png": pic })]);
  };

  const onCopy = useCallback(
    async (clipboardData: any) => {
      const pod = getPod(id);
      if (!pod) return;

      clipboardData.setData("text/plain", "");
      // clipboardData.clearData();
      // clipboardData.setData(
      //   "application/json",
      //   JSON.stringify({
      //     type: "pod",
      //     data: pod,
      //   })
      // );
      getPicture(pod);
      console.log("copied", clipboardData);
    },
    [getPod, id]
  );

  if (!pod) return null;

  // onsize is banned for a guest, FIXME: ugly code
  const Wrap = (child) =>
    role === RoleType.GUEST ? (
      <>{child}</>
    ) : (
      <ResizableBox
        onResizeStop={onResize}
        height={pod.height || 100}
        width={width}
        axis={"x"}
        minConstraints={[200, 200]}
      >
        {child}
      </ResizableBox>
    );

  return Wrap(
    <Box
      id={"reactflow_node_code_" + id}
      sx={{
        border: "solid 1px #d6dee6",
        borderWidth: pod.ispublic ? "4px" : "2px",
        borderRadius: "4px",
        width: "100%",
        height: "100%",
        backgroundColor: "rgb(244, 246, 248)",
        borderColor: pod.ispublic
          ? "green"
          : selected
          ? "#003c8f"
          : !isPodFocused
          ? "#d6dee6"
          : "#5e92f3",
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
      {/* The header of code pods. */}
      <Box className="custom-drag-handle">
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
            disabled={role === RoleType.GUEST}
            onBlur={(e) => {
              const name = e.target.value;
              if (name === data.name) return;
              const node = nodesMap.get(id);
              if (node) {
                nodesMap.set(id, { ...node, data: { ...node.data, name } });
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
        <Box sx={styles["pod-index"]}>[{index}]</Box>
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
          className="nodrag"
          onClick={(e) => {
            const pane = document.getElementsByClassName(
              "react-flow__pane"
            )[0] as HTMLElement;
            if (pane) {
              pane.tabIndex = 0;
              pane.focus();
            }
          }}
        >
          {role !== RoleType.GUEST && (
            <Tooltip title="Run (shift-enter)">
              <IconButton
                size="small"
                onClick={() => {
                  clearResults(id);
                  wsRun(id);
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
              <IconButton size="small">
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </CopyToClipboard>
          {role !== RoleType.GUEST && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => {
                  deleteNodeById(id);
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
        </Box>
      </Box>
      <Box
        sx={{
          height: "90%",
        }}
      >
        <MyMonaco id={id} gitvalue="" />
        {showResult && (
          <Box
            className="nowheel"
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
            <ResultBlock pod={pod} id={id} />
          </Box>
        )}
      </Box>
    </Box>
  );
});

const nodeTypes = { scope: ScopeNode, code: CodeNode, rich: RichNode };

const level2color = {
  0: "rgba(187, 222, 251, 0.5)",
  1: "rgba(144, 202, 249, 0.5)",
  2: "rgba(100, 181, 246, 0.5)",
  3: "rgba(66, 165, 245, 0.5)",
  4: "rgba(33, 150, 243, 0.5)",
  // default: "rgba(255, 255, 255, 0.2)",
  default: "rgba(240,240,240,0.25)",
};

function getAbsPos({ node, nodesMap }) {
  let x = node.position.x;
  let y = node.position.y;
  if (node.parentNode) {
    // FIXME performance.
    let [dx, dy] = getAbsPos({
      node: nodesMap.get(node.parentNode),
      nodesMap,
    });
    return [x + dx, y + dy];
  } else {
    return [x, y];
  }
}

/**
 * For historical reason, the state.pod.type and DB schema pod.type are "CODE",
 * "DECK", "WYSIWYG", while the node types in react-flow are "code", "scope",
 * "rich". These two functions document this and handle the conversion.
 * @param dbtype
 * @returns
 */
function dbtype2nodetype(dbtype: string) {
  switch (dbtype) {
    case "CODE":
      return "code";
    case "DECK":
      return "scope";
    case "WYSIWYG":
      return "rich";
    default:
      throw new Error(`unknown dbtype ${dbtype}`);
  }
}

function nodetype2dbtype(nodetype: string) {
  switch (nodetype) {
    case "code":
      return "CODE";
    case "scope":
      return "DECK";
    case "rich":
      return "WYSIWYG";
    default:
      throw new Error(`unknown nodetype ${nodetype}`);
  }
}

export function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesStateSynced([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [pasting, setPasting] = useState<null | string>(null);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // the real pods
  const getId2children = useStore(store, (state) => state.getId2children);
  // const pods = useStore(store, (state) => state.pods);
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const repoId = useStore(store, (state) => state.repoId);
  const role = useStore(store, (state) => state.role);
  const provider = useStore(store, (state) => state.provider);
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shareOpen = useStore(store, (state) => state.shareOpen);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);

  const getRealNodes = useCallback(
    (id: string, level: number) => {
      let res: any[] = [];
      let children = getId2children(id) || [];
      const pod = getPod(id);
      if (id !== "ROOT") {
        res.push({
          id: id,
          type: dbtype2nodetype(pod.type),
          data: {
            // label: `ID: ${id}, parent: ${pods[id].parent}, pos: ${pods[id].x}, ${pods[id].y}`,
            label: id,
            name: pod.name,
            parent: pod.parent,
          },
          // position: { x: 100, y: 100 },
          position: { x: pod.x, y: pod.y },
          parentNode: pod.parent !== "ROOT" ? pod.parent : undefined,
          extent: "parent",
          level,
          style: {
            backgroundColor:
              pod.type !== "DECK"
                ? undefined
                : level2color[level] || level2color["default"],
            width: pod.width || undefined,
            // for code node, don't set height, let it be auto
            height: pod.height || undefined,
          },
          dragHandle: ".custom-drag-handle",
        });
      }
      for (const child of children) {
        res = res.concat(getRealNodes(child, level + 1));
      }
      return res;
    },
    [getId2children, getPod]
  );
  useEffect(() => {
    const init = () => {
      let nodes = getRealNodes("ROOT", -1);
      nodes.forEach((node) => {
        if (!nodesMap.has(node.id)) {
          console.log("add node", node.id, node);
          nodesMap.set(node.id, node);
        }
      });
      setNodes(
        Array.from(nodesMap.values())
          .filter(
            (node) =>
              !node.data.hasOwnProperty("clientId") ||
              node.data.clientId === clientId
          )
          .sort((a: Node & { level }, b: Node & { level }) => a.level - b.level)
      );
    };

    if (!provider) return;
    if (provider.synced) {
      init();
    } else {
      provider.once("synced", init);
    }
    // check if the nodesMap on the websocket has already been initialized with node info

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

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
  const clientId = useStore(
    store,
    (state) => state.provider?.awareness?.clientID
  );

  const addNode = useCallback(
    (x: number, y: number, type: "code" | "scope" | "rich") => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let style;

      switch (type) {
        case "scope":
          style = {
            backgroundColor: level2color[0],
            width: 600,
            height: 600,
          };
          break;
        case "code":
        case "rich":
          style = {
            width: 300,
            // we must not set the height here, otherwise the auto layout will not work
            height: undefined,
          };
          break;
        default:
          throw new Error(`unknown type ${type}`);
      }

      const position = reactFlowInstance.project({
        x: x - reactFlowBounds.left,
        y: y - reactFlowBounds.top,
      });
      let id = nanoid();
      const newNode = {
        id,
        type,
        position,
        style,
        data: {
          label: id,
          name: "",
          parent: "ROOT",
        },
        level: 0,
        extent: "parent",
        //otherwise, throws a lot of warnings, see https://reactflow.dev/docs/guides/troubleshooting/#only-child-nodes-can-use-a-parent-extent
        parentNode: undefined,
        dragHandle: ".custom-drag-handle",
      };

      // setNodes((nds) => nds.concat(newNode));

      // add to pods
      addPod(apolloClient, {
        id,
        parent: "ROOT",
        type: nodetype2dbtype(type),
        lang: "python",
        x: position.x,
        y: position.y,
        width: style.width,
        height: style.height,
        dirty: true,
      });

      nodesMap.set(id, newNode as any);
    },

    [addPod, apolloClient, nodesMap, reactFlowInstance]
  );

  const getScopeAt = useCallback(
    (x: number, y: number, ids: string[]) => {
      const scope = nodes.findLast((node) => {
        let [x1, y1] = getAbsPos({ node, nodesMap });
        return (
          node.type === "scope" &&
          x >= x1 &&
          !ids.includes(node.id) &&
          x <= x1 + node.style.width &&
          y >= y1 &&
          y <= y1 + node.style.height
        );
      });
      return scope;
    },
    [nodes, nodesMap]
  );

  /**
   * @param {string} node The node to be moved.
   * @param {string} event The event that triggered the move.
   *
   * This function is called when a node is moved. It will do two things:
   * 1. Update the position of the node in the redux store.
   * 2. Check if the node is moved into a scope. If so, update the parent of the node.
   */

  // FIXME: add awareness info when dragging
  const onNodeDragStart = () => {};

  // Check if the nodes can be dropped into a scope when moving ends

  const checkNodesEndLocation = useCallback(
    (event, nodes: Node[], commonParent: string | undefined) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      // This mouse position is absolute within the canvas.
      const mousePos = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const scope = getScopeAt(
        mousePos.x,
        mousePos.y,
        nodes.map((n) => n.id)
      );

      // FIXME: a better way to do this: check if the commonParent is the ancestor of the scope
      if (commonParent !== undefined && commonParent !== "ROOT") {
        const currentParent = nodesMap.get(commonParent);
        if (currentParent) {
          console.log("currentParent", currentParent);
          if (
            mousePos.x < currentParent.positionAbsolute!.x ||
            mousePos.x >
              currentParent.positionAbsolute!.x + currentParent.width! ||
            mousePos.y < currentParent.positionAbsolute!.y ||
            mousePos.y >
              currentParent.positionAbsolute!.y + currentParent.height!
          ) {
            // the mouse is outside the current parent, the nodes can't be dragged out
            // console.log("Cannot drop outside parent scope");
            // but position should also be updated
            nodes.forEach((node) => {
              setPodPosition({
                id: node.id,
                x: node.position.x,
                y: node.position.y,
                dirty: true,
              });
            });
            return;
          }
        }
      }

      // no target scope, or the target scope is the same as the current parent
      if (!scope || scope.id === commonParent) {
        // only update position and exit, avoid updating parentNode
        nodes.forEach((node) => {
          setPodPosition({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            dirty: true,
          });
        });
        return;
      }

      // update the level of a node as well as its all descendants
      function updateLevel(id: string, level: number) {
        const node = nodesMap.get(id);
        if (node) {
          (node as any).level = level;
          node.style!.backgroundColor = level2color[level];
          nodesMap.set(id, node);
          getPod(id)?.children.forEach(({ id }) => updateLevel(id, level + 1));
        }
      }

      // check if this position is inside parent scope
      nodes.forEach((node) => {
        let absX = node.position.x;
        let absY = node.position.y;

        console.log("dropped into scope:", scope);
        // compute the actual position
        let [dx, dy] = getAbsPos({ node: scope, nodesMap });
        absX = node.positionAbsolute!.x - dx;
        absY = node.positionAbsolute!.y - dy;
        // auto-align the node to, keep it bound in the scope
        // FIXME: it assumes the scope must be larger than the node

        absX = Math.max(absX, 0);
        absX = Math.min(absX, scope.width! - node.width!);
        absY = Math.max(absY, 0);
        absY = Math.min(absY, scope.height! - node.height!);

        setPodParent({
          id: node.id,
          parent: scope.id,
          dirty: true,
        });

        const currentNode = nodesMap.get(node.id);
        if (currentNode) {
          currentNode.parentNode = scope.id;
          currentNode.data!.parent = scope.id;
          currentNode.position = { x: absX, y: absY };
          nodesMap.set(node.id, currentNode);
        }

        updateLevel(node.id, scope.level + 1);

        // update
        setPodPosition({
          id: node.id,
          x: absX,
          y: absY,
          dirty: true,
        });
      });
    },
    [
      reactFlowInstance,
      getScopeAt,
      setPodPosition,
      nodesMap,
      setPodParent,
      getPod,
    ]
  );

  const onNodeDragStop = useCallback(
    // handle nodes list as multiple nodes can be dragged together at once
    (event, _n: Node, nodes: Node[]) => {
      checkNodesEndLocation(event, nodes, commonParent);
    },
    [checkNodesEndLocation]
  );

  const onNodesDelete = useCallback(
    (nodes) => {
      // remove from pods
      for (const node of nodes) {
        deletePod(apolloClient, { id: node.id, toDelete: [] });
      }
    },
    [apolloClient, deletePod]
  );

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    // just for debug
    // console.log("selection changed", nodes, edges);
    // setSelection({nodes, edges});
  }, []);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [client, setClient] = useState({ x: 0, y: 0 });

  const onPaneContextMenu = (event) => {
    console.log("onPaneContextMenu", event);
    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
    console.log(showContextMenu, points, client);
  };

  const pasteCodePod = useCallback(
    (pod) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      let [posX, posY] = [
        reactFlowBounds.width / 2,
        reactFlowBounds.height / 2,
      ];
      const position = reactFlowInstance.project({ x: posX, y: posY });
      position.x = (position.x - pod.width! / 2) as number;
      position.y = (position.y - (pod.height ?? 0) / 2) as number;

      const style = {
        width: pod.width,
        height: undefined,
        // create a temporary half-transparent pod
        opacity: 0.5,
      };

      const id = nanoid();
      const newNode = {
        id,
        type: "code",
        position,
        data: {
          name: pod?.name || "",
          label: id,
          parent: "ROOT",
          clientId,
        },
        // the temporary pod should always be in the most front, set the level to a large number
        level: 114514,
        extent: "parent",
        parentNode: undefined,
        dragHandle: ".custom-drag-handle",
        style,
      };

      // create an informal (temporary) pod in local, without remote addPod
      addPod(null, {
        id,
        parent: "ROOT",
        type: "CODE",
        lang: "python",
        x: position.x,
        y: position.y,
        width: pod.width,
        height: pod.height,
        content: pod.content,
        error: pod.error,
        stdout: pod.stdout,
        result: pod.result,
        name: pod.name,
      });

      nodesMap.set(id, newNode as any);
      setPasting(id);
    },
    [addPod, clientId, nodesMap, reactFlowInstance, setPasting]
  );

  useEffect(() => {
    const handleClick = (e) => {
      setShowContextMenu(false);
    };
    const handlePaste = (event) => {
      // avoid duplicated pastes
      if (pasting || role === RoleType.GUEST) return;

      // only paste when the pane is focused
      if (
        event.target?.className !== "react-flow__pane" &&
        document.activeElement?.className !== "react-flow__pane"
      )
        return;

      try {
        // the user clipboard data is unpreditable, may have application/json from other source that can't be parsed by us, use try-catch here.
        const playload = event.clipboardData.getData("application/json");
        const data = JSON.parse(playload);
        if (data?.type !== "pod") {
          return;
        }
        // clear the selection, make the temporary front-most
        resetSelection();
        pasteCodePod(data.data);
        // make the pane unreachable by keyboard (escape), or a black border shows up in the pane when pasting is canceled.
        const pane = document.getElementsByClassName("react-flow__pane")[0];
        if (pane && pane.hasAttribute("tabindex")) {
          pane.removeAttribute("tabindex");
        }
      } catch (e) {
        console.log("paste error", e);
      }
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("paste", handlePaste);
    };
  }, [pasteCodePod, pasting]);

  useEffect(() => {
    if (!pasting || !reactFlowWrapper.current) {
      return;
    }

    const mouseMove = (event) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      const node = nodesMap.get(pasting);
      if (!node) return;
      node.position = position;
      nodesMap.set(pasting, node);
    };
    const mouseClick = (event) => {
      const node = nodesMap.get(pasting);
      if (!node) return;
      const newNode = {
        ...node,
        level: 0,
        style: {
          width: node.style?.width,
          height: node.style?.height,
        },
        data: {
          name: node.data?.name,
          label: node.data?.label,
          parent: node.data?.parent,
        },
      };
      const pod = getPod(pasting);
      // delete the temporary node
      nodesMap.delete(pasting);
      // add the formal pod in place under root
      addPod(apolloClient, {
        ...pod,
      } as any);
      nodesMap.set(pasting, newNode);

      // check if the formal node is located in a scope, if it is, change its parent
      const currentNode = reactFlowInstance.getNode(pasting);
      checkNodesEndLocation(event, [currentNode], "ROOT");
      //clear the pasting state
      setPasting(null);
    };
    const keyDown = (event) => {
      if (event.key !== "Escape") return;
      // delete the temporary node
      nodesMap.delete(pasting);
      setPasting(null);
      //clear the pasting state
      event.preventDefault();
    };
    reactFlowWrapper.current.addEventListener("mousemove", mouseMove);
    reactFlowWrapper.current.addEventListener("click", mouseClick);
    document.addEventListener("keydown", keyDown);
    return () => {
      if (reactFlowWrapper.current) {
        reactFlowWrapper.current.removeEventListener("mousemove", mouseMove);
        reactFlowWrapper.current.removeEventListener("click", mouseClick);
      }
      document.removeEventListener("keydown", keyDown);
      // FIXME(XINYI): auto focus on pane after finishing pasting should be set here, however, Escape triggers the tab selection on the element with tabindex=0, shows a black border on the pane. So I disable it.
    };
  }, [
    pasting,
    reactFlowWrapper,
    setPasting,
    getPod,
    deletePod,
    addPod,
    apolloClient,
    reactFlowInstance,
    nodesMap,
    checkNodesEndLocation,
  ]);

  const onPaneClick = (event) => {
    // focus
    event.target.tabIndex = 0;
  };

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
          onPaneClick={onPaneClick}
          // onPaneMouseMove={onPaneMouseMove}
          onSelectionChange={onSelectionChange}
          attributionPosition="top-right"
          maxZoom={10}
          minZoom={0.1}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          zoomOnScroll={false}
          panOnScroll={true}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={role !== RoleType.GUEST}
          // disable node delete on backspace when the user is a guest.
          deleteKeyCode={role === RoleType.GUEST ? null : "Backspace"}
          multiSelectionKeyCode={isMac ? "Meta" : "Control"}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.borderColor) return n.style.borderColor;
                if (n.type === "code") return "#d6dee6";
                if (n.type === "scope") return "#f4f6f8";

                return "#d6dee6";
              }}
              nodeColor={(n) => {
                if (n.style?.backgroundColor) return n.style.backgroundColor;

                return "#f4f6f8";
              }}
              nodeBorderRadius={2}
            />
            <Controls showInteractive={role !== RoleType.GUEST} />

            <Background />
          </Box>
        </ReactFlow>
        {showContextMenu && (
          <CanvasContextMenu
            x={points.x}
            y={points.y}
            addCode={() => addNode(client.x, client.y, "code")}
            addScope={() => addNode(client.x, client.y, "scope")}
            addRich={() => addNode(client.x, client.y, "rich")}
            onShareClick={() => {
              setShareOpen(true);
            }}
          />
        )}
        {shareOpen && <ShareProjDialog open={shareOpen} id={repoId || ""} />}
      </Box>
    </Box>
  );
}
