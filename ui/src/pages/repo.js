import { useParams, Link as ReactLink } from "react-router-dom";

import {
  Box,
  Text,
  Flex,
  Textarea,
  Button,
  Tooltip,
  Image,
  IconButton,
  Spinner,
  Code,
} from "@chakra-ui/react";
import { Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
} from "@chakra-ui/react";
import { HStack, VStack, Select } from "@chakra-ui/react";
import { useClipboard } from "@chakra-ui/react";

import {
  ArrowUpIcon,
  ArrowForwardIcon,
  ArrowDownIcon,
  CheckIcon,
  RepeatIcon,
  HamburgerIcon,
  InfoIcon,
  ChevronDownIcon,
  DragHandleIcon,
  DeleteIcon,
} from "@chakra-ui/icons";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useResizeObserver from "use-resize-observer";
import io from "socket.io-client";
import { Node } from "slate";

import { repoSlice, loadPodQueue, remoteUpdatePod } from "../lib/store";
import { MySlate } from "../components/MySlate";
import { CodeSlack } from "../components/CodeSlate";
import { StyledLink as Link } from "../components/utils";

import { Terminal } from "xterm";
import { XTerm, DummyTerm } from "../components/MyXTerm";
import * as wsActions from "../lib/wsActions";

import brace from "../GullBraceLeft.svg";

export default function Repo() {
  let { username, reponame } = useParams();
  const dispatch = useDispatch();
  dispatch(repoSlice.actions.setRepo({ username, reponame }));
  useEffect(() => {
    // load the repo
    dispatch(loadPodQueue({ username, reponame }));
    // dispatch(wsActions.wsConnect());
  }, []);

  const queueL = useSelector((state) => state.repo.queue.length);
  const repoLoaded = useSelector((state) => state.repo.repoLoaded);
  const sessionId = useSelector((state) => state.repo.sessionId);
  const sessionRuntime = useSelector((state) => state.repo.sessionRuntime);
  const kernelConnected = useSelector((state) => state.repo.kernelConnected);
  const kernelStatus = useSelector((state) => state.repo.kernelStatus);

  return (
    <Flex direction="column" m="auto">
      {/* <Box m="auto" w="lg">
        <MyXTerm />
      </Box> */}
      <Box pb={10} m="auto">
        <Text>
          Repo:{" "}
          <Link to={`/${username}`} as={ReactLink}>
            {username}
          </Link>{" "}
          /{" "}
          <Link to={`/${username}/${reponame}`} as={ReactLink}>
            {reponame}
          </Link>
        </Text>
        <Text>SyncQueue: {queueL}</Text>
        <Text>Session ID: {sessionId}</Text>
        <Button
          onClick={() => {
            dispatch(repoSlice.actions.resetSessionId());
          }}
        >
          Reset Session
        </Button>
        <Text>
          Session Runtime:
          <Code>{Object.keys(sessionRuntime)}</Code>
        </Text>
        <Text>Kernel connected? {kernelConnected ? "Yes" : "No"}</Text>

        <Button
          onClick={() => {
            dispatch(wsActions.wsConnect("host"));
          }}
        >
          Connect
        </Button>
        <Button
          onClick={() => {
            dispatch(wsActions.wsDisconnect());
          }}
        >
          Disconnect
        </Button>
        <Text>Kernel status: {kernelStatus}</Text>
        <Button
          onClick={() => {
            dispatch(wsActions.wsRequestStatus());
          }}
        >
          Request Kernel Status
        </Button>
        {!repoLoaded && <Text>Repo Loading ...</Text>}
      </Box>
      {repoLoaded && (
        <Box m="auto">
          <Box
            overflowX="scroll"
            border="solid 3px"
            p={5}
            m={5}
            maxW={["sm", "lg", "3xl", "4xl", "6xl"]}
          >
            <Box>
              <Deck id="ROOT" />
            </Box>
          </Box>
        </Box>
      )}
    </Flex>
  );
}

