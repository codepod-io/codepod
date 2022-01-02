import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import { purple, red, grey, blue } from "@mui/material/colors";
import IconButton from "@mui/material/IconButton";
import RawOnIcon from "@mui/icons-material/RawOn";
import RawOffIcon from "@mui/icons-material/RawOff";

import { gql, useQuery, useMutation } from "@apollo/client";
import { GoDiff } from "react-icons/go";

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaCut, FaPaste } from "react-icons/fa";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { AiOutlineFunction } from "react-icons/ai";
import { GiPlatform } from "react-icons/gi";
import Ansi from "ansi-to-react";
import FastForwardIcon from "@mui/icons-material/FastForward";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Popper from "@mui/material/Popper";

import { FcAddColumn, FcDeleteColumn } from "react-icons/fc";

import { repoSlice } from "../../lib/store";
import { MySlate } from "../MySlate";
import { MyMonaco, MyMonacoDiff } from "../MyMonaco";
import { hashPod } from "../../lib/utils";

import { XTerm, DummyTerm } from "../MyXTerm";
import * as wsActions from "../../lib/ws/actions";
import * as qActions from "../../lib/queue/actions";
import useMe from "../../lib/me";
import {
  HoverButton,
  DeleteButton,
  ExportList,
  ImportList,
  HoveringMenu,
  ExportButton,
  FoldButton,
  SyncStatus,
  UpButton,
  DownButton,
  RightButton,
  ThundarButton,
  UtilityButton,
  ClickInputButton,
  ThundarMark,
  UtilityMark,
  RunButton,
  DeckRunButton,
} from "./toolbar";

import Masonry from "@mui/lab/Masonry";

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function Code(props) {
  return (
    <Box component="pre" {...props}>
      {props.children}
    </Box>
  );
}

// FIXME this should be cleared if pods get deleted
const deckCache = {};

function getDeck({ id, level }) {
  // avoid re-rendering
  if (!(id in deckCache)) {
    deckCache[id] = <Deck id={id} key={id} level={level}></Deck>;
  }
  return deckCache[id];
}

