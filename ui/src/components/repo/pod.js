import {
  Box,
  Text,
  Flex,
  Textarea,
  Button,
  Tooltip,
  Image,
  Spinner,
  Code,
  Spacer,
  Divider,
  useToast,
  Input,
} from "@chakra-ui/react";
import { HStack, VStack, Select } from "@chakra-ui/react";

import { gql, useQuery, useMutation } from "@apollo/client";
import {
  ArrowUpIcon,
  ArrowForwardIcon,
  ArrowDownIcon,
  AddIcon,
  QuestionOutlineIcon,
} from "@chakra-ui/icons";
import { GoDiff } from "react-icons/go";

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import IconButton from "@material-ui/core/IconButton";

import { FaCut, FaPaste } from "react-icons/fa";

import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import { AiOutlineFunction } from "react-icons/ai";
import Ansi from "ansi-to-react";

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
import Popper from "@material-ui/core/Popper";
import Paper from "@material-ui/core/Paper";

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
} from "./toolbar";

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
  const dispatch = useDispatch();
  return (
    <Box
      position="relative"
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <Box
        style={{
          margin: "5px",
          position: "absolute",
          top: "0px",
          left: "-30px",
        }}
      >
        <HoveringMenu pod={pod} showMenu={showMenu}>
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
          <Button
            variant="ghost"
            color="green"
            size="xs"
            onClick={() => {
              dispatch(wsActions.wsRunTree(id));
            }}
          >
            <PlayArrowIcon fontSize="small" />
          </Button>
        </HoveringMenu>
      </Box>
      <Flex>
        <ClickInputButton
          callback={(value) => {
            dispatch(repoSlice.actions.setName({ id: pod.id, name: value }));
          }}
        >
          <Code colorScheme="blackAlpha" bg="blue.200">
            {pod.name ? pod.name : pod.id}
          </Code>
        </ClickInputButton>

        {pod.id !== "ROOT" && (
          <Flex>
            <ThundarMark pod={pod} />
            <UtilityMark pod={pod} />
          </Flex>
        )}

        <Flex
          visibility={showMenu ? "visible" : "hidden"}
          background="gray.50"
          rounded="md"
          boxShadow="2xl"
        >
          {/* <Button>Diff</Button>
              <Button>+</Button> */}
          {pod.id !== "ROOT" && <UpButton pod={pod} />}
          {pod.id !== "ROOT" && <DownButton pod={pod} />}
          <RightButton pod={pod} />

          {pod.id !== "ROOT" && <DeleteButton pod={pod} />}
        </Flex>
      </Flex>
    </Box>
  );
}

export function Deck(props) {
  const { id, level = 0 } = props;
  // console.log("rendering deck", id);
  const dispatch = useDispatch();
  const pod = useSelector((state) => state.repo.pods[id]);
  const clip = useSelector((state) => state.repo.clip);
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
    <HStack
      // borderLeft="2px"
      // borderTop="2px"
      // border="2px"
      my={1}
      // mx={2}
      bg={`rgba(0,0,0,${0.03 * level})`}
      // ROOT's shadow apears as a vertical line in the right
      boxShadow={id == "ROOT" ? undefined : "xl"}
      p={2}
      border={clip === pod.id ? "dashed orange" : undefined}
    >
      <Box>
        <DeckTitle id={id} />
        <Flex
          // FIXME column flex with maxH won't auto flow to right.
          direction="column"
          // border="5px solid blue"
          // maxH="lg"
          // maxW={2000}
          // wrap="wrap"
        >
          {pod.children
            .filter(({ type }) => type !== "DECK")
            .map(({ id }) => (
              <Box key={id}>
                <Pod id={id} />
              </Box>
            ))}
        </Flex>
      </Box>
      <Flex direction="column">
        {pod.children
          .filter(({ type }) => type === "DECK")
          .map(({ id }) => (
            <Box key={id}>
              <Deck id={id} level={level + 1} />
            </Box>
          ))}
      </Flex>
    </HStack>
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
      align="start"
      // p={2}
      // w="xs"
    >
      <Box>
        <Box alignContent="center">
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
    <VStack align="start" p={2}>
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
    </VStack>
  );
}

