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
            <CommitButton from={from} to={to} />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function CommitButton({ from, to }) {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let [gitCommit, {}] = useMutation(
    gql`
      mutation GitCommit(
        $reponame: String
        $username: String
        $content: String
        $msg: String
      ) {
        gitCommit(
          reponame: $reponame
          username: $username
          content: $content
          msg: $msg
        )
      }
    `,
    { refetchQueries: ["GitGetHead"] }
  );
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
          variant="ghost"
          onClick={() => {
            // pop up a input box for entering exporrt
            setShow(!show);
          }}
          isDisabled={from === to}
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
                      content: to,
                      msg: value,
                    },
                  });
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

function RepoButton() {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let url;
  if (window.location.protocol === "http:") {
    url = `http://git.${window.location.host}/?p=${username}/${reponame}/.git`;
  } else {
    url = `https://git.${window.location.host}/?p=${username}/${reponame}/.git`;
  }
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button size="sm" onClick={onOpen}>
        Repo
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent h="xl">
          <ModalHeader>The Git Repo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* <Lorem count={2} /> */}
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

function GitBar() {
  let reponame = useSelector((state) => state.repo.reponame);
  let username = useSelector((state) => state.repo.username);
  let { data, loading } = useQuery(gql`
    query GitGetHead {
      gitGetHead(reponame: "${reponame}", username: "${username}")
    }`);
  let to = useSelector((state) => exportSingleFile(state.repo.pods));
  if (loading) return <Text>Loading</Text>;
  let from = data.gitGetHead;
  return (
    <Box>
      <Text>Git</Text>
      <DiffButton from={from} to={to} />
      <RepoButton />
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
    <Box px="1rem">
      <SidebarSession />
      <SidebarRuntime />
      <SidebarKernel />
      <ToastError />
      <ApplyAll />
      <GitBar />
      <Divider my={2} />
      <ActiveSessions />
    </Box>
  );
}