export function DeckTitle({ id }) {
  const [showMenu, setShowMenu] = useState(false);
  const pod = useSelector((state) => state.repo.pods[id]);
  const devmode = useSelector((state) => state.repo.repoConfig?.devMode);
  const dispatch = useDispatch();
  return (
    <Box
      position="relative"
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <Box
        sx={{
          margin: "5px",
          position: "absolute",
          top: "0px",
          left: "-30px",
        }}
      >
        {/* The hovering menu */}
        <HoveringMenu pod={pod} showMenu={showMenu}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            {pod.id !== "ROOT" && <UpButton pod={pod} />}
            {pod.id !== "ROOT" && <DownButton pod={pod} />}
            <RightButton pod={pod} />

            {pod.id !== "ROOT" && <DeleteButton pod={pod} />}
            {pod.id !== "ROOT" && (
              <Box>
                <ThundarButton pod={pod} />
                <UtilityButton pod={pod} />
              </Box>
            )}
            <IconButton
              sx={{
                color: "green",
              }}
              size="small"
              onClick={() => {
                dispatch(wsActions.wsRun(id));
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Button
              size="small"
              // variant="ghost"
              onClick={() => {
                dispatch(repoSlice.actions.addColumn(pod.id));
              }}
            >
              <FcAddColumn />
            </Button>

            <Button
              size="small"
              // variant="ghost"
              onClick={() => {
                dispatch(repoSlice.actions.deleteColumn(pod.id));
              }}
            >
              <FcDeleteColumn />
            </Button>
            <Box component="span">col:{pod.column}</Box>
          </Box>
        </HoveringMenu>
      </Box>
      {devmode && (
        <Box>
          ID: <Code>{pod.id}</Code>
          Children:{" "}
          <Box
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              width: 400,
            }}
          >
            {JSON.stringify(pod.children)}
          </Box>
        </Box>
      )}

      {/* The name of the deck */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ display: "flex" }}>
          <GiPlatform />
        </Box>
        <Box
          component="pre"
          sx={{
            my: 0,
          }}
        >
          {pod.name || pod.id}
        </Box>

        <Box>({pod.children.filter(({ type }) => type !== "DECK").length})</Box>

        {pod.id !== "ROOT" && (
          <Box sx={{ display: "flex" }}>
            <ThundarMark pod={pod} />
            <UtilityMark pod={pod} />
          </Box>
        )}
      </Box>
      {pod.stdout && (
        <Box
          sx={{
            overflow: "scroll",
            maxHeight: "3xs",
            border: "1px",
          }}
        >
          {/* <Code maxW="lg" whiteSpace="pre-wrap">
              {pod.stdout}
            </Code> */}
          {/* TODO separate stdout and stderr */}
          <Box>Stdout/Stderr:</Box>
          <Box
            sx={{
              whiteSpace: "pre-wrap",
              fontSize: "sm",
            }}
          >
            <Ansi>{pod.stdout}</Ansi>
          </Box>
          <Divider />
        </Box>
      )}
      {pod.error && (
        <Box
          sx={{
            overflow: "scroll",
            maxHeight: "3xs",
            border: "1px",
            bg: grey[50],
          }}
        >
          <Box color="red">Error: {pod.error.evalue}</Box>
          {pod.error.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              {/* <Code w="100%" whiteSpace="pre-wrap" bg="gray.50" fontSize="sm">
                  {stripAnsi(pod.error.stacktrace.join("\n"))}
                </Code> */}
              <Box
                whiteSpace="pre-wrap"
                fontSize="sm"
                // this inline-style also works
                // but it cannot be applied to <Ansi/> tag
                // style={{
                //   whiteSpace: "pre-wrap",
                // }}
              >
                <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
              </Box>
            </Box>
          )}
        </Box>
      )}
      {pod.running && <Box>Running ..</Box>}
      <Box
        style={{
          margin: "5px",
          position: "absolute",
          top: "-40px",
          left: "15px",
          zIndex: 100,
        }}
      >
        {/* ===== The hovering bar */}
        <Box
          sx={{
            display: "flex",
            background: grey[50],
            rounded: "md",
            boxShadow: "2xl",
            flexDir: "row",
            alignItems: "center",
          }}
          visibility={showMenu ? "visible" : "hidden"}
          // visibility="visible"
          display={showMenu ? "flex" : "none"}
        >
          {/* <Button>Diff</Button>
              <Button>+</Button> */}
          {pod.id !== "ROOT" && (
            <ClickInputButton
              callback={(value) => {
                dispatch(
                  repoSlice.actions.setName({ id: pod.id, name: value })
                );
              }}
            >
              <AiOutlineFunction />
            </ClickInputButton>
          )}
          {pod.id !== "ROOT" && <UpButton pod={pod} />}
          {pod.id !== "ROOT" && <DownButton pod={pod} />}
          <HoverButton
            btn1={<RightButton pod={pod} />}
            btn2={
              <IconButton
                variant="ghost"
                size="xs"
                onClick={() => {
                  dispatch(
                    qActions.remoteAdd({
                      parent: pod.id,
                      index: 0,
                      type: "CODE",
                      lang: pod.lang,
                      column: pod.column,
                    })
                  );
                }}
              >
                +
              </IconButton>
            }
          />

          <IconButton
            variant="ghost"
            size="xs"
            onClick={() => {
              dispatch(
                qActions.remoteAdd({
                  parent: pod.id,
                  index: 0,
                  type: "CODE",
                  lang: pod.lang,
                  column: pod.column,
                })
              );
            }}
          >
            +
          </IconButton>

          {pod.id !== "ROOT" && <DeleteButton pod={pod} />}
          {pod.id !== "ROOT" && <FoldButton pod={pod} />}
          {/* Run button, with hovering support */}
          <DeckRunButton id={id} />
          <IconButton
            variant="ghost"
            sx={{
              color: "green",
            }}
            size="small"
            onClick={() => {
              dispatch(wsActions.wsPowerRun({ id }));
            }}
          >
            <FastForwardIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