function WysiwygPod({ pod }) {
  let dispatch = useDispatch();
  return (
    <VStack align="start">
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
    </VStack>
  );
}
function Pod({ id, draghandle }) {
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
  let [gitStage, {}] = useMutation(gql`
    mutation GitStage($reponame: String, $username: String, $podId: ID) {
      gitStage(reponame: $reponame, username: $username, podId: $podId)
    }
  `);
  let [gitUnstage, {}] = useMutation(gql`
    mutation GitUnstage($reponame: String, $username: String, $podId: ID) {
      gitUnstage(reponame: $reponame, username: $username, podId: $podId)
    }
  `);
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
        <Flex>
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
            disabled={pod.remoteHash !== hashPod(pod)}
          >
            Stage
          </Button>
          <Button
            onClick={() => {
              gitUnstage({
                variables: {
                  podId: id,
                },
              });
              // FIXME this is not trigering an update
              dispatch(repoSlice.actions.gitUnstage(id));
            }}
            disabled={pod.remoteHash !== hashPod(pod)}
          >
            UnStage
          </Button>
        </Flex>
        <Flex>
          <Box w="xs" border="solid 1px" mx={2}>
            <Box>Diff</Box>
            {/* I have to use || "" otherwise it is not updated */}
            <MyMonacoDiff from={pod.staged} to={pod.content} />
          </Box>
          <Box w="xs" border="solid 1px" mx={2}>
            <Box>Staged</Box>
            <MyMonacoDiff from={pod.githead} to={pod.staged} />
          </Box>
        </Flex>
      </Box>
    </>
  );
}

function PodWrapper({ id, draghandle, children }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const clip = useSelector((state) => state.repo.clip);
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
      ml={0}
      my={1}
      w="2xs"
      // w={150}
      border={clip === pod.id ? "dashed orange" : undefined}
    >
      <Flex>
        <ExportList pod={pod} />
        <ImportList pod={pod} />
        <ThundarMark pod={pod} />
        <UtilityMark pod={pod} />
        {hasgitdiff && (
          <Button
            onClick={() => {
              setShowDiff(!showDiff);
            }}
            size="xs"
            variant="ghost"
            color="orange.600"
          >
            <GoDiff />
          </Button>
        )}
      </Flex>

      <Box
        position="relative"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {pod.fold ? (
          <Box h={10} border="dashed 1px">
            <Text>Folded</Text>
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
                disablePortal={false}
                placement="right-start"
                modifiers={{
                  hide: { enabled: false },
                  flip: { enabled: false },
                  preventOverflow: {
                    enabled: false,
                  },
                }}
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
          <HoveringMenu pod={pod} showMenu={showMenu} draghandle={draghandle}>
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
          </HoveringMenu>
        </Box>

        <Box
          style={{
            margin: "5px",
            position: "absolute",
            top: "-30px",
            right: "15px",
          }}
        >
          <Flex>
            <Flex
              visibility={showMenu ? "visible" : "hidden"}
              background="gray.50"
              rounded="md"
              boxShadow="2xl"
            >
              {/* <Button>Diff</Button>
              <Button>+</Button> */}
              <ExportButton id={pod.id} />
              <UpButton pod={pod} />
              <DownButton pod={pod} />
              <DeleteButton pod={pod} />
              <FoldButton pod={pod} />
            </Flex>
            {/* <SyncStatus pod={pod} /> */}
          </Flex>
        </Box>

        {!pod.fold && (
          <Flex
            style={{
              margin: "5px",
              position: "absolute",
              bottom: "-4px",
              right: "15px",
            }}
          >
            {/* The lang */}
            {pod.type === "WYSIWYG" && (
              <Text color="gray" mr={2} fontSize="xs">
                {pod.type}
              </Text>
            )}
            {/* {pod.type === "CODE" && pod.lang && <RunButton id={id} />} */}
          </Flex>
        )}
      </Box>

      {pod.stdout && (
        <Box overflow="scroll" maxH="3xs" border="1px">
          {/* <Code maxW="lg" whiteSpace="pre-wrap">
              {pod.stdout}
            </Code> */}
          <Text>Stdout:</Text>
          <Box whiteSpace="pre-wrap" fontSize="sm">
            <Ansi>{pod.stdout}</Ansi>
          </Box>
        </Box>
      )}
      {pod.running && <Text>Running ..</Text>}
      {pod.result && (
        <Flex direction="column">
          <Flex>
            <Text color="gray" mr="1rem">
              Result: [{pod.result.count}]:
            </Text>
            <Text>
              <Code whiteSpace="pre-wrap">{pod.result.text}</Code>
            </Text>
          </Flex>
          {pod.result.image && (
            <img src={`data:image/png;base64,${pod.result.image}`} />
          )}
        </Flex>
      )}
      {pod.error && (
        <Box overflow="scroll" maxH="3xs" border="1px" bg="gray.50">
          <Text color="red">Error: {pod.error.evalue}</Text>
          {pod.error.stacktrace && (
            <Box>
              <Text>StackTrace</Text>
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
  if (pod.type === "WYSIWYG") {
    return <WysiwygPod pod={pod} />;
  } else if (pod.type === "MD") {
    return (
      <Textarea
        w="xs"
        onChange={(e) => {
          dispatch(
            repoSlice.actions.setPodContent({ id, content: e.target.value })
          );
        }}
        value={pod.content || ""}
        placeholder="Markdown here"
      ></Textarea>
    );
  } else if (pod.type === "CODE") {
    return <CodePod id={id} />;
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

        {/* <Text>Deck</Text> */}
      </Box>
    );
  } else {
    throw new Error(`Invalid pod type ${pod.type}`);
  }
}
