import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

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
  Spacer,
  Divider,
  useToast,
  Input,
} from "@chakra-ui/react";
import { Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import { HStack, VStack, Select } from "@chakra-ui/react";
import { useClipboard } from "@chakra-ui/react";
import { gql, useQuery, useMutation } from "@apollo/client";

import {
  ArrowUpIcon,
  ArrowForwardIcon,
  ArrowDownIcon,
  CheckIcon,
  CloseIcon,
  RepeatIcon,
  HamburgerIcon,
  InfoIcon,
  ChevronDownIcon,
  DragHandleIcon,
  DeleteIcon,
  AddIcon,
  QuestionOutlineIcon,
} from "@chakra-ui/icons";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useResizeObserver from "use-resize-observer";
import io from "socket.io-client";

import Popover from "@material-ui/core/Popover";
import Paper from "@material-ui/core/Paper";
import stripAnsi from "strip-ansi";

import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { CgMenuRound } from "react-icons/cg";
// import { CheckIcon } from "@material-ui/icons";
import RefreshIcon from "@material-ui/icons/Refresh";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import { Switch } from "@material-ui/core";
import Popper from "@material-ui/core/Popper";
import TextField from "@material-ui/core/TextField";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import { AiOutlineFunction } from "react-icons/ai";
import Ansi from "ansi-to-react";

import { MdImportExport, MdSwapVert, MdCallMissed } from "react-icons/md";

import {
  repoSlice,
  loadPodQueue,
  remoteUpdatePod,
  remoteUpdateAllPods,
  selectIsDirty,
  selectNumDirty,
} from "../lib/store";
import { MySlate } from "../components/MySlate";
import { RichCodeSlate as CodeSlate } from "../components/CodeSlate";
import { MyMonaco } from "../components/MyMonaco";
import { StyledLink as Link } from "../components/utils";

import { Terminal } from "xterm";
import { XTerm, DummyTerm } from "../components/MyXTerm";
import * as wsActions from "../lib/wsActions";
import useMe from "../lib/me";

import brace from "../GullBraceLeft.svg";

function SidebarSession() {
  let { username, reponame } = useParams();
  // const sessionId = useSelector((state) => state.repo.sessionId);
  let sessionId = useSelector((state) => state.repo.sessionId);
  const dispatch = useDispatch();

  return (
    <Box>
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
      {/* <Text>SyncQueue: {queueL}</Text> */}
      <Text>
        Session ID: <Code>{sessionId}</Code>
        {/* <Button
          size="xs"
          onClick={() => {
            dispatch(repoSlice.actions.resetSessionId());
          }}
        >
          <RefreshIcon />
        </Button> */}
      </Text>
    </Box>
  );
}

function SidebarRuntime() {
  const sessionRuntime = useSelector((state) => state.repo.sessionRuntime);
  const runtimeConnected = useSelector((state) => state.repo.runtimeConnected);
  const dispatch = useDispatch();
  return (
    <Box>
      <Text>
        Session Runtime:
        <Code>{Object.keys(sessionRuntime)}</Code>
      </Text>
      <Text>
        Runtime connected?{" "}
        {runtimeConnected ? (
          <Box as="span" color="green">
            Yes
          </Box>
        ) : (
          <Box as="span" color="red">
            No
          </Box>
        )}
      </Text>

      <HStack>
        <Button
          size="sm"
          onClick={() => {
            dispatch(wsActions.wsConnect());
          }}
        >
          Connect
        </Button>
        {/* <Spacer /> */}
        <Button
          size="sm"
          onClick={() => {
            dispatch(wsActions.wsDisconnect());
          }}
        >
          Disconnect
        </Button>
      </HStack>
    </Box>
  );
}

function SidebarKernel() {
  const kernels = useSelector((state) => state.repo.kernels);
  const sessionId = useSelector((state) => state.repo.sessionId);
  const runtimeConnected = useSelector((state) => state.repo.runtimeConnected);
  const dispatch = useDispatch();
  return (
    <Box>
      {/* CAUTION Object.entries is very tricky. Must use for .. of, and the destructure must be [k,v] LIST */}
      {Object.entries(kernels).map(([lang, kernel]) => (
        <Box key={`lang-${lang}`}>
          <Text>
            kernel name:{" "}
            <Box as="span" color="blue">
              {lang}
            </Box>
          </Text>
          <Text>
            Status:{" "}
            {runtimeConnected ? (
              <Box as="span" color="blue">
                {kernel.status ? kernel.status : "Unknown"}
              </Box>
            ) : (
              <Box color="red" as="span">
                disconnected
              </Box>
            )}
            <Button
              size="xs"
              onClick={() => {
                dispatch(wsActions.wsRequestStatus({ sessionId, lang }));
              }}
            >
              <RefreshIcon />
            </Button>
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function ToastError() {
  const toast = useToast();
  const error = useSelector((state) => state.repo.error);
  const dispatch = useDispatch();
  useEffect(() => {
    if (error) {
      toast({
        title: `ERROR`,
        position: "top-right",
        description: error.msg,
        status: error.type,
        duration: 3000,
        isClosable: true,
      });
      // I'll need to clear this msg once it is displayed
      dispatch(repoSlice.actions.clearError());
    }
  }, [error]);
  return <Box></Box>;
}

function ApplyAll() {
  const dispatch = useDispatch();
  const toast = useToast();
  const numDirty = useSelector(selectNumDirty());

  function alertUser(e) {
    // I have to have both of these
    e.preventDefault();
    e.returnValue = "";
    toast({
      title: `ERROR`,
      description: "You have unsaved changes!",
      status: "error",
      duration: 3000,
      isClosable: true,
    });
  }

  useEffect(() => {
    if (numDirty > 0) {
      // window.onbeforeunload = () => true;
      window.addEventListener("beforeunload", alertUser);
    } else {
      // window.onbeforeunload = undefined;
    }
    return () => {
      window.removeEventListener("beforeunload", alertUser);
    };
  }, [numDirty]);
  return (
    <HStack>
      <Button
        size="sm"
        onClick={() => {
          // run all pods
          dispatch(wsActions.wsRunAll());
        }}
      >
        Apply All Pods
      </Button>

      <Prompt
        when={numDirty > 0}
        message="You have unsaved changes. Are you sure you want to leave?"
      />

      <Button
        size="sm"
        disabled={numDirty == 0}
        onClick={() => {
          dispatch(remoteUpdateAllPods());
        }}
      >
        <CloudUploadIcon />
        <Text as="span" color="blue" mx={1}>
          {numDirty}
        </Text>
      </Button>
    </HStack>
  );
}

function ActiveSessions() {
  const { loading, data, refetch } = useQuery(gql`
    query GetActiveSessions {
      activeSessions
    }
  `);
  const runtimeConnected = useSelector((state) => state.repo.runtimeConnected);
  useEffect(() => {
    console.log("----- refetching active sessions ..");
    refetch();
  }, [runtimeConnected]);
  const [killSession, { data: _data }] = useMutation(
    gql`
      mutation KillSession($sessionId: String!) {
        killSession(sessionId: $sessionId)
      }
    `,
    {
      refetchQueries: ["GetActiveSessions"],
    }
  );
  if (loading) {
    return <Text>Loading</Text>;
  }
  return (
    <Box>
      {data.activeSessions && (
        <Box>
          <Text>Active Sessions:</Text>
          {data.activeSessions.map((k) => (
            <Flex key={k}>
              <Text color="blue">{k}</Text>
              <Button
                size="sm"
                onClick={() => {
                  killSession({
                    variables: {
                      sessionId: k,
                    },
                  });
                }}
              >
                Kill
              </Button>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Sidebar() {
  return (
    <Box px="1rem">
      <SidebarSession />
      <SidebarRuntime />
      <SidebarKernel />
      <ToastError />
      <ApplyAll />

      <Divider my={2} />
      <ActiveSessions />
    </Box>
  );
}

export default function Repo() {
  let { username, reponame } = useParams();
  const dispatch = useDispatch();
  dispatch(repoSlice.actions.setRepo({ username, reponame }));
  const { loading, me } = useMe();
  useEffect(() => {
    if (me) {
      dispatch(
        repoSlice.actions.setSessionId(
          `${me?.username}_${username}_${reponame}`
        )
      );
      dispatch(wsActions.wsConnect());
    }
  }, [me]);
  useEffect(() => {
    // load the repo
    dispatch(loadPodQueue({ username, reponame }));
    // dispatch(wsActions.wsConnect());
  }, []);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.
  //
  // const queueL = useSelector((state) => state.repo.queue.length);
  const repoLoaded = useSelector((state) => state.repo.repoLoaded);

  if (loading) return <Text>Loading</Text>;

  return (
    <Box m="auto" height="100%">
      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w="18%"
        overflow="auto"
      >
        <Sidebar />
      </Box>
      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w="80%"
        overflow="scroll"
      >
        {!repoLoaded && <Text>Repo Loading ...</Text>}
        {repoLoaded && (
          <Box height="100%" border="solid 3px" p={2} overflow="auto">
            <Deck id="ROOT" />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function SyncStatus({ pod }) {
  const dispatch = useDispatch();
  const isDirty = useSelector(selectIsDirty(pod.id));
  if (pod.isSyncing) {
    return (
      <Box>
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="sm"
        />
      </Box>
    );
  } else if (isDirty) {
    return (
      <Box>
        <Button
          size="xs"
          variant="ghost"
          // icon={}
          // colorScheme={"yellow"}
          onClick={() => {
            dispatch(remoteUpdatePod(pod));
          }}
        >
          <RepeatIcon />
        </Button>
      </Box>
    );
  } else {
    return (
      <Box>
        <Button size="xs" variant="ghost" isDisabled>
          <CheckIcon />
        </Button>
      </Box>
    );
  }
}

function InfoBar({ pod }) {
  /* eslint-disable no-unused-vars */
  const [value, setValue] = useState(pod.id);
  const { hasCopied, onCopy } = useClipboard(value);
  const [show, setShow] = useState(false);
  const anchorEl = useRef(null);
  return (
    <Box>
      <Button
        size="sm"
        ref={anchorEl}
        onClick={(e) => {
          setShow(!show);
        }}
      >
        {/* <InfoOutlinedIcon /> */}
        <InfoIcon />
      </Button>
      <Popper open={show} anchorEl={anchorEl.current} placement="left-start">
        <Paper>
          <Box p={5}>
            The content of the Popover.
            <Box>
              <Text>
                ID:{" "}
                <Code colorScheme="blackAlpha">
                  {
                    // pod.id.substring(0, 8)
                    pod.id
                  }
                </Code>
                <Button onClick={onCopy}>
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
              </Text>
              <Text>
                Namespace:
                <Code colorScheme="blackAlpha">{pod.ns}</Code>
              </Text>
              <Text mr={5}>Index: {pod.index}</Text>
              <Text>
                Parent:{" "}
                <Code colorScheme="blackAlpha">
                  {pod.parent.substring(0, 8)}
                </Code>
              </Text>
            </Box>
          </Box>
        </Paper>
      </Popper>
    </Box>
  );
}

function ExportButton({ id }) {
  const anchorEl = useRef(null);
  const [show, setShow] = useState(false);
  const [value, setValue] = useState(null);
  const dispatch = useDispatch();
  return (
    <ClickAwayListener
      onClickAway={() => {
        setShow(false);
      }}
    >
      <Box>
        <Button
          ref={anchorEl}
          variant="ghost"
          size="xs"
          onClick={() => {
            // pop up a input box for entering exporrt
            setShow(!show);
          }}
        >
          <AiOutlineFunction />
        </Button>
        <Popper open={show} anchorEl={anchorEl.current} placement="top">
          <Paper>
            <TextField
              label="Export"
              variant="outlined"
              // focused={show}
              autoFocus
              onChange={(e) => {
                setValue(e.target.value);
              }}
              onKeyDown={(e) => {
                // enter
                // keyCode is deprecated in favor of code, but chrome didn't have
                // it ..
                if (e.keyCode === 13 && value) {
                  console.log("enter pressed, adding", value);
                  dispatch(repoSlice.actions.addPodExport({ id, name: value }));
                  // clear value
                  setValue(null);
                  // click away
                  setShow(false);
                }
              }}
            />
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}

function ToolBar({ pod }) {
  const dispatch = useDispatch();
  const [show, setShow] = useState(false);
  return (
    <Flex>
      <ExportButton id={pod.id} />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.parent,
              index: pod.index,
              type: pod.type,
              lang: pod.lang,
            })
          );
        }}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.parent,
              index: pod.index + 1,
              type: pod.type,
              lang: pod.lang,
            })
          );
        }}
      >
        <ArrowDownIcon />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          dispatch(
            repoSlice.actions.addPod({
              parent: pod.id,
              type: pod.type,
              lang: pod.lang,
              index: 0,
            })
          );
        }}
      >
        <ArrowForwardIcon />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        color="red"
        onClick={() => {
          dispatch(repoSlice.actions.deletePod({ id: pod.id }));
        }}
      >
        <DeleteIcon />
      </Button>
    </Flex>
  );
}

function LanguageMenu({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      <Select
        size="xs"
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
        <option value="racket">Racket</option>
        <option value="scheme">Scheme</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
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
      <Select
        size="xs"
        placeholder="Select option"
        value={pod.type || ""}
        onChange={(e) =>
          dispatch(
            repoSlice.actions.setPodType({
              id: pod.id,
              type: e.target.value,
            })
          )
        }
      >
        <option value="CODE">CODE</option>
        <option value="WYSIWYG">WYSIWYG</option>
        <option value="REPL">REPL</option>
        <option value="MD">Markdown</option>
      </Select>
    </Box>
  );
}

// FIXME this should be cleared if pods get deleted
const deckCache = {};

function getDeck(id) {
  // avoid re-rendering
  if (!(id in deckCache)) {
    deckCache[id] = <Deck id={id} key={id}></Deck>;
  }
  return deckCache[id];
}

function Deck({ id }) {
  const dispatch = useDispatch();
  const pod = useSelector((state) => state.repo.pods[id]);
  return (
    <VStack align="start">
      <Box>
        {/* LEFT */}
        <Flex align="center">
          {pod.id === "ROOT" ? (
            <Box>
              {pod.children.length == 0 && (
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
                  <AddIcon />
                </Button>
              )}
            </Box>
          ) : (
            <Pod id={pod.id} />
          )}
          {pod.children.length > 0 && (
            <Flex>
              {/* The brace */}
              {pod.id !== "ROOT" && (
                <Box ml={1}>
                  <Image
                    // src={require("../GullBraceLeft.svg")}
                    src={brace}
                    // src="../GullBraceLeft.svg"
                    alt="brace"
                    h="100%"
                    maxW="none"
                    w="20px"
                  />
                </Box>
              )}
              {/* RIGHT */}
              <Flex direction="column">
                <Code colorScheme="blackAlpha">{pod.id}</Code>
                {pod.children.map((id) => {
                  return getDeck(id);
                })}
              </Flex>
            </Flex>
          )}
        </Flex>
      </Box>
    </VStack>
  );
}

function IOStatus({ id, name }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const status = useSelector((state) => state.repo.pods[id].io[name]);
  if (!status) {
    return (
      <Box as="span" size="xs" variant="ghost">
        <QuestionOutlineIcon color="orange" />
      </Box>
    );
  } else if ("result" in status) {
    return (
      <Button as="span" size="xs" variant="ghost">
        <CheckIcon color="green" />
      </Button>
    );
  } else if ("error" in status) {
    console.log("Error:", status);
    return (
      <Box>
        <Button
          as="span"
          onClick={(e) => {
            setAnchorEl(e.currentTarget);
          }}
        >
          <CloseIcon color="red" />
        </Button>
        <Popover
          open={Boolean(anchorEl)}
          onClose={() => {
            setAnchorEl(null);
          }}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        >
          <Box maxW="lg">
            <Text color="red">{status.error.evalue}</Text>
            {status.error.stacktrace && (
              <Text>
                StackTrace:
                <Code whiteSpace="pre-wrap">
                  {stripAnsi(status.error.stacktrace.join("\n"))}
                </Code>
              </Text>
            )}
          </Box>
        </Popover>
      </Box>
    );
  }
}

function HoveringBar({ pod, showMenu }) {
  let dispatch = useDispatch();
  // const [anchorEl, setAnchorEl] = React.useState(null);
  const [show, setShow] = useState(false);
  const anchorEl = useRef(null);
  const [showForce, setShowForce] = useState(false);
  return (
    <Flex>
      {/* <Button
        size="sm"
        onClick={(e) => {
          setAnchorEl(anchorEl ? null : e.currentTarget);
        }}
      >
        Tool
      </Button> */}

      <Box
        ref={anchorEl}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        // onClick={() => setShowForce(!showForce)}
        visibility={showMenu || show || showForce ? "visible" : "hidden"}
      >
        <CgMenuRound size={25} />
      </Box>

      <Popper
        // open={Boolean(anchorEl)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        open={showForce || show}
        anchorEl={anchorEl.current}
        placement="left-start"
      >
        <Flex
          direction="column"
          bg="white"
          border="1px"
          p={3}
          rounded="md"
          boxShadow="md"
        >
          <HStack>
            <InfoBar pod={pod} />
          </HStack>
          <HStack my={2}>
            <TypeMenu pod={pod} />
            <LanguageMenu pod={pod} />
          </HStack>
          <HStack>
            <Button
              size="sm"
              onClick={() => {
                dispatch(repoSlice.actions.toggleRaw(pod.id));
              }}
            >
              {pod.raw ? "raw" : "wrapped"}
            </Button>
            <Button
              size="sm"
              isDisabled={!pod.lang}
              onClick={() => {
                // 1. create or load runtime socket
                // dispatch(
                //   repoSlice.actions.ensureSessionRuntime({ lang: pod.lang })
                // );
                // clear previous results
                dispatch(repoSlice.actions.clearResults(pod.id));
                // 2. send
                dispatch(wsActions.wsRun(pod.id));
                // 3. the socket should have onData set to set the output
              }}
            >
              Run
            </Button>
          </HStack>
          <Box>
            <MyInputButton
              placeholder="identifier"
              onClick={(name) => {
                dispatch(repoSlice.actions.addPodExport({ id: pod.id, name }));
              }}
            >
              Add Ex-port
            </MyInputButton>
            <MyInputButton
              placeholder="identifier"
              onClick={(name) => {
                dispatch(repoSlice.actions.addPodMidport({ id: pod.id, name }));
              }}
            >
              Add Mid-port
            </MyInputButton>
          </Box>
        </Flex>
      </Popper>
    </Flex>
  );
}

function MyInputButton({ onClick = (v) => {}, placeholder, children }) {
  const [value, setValue] = useState("");
  return (
    <Box>
      <Input
        size="sm"
        // maxWidth={20}
        w="50%"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      ></Input>
      <Button size="sm" onClick={() => onClick(value)}>
        {children}
      </Button>
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

function ExportList({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.exports && Object.keys(pod.exports).length > 0 && (
        <Box>
          <Text as="span" mr={2}>
            Exports:
          </Text>
          {Object.entries(pod.exports).map(([k, v]) => (
            <Box as="span" key={k} mr={1}>
              <Code>{k}</Code>
              <Switch
                size="small"
                checked={v}
                onChange={() => {
                  dispatch(wsActions.wsToggleExport({ id: pod.id, name: k }));
                }}
              />
              <Button
                size="xs"
                color="red"
                variant="ghost"
                onClick={() => {
                  // FIXME also delete all imports for it
                  // Or just show error
                  dispatch(
                    repoSlice.actions.deletePodExport({ id: pod.id, name: k })
                  );
                }}
              >
                <CloseIcon />
              </Button>
              {/* No need IOStatus for exports */}
              {/* <IOStatus id={pod.id} name={k} /> */}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ImportList({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.imports && Object.keys(pod.imports).length > 0 && (
        <Box>
          <Text as="span" mr={2}>
            Imports:
          </Text>
          {Object.entries(pod.imports).map(([k, v]) => (
            <Box key={k} as="span">
              <Code>{k}</Code>
              <Switch
                size="small"
                checked={v}
                onChange={() => {
                  dispatch(wsActions.wsToggleImport({ id: pod.id, name: k }));
                }}
              />
              <IOStatus id={pod.id} name={k} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function MidportList({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.midports && Object.keys(pod.midports).length > 0 && (
        <Box>
          <Text as="span" mr={2}>
            Midports:
          </Text>
          {Object.entries(pod.midports).map(([k, v]) => (
            <Box key={k}>
              <Switch
                size="small"
                checked={v}
                onChange={() => {
                  dispatch(
                    wsActions.wsToggleMidport({ id: pod.id, name: k })
                    // repoSlice.actions.togglePodMidport({
                    //   id: pod.id,
                    //   name: k,
                    // })
                  );
                }}
              />
              <Code>{k}</Code>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Pod({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = useState(false);
  return (
    <Box ml={5} mb={1} w="md">
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
          <HoveringBar pod={pod} showMenu={showMenu} />
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
        <Box overflow="scroll" h="3xs" border="1px" bg="gray.50">
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
        <Box overflow="scroll" h="3xs" border="1px" bg="gray.50">
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
                repoSlice.actions.addPod({
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
