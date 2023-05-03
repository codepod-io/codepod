import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";

import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";

import { useApolloClient } from "@apollo/client";

import { useStore } from "zustand";
import { RepoContext } from "../../lib/store";

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
import Ansi from "ansi-to-react";

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
import Grid from "@mui/material/Grid";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import RectangleIcon from "@mui/icons-material/Rectangle";
import DisabledByDefaultIcon from "@mui/icons-material/DisabledByDefault";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import { BubbleMenu, useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

function MyEditor({ id }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content: `
      <p>
        Hey, try to select some text here. There will popup a menu for selecting some inline styles. Remember: you have full control about content and styling of this menu.
      </p>
    `,
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }

    // update link
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return null;
    const url = window.prompt("URL");

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <Box>
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "is-active" : ""}
          >
            bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "is-active" : ""}
          >
            italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive("strike") ? "is-active" : ""}
          >
            strike
          </button>
          <button
            onClick={setLink}
            className={editor.isActive("link") ? "is-active" : ""}
          >
            setLink
          </button>
          <button
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
          >
            unsetLink
          </button>
          <button onClick={addImage}>setImage</button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} style={{ padding: 1 }} />
    </Box>
  );
}

function MyFloatingToolbar({ id }: { id: string }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  return (
    <>
      {!isGuest && (
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => {
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      <Box className="custom-drag-handle" sx={{ cursor: "grab" }}>
        <DragIndicatorIcon fontSize="small" />
      </Box>
    </>
  );
}

/**
 * The React Flow node.
 */

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;
  selected: boolean;
  // note that xPos and yPos are the absolute position of the node
  xPos: number;
  yPos: number;
}

export const RichNode = memo<Props>(function ({
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
  const setPodName = useStore(store, (state) => state.setPodName);
  const getPod = useStore(store, (state) => state.getPod);
  const setPodGeo = useStore(store, (state) => state.setPodGeo);
  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const width = useStore(store, (state) => state.pods[id]?.width);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const devMode = useStore(store, (state) => state.devMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const updateView = useStore(store, (state) => state.updateView);
  const reactFlowInstance = useReactFlow();

  const [showToolbar, setShowToolbar] = useState(false);

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

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  if (!pod) return null;

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
        {" "}
        {Wrap(
          <Box
            sx={{
              border: "solid 1px #d6dee6",
              borderWidth: "2px",
              borderRadius: "4px",
              width: "100%",
              height: "100%",
              backgroundColor: "white",
              borderColor: pod.ispublic
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
            <Box>
              {devMode && (
                <Box
                  sx={{
                    position: "absolute",
                    top: "-48px",
                    bottom: "0px",
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
                  alignItems: "center",
                }}
              >
                <MyFloatingToolbar id={id} />
              </Box>
            </Box>
            <Box>
              <MyEditor id={id} />
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
});
