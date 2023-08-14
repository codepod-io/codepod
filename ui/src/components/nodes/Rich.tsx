import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
  useMemo,
} from "react";
import * as React from "react";

import Moveable from "react-moveable";
import { ResizableBox } from "react-resizable";

import { useApolloClient } from "@apollo/client";

import { useStore } from "zustand";
import { shallow } from "zustand/shallow";

import * as Y from "yjs";

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
  useStore as useReactFlowStore,
} from "reactflow";
import Ansi from "ansi-to-react";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatColorResetIcon from "@mui/icons-material/FormatColorReset";

import {
  BoldExtension,
  CalloutExtension,
  DropCursorExtension,
  ImageExtension,
  ItalicExtension,
  PlaceholderExtension,
  ShortcutHandlerProps,
  SubExtension,
  SupExtension,
  TextHighlightExtension,
  createMarkPositioner,
  wysiwygPreset,
  MarkdownExtension,
  TOP_50_TLDS,
  BidiExtension,
  GapCursorExtension,
  ShortcutsExtension,
  TrailingNodeExtension,
  HardBreakExtension,
  HorizontalRuleExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HeadingExtension,
  IframeExtension,
  CodeExtension,
  StrikeExtension,
  UnderlineExtension,
  EmojiExtension,
} from "remirror/extensions";
import emojiData from "svgmoji/emoji.json";

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
  useChainedCommands,
  useCurrentSelection,
  useAttrs,
  useUpdateReason,
  FloatingWrapper,
  useMention,
  useKeymap,
  ToggleBoldButton,
  ToggleItalicButton,
  ToggleUnderlineButton,
  ToggleCodeButton,
  ToggleStrikeButton,
} from "@remirror/react";
import { FloatingToolbar, useExtensionEvent } from "@remirror/react";

import { InputRule } from "@remirror/pm";
import { markInputRule } from "@remirror/core-utils";

import { TableExtension } from "@remirror/extension-react-tables";
import { GenIcon, IconBase } from "@remirror/react-components";
import "remirror/styles/all.css";
import { styled } from "@mui/material";

// Local Imports

import { MyYjsExtension } from "./extensions/YjsRemirror";
import {
  MathInlineExtension,
  MathBlockExtension,
} from "./extensions/mathExtension";
import {
  BulletListExtension,
  OrderedListExtension,
  TaskListExtension,
} from "./extensions/list";

import { CodePodSyncExtension } from "./extensions/codepodSync";

import { LinkExtension, LinkToolbar } from "./extensions/link";
import { SlashExtension } from "./extensions/slash";
import { SlashSuggestor } from "./extensions/useSlash";
import { BlockHandleExtension } from "./extensions/blockHandle";

import { ConfirmDeleteButton, Handles, level2fontsize } from "./utils";
import { RepoContext } from "../../lib/store";

import "./remirror-size.css";

/**
 * This is the toolbar when user select some text. It allows user to change the
 * markups of the text, e.g. bold, italic, underline, highlight, etc.
 */
const EditorToolbar = () => {
  return (
    <>
      <FloatingToolbar
        // By default, MUI's Popper creates a Portal, which is a ROOT html
        // elements that prevents paning on reactflow canvas. Therefore, we
        // disable the portal behavior.
        disablePortal
        sx={{
          button: {
            padding: 0,
            border: "none",
            borderRadius: "5px",
            marginLeft: "5px",
          },
          paddingX: "4px",
          border: "2px solid grey",
          borderRadius: "5px",
          alignItems: "center",
          backgroundColor: "white",
        }}
      >
        <ToggleBoldButton />
        <ToggleItalicButton />
        <ToggleUnderlineButton />
        <ToggleStrikeButton />
        <ToggleCodeButton />
        <SetHighlightButton color="lightpink" />
        <SetHighlightButton color="yellow" />
        <SetHighlightButton color="lightgreen" />
        <SetHighlightButton color="lightcyan" />
        <SetHighlightButton />

        {/* <TextAlignmentButtonGroup /> */}
        {/* <IndentationButtonGroup /> */}
        {/* <BaselineButtonGroup /> */}
      </FloatingToolbar>
    </>
  );
};

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
      label={color ? "Highlight" : "Clear Highlight"}
      enabled={enabled}
      onSelect={handleSelect}
      icon={
        color ? (
          <Box
            sx={{
              backgroundColor: color,
              paddingX: "4px",
              borderRadius: "4px",
              lineHeight: 1.2,
            }}
          >
            A
          </Box>
        ) : (
          <FormatColorResetIcon />
        )
      }
    />
  );
};

const MyStyledWrapper = styled("div")(
  () => `
  .remirror-editor-wrapper {
    padding: 0;
  }

  /* leave some space for the block handle */
  .remirror-editor-wrapper .ProseMirror {
    padding-left: 24px;
  }
`
);

