import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

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
  useClipboard,
  Input,
} from "@chakra-ui/react";
import { HStack, VStack, Select } from "@chakra-ui/react";
import { gql, useQuery, useMutation } from "@apollo/client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import StopIcon from "@material-ui/icons/Stop";
import { useDisclosure } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Paper from "@material-ui/core/Paper";
// import { CheckIcon } from "@material-ui/icons";
import RefreshIcon from "@material-ui/icons/Refresh";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import { Switch } from "@material-ui/core";
import Popper from "@material-ui/core/Popper";
import TextField from "@material-ui/core/TextField";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
// const Diff2html = require("diff2html");
// import { Diff2html } from "diff2html";
import * as Diff2Html from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

import {
  repoSlice,
  loadPodQueue,
  remoteUpdatePod,
  remoteUpdateAllPods,
  selectIsDirty,
  selectNumDirty,
  selectNumStaged,
  selectNumChanged,
  selectChangedIds,
  selectStagedIds,
} from "../../lib/store";
import { MyMonaco, MyMonacoDiff } from "../MyMonaco";
import { StyledLink as Link } from "../utils";

import * as wsActions from "../../lib/ws/actions";

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
          <Box>
            <Box as="span" color="blue">
              {lang}
            </Box>{" "}
            {runtimeConnected ? (
              <Box as="span" color="green">
                {kernel.status ? kernel.status : "Unknown"}
              </Box>
            ) : (
              <Box color="red" as="span">
                NA
              </Box>
            )}
            <Tooltip label="refresh status">
              <Button
                size="xs"
                onClick={() => {
                  dispatch(wsActions.wsRequestStatus({ lang }));
                }}
              >
                <RefreshIcon />
              </Button>
            </Tooltip>
            <Tooltip label="interrupt">
              <Button
                size="xs"
                onClick={() => {
                  dispatch(wsActions.wsInterruptKernel({ lang }));
                }}
              >
                <StopIcon />
              </Button>
            </Tooltip>
          </Box>
        </Box>
      ))}
    </Box>
  );
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

  let update_intervalId = null;

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

  useEffect(() => {
    if (!update_intervalId) {
      // clearInterval(update_intervalId);
      update_intervalId = setInterval(() => {
        // websocket resets after 60s of idle by most firewalls
        console.log("periodically saving ..");
        dispatch(remoteUpdateAllPods());
      }, 1000);
    }
  }, []);

  return (
    <Flex>
      <Button
        size="sm"
        onClick={() => {
          // run all pods
          dispatch(wsActions.wsRunAll());
        }}
      >
        Apply All
      </Button>

      {/* <Prompt
          when={numDirty > 0}
          message="You have unsaved changes. Are you sure you want to leave?"
        /> */}

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

      <Button
        size="sm"
        onClick={() => {
          dispatch(repoSlice.actions.clearAllResults());
        }}
      >
        Clear All
      </Button>
    </Flex>
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

function HtmlDiff({ diffstring }) {
  const diffJson = Diff2Html.parse(diffstring);
  const diffHtml = Diff2Html.html(diffJson, { drawFileList: true });
  return <div dangerouslySetInnerHTML={{ __html: diffHtml }} />;
}

function Diff2({}) {
  // select the content
  // compare to ???
  // or just create a monaco diff editor?
  const diffJson = Diff2Html.parse(`
  diff --git a/aaa.txt b/aaa.txt
  index 3462721..bd23c03 100644
  --- a/aaa.txt
  +++ b/aaa.txt
  @@ -1 +1 @@
  -hello!
  \ No newline at end of file
  +hello!world
  diff --git a/bbb.txt b/bbb.txt
  new file mode 100644
  index 0000000..f761ec1
  --- /dev/null
  +++ b/bbb.txt
  @@ -0,0 +1 @@
  +bbb
  diff --git a/ccc.txt b/ccc.txt
  new file mode 100644
  index 0000000..b2a7546
  --- /dev/null
  +++ b/ccc.txt
  @@ -0,0 +1 @@
  +ccc      
        `);
  const diffHtml = Diff2Html.html(diffJson, { drawFileList: true });
  return <div dangerouslySetInnerHTML={{ __html: diffHtml }} />;
}

function DiffButton({ from, to }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button size="sm" onClick={onOpen}>
        Diff
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent h="lg">
          <ModalHeader>CodePod Diff</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* <Lorem count={2} /> */}
            <Box w="100%" h="100%">
              <MyMonacoDiff from={from} to={to} />
            </Box>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
            <CommitButton disabled={from === to} />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function CommitButton({ disabled }) {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let [gitCommit, {}] = useMutation(
    gql`
      mutation GitCommit($reponame: String, $username: String, $msg: String) {
        gitCommit(reponame: $reponame, username: $username, msg: $msg)
      }
    `,
    { refetchQueries: ["GitGetHead", "GitDiff"] }
  );
  const dispatch = useDispatch();
  const anchorEl = useRef(null);
  const [show, setShow] = useState(false);
  const [value, setValue] = useState(null);
  return (
    <ClickAwayListener
      onClickAway={() => {
        setShow(false);
      }}
    >
      <Box>
        <Button
          ref={anchorEl}
          onClick={() => {
            // pop up a input box for entering exporrt
            setShow(!show);
          }}
          isDisabled={disabled}
          // size="xs"
        >
          Commit
        </Button>
        <Popper
          open={show}
          anchorEl={anchorEl.current}
          // need this, otherwise the z-index seems to be berried under Chakra Modal
          disablePortal
          placement="top"
        >
          <Paper>
            <TextField
              label="Msg (enter to submit)"
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
                  console.log("enter pressed, commiting with msg", value);
                  gitCommit({
                    variables: {
                      reponame,
                      username,
                      msg: value,
                    },
                  });
                  // also set the current
                  dispatch(repoSlice.actions.gitCommit());
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

function exportSingleFile(pods) {
  // export all pods into a single file
  function helper(id, level) {
    if (!pods[id]) {
      console.log("WARN invalid pod", id);
      return "";
    }
    let code1 = `
# CODEPOD ${id} ${pods[id].type}
${pods[id].content}
`;
    // add indentation
    code1 = code1.replaceAll("\n", "\n" + "    ".repeat(level));
    let code2 = pods[id].children
      .map(({ id }) => helper(id, level + 1))
      .join("\n");
    return code1 + code2;
  }
  return helper("ROOT", 0);
}

function RepoButton({}) {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let url;
  if (window.location.protocol === "http:") {
    url = `http://git.${window.location.host}/?p=${username}/${reponame}/.git`;
  } else {
    url = `https://git.${window.location.host}/?p=${username}/${reponame}/.git`;
  }
  let clonecmd = `git clone ${window.location.protocol}//git.${window.location.host}/${username}/${reponame}/.git`;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { hasCopied, onCopy } = useClipboard(clonecmd);
  return (
    <>
      <Button size="xs" onClick={onOpen}>
        Repo
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent h="xl">
          <ModalHeader>The Git Repo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* <Lorem count={2} /> */}
            <Box>
              Clone: <Code>{clonecmd}</Code>
              <Button onClick={onCopy}>{hasCopied ? "Copied" : "Copy"}</Button>
            </Box>
            <Box w="100%" h="100%">
              <iframe src={url} width="100%" height="100%" />
            </Box>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button variant="ghost">Commit</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function genRelJson(pods) {
  function helper(id) {
    if (pods[id].type !== "DECK") {
      return id;
    }
    const decks = pods[id].children
      .filter((x) => x.type === "DECK")
      .map((x) => x.id);
    const childPods = pods[id].children
      .filter((x) => x.type !== "DECK")
      .map((x) => x.id);
    return {
      id: id,
      pods: childPods.map(helper),
      decks: decks.map(helper),
    };
  }
  return helper("ROOT");
}

function RelButton() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const pods = useSelector((state) => state.repo.pods);
  return (
    <>
      <Button size="sm" onClick={onOpen}>
        Rel.json
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent h="lg">
          <ModalHeader>CodePod Diff</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box w="100%" h="100%">
              <MyMonaco
                value={JSON.stringify(genRelJson(pods), null, 2)}
                lang="json"
              />
            </Box>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function GitExportButton() {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let [gitExport, {}] = useMutation(
    gql`
      mutation GitExport($reponame: String, $username: String) {
        gitExport(reponame: $reponame, username: $username)
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  return (
    <Button
      onClick={() => {
        gitExport({
          variables: {
            reponame,
            username,
          },
        });
      }}
      size="xs"
    >
      GitExport
    </Button>
  );
}

function GitDiffButton({}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let { data, loading, error } = useQuery(
    gql`
      query GitDiff {
        gitDiff(reponame: "${reponame}", username: "${username}")
      }
    `
  );
  let [gitExport, {}] = useMutation(
    gql`
      mutation GitExport($reponame: String, $username: String) {
        gitExport(reponame: $reponame, username: $username)
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  return (
    <>
      <Button
        size="xs"
        onClick={() => {
          // first export
          gitExport({
            variables: {
              reponame,
              username,
            },
          });
          onOpen();
        }}
      >
        Diff
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />

        <ModalContent>
          <ModalHeader>CodePod Diff</ModalHeader>
          <ModalCloseButton />
          <ModalBody h={50} overflow="scroll">
            <Box>
              {loading && <Box>Loading ..</Box>}
              {/* FIXME diff2html cannot be wrapped in a fixed height div
              with overflow scroll, otherwise the line numbers are floating
               outside. see https://github.com/rtfpessoa/diff2html/issues/381

               Thus, I'm using Monaco instead.
                */}
              {data && data.gitDiff && <HtmlDiff diffstring={data.gitDiff} />}

              {error && (
                <Box>
                  Error{" "}
                  <Code whiteSpace="pre-wrap">
                    {JSON.stringify(error, null, 2)}
                  </Code>
                </Box>
              )}
            </Box>
          </ModalBody>

          <ModalFooter>
            <CommitButton disabled={!(data && data.gitDiff)} />
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function StageAllButton() {
  // FIXME this is re-rendering all the time
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let changed_ids = useSelector(selectChangedIds());
  let staged_ids = useSelector(selectStagedIds());
  let dispatch = useDispatch();
  // let ids = useSelector(selectNumChanged());
  // console.log("changed ids", ids);
  let [gitStageMulti, {}] = useMutation(
    gql`
      mutation GitStageMulti(
        $reponame: String
        $username: String
        $podIds: [ID]
      ) {
        gitStageMulti(reponame: $reponame, username: $username, podIds: $podIds)
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  let [gitUnstageMulti, {}] = useMutation(
    gql`
      mutation GitUnstageMulti(
        $reponame: String
        $username: String
        $podIds: [ID]
      ) {
        gitUnstageMulti(
          reponame: $reponame
          username: $username
          podIds: $podIds
        )
      }
    `,
    { refetchQueries: ["GitDiff"] }
  );
  return (
    <Box>
      <Button
        size="xs"
        onClick={() => {
          gitStageMulti({
            variables: {
              podIds: changed_ids,
              username,
              reponame,
            },
          });
          for (const id of changed_ids) {
            dispatch(repoSlice.actions.gitStage(id));
          }
        }}
      >
        Stage All
      </Button>
      <Button
        size="xs"
        onClick={() => {
          gitUnstageMulti({
            variables: {
              podIds: staged_ids,
              username,
              reponame,
            },
          });
          for (const id of staged_ids) {
            dispatch(repoSlice.actions.gitUnstage(id));
          }
        }}
      >
        Unstage All
      </Button>
    </Box>
  );
}

function GitBar() {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let dispatch = useDispatch();
  let { data, loading } = useQuery(gql`
    query GitGetHead {
      gitGetHead(reponame: "${reponame}", username: "${username}")
    }`);
  const numChanged = useSelector(selectNumChanged());
  const numStaged = useSelector(selectNumStaged());
  let to = useSelector((state) => exportSingleFile(state.repo.pods));
  if (loading) return <Text>Loading</Text>;
  let from = data.gitGetHead;
  return (
    <Box>
      <Text>
        Git{" "}
        <Box as="span" color="green">
          {numStaged}
        </Box>{" "}
        staged{" "}
        <Box as="span" color="red">
          {numChanged}
        </Box>{" "}
        changed
      </Text>
      {/* <DiffButton from={from} to={to} /> */}

      {/* <RelButton /> */}
      <Flex wrap="wrap">
        <StageAllButton />
        <GitDiffButton />
        <RepoButton />
        <GitExportButton />
      </Flex>
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

export function Sidebar() {
  return (
    <Box mx={2} px="1rem" boxShadow="xl" rounded="md" bg="gray.200">
      <Box boxShadow="xl" p="2" rounded="md" bg="gray.50">
        <SidebarSession />
      </Box>
      <Divider my={2} />
      <Box boxShadow="xl" p="2" rounded="md" bg="gray.50">
        <GitBar />
      </Box>
      <Divider my={2} />

      <Box boxShadow="xl" p="2" rounded="md" bg="gray.50">
        <SidebarRuntime />
        <SidebarKernel />
        {!window.codepod && <ActiveSessions />}
      </Box>
      <Box boxShadow="xl" p="2" rounded="md" bg="gray.50">
        <ToastError />
        <ApplyAll />
      </Box>
      <Divider my={2} />
    </Box>
  );
}
