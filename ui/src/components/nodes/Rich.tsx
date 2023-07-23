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
  useStore as useReactFlowStore,
} from "reactflow";
import "reactflow/dist/style.css";
import Ansi from "ansi-to-react";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatColorResetIcon from "@mui/icons-material/FormatColorReset";

import {
  BoldExtension,
  CalloutExtension,
  DropCursorExtension,
  ImageExtension,
  ItalicExtension,
  LinkExtension as RemirrorLinkExtension,
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
  useChainedCommands,
  useCurrentSelection,
  useAttrs,
  useUpdateReason,
  FloatingWrapper,
  useMention,
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
import "./remirror-size.css";
import { styled } from "@mui/material";

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

import { NewPodButtons, level2fontsize } from "./utils";

class LinkExtension extends RemirrorLinkExtension {
  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: /\[([^\]]+)\]\(([^)]+)\)/,
        type: this.type,
        getAttributes: (matches: string[]) => {
          const [_, text, href] = matches;
          return { text: text, href: href };
        },
      }),
      markInputRule({
        regexp: /(?:==|__)([^*_]+)(?:==|__)$/,
        type: this.type,
        ignoreWhitespace: true,
      }),
    ];
  }
}

function useLinkShortcut() {
  const [linkShortcut, setLinkShortcut] = useState<
    ShortcutHandlerProps | undefined
  >();
  const [isEditing, setIsEditing] = useState(false);

  useExtensionEvent(
    LinkExtension,
    "onShortcut",
    useCallback(
      (props) => {
        if (!isEditing) {
          setIsEditing(true);
        }

        return setLinkShortcut(props);
      },
      [isEditing]
    )
  );

  return { linkShortcut, isEditing, setIsEditing };
}

function useFloatingLinkState() {
  const chain = useChainedCommands();
  const { isEditing, linkShortcut, setIsEditing } = useLinkShortcut();
  const { to, empty } = useCurrentSelection();

  const url = (useAttrs().link()?.href as string) ?? "";
  const [href, setHref] = useState<string>(url);

  // A positioner which only shows for links.
  const linkPositioner = React.useMemo(
    () => createMarkPositioner({ type: "link" }),
    []
  );

  const onRemove = useCallback(() => {
    return chain.removeLink().focus().run();
  }, [chain]);

  const updateReason = useUpdateReason();

  React.useLayoutEffect(() => {
    if (!isEditing) {
      return;
    }

    if (updateReason.doc || updateReason.selection) {
      setIsEditing(false);
    }
  }, [isEditing, setIsEditing, updateReason.doc, updateReason.selection]);

  useEffect(() => {
    setHref(url);
  }, [url]);

  const submitHref = useCallback(() => {
    setIsEditing(false);
    const range = linkShortcut ?? undefined;

    if (href === "") {
      chain.removeLink();
    } else {
      chain.updateLink({ href, auto: false }, range);
    }

    chain.focus(range?.to ?? to).run();
  }, [setIsEditing, linkShortcut, chain, href, to]);

  const cancelHref = useCallback(() => {
    setIsEditing(false);
  }, [setIsEditing]);

  const clickEdit = useCallback(() => {
    if (empty) {
      chain.selectLink();
    }

    setIsEditing(true);
  }, [chain, empty, setIsEditing]);

  return React.useMemo(
    () => ({
      href,
      setHref,
      linkShortcut,
      linkPositioner,
      isEditing,
      clickEdit,
      onRemove,
      submitHref,
      cancelHref,
    }),
    [
      href,
      linkShortcut,
      linkPositioner,
      isEditing,
      clickEdit,
      onRemove,
      submitHref,
      cancelHref,
    ]
  );
}

const DelayAutoFocusInput = ({
  autoFocus,
  ...rest
}: React.HTMLProps<HTMLInputElement>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [autoFocus]);

  return <input ref={inputRef} {...rest} />;
};