function HotkeyControl({ id }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const setCursorNode = useStore(store, (state) => state.setCursorNode);
  const focusedEditor = useStore(store, (state) => state.focusedEditor);
  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);
  const selectPod = useStore(store, (state) => state.selectPod);

  useKeymap("Escape", () => {
    setCursorNode(id);
    setFocusedEditor(undefined);
    selectPod(id, true);
    return true;
  });
  const commands = useCommands();
  useEffect(() => {
    if (focusedEditor === id) {
      commands.focus();
    } else {
      commands.blur();
    }
  }, [focusedEditor]);
  return <></>;
}

// FIXME re-rendering performance
const MyEditor = ({
  placeholder = "Start typing...",
  id,
}: {
  placeholder?: string;
  id: string;
}) => {
  // FIXME this is re-rendered all the time.
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  // the Yjs extension for Remirror
  const provider = useStore(store, (state) => state.provider)!;

  const focusedEditor = useStore(store, (state) => state.focusedEditor);
  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const updateView = useStore(store, (state) => state.updateView);
  const richMap = useStore(store, (state) => state.getRichMap());
  if (!richMap.has(id)) {
    richMap.set(id, new Y.XmlFragment());
  }
  const yXml = richMap.get(id) as Y.XmlFragment;

  const { manager, state, setState } = useRemirror({
    extensions: () => [
      new PlaceholderExtension({ placeholder }),
      new ReactComponentExtension(),
      new TableExtension(),
      new TextHighlightExtension(),
      new SupExtension(),
      new SubExtension(),
      new MarkdownExtension(),
      new MyYjsExtension({ yXml, awareness: provider.awareness }),
      new MathInlineExtension(),
      new MathBlockExtension(),
      // new CalloutExtension({ defaultType: "warn" }),
      // Plain
      new BidiExtension(),
      new DropCursorExtension(),
      new GapCursorExtension(),
      new ShortcutsExtension(),
      new TrailingNodeExtension(),
      // Nodes
      new HardBreakExtension(),
      new ImageExtension({ enableResizing: true }),
      new HorizontalRuleExtension(),
      new BlockquoteExtension(),
      new CodeBlockExtension(),
      new HeadingExtension(),
      new IframeExtension(),
      new BulletListExtension(),
      new OrderedListExtension(),
      new TaskListExtension(),

      // Marks
      new BoldExtension(),
      new CodeExtension(),
      new StrikeExtension(),
      new ItalicExtension(),
      new LinkExtension({
        autoLink: true,
        autoLinkAllowedTLDs: ["dev", ...TOP_50_TLDS],
      }),
      new UnderlineExtension(),
      new EmojiExtension({ data: emojiData, plainText: true }),
      new SlashExtension({
        extraAttributes: { type: "user" },
        matchers: [
          { name: "slash", char: "/", appendText: " ", matchOffset: 0 },
        ],
      }),
      new BlockHandleExtension(),
    ],
    onError: ({ json, invalidContent, transformers }) => {
      // Automatically remove all invalid nodes and marks.
      console.log("removing invalidContent", invalidContent);
      return transformers.remove(json, invalidContent);
    },

    // Set the initial content.
    // content: "<p>I love <b>Remirror</b></p>",
    // content: "hello world",
    // content: initialContent,
    // FIXME initial content should not be set.
    // content: pod.content == "" ? pod.richContent : pod.content,

    // Place the cursor at the start of the document. This can also be set to
    // `end`, `all` or a numbered position.
    // selection: "start",

    // Set the string handler which means the content provided will be
    // automatically handled as html.
    // `markdown` is also available when the `MarkdownExtension`
    // is added to the editor.
    // stringHandler: "html",
    // stringHandler: htmlToProsemirrorNode,
    // FIXME handle markdown import/export when we migrate to Yjs for everything.
    stringHandler: "markdown",
  });

  // Printing the schema for backend JSON2YXML conversion. This is useful for
  // parsing the prosemirror JSON doc format in the backend (search `json2yxml`
  // funciton).
  //
  // const obj = { nodes: {}, marks: {},
  // };
  // manager.schema.spec.nodes.forEach((k, v) => { console.log("k", k, "v", v);
  //   obj["nodes"][k] = v;
  // });
  // manager.schema.spec.marks.forEach((k, v) => { console.log("k", k, "v", v);
  //   obj["marks"][k] = v;
  // });
  // console.log("obj", JSON.stringify(obj));

  return (
    <Box
      className="remirror-theme"
      onFocus={() => {
        setFocusedEditor(id);
        if (resetSelection()) updateView();
      }}
      onBlur={() => {
        setFocusedEditor(undefined);
      }}
      sx={{
        userSelect: "text",
        cursor: "auto",
        // Display different markers for different levels in nested ordered lists.
        ol: {
          listStylType: "decimal",
        },
        "ol li ol": {
          listStyleType: "lower-alpha",
        },
        "ol li ol li ol": {
          listStyleType: "lower-roman",
        },
      }}
      overflow="auto"
    >
      <ThemeProvider>
        <MyStyledWrapper>
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
          <Remirror
            manager={manager}
            // Must set initialContent, otherwise the Reactflow will fire two
            // dimension change events at the beginning. This should be caused
            // by initialContent being empty, then the actual content. Setting
            // it to the actual content at the beginning will prevent this.
            initialContent={state}
            // Should not set state and onChange (the controlled Remirror editor
            // [1]), otherwise Chinsee (or CJK) input methods will not be
            // supported [2].
            // - [1] https://remirror.io/docs/controlled-editor
            // - [2] demo that Chinese input method is not working:
            //   https://remirror.vercel.app/?path=/story/editors-controlled--editable
          >
            <HotkeyControl id={id} />
            {/* <WysiwygToolbar /> */}
            <EditorComponent />

            <TableComponents />
            <SlashSuggestor />

            {!isGuest && <EditorToolbar />}
            <LinkToolbar />

            {/* <Menu /> */}
          </Remirror>
        </MyStyledWrapper>
      </ThemeProvider>
    </Box>
  );
};

