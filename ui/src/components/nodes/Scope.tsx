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
import Grid from "@mui/material/Grid";
import DeleteIcon from "@mui/icons-material/Delete";
import Moveable from "react-moveable";

import { useStore } from "zustand";

import { RepoContext, RoleType } from "../../lib/store";

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;
  selected: boolean;
  // note that xPos and yPos are the absolute position of the node
  xPos: number;
  yPos: number;
}

export const ScopeNode = memo<Props>(function ScopeNode({
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
