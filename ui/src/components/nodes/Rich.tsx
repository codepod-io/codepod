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

import {
  BoldExtension,
  CalloutExtension,
  ItalicExtension,
  PlaceholderExtension,
  SubExtension,
  SupExtension,
  TextHighlightExtension,
  wysiwygPreset,
} from "remirror/extensions";
import {
  Remirror,
  EditorComponent,
  useRemirror,
  useCommands,
  useActive,
  WysiwygToolbar,
  TableComponents,
  ThemeProvider,
  ReactComponentExtension,
  HeadingLevelButtonGroup,
  VerticalDivider,
  FormattingButtonGroup,
  CommandButtonGroup,
  ListButtonGroup,
  CreateTableButton,
  DecreaseIndentButton,
  IncreaseIndentButton,
  TextAlignmentButtonGroup,
  IndentationButtonGroup,
  BaselineButtonGroup,
  CommandButton,
  CommandButtonProps,
} from "@remirror/react";
import { WysiwygEditor } from "@remirror/react-editors/wysiwyg";
import { FloatingToolbar } from "@remirror/react";
import { AllStyledComponent } from "@remirror/styles/emotion";
import { TableExtension } from "@remirror/extension-react-tables";
import { GenIcon, IconBase } from "@remirror/react-components";

import { htmlToProsemirrorNode } from "remirror";
import { styled } from "@mui/material";

const selectionKeys = ["Enter", "Space", "Escape", "Tab"];

export interface SetHighlightButtonProps
  extends Omit<
    CommandButtonProps,
    "commandName" | "active" | "enabled" | "attrs" | "onSelect" | "icon"
  > {}

export const SetHighlightButton: React.FC<
  SetHighlightButtonProps | { color: string }
> = ({ color = null, ...props }) => {
  const { setTextHighlight, removeTextHighlight } = useCommands();

  const handleSelect = useCallback(() => {
    if (color === null) {
      removeTextHighlight();
    } else {
      setTextHighlight(color);
    }
    // TODO toggle the bar
  }, [color, removeTextHighlight, setTextHighlight]);

  const enabled = true;

  return (
    <CommandButton
      {...props}
      commandName="setHighlight"
      label={color ? "Highlight" : "Un-Highlight"}
      enabled={enabled}
      onSelect={handleSelect}
      icon={
        <IconBase viewBox="0 0 24 24">
          color === null ? <DisabledByDefaultIcon /> :{" "}
          <RectangleIcon sx={{ color }} />
        </IconBase>
      }
    />
  );
};

const MyStyledWrapper = styled("div")(
  () => `
  .remirror-editor-wrapper {
    padding: 0;
  }
`
);