function MyFloatingToolbar({ id }: { id: string }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const reactFlowInstance = useReactFlow();
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const zoomLevel = useReactFlowStore((s) => s.transform[2]);
  const iconFontSize = zoomLevel < 1 ? `${1.5 * (1 / zoomLevel)}rem` : `1.5rem`;

  return (
    <>
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
        <Tooltip title="Delete">
          <ConfirmDeleteButton
            size="small"
            handleConfirm={() => {
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
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const cursorNode = useStore(store, (state) => state.cursorNode);
  const focusedEditor = useStore(store, (state) => state.focusedEditor);
  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);

  // A helper state to allow single-click a selected pod and enter edit mode.
  const [singleClickEdit, setSingleClickEdit] = useState(false);
  useEffect(() => {
    if (!selected) setSingleClickEdit(false);
  }, [selected, setSingleClickEdit]);

  const devMode = useStore(store, (state) => state.devMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const updateView = useStore(store, (state) => state.updateView);
  const reactFlowInstance = useReactFlow();

  const [showToolbar, setShowToolbar] = useState(false);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);

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
        updateView();
        if (autoRunLayout) {
          autoLayoutROOT();
        }
      }
    },
    [id, nodesMap, updateView, autoLayoutROOT]
  );

  const { width, height, parent } = useReactFlowStore(
    (s) => {
      const node = s.nodeInternals.get(id)!;

      return {
        width: node.width,
        height: node.height,
        parent: node.parentNode,
      };
    },
    // Need to use shallow here. Otherwise, the node will keep re-rendering.
    shallow
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

  useEffect(() => {
    if (cursorNode === id) {
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  }, [cursorNode]);

  const node = nodesMap.get(id);
  if (!node) return null;

  const fontSize = level2fontsize(
    node?.data.level,
    contextualZoomParams,
    contextualZoom
  );

  if (contextualZoom && fontSize * zoomLevel < threshold) {
    // Return a collapsed block.
    let text = "<some rich text>";
    // if (pod.content) {
    //   // let json = JSON.parse(pod.content);
    //   const plain = prosemirrorToPlainText(pod.content);
    //   text = plain.split("\n")[0];
    // }
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
          height: height,
          width: width,
          color: "darkorchid",
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
          height={height || 100}
          width={width || 0}
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
          // hide drag handle
          const elems = document.getElementsByClassName("global-drag-handle");
          Array.from(elems).forEach((elem) => {
            (elem as HTMLElement).style.display = "none";
          });
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
              borderColor: false // FIXME pod.ispublic
                ? "green"
                : selected
                ? "#003c8f"
                : focusedEditor !== id
                ? "#d6dee6"
                : "#003c8f",
            }}
          >
            <Box
              sx={{
                opacity: showToolbar ? 1 : 0,
              }}
            >
              <Handles
                width={width}
                height={height}
                parent={parent}
                xPos={xPos}
                yPos={yPos}
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
                  {id} at ({Math.round(xPos)}, {Math.round(yPos)}, w: {width},
                  h: {height})
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
                  zIndex: 10,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <MyFloatingToolbar id={id} />
              </Box>
            </Box>
            <MyEditor id={id} />
          </Box>
        )}
      </Box>
    </>
  );
});

function prosemirrorToPlainText(prosemirrorJson) {
  let plainText = "";

  // Iterate through each node in the prosemirror JSON object
  prosemirrorJson.content.forEach((node) => {
    // Handle each node type
    switch (node.type) {
      // Handle paragraph nodes
      case "paragraph": {
        // Iterate through each child of the paragraph
        if (node.content) {
          node.content.forEach((child) => {
            // If the child is text, add its value to the plainText string
            if (child.type === "text") {
              plainText += child.text;
            }
          });
          // Add a newline character after the paragraph
          plainText += "\n";
        }
        break;
      }
      // Handle heading nodes
      case "heading": {
        // Add the heading text to the plainText string
        node.content.forEach((child) => {
          // If the child is text, add its value to the plainText string
          if (child.type === "text") {
            plainText += child.text;
          }
        });
        // Add two newline characters after the heading
        plainText += "\n\n";
        break;
      }
      // Handle other node types
      default: {
        // If the node has content, recursively call the function on its content
        if (node.content) {
          plainText += prosemirrorToPlainText(node);
        }
        break;
      }
    }
  });

  return plainText;
}
