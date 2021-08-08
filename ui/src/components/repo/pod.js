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

import {
  ArrowUpIcon,
  ArrowForwardIcon,
  ArrowDownIcon,
  AddIcon,
  QuestionOutlineIcon,
} from "@chakra-ui/icons";
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

import { repoSlice } from "../../lib/store";
import { MySlate } from "../MySlate";
import { MyMonaco, MyMonacoDiff } from "../MyMonaco";

import { XTerm, DummyTerm } from "../MyXTerm";
import * as wsActions from "../../lib/ws/actions";
import * as qActions from "../../lib/queue/actions";
import useMe from "../../lib/me";
import {
  HoverButton,
  DeleteButton,
  ExportList,
  ImportList,
  HoveringBar,
  ToolBar,
  SyncStatus,
  UpButton,
  DownButton,
  RightButton,
} from "./toolbar";

// FIXME this should be cleared if pods get deleted
const deckCache = {};

function getDeck(id) {
  // avoid re-rendering
  if (!(id in deckCache)) {
    deckCache[id] = <Deck id={id} key={id}></Deck>;
  }
  return deckCache[id];
}

export function Deck({ id, level = 0 }) {
  const dispatch = useDispatch();
  const pod = useSelector((state) => state.repo.pods[id]);
  const clip = useSelector((state) => state.repo.clip);
  // get the children's column
  // FIXME performance issue
  const thechildren = useSelector((state) =>
    pod.children.map((id) => state.repo.pods[id])
  );
  const columns = [...new Set(thechildren.map((c) => c.column))].sort();
  // assuming the pod id itself is already rendered
  if (pod.type !== "DECK") return <Box></Box>;
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
      borderLeft="2px"
      borderTop="2px"
      my={5}
      mx={3}
      bg={`rgba(0,0,0,${0.03 * level})`}
      boxShadow="xl"
      p={3}
      border={clip === pod.id ? "dashed orange" : undefined}
    >
      <Box>
        <Flex>
          <Code colorScheme="blackAlpha">{pod.id}</Code>

          {pod.id !== "ROOT" && <UpButton pod={pod} />}
          {pod.id !== "ROOT" && <DownButton pod={pod} />}
          <RightButton pod={pod} />

          {pod.id !== "ROOT" && <DeleteButton pod={pod} />}

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
        </Flex>

        {/* 2. render all children */}
        <Flex>
          {/* render in columns */}
          {columns.map((col) => (
            <Flex key={col} direction="column" mr={2}>
              <SortableContext
                items={thechildren
                  .filter((c) => c.column === col)
                  .map((c) => c.id)}
              >
                {/* Trying to solve the animation of transfering across containers, but not working. */}
                <DroppableContainer
                  items={thechildren
                    .filter((c) => c.column === col)
                    .map((c) => c.id)}
                  id={`${pod.id}-${col}`}
                >
                  {thechildren
                    .filter((c) => c.column === col)
                    .map(({ id }) => (
                      <SortablePod id={id} key={id}></SortablePod>
                    ))}
                </DroppableContainer>
              </SortableContext>
            </Flex>
          ))}
        </Flex>
      </Box>
      <Box>
        {/* 3. for each child, render its children using this Deck */}
        {pod.children.map((id) => {
          return <Deck id={id} key={id} level={level + 1}></Deck>;
        })}
      </Box>
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

function CodePod({ id }) {
  let pod = useSelector((state) => state.repo.pods[id]);
  let dispatch = useDispatch();

  return (
    // FIXME using VStack will cause some strange padding
    <Box
      align="start"
      // p={2}
      w="md"
    >
      <Box>
        <Box border="1px" pt={2} alignContent="center">
          <MyMonaco
            value={pod.content || "\n\n\n"}
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
  const pod = useSelector((state) => state.repo.pods[id]);
  const clip = useSelector((state) => state.repo.clip);
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = useState(false);
  if (pod.type === "DECK") return <Box></Box>;
  return (
    <Box
      ml={0}
      mb={1}
      w="md"
      border={clip === pod.id ? "dashed orange" : undefined}
    >
      <ExportList pod={pod} />
      <ImportList pod={pod} />
      <Box
        position="relative"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        <ThePod id={id} />

        <Box
          style={{
            margin: "5px",
            position: "absolute",
            top: "0px",
            left: "-30px",
          }}
        >
          <HoveringBar pod={pod} showMenu={showMenu} draghandle={draghandle} />
        </Box>

        <Box
          style={{
            margin: "5px",
            position: "absolute",
            top: "0px",
            right: "15px",
          }}
        >
          <Flex>
            <ToolBar pod={pod} />
            <SyncStatus pod={pod} />
          </Flex>
        </Box>

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
          {pod.type === "CODE" && pod.lang && (
            <Flex>
              <Text mr={2} color="gray" fontSize="sm">
                {pod.lang}
              </Text>
              <Tooltip label="Run (shift-enter)">
                <Button
                  variant="ghost"
                  color="green"
                  size="xs"
                  onClick={() => {
                    dispatch(wsActions.wsRun(id));
                  }}
                >
                  <PlayArrowIcon fontSize="small" />
                </Button>
              </Tooltip>
            </Flex>
          )}
        </Flex>
      </Box>

      {pod.stdout && (
        <Box overflow="scroll" maxH="3xs" border="1px" bg="gray.50">
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
        <Flex>
          <Text color="gray" mr="1rem">
            Result: [{pod.result.count}]:
          </Text>
          <Text>
            <Code maxW="lg" whiteSpace="pre-wrap">
              {pod.result.text}
            </Code>
          </Text>
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