function SyncStatus({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.status !== "dirty" &&
        pod.status !== "synced" &&
        pod.status !== "syncing" && <Box>Error {pod.status}</Box>}
      {pod.status === "dirty" && (
        <Box>
          <IconButton
            size="sm"
            icon={<RepeatIcon />}
            colorScheme={"yellow"}
            onClick={() => {
              dispatch(
                remoteUpdatePod({
                  id: pod.id,
                  content: pod.content,
                  type: pod.type,
                  lang: pod.lang,
                })
              );
            }}
          ></IconButton>
        </Box>
      )}
      {pod.status === "synced" && (
        <Box>
          <CheckIcon color="green" />
        </Box>
      )}
      {pod.status === "syncing" && (
        <Box>
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.200"
            color="blue.500"
            size="xl"
          />
        </Box>
      )}
    </Box>
  );
}

function InfoBar({ pod }) {
  /* eslint-disable no-unused-vars */
  const [value, setValue] = useState(pod.id);
  const { hasCopied, onCopy } = useClipboard(value);
  // return <Box></Box>;
  return (
    <Box>
      <DragHandleIcon mr="3px" />
      <Popover>
        <PopoverTrigger>
          <IconButton size="sm" icon={<InfoIcon />}></IconButton>
          {/* <InfoIcon /> */}
        </PopoverTrigger>
        <PopoverContent w="lg">
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader>Info</PopoverHeader>
          <PopoverBody>
            <Text>
              ID:{" "}
              <Code colorScheme="blackAlpha">
                {
                  // pod.id.substring(0, 8)
                  pod.id
                }
              </Code>
              <Button onClick={onCopy}>{hasCopied ? "Copied" : "Copy"}</Button>
            </Text>
            <Text mr={5}>Index: {pod.index}</Text>
            <Text>
              Parent:{" "}
              <Code colorScheme="blackAlpha">{pod.parent.substring(0, 8)}</Code>
            </Text>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  );
}

function ToolBar({ pod }) {
  const dispatch = useDispatch();
  const [show, setShow] = useState(false);
  return (
    <Box>
      <Button
        size="sm"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.parent,
              index: pod.index,
              type: "CODE",
            })
          );
        }}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        size="sm"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.parent,
              index: pod.index + 1,
              type: "CODE",
            })
          );
        }}
      >
        <ArrowDownIcon />
      </Button>
      <Button
        size="sm"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.id,
              type: "CODE",
              index: 0,
            })
          );
        }}
      >
        <ArrowForwardIcon />
      </Button>
      <Button
        size="sm"
        color="red"
        onClick={() => {
          dispatch(repoSlice.actions.deletePod({ id: pod.id }));
        }}
      >
        <DeleteIcon />
      </Button>
    </Box>
  );
}

function LanguageMenu({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      <Select
        placeholder="Select option"
        value={pod.lang || ""}
        onChange={(e) =>
          dispatch(
            repoSlice.actions.setPodLang({
              id: pod.id,
              lang: e.target.value,
            })
          )
        }
      >
        <option value="python">Python</option>
        <option value="julia">Julia</option>
        <option value="js">JavaScript</option>
        <option value="css">CSS</option>
        <option value="html">HTML</option>
        <option value="sql">SQL</option>
        <option value="java">Java</option>
        <option value="php">PHP</option>
      </Select>
    </Box>
  );
}

function TypeMenu({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      <Menu>
        <MenuButton size="sm" as={Button} rightIcon={<ChevronDownIcon />}>
          {pod.type}
        </MenuButton>
        <MenuList>
          <MenuItem
            onClick={() => {
              dispatch(
                repoSlice.actions.setPodType({
                  id: pod.id,
                  type: "CODE",
                })
              );
            }}
          >
            Code
          </MenuItem>
          <MenuItem
            onClick={() => {
              dispatch(
                repoSlice.actions.setPodType({
                  id: pod.id,
                  type: "WYSIWYG",
                })
              );
            }}
          >
            WYSIWYG
          </MenuItem>
          <MenuItem
            onClick={() => {
              dispatch(
                repoSlice.actions.setPodType({
                  id: pod.id,
                  type: "REPL",
                })
              );
            }}
          >
            REPL
          </MenuItem>
          <MenuItem
            isDisabled
            onClick={() => {
              dispatch(
                repoSlice.actions.setPodType({
                  id: pod.id,
                  type: "MD",
                })
              );
            }}
          >
            Markdown
          </MenuItem>
        </MenuList>
      </Menu>
    </Box>
  );
}