function useUpdatePositionerOnMove() {
  // Update (all) the positioners whenever there's a move (pane) on reactflow,
  // so that the toolbar moves with the Rich pod and content.
  const { forceUpdatePositioners, emptySelection } = useCommands();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const moved = useStore(store, (state) => state.moved);
  const clicked = useStore(store, (state) => state.clicked);
  useEffect(() => {
    forceUpdatePositioners();
  }, [moved]);
  useEffect(() => {
    emptySelection();
  }, [clicked]);
  return;
}

/**
 * This is a two-buttons toolbar when user click on a link. The first button
 * edits the link, the second button opens the link.
 */
const LinkToolbar = () => {
  const {
    isEditing,
    linkPositioner,
    clickEdit,
    onRemove,
    submitHref,
    href,
    setHref,
    cancelHref,
  } = useFloatingLinkState();
  useUpdatePositionerOnMove();
  const { empty } = useCurrentSelection();

  const handleClickEdit = useCallback(() => {
    clickEdit();
  }, [clickEdit]);

  return (
    <>
      {!isEditing && empty && (
        // By default, MUI's Popper creates a Portal, which is a ROOT html
        // elements that prevents paning on reactflow canvas. Therefore, we
        // disable the portal behavior.
        <FloatingToolbar
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
          // The default positinoer will cause the toolbar only show on text
          // selection. This linkPositioner allows the toolbar to be shown
          // without any text selection
          positioner={linkPositioner}
        >
          <CommandButton
            commandName="updateLink"
            aria-label="Edit link"
            onSelect={handleClickEdit}
            icon="pencilLine"
            enabled
          />
          <CommandButton
            commandName="removeLink"
            aria-label="Open link"
            onSelect={() => {
              window.open(href, "_blank");
            }}
            icon="externalLinkFill"
            enabled
          />
        </FloatingToolbar>
      )}

      <FloatingWrapper
        positioner="always"
        placement="bottom"
        enabled={isEditing}
        renderOutsideEditor
      >
        <DelayAutoFocusInput
          style={{ zIndex: 20 }}
          autoFocus
          placeholder="Enter link..."
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setHref(event.target.value)
          }
          value={href}
          onKeyPress={(event: React.KeyboardEvent<HTMLInputElement>) => {
            const { code } = event;

            if (code === "Enter") {
              submitHref();
            }

            if (code === "Escape") {
              cancelHref();
            }
          }}
        />
      </FloatingWrapper>
    </>
  );
};

/**
 * This is the toolbar when user select some text. It allows user to change the
 * markups of the text, e.g. bold, italic, underline, highlight, etc.
 */
