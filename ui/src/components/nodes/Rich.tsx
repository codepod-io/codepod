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

import {
  BoldExtension,
  CalloutExtension,
  DropCursorExtension,
  ImageExtension,
  ItalicExtension,
  LinkExtension,
  PlaceholderExtension,
  ShortcutHandlerProps,
  SubExtension,
  SupExtension,
  TextHighlightExtension,
  YjsExtension,
  createMarkPositioner,
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
  useChainedCommands,
  useCurrentSelection,
  useAttrs,
  useUpdateReason,
  FloatingWrapper,
} from "@remirror/react";
import { WysiwygEditor } from "@remirror/react-editors/wysiwyg";
import { FloatingToolbar, useExtensionEvent } from "@remirror/react";
import { TableExtension } from "@remirror/extension-react-tables";
import { GenIcon, IconBase } from "@remirror/react-components";
import "remirror/styles/all.css";

import { ProsemirrorPlugin, htmlToProsemirrorNode } from "remirror";
import { styled } from "@mui/material";

import { MyYjsExtension } from "./YjsRemirror";

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

const FloatingLinkToolbar = ({ children }) => {
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
  const { empty } = useCurrentSelection();

  const handleClickEdit = useCallback(() => {
    clickEdit();
  }, [clickEdit]);

  const linkEditButtons = activeLink ? (
    <CommandButtonGroup>
      <CommandButton
        commandName="updateLink"
        aria-label="Edit link"
        onSelect={handleClickEdit}
        icon="pencilLine"
        enabled
      />
      <CommandButton
        commandName="removeLink"
        aria-label="Remove link"
        onSelect={onRemove}
        icon="linkUnlink"
        enabled
      />
    </CommandButtonGroup>
  ) : (
    <CommandButtonGroup>
      <CommandButton
        commandName="updateLink"
        aria-label="Add link"
        onSelect={handleClickEdit}
        icon="link"
        enabled
      />
    </CommandButtonGroup>
  );

  return (
    <>
      {!isEditing && (
        <FloatingToolbar>
          {linkEditButtons}
          {children}
        </FloatingToolbar>
      )}
      {!isEditing && empty && (
        <FloatingToolbar positioner={linkPositioner}>
          {linkEditButtons}
          {children}
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
  // FIXME this is re-rendered all the time.
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const setPodContent = useStore(store, (state) => state.setPodContent);
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
      // new BoldExtension(),
      // new ItalicExtension(),
      new ReactComponentExtension(),
      new TableExtension(),
      new TextHighlightExtension(),
      new SupExtension(),
      new SubExtension(),
      new LinkExtension({ autoLink: true }),
      new ImageExtension({ enableResizing: true }),
      new DropCursorExtension(),
      new MyYjsExtension({ getProvider: () => provider, id }),
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
      sx={{ userSelect: "text", cursor: "auto" }}
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
                setPodContent({ id, content: nextState.doc.toJSON() });
              }
            }}
          >
            {/* <WysiwygToolbar /> */}
            <EditorComponent />

            <TableComponents />

            {!isGuest && (
              <FloatingLinkToolbar>
                <FormattingButtonGroup />
                <VerticalDivider />
                <CommandButtonGroup>
                  {/* <HeadingLevelButtonGroup /> */}

                  {/* <ListButtonGroup /> */}
                  <SetHighlightButton color="lightpink" />
                  <SetHighlightButton color="yellow" />
                  <SetHighlightButton color="lightgreen" />
                  <SetHighlightButton color="lightcyan" />
                  <SetHighlightButton />
                </CommandButtonGroup>
                <VerticalDivider />
                {/* <FormattingButtonGroup /> */}
                {/* <DecreaseIndentButton /> */}
                {/* <IncreaseIndentButton /> */}
                {/* <TextAlignmentButtonGroup /> */}
                {/* <IndentationButtonGroup /> */}
                {/* <BaselineButtonGroup /> */}
              </FloatingLinkToolbar>
            )}

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