function Deck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const { ref: right, width = 0, height = 0 } = useResizeObserver();
  return (
    <VStack align="start" p={2}>
      <Box border="solid 1px" p={3}>
        {/* LEFT */}
        <Flex align="center">
          <Pod id={pod.id} />
          {pod.children.length > 0 && (
            <Flex>
              {/* The brace */}
              <div>
                <Image
                  // src={require("../GullBraceLeft.svg")}
                  src={brace}
                  // src="../GullBraceLeft.svg"
                  alt="brace"
                  h={height}
                  maxW="none"
                  w="20px"
                />
              </div>
              {/* RIGHT */}
              <Flex direction="column" ref={right}>
                {pod.children.map((id) => {
                  return <Deck id={id} key={id}></Deck>;
                })}
              </Flex>
            </Flex>
          )}
        </Flex>
      </Box>
    </VStack>
  );
}

const slackGetPlainText = (nodes) => {
  return nodes.map((n) => Node.string(n)).join("\n");
};

function CodePod({ pod }) {
  let dispatch = useDispatch();
  return (
    <VStack align="start" p={2}>
      <HStack>
        <InfoBar pod={pod} />
        <ToolBar pod={pod} />
        <SyncStatus pod={pod} />
        <TypeMenu pod={pod} />
        <LanguageMenu pod={pod} />
        <Button
          size="sm"
          isDisabled={!pod.lang}
          onClick={() => {
            // 1. create or load runtime socket
            // dispatch(
            //   repoSlice.actions.ensureSessionRuntime({ lang: pod.lang })
            // );
            // 2. send
            dispatch(wsActions.wsRun(slackGetPlainText(pod.content)));
            // 3. the socket should have onData set to set the output
          }}
        >
          Run
        </Button>
      </HStack>
      <Box border="1px" w="sm">
        <CodeSlack
          value={
            pod.content || [
              {
                type: "paragraph",
                children: [{ text: "" }],
              },
            ]
          }
          onChange={(value) => {
            dispatch(
              repoSlice.actions.setPodContent({ id: pod.id, content: value })
            );
          }}
          language={pod.lang || "javascript"}
        />
      </Box>
    </VStack>
  );
}

function getNewTerm(sessionId, lang) {
  if (!lang) return DummyTerm();
  let socket = io(`http://localhost:4000`);
  socket.emit("spawn", sessionId, lang);
  let term = new Terminal();
  term.onData((data) => {
    socket.emit("terminalInput", data);
  });
  socket.on("terminalOutput", (data) => {
    term.write(data);
  });
  return term;
}

function ReplPod({ pod }) {
  const sessionId = useSelector((state) => state.repo.sessionId);
  const [term, setTerm] = useState(null);
  useEffect(() => {
    // setTerm(getNewTerm(sessionId, pod.lang));
  }, []);

  return (
    <VStack align="start" p={2}>
      <HStack>
        <InfoBar pod={pod} />
        <ToolBar pod={pod} />
        <SyncStatus pod={pod} />
        <TypeMenu pod={pod} />
        <LanguageMenu pod={pod} />
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
      </HStack>
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
    <VStack align="start" p={2}>
      <HStack>
        <InfoBar pod={pod} />
        <ToolBar pod={pod} />
        <SyncStatus pod={pod} />
        <TypeMenu pod={pod} />
      </HStack>
      <Box border="1px" w="sm">
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

function Pod({ id }) {
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
    return <CodePod pod={pod} />;
  } else if (pod.type === "REPL") {
    return <ReplPod pod={pod} />;
  } else if (pod.type === "DECK") {
    return <Text>Deck</Text>;
  } else {
    throw new Error(`Invalid pod type ${pod.type}`);
  }
}