const EditorToolbar = () => {
  useUpdatePositionerOnMove();
  const {
    isEditing,
    linkPositioner,
    clickEdit,
    onRemove,
    submitHref,
    href,
    setHref,
    cancelHref,
  } = useFloatingLinkState();
  const active = useActive();
  const activeLink = active.link();
  const handleClickEdit = useCallback(() => {
    clickEdit();
  }, [clickEdit]);

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
        {!activeLink && (
          <CommandButton
            commandName="updateLink"
            aria-label="Add link"
            onSelect={handleClickEdit}
            icon="link"
            enabled
          />
        )}
        <SetHighlightButton color="lightpink" />
        <SetHighlightButton color="yellow" />
        <SetHighlightButton color="lightgreen" />
        <SetHighlightButton color="lightcyan" />
        <SetHighlightButton />

        {/* <TextAlignmentButtonGroup /> */}
        {/* <IndentationButtonGroup /> */}
        {/* <BaselineButtonGroup /> */}
      </FloatingToolbar>

      <FloatingWrapper
        positioner="always"
        placement="bottom"
        enabled={isEditing}
        renderOutsideEditor
      >
        <DelayAutoFocusInput
          style={{ zIndex: 20 }}
          autoFocus
          placeholder="Enter link..."
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setHref(event.target.value)
          }
          value={href}
          onKeyPress={(event: React.KeyboardEvent<HTMLInputElement>) => {
            const { code } = event;

            if (code === "Enter") {
              submitHref();
            }

            if (code === "Escape") {
              cancelHref();
            }
          }}
        />
      </FloatingWrapper>
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
`
);

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
  const setPodContent = useStore(store, (state) => state.setPodContent);
  const setPodRichContent = useStore(store, (state) => state.setPodRichContent);
  // initial content
  const getPod = useStore(store, (state) => state.getPod);
  const nodesMap = useStore(store, (state) => state.ydoc.getMap<Node>("pods"));
  const pod = getPod(id);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const setPodFocus = useStore(store, (state) => state.setPodFocus);
  // the Yjs extension for Remirror
  const provider = useStore(store, (state) => state.provider)!;

  const setPodBlur = useStore(store, (state) => state.setPodBlur);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const updateView = useStore(store, (state) => state.updateView);
  const isPodFocused = useStore(store, (state) => state.pods[id]?.focus);
  const ref = useRef<HTMLDivElement>(null);
  const { manager, state, setState } = useRemirror({
    extensions: () => [
      new PlaceholderExtension({ placeholder }),
      new ReactComponentExtension(),
      new TableExtension(),
      new TextHighlightExtension(),
      new SupExtension(),
      new SubExtension(),
      new LinkExtension({
        autoLink: true,
        autoLinkAllowedTLDs: ["dev", ...TOP_50_TLDS],
      }),
      new MarkdownExtension(),
      new MyYjsExtension({ getProvider: () => provider, id }),
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
    content: pod.content == "" ? pod.richContent : pod.content,

    // Place the cursor at the start of the document. This can also be set to
    // `end`, `all` or a numbered position.
    // selection: "start",

    // Set the string handler which means the content provided will be
    // automatically handled as html.
    // `markdown` is also available when the `MarkdownExtension`
    // is added to the editor.
    // stringHandler: "html",
    // stringHandler: htmlToProsemirrorNode,
    stringHandler: "markdown",
  });

  let index_onChange = 0;

  return (
    <Box
      className="remirror-theme"
      onFocus={() => {
        setPodFocus(id);
        if (resetSelection()) updateView();
      }}
      onBlur={() => {
        setPodBlur(id);
      }}
      sx={{
        userSelect: "text",
        cursor: "auto",
        // Display different markers for different levels in nested ordered lists.
        ol: {
          "list-style-type": "decimal",
        },
        "ol li ol": {
          "list-style-type": "lower-alpha",
        },
        "ol li ol li ol": {
          "list-style-type": "lower-roman",
        },
      }}
      ref={ref}
      overflow="auto"
    >
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
                setPodRichContent({
                  id,
                  richContent: parameter.helpers.getMarkdown(),
                });
                index_onChange += 1;
                if (index_onChange == 1) {
                  if (
                    JSON.stringify(pod.content) ===
                    JSON.stringify(nextState.doc.toJSON())
                  ) {
                    // This is the first onChange trigger, and the content is the same. Skip it.
                    return;
                  }
                }
                setPodContent({ id, content: nextState.doc.toJSON() });
              }
            }}
          >
            {/* <WysiwygToolbar /> */}
            <EditorComponent />

            <TableComponents />

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
  // const selected = useStore(store, (state) => state.pods[id]?.selected);
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  return (
    <>
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

  if (!pod) return null;

  const node = nodesMap.get(id);

  const fontSize = level2fontsize(
    node?.data.level,
    contextualZoomParams,
    contextualZoom
  );

  if (contextualZoom && fontSize * zoomLevel < threshold) {
    // Return a collapsed block.
    let text = "";
    if (pod.content) {
      // let json = JSON.parse(pod.content);
      const plain = prosemirrorToPlainText(pod.content);
      text = plain.split("\n")[0];
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
            <NewPodButtons pod={pod} xPos={xPos} yPos={yPos} />
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
                  zIndex: 10,
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