// FIXME re-rendering performance
const MyEditor = ({
  placeholder = "Start typing...",
  initialContent,
  id,
}: {
  placeholder?: string;
  initialContent?: string;
  id: string;
}) => {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const setPodContent = useStore(store, (state) => state.setPodContent);
  // initial content
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const setPodFocus = useStore(store, (state) => state.setPodFocus);
  const setPodBlur = useStore(store, (state) => state.setPodBlur);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const ref = useRef<HTMLDivElement>(null);
  const { manager, state, setState } = useRemirror({
    extensions: () => [
      new PlaceholderExtension({ placeholder }),
      // new BoldExtension(),
      // new ItalicExtension(),
      new ReactComponentExtension(),
      new TableExtension(),
      new TextHighlightExtension(),
      new SupExtension(),
      new SubExtension(),
      // new CalloutExtension({ defaultType: "warn" }),
      ...wysiwygPreset(),
    ],

    // Set the initial content.
    // content: "<p>I love <b>Remirror</b></p>",
    // content: "hello world",
    // content: initialContent,
    content: pod.content,

    // Place the cursor at the start of the document. This can also be set to
    // `end`, `all` or a numbered position.
    // selection: "start",

    // Set the string handler which means the content provided will be
    // automatically handled as html.
    // `markdown` is also available when the `MarkdownExtension`
    // is added to the editor.
    // stringHandler: "html",
    stringHandler: htmlToProsemirrorNode,
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (selectionKeys.indexOf(event.code) !== -1) {
        // avoid to re-select this node
        event.stopPropagation();
      }
    };
    if (!isPodFocused || !ref.current) return;
    ref.current?.addEventListener("keydown", handler);
    return () => {
      if (ref.current) ref.current.removeEventListener("keydown", handler);
    };
  }, [ref.current, isPodFocused]);

  return (
    <Box
      className="remirror-theme"
      onFocus={() => {
        // FIXME: it's a dummy update in nodesMap to trigger the local update to clear all selection
        if (resetSelection()) nodesMap.set(id, nodesMap.get(id) as Node);
        setPodFocus(id);
      }}
      onBlur={() => {
        setPodBlur(id);
      }}
      sx={{ userSelect: "text", cursor: "auto" }}
      ref={ref}
      overflow="auto"
    >
      <AllStyledComponent>
        <ThemeProvider>
          <MyStyledWrapper>
            <Remirror
              manager={manager}
              // initialContent={state}
              state={state}
              editable={!isGuest}
              // FIXME: onFocus is not working
              onChange={(parameter) => {
                let nextState = parameter.state;
                setState(nextState);
                // TODO sync with DB and yjs
                if (parameter.tr?.docChanged) {
                  setPodContent({ id, content: nextState.doc.toJSON() });
                }
              }}
            >
              {/* <WysiwygToolbar /> */}
              <EditorComponent />
              <TableComponents />

              {!isGuest && (
                <FloatingToolbar>
                  <CommandButtonGroup>
                    {/* <HeadingLevelButtonGroup /> */}
                    {/* <VerticalDivider /> */}
                    <FormattingButtonGroup />
                    {/* <ListButtonGroup /> */}
                    <SetHighlightButton color="lightpink" />
                    <SetHighlightButton color="yellow" />
                    <SetHighlightButton color="lightgreen" />
                    <SetHighlightButton color="lightcyan" />
                    <SetHighlightButton />
                  </CommandButtonGroup>
                  {/* <DecreaseIndentButton /> */}
                  {/* <IncreaseIndentButton /> */}
                  {/* <TextAlignmentButtonGroup /> */}
                  {/* <IndentationButtonGroup /> */}
                  {/* <BaselineButtonGroup /> */}
                </FloatingToolbar>
              )}
              {!isGuest && (
                <FloatingToolbar positioner="emptyBlockStart">
                  <HeadingLevelButtonGroup />
                </FloatingToolbar>
              )}
              {/* <Menu /> */}
            </Remirror>
          </MyStyledWrapper>
        </ThemeProvider>
      </AllStyledComponent>
    </Box>
  );
};

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
}) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // const pod = useStore(store, (state) => state.pods[id]);
  const setPodName = useStore(store, (state) => state.setPodName);
  const getPod = useStore(store, (state) => state.getPod);
  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const width = useStore(store, (state) => state.pods[id]?.width);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const index = useStore(
    store,
    (state) => state.pods[id]?.result?.count || " "
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const onResize = useCallback((e, data) => {
    const { size } = data;
    const node = nodesMap.get(id);
    if (node) {
      node.style = { ...node.style, width: size.width };
      nodesMap.set(id, node);
    }
  }, []);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));

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
      <ResizableBox
        onResizeStop={onResize}
        height={pod.height || 100}
        width={width || 0}
        axis={"x"}
        minConstraints={[200, 200]}
      >
        {child}
      </ResizableBox>
    );

  return Wrap(
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
      <Box className="custom-drag-handle">
        <Box
          sx={{
            height: "1em",
          }}
        ></Box>
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
        >
          {!isGuest && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => {
                  nodesMap.delete(id);
                }}
              >
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      <Box>
        <MyEditor id={id} />
      </Box>
    </Box>
  );
});