function PodSummary({ id }) {
  let pod = useSelector((state) => state.repo.pods[id]);
  // console.log("PodSummary", id, pod.running);
  return (
    <Box>
      {pod.running && <CircularProgress />}
      {pod.error && (
        <Box
          // component="pre"
          sx={{
            color: "red",
            mr: pod.exports && Object.keys(pod.exports).length > 0 ? 0 : 1,
          }}
        >
          X
        </Box>
      )}
      {pod.stdout && <Code color="blue">O</Code>}
      {/* {pod.id} */}
      {pod.exports && pod.exports.length > 0 && (
        <Box
          sx={{
            display: "flex",
          }}
        >
          {pod.exports.map((k) => (
            <Box
              key={k}
              sx={{
                mr: 1,
              }}
            >
              <Box component="pre" sx={{ m: 0 }}>
                {k}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* the execute results */}
      {/* {pod.running ? "running" : "not"}
      {pod.result ? "OK" : "not"}
      {pod.stdout ? "stdout" : } */}
    </Box>
  );
}

function DeckSummary({ id }) {
  // recursively go down and get pod sum
  const pod = useSelector((state) => state.repo.pods[id]);
  if (pod.exports && pod.exports["self"]) {
    return (
      <Box>
        Deck {id}
        {pod.children
          .filter(({ type }) => type !== "DECK")
          .map(({ id }) => (
            <Box key={id}>
              <PodSummary id={id} />
            </Box>
          ))}
        {pod.children
          .filter(({ type }) => type === "DECK")
          .map(({ id }) => (
            <Box key={id}>
              <DeckSummary id={id} />
            </Box>
          ))}
      </Box>
    );
  } else {
    return <Box></Box>;
  }
}

export function Deck(props) {
  const { id, level = 0 } = props;
  // console.log("rendering deck", id);
  const dispatch = useDispatch();
  const pod = useSelector((state) => state.repo.pods[id]);
  let numPods = pod.children.filter(({ type }) => type !== "DECK").length;
  if (pod.type !== "DECK") return <Pod id={id}></Pod>;
  if (pod.children.length == 0 && pod.id === "ROOT") {
    return (
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          dispatch(
            qActions.remoteAdd({
              parent: pod.id,
              type: "DECK",
              index: pod.children.length,
            })
          );
        }}
      >
        <AddIcon />
      </Button>
    );
  }
  return (
    <Stack
      direction="row"
      // borderLeft="2px"
      // borderTop="2px"
      // border="2px"
      sx={{
        my: 1,
        // mx={2}
        bgcolor: `rgba(0,0,0,${0.03 * level})`,
        // ROOT's shadow apears as a vertical line in the right
        boxShadow: id == "ROOT" ? undefined : "xl",
        p: 2,
        border: pod.clipped
          ? "dashed red"
          : pod.lastclip
          ? "dashed orange"
          : undefined,
      }}
    >
      <Box>
        <DeckTitle id={id} />
        <Box sx={{ display: "flex", flexWrap: "wrap" }}>
          {/* {pod.children
            .filter(({ type }) => type !== "DECK")
            .map(({ id }) => (
              <Box key={id}>
                <PodSummary id={id} />
              </Box>
            ))} */}
          {/* {pod.children
              .filter(({ type }) => type === "DECK")
              .map(({ id }) => (
                <Box key={id}>
                  <DeckSummary id={id} level={level + 1} />
                </Box>
              ))} */}
        </Box>
        {pod.fold ? (
          <Box>Folded</Box>
        ) : (
          numPods > 0 && (
            <Box width={`${430 * (pod.column || 1)}px`}>
              <Masonry columns={pod.column || 1} spacing={1}>
                {pod.children
                  .filter(({ type }) => type !== "DECK")
                  .map(({ id }, index) => (
                    <Box
                      key={id}
                      // sx={{
                      //   width: "360px",
                      // }}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          top: "30px",
                          left: "-17px",
                        }}
                      >
                        {index}
                      </Box>
                      <Pod id={id} />
                    </Box>
                  ))}
              </Masonry>
            </Box>
          )
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {pod.children
          .filter(({ type }) => type === "DECK")
          .map(({ id }) => (
            <Box key={id}>
              <Deck id={id} level={level + 1} />
            </Box>
          ))}
      </Box>
    </Stack>
  );
}

const defaultContainerStyle = ({ isOverContainer }) => ({
  marginTop: 40,
  backgroundColor: isOverContainer
    ? "rgb(235,235,235,1)"
    : "rgba(246,246,246,1)",
});

function DroppableContainer({ children, items, id }) {
  const { over, isOver, setNodeRef } = useDroppable({
    id: id,
  });
  const isOverContainer = isOver || (over ? items.includes(over.id) : false);

  return (
    <Box ref={setNodeRef} style={defaultContainerStyle({ isOverContainer })}>
      {children}
    </Box>
  );
}

function SortablePod({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Box ref={setNodeRef} style={style}>
      <Pod id={id} draghandle={{ ...listeners, ...attributes }}></Pod>
    </Box>
  );
}

function CodePod(props) {
  // FIXME performance
  const { id } = props;
  let pod = useSelector((state) => state.repo.pods[id]);
  let dispatch = useDispatch();

  return (
    // FIXME using VStack will cause some strange padding
    <Box
      sx={{
        alignItems: "start",
      }}
      // p={2}
      // w="xs"
    >
      <Box>
        <Box
          sx={{
            alignContent: "center",
          }}
        >
          <MyMonaco
            value={pod.content || ""}
            gitvalue={pod.staged}
            // pod={pod}
            onChange={(value) => {
              dispatch(
                repoSlice.actions.setPodContent({ id: pod.id, content: value })
              );
            }}
            lang={pod.lang || "javascript"}
            onExport={(name, isActive) => {
              if (isActive) {
                dispatch(
                  repoSlice.actions.deletePodExport({ id: pod.id, name })
                );
              } else {
                dispatch(repoSlice.actions.addPodExport({ id: pod.id, name }));
              }
            }}
            onMidport={(name, isActive) => {
              if (isActive) {
                dispatch(
                  repoSlice.actions.deletePodMidport({ id: pod.id, name })
                );
              } else {
                dispatch(repoSlice.actions.addPodMidport({ id: pod.id, name }));
              }
            }}
            onRun={() => {
              dispatch(repoSlice.actions.clearResults(pod.id));
              dispatch(wsActions.wsRun(pod.id));
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

function ReplPod({ pod }) {
  const sessionId = useSelector((state) => state.repo.sessionId);
  const [term, setTerm] = useState(null);
  useEffect(() => {
    // setTerm(getNewTerm(sessionId, pod.lang));
  }, []);

  return (
    <Stack align="start" p={2}>
      {/* <HStack>
          <Button
            size="sm"
            isDisabled={!term}
            onClick={() => {
              setTerm(null);
            }}
          >
            Close
          </Button>
          <Button
            size="sm"
            isDisabled={term}
            // TODO not able to implement "reset"
            onClick={() => {
              setTerm(getNewTerm(sessionId, pod.lang));
            }}
          >
            Connect
          </Button>
        </HStack> */}
      <Box border="1px" w="sm" h="8rem">
        {/* <XTerm /> */}
        {term && <XTerm term={term} />}
      </Box>
    </Stack>
  );
}

function WysiwygPod({ pod }) {
  let dispatch = useDispatch();
  return (
    <Stack align="start">
      <Box border="1px" w="100%" p="1rem">
        <MySlate
          value={
            pod.content || [
              {
                type: "paragraph",
                children: [
                  {
                    text: "",
                  },
                ],
              },
            ]
          }
          onChange={(value) => {
            dispatch(
              repoSlice.actions.setPodContent({ id: pod.id, content: value })
            );
          }}
          placeholder="Write some rich text"
        />
      </Box>
    </Stack>
  );
}
function Pod({ id, draghandle }) {
  console.log("Rendering pod", id);
  return (
    <PodWrapper id={id} draghandle={draghandle}>
      <ThePod id={id} />
    </PodWrapper>
  );
}

function PodDiff({ id, setShowDiff }) {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  // 1. a button
  // 2. when the button is clicked, show the modal
  let pod = useSelector((state) => state.repo.pods[id]);
  // useMutation
  let [gitStage, {}] = useMutation(
    gql`
      mutation GitStage($reponame: String, $username: String, $podId: ID) {
        gitStage(reponame: $reponame, username: $username, podId: $podId)
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  let [gitUnstage, {}] = useMutation(
    gql`
      mutation GitUnstage($reponame: String, $username: String, $podId: ID) {
        gitUnstage(reponame: $reponame, username: $username, podId: $podId)
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  let dispatch = useDispatch();
  let theset = new Set([
    pod.content || "",
    pod.staged || "",
    pod.githead || "",
  ]);
  if (theset.size == 1) {
    return <Box></Box>;
  }
  return (
    <>
      <Box>
        <Box sx={{ display: "flex" }}>
          <Button
            onClick={() => {
              setShowDiff(false);
            }}
          >
            close
          </Button>
          <Button
            onClick={() => {
              gitStage({
                variables: {
                  podId: id,
                  username,
                  reponame,
                },
              });
              dispatch(repoSlice.actions.gitStage(id));
            }}
            // disabled={pod.remoteHash !== hashPod(pod)}
          >
            Stage
          </Button>
          <Button
            onClick={() => {
              gitUnstage({
                variables: {
                  podId: id,
                  username,
                  reponame,
                },
              });
              // FIXME this is not trigering an update
              dispatch(repoSlice.actions.gitUnstage(id));
            }}
            // disabled={pod.remoteHash !== hashPod(pod)}
          >
            UnStage
          </Button>
        </Box>
        <Box sx={{ display: "flex" }}>
          <Box
            sx={{
              width: "xs",
              border: "solid 1px",
              mx: 2,
            }}
          >
            <Box>Diff</Box>
            {/* I have to use || "" otherwise it is not updated */}
            <MyMonacoDiff from={pod.staged} to={pod.content} />
          </Box>
          <Box w="xs" border="solid 1px" mx={2}>
            <Box>Staged</Box>
            <MyMonacoDiff from={pod.githead} to={pod.staged} />
          </Box>
        </Box>
      </Box>
    </>
  );
}

function PodWrapper({ id, draghandle, children }) {
  // console.log("PodWrapper", id);
  const pod = useSelector((state) => state.repo.pods[id]);
  const devmode = useSelector((state) => state.repo.repoConfig?.devMode);
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const anchorEl = useRef(null);
  // whether the pod is diff
  let theset = new Set([
    pod.content || "",
    pod.staged || "",
    pod.githead || "",
  ]);
  let hasgitdiff = theset.size > 1;
  if (pod.type === "DECK") return <Box></Box>;
  return (
    <Box
      sx={{
        ml: 0,
        my: 1,
        width: 400,
        // w={150}
        border: pod.clipped
          ? "dashed red"
          : pod.lastclip
          ? "dashed orange"
          : undefined,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <ExportList pod={pod} />
        <ImportList pod={pod} />
        <ThundarMark pod={pod} />
        <UtilityMark pod={pod} />
        {devmode && <Code>ID: {pod.id}</Code>}
        {hasgitdiff && (
          <IconButton
            onClick={() => {
              setShowDiff(!showDiff);
            }}
            sx={{
              color: "orange",
            }}
            size="small"
          >
            <GoDiff fontSize={15} />
          </IconButton>
        )}
      </Box>

      <Box
        position="relative"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {pod.fold ? (
          <Box h={10} border="dashed 1px">
            <Box>Folded</Box>
          </Box>
        ) : (
          // <ThePod id={id} />
          <Box>
            <Box ref={anchorEl}>{children}</Box>
            <Box>
              <Popper
                open={showDiff}
                anchorEl={anchorEl.current}
                // need this, otherwise the z-index seems to be berried under Chakra Modal
                // disablePortal={false}
                placement="right-start"
                modifiers={[
                  {
                    name: "flip",
                    enabled: false,
                  },
                  {
                    name: "hide",
                    enabled: false,
                  },
                  {
                    name: "preventOverflow",
                    enabled: false,
                  },
                ]}
              >
                <Box bg="gray" w="2xl">
                  <PodDiff id={id} setShowDiff={setShowDiff} />
                  {/* Hello */}
                  {/* <MyMonaco value="hello"></MyMonaco> */}
                </Box>
              </Popper>
            </Box>
          </Box>
        )}

        <Box
          style={{
            margin: "5px",
            position: "absolute",
            top: "0px",
            left: "-30px",
          }}
        >
          {/* ==== The hovering menu */}
          <HoveringMenu pod={pod} showMenu={showMenu} draghandle={draghandle}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <ExportButton id={pod.id} />
              <UpButton pod={pod} />
              <DownButton pod={pod} />
              <DeleteButton pod={pod} />
              <FoldButton pod={pod} />
              <ThundarButton pod={pod} />
              <UtilityButton pod={pod} />
              <Button
                onClick={() => {
                  setShowDiff(!showDiff);
                }}
              >
                toggle diff
              </Button>
            </Box>
          </HoveringMenu>
        </Box>

        <Box
          style={{
            margin: "5px",
            position: "absolute",
            top: "-38px",
            right: "15px",
          }}
        >
          <Box sx={{ display: "flex" }}>
            {/* ===== The hovering bar */}
            <Box
              sx={{
                display: "flex",
                background: grey[50],
                rounded: "md",
                boxShadow: "2xl",
                alignItems: "center",
              }}
              visibility={showMenu ? "visible" : "hidden"}
              display={showMenu ? "inherit" : "none"}
            >
              {/* <Button>Diff</Button>
              <Button>+</Button> */}
              <ExportButton id={pod.id} />
              <UpButton pod={pod} />
              <DownButton pod={pod} />
              <DeleteButton pod={pod} />
              <IconButton
                size="smal"
                sx={{
                  fontSize: 10,
                }}
                onClick={() => {
                  dispatch(repoSlice.actions.toggleRaw(pod.id));
                }}
              >
                {pod.raw ? (
                  <RawOnIcon sx={{ fontSize: 15 }} />
                ) : (
                  <RawOffIcon sx={{ fontSize: 15 }} />
                )}
              </IconButton>
              <FoldButton pod={pod} />
              <RunButton id={id} />
            </Box>
            {/* <SyncStatus pod={pod} /> */}
          </Box>
        </Box>

        {!pod.fold && (
          <Box
            sx={{
              display: "flex",
              margin: "5px",
              position: "absolute",
              bottom: "-4px",
              right: "15px",
            }}
          >
            {/* The lang */}
            {pod.type === "WYSIWYG" && (
              <Box color="gray" mr={2} fontSize="xs">
                {pod.type}
              </Box>
            )}
            {pod.type === "CODE" && pod.lang && (
              <Box
                sx={{
                  display: "flex",
                }}
              >
                {pod.raw && (
                  <Box pr={2} color="gray">
                    raw
                  </Box>
                )}
                <Box color="gray">{pod.lang}</Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {pod.stdout && (
        <Box overflow="scroll" maxHeight="200px" border="1px">
          {/* <Code maxW="lg" whiteSpace="pre-wrap">
              {pod.stdout}
            </Code> */}
          {/* TODO separate stdout and stderr */}
          <Box>Stdout/Stderr:</Box>
          <Box whiteSpace="pre-wrap" fontSize="sm">
            <Ansi>{pod.stdout}</Ansi>
          </Box>
        </Box>
      )}
      {pod.running && <CircularProgress />}
      {pod.result && (
        <Flex direction="column" overflow="scroll" maxHeight="200px">
          {pod.result.html ? (
            <div dangerouslySetInnerHTML={{ __html: pod.result.html }}></div>
          ) : (
            pod.result.text && (
              <Flex>
                <Box color="gray" mr="1rem">
                  Result: [{pod.result.count}]:
                </Box>
                <Box>
                  <Code whiteSpace="pre-wrap">{pod.result.text}</Code>
                </Box>
              </Flex>
            )
          )}
          {pod.result.image && (
            <img src={`data:image/png;base64,${pod.result.image}`} />
          )}
        </Flex>
      )}
      {pod.error && (
        <Box overflow="scroll" maxHeight="3xs" border="1px" bg="gray.50">
          <Box color="red">Error: {pod.error.evalue}</Box>
          {pod.error.stacktrace && (
            <Box>
              <Box>StackTrace</Box>
              {/* <Code w="100%" whiteSpace="pre-wrap" bg="gray.50" fontSize="sm">
                  {stripAnsi(pod.error.stacktrace.join("\n"))}
                </Code> */}
              <Box
                whiteSpace="pre-wrap"
                fontSize="sm"
                // this inline-style also works
                // but it cannot be applied to <Ansi/> tag
                // style={{
                //   whiteSpace: "pre-wrap",
                // }}
              >
                <Ansi>{pod.error.stacktrace.join("\n")}</Ansi>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function ThePod({ id }) {
  // console.log("rendinering thepod", id);
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  const doubleClickToEdit = useSelector(
    (state) => state.repo.repoConfig?.doubleClickToEdit
  );
  if (pod.type === "WYSIWYG") {
    return <WysiwygPod pod={pod} />;
  } else if (pod.type === "MD") {
    return (
      <TextField
        w="md"
        onChange={(e) => {
          dispatch(
            repoSlice.actions.setPodContent({ id, content: e.target.value })
          );
        }}
        value={pod.content || ""}
        placeholder="Markdown here"
      ></TextField>
    );
  } else if (pod.type === "CODE") {
    if (!doubleClickToEdit || pod.render) {
      return <CodePod id={id} />;
    } else {
      return (
        <Code
          onDoubleClick={() => {
            // console.log("Double clicked!");
            dispatch(repoSlice.actions.setPodRender({ id, value: true }));
          }}
          sx={{
            whiteSpace: "pre-wrap",
            fontSize: "sm",
          }}
        >
          {pod.content}
          <Box>(Read-only)</Box>
        </Code>
      );
    }
  } else if (pod.type === "REPL") {
    return <ReplPod pod={pod} />;
  } else if (pod.type === "DECK") {
    return (
      <Box>
        {pod.children.length == 0 && (
          <Button
            size="sm"
            onClick={() => {
              dispatch(
                qActions.remoteAdd({
                  parent: pod.id,
                  type: "CODE",
                  index: 0,
                })
              );
            }}
          >
            <AddIcon />
          </Button>
        )}
      </Box>
    );
  } else {
    throw new Error(`Invalid pod type ${pod.type}`);
  }
}
