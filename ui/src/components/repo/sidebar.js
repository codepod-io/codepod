import { useParams, Link as ReactLink, Prompt } from "react-router-dom";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";

import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import DeleteForeverTwoToneIcon from "@mui/icons-material/DeleteForeverTwoTone";

import { purple, red, grey } from "@mui/material/colors";

import { useSnackbar } from "notistack";

import { gql, useQuery, useMutation } from "@apollo/client";

import StopIcon from "@mui/icons-material/Stop";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Paper from "@mui/material/Paper";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import ClickAwayListener from "@mui/base/ClickAwayListener";
// const Diff2html = require("diff2html");
// import { Diff2html } from "diff2html";
import * as Diff2Html from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

import { ClickInputButton } from "./toolbar";

import {
  repoSlice,
  loadPodQueue,
  remoteUpdatePod,
  remoteUpdateAllPods,
  selectNumDirty,
  selectNumStaged,
  selectNumChanged,
  selectChangedIds,
  selectStagedIds,
} from "../../lib/store";
import { MyMonaco, MyMonacoDiff } from "../MyMonaco";

import * as wsActions from "../../lib/ws/actions";
import produce from "immer";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

function Code(props) {
  return (
    <Box component="pre" {...props}>
      {props.children}
    </Box>
  );
}

function HStack(props) {
  return <Stack {...props}>{props.children}</Stack>;
}

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function SidebarSession() {
  let { username, reponame } = useParams();
  // const sessionId = useSelector((state) => state.repo.sessionId);
  let sessionId = useSelector((state) => state.repo.sessionId);
  const dispatch = useDispatch();

  return (
    <Box>
      <Box>
        Repo:{" "}
        <Link to={`/${username}`} component={ReactLink}>
          {username}
        </Link>{" "}
        /{" "}
        <Link to={`/${username}/${reponame}`} component={ReactLink}>
          {reponame}
        </Link>
      </Box>
      {/* <Text>SyncQueue: {queueL}</Text> */}
      <Box>
        Session ID: <Code>{sessionId}</Code>
        {/* <Button
            size="xs"
            onClick={() => {
              dispatch(repoSlice.actions.resetSessionId());
            }}
          >
            <RefreshIcon />
          </Button> */}
      </Box>
    </Box>
  );
}

function RuntimeItem({ socketAddress, mqAddress }) {
  const [edit, setEdit] = useState(false);
  const [addr1, setAddr1] = useState(socketAddress);
  const [addr2, setAddr2] = useState(mqAddress);
  const dispatch = useDispatch();
  const activeRuntime = useSelector((state) => state.repo.activeRuntime);
  let reponame = useSelector((state) => state.repo.reponame);
  const repoConfig = useSelector((state) => state.repo.repoConfig);
  const [updateRepoConfig, {}] = useMutation(
    gql`
      mutation UpdateRepoConfig($reponame: String, $config: String) {
        updateRepoConfig(name: $reponame, config: $config)
      }
    `,
    { refetchQueries: ["RepoConfig"] }
  );
  return (
    <Stack key={socketAddress} direction="row" alignItems="center">
      <Radio
        checked={
          JSON.stringify([socketAddress, mqAddress]) ==
          JSON.stringify(activeRuntime)
        }
        onChange={() => {
          dispatch(wsActions.wsDisconnect());
          dispatch(
            repoSlice.actions.activateRuntime([socketAddress, mqAddress])
          );
          // dispatch(wsActions.wsConnect());
        }}
        value="a"
        name="radio-buttons"
        inputProps={{ "aria-label": "A" }}
      />
      {edit ? (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <TextField
            size="small"
            value={addr1}
            onChange={(e) => {
              setAddr1(e.target.value);
            }}
          ></TextField>
          <TextField
            size="small"
            value={addr2}
            onChange={(e) => {
              setAddr2(e.target.value);
            }}
          ></TextField>
          <Button
            onClick={() => {
              updateRepoConfig({
                variables: {
                  reponame,
                  config: JSON.stringify({
                    runtimes: produce(repoConfig.runtimes, (draft) => {
                      let idx = draft.findIndex(
                        ([addr1, addr2]) => addr1 === socketAddress
                      );
                      draft[idx] = [addr1, addr2];
                    }),
                  }),
                },
              });
              setEdit(false);
            }}
          >
            Save
          </Button>
          <Button
            onClick={() => {
              setAddr1(socketAddress);
              setAddr2(mqAddress);
              setEdit(false);
            }}
          >
            Cancel
          </Button>
        </Box>
      ) : (
        <Box>
          <Box fontSize="small">{socketAddress}</Box>
          {mqAddress && <Box fontSize="small">{mqAddress}</Box>}
        </Box>
      )}

      {!edit && socketAddress !== "localhost:14321" && (
        <Box>
          <IconButton
            onClick={() => {
              updateRepoConfig({
                variables: {
                  reponame,
                  config: JSON.stringify({
                    runtimes: produce(repoConfig.runtimes, (draft) => {
                      let idx = draft.findIndex(
                        ([addr1, addr2]) => addr1 === socketAddress
                      );
                      draft.splice(idx, 1);
                    }),
                  }),
                },
              });
            }}
          >
            <DeleteForeverTwoToneIcon sx={{ fontSize: 15, color: "red" }} />
          </IconButton>
          <Button
            onClick={() => {
              setEdit(true);
            }}
          >
            Edit
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function SidebarRuntime() {
  const sessionRuntime = useSelector((state) => state.repo.sessionRuntime);
  const runtimeConnected = useSelector((state) => state.repo.runtimeConnected);
  // const runtimes = useSelector((state) => state.repo.runtimes);

  let reponame = useSelector((state) => state.repo.reponame);
  const [updateRepoConfig, {}] = useMutation(
    gql`
      mutation UpdateRepoConfig($reponame: String, $config: String) {
        updateRepoConfig(name: $reponame, config: $config)
      }
    `,
    { refetchQueries: ["RepoConfig"] }
  );
  const repoConfig = useSelector((state) => state.repo.repoConfig);
  const dispatch = useDispatch();
  return (
    <Box>
      <Box>
        Session Runtime:
        <Box>{Object.keys(sessionRuntime)}</Box>
      </Box>
      <Box>
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
      </Box>
      <Box sx={{ display: "flex" }}>
        <Button
          size="small"
          onClick={() => {
            dispatch(wsActions.wsConnect());
          }}
        >
          Connect
        </Button>
        {/* <Spacer /> */}
        <Button
          size="small"
          onClick={() => {
            dispatch(wsActions.wsDisconnect());
          }}
        >
          Disconnect
        </Button>
      </Box>
      <Box>
        Runtimes:
        <Button
          onClick={() => {
            dispatch(repoSlice.actions.addRuntime());
          }}
        >
          +
        </Button>
        {[["localhost:14321", ""]]
          .concat(repoConfig?.runtimes || [])
          .map(([address, mqAddress]) => (
            <RuntimeItem
              socketAddress={address}
              mqAddress={mqAddress}
              key={address + mqAddress}
            />
          ))}
      </Box>
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
            <Tooltip title="refresh status">
              <IconButton
                size="small"
                onClick={() => {
                  dispatch(wsActions.wsRequestStatus({ lang }));
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="interrupt">
              <IconButton
                size="small"
                onClick={() => {
                  dispatch(wsActions.wsInterruptKernel({ lang }));
                }}
              >
                <StopIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ApplyAll() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const numDirty = useSelector(selectNumDirty());

  function alertUser(e) {
    // I have to have both of these
    e.preventDefault();
    e.returnValue = "";
    enqueueSnackbar(`ERROR: You have unsaved changes!`, { variant: "error" });
  }

  let update_intervalId = null;

  useEffect(() => {
    if (numDirty > 0) {
      // FIXME doesn't work on mac?
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
        // console.log("periodically saving ..");
        dispatch(remoteUpdateAllPods());
      }, 1000);
    }
  }, []);

  return (
    <Flex>
      <Button
        size="small"
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
        size="small"
        disabled={numDirty == 0}
        onClick={() => {
          dispatch(remoteUpdateAllPods());
        }}
      >
        <CloudUploadIcon />
        <Box as="span" color="blue" mx={1}>
          {numDirty}
        </Box>
      </Button>

      <Button
        size="small"
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
    return <Box>Loading</Box>;
  }
  return (
    <Box>
      {data.activeSessions && (
        <Box>
          <Box>Active Sessions:</Box>
          {data.activeSessions.map((k) => (
            <Flex key={k}>
              <Box color="blue">{k}</Box>
              <Button
                size="small"
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
          // disablePortal
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

  const [hasCopied, setCopied] = useState(false);

  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  return (
    <>
      <Button size="small" onClick={handleOpen}>
        Repo
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            The Git Repo
          </Typography>
          <Box>
            Clone: <Code>{clonecmd}</Code>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(clonecmd);
                setCopied(true);
              }}
            >
              {hasCopied ? "Copied" : "Copy"}
            </Button>
          </Box>
          <Box w="100%" h="100%">
            <iframe src={url} width="100%" height="100%" />
          </Box>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            {/* Duis mollis, est non commodo luctus, nisi erat porttitor ligula. */}
            <Button mr={3} onClick={handleClose}>
              Close
            </Button>
            <Button>Commit</Button>
          </Typography>
        </Box>
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
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const pods = useSelector((state) => state.repo.pods);
  return (
    <>
      <Button size="small" onClick={handleOpen}>
        Rel.json
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            CodePod Diff
          </Typography>
          <Box w="100%" h="100%">
            <MyMonaco
              value={JSON.stringify(genRelJson(pods), null, 2)}
              lang="json"
            />
          </Box>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            <Button sx={{ mr: 2 }} onClick={handleClose}>
              Close
            </Button>
          </Typography>
        </Box>
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
    `
    // { refetchQueries: ["GitDiff"] }
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
      size="small"
    >
      GitExport
    </Button>
  );
}

function GitDiffButton({}) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
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
        size="small"
        onClick={() => {
          // first export
          gitExport({
            variables: {
              reponame,
              username,
            },
          });
          handleOpen();
        }}
      >
        Diff
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            CodePod Diff
          </Typography>
          <Box
            sx={{
              height: 30,
              overflow: "scroll",
            }}
          >
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
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            <CommitButton disabled={!(data && data.gitDiff)} />
            <Button sx={{ mr: 2 }} onClick={handleClose}>
              Close
            </Button>
          </Typography>
        </Box>
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
        size="small"
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
        size="small"
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
  if (loading) return <Box>Loading</Box>;
  let from = data.gitGetHead;
  return (
    <Box>
      <Box>
        Git{" "}
        <Box as="span" color="green">
          {numStaged}
        </Box>{" "}
        staged{" "}
        <Box as="span" color="red">
          {numChanged}
        </Box>{" "}
        changed
      </Box>
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
  const { enqueueSnackbar } = useSnackbar();
  const error = useSelector((state) => state.repo.error);
  const dispatch = useDispatch();
  useEffect(() => {
    if (error) {
      enqueueSnackbar(`ERROR: ${error.msg}`, { variant: error.type });
      // I'll need to clear this msg once it is displayed
      dispatch(repoSlice.actions.clearError());
    }
  }, [error]);
  return <Box></Box>;
}

function SidebarTest() {
  const dispatch = useDispatch();
  return (
    <Box>
      SidebarTest
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          dispatch(repoSlice.actions.foldAll());
        }}
      >
        Fold All
      </Button>
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          dispatch(repoSlice.actions.unfoldAll());
        }}
      >
        Unfold All
      </Button>
      <Button
        onClick={() => {
          dispatch(repoSlice.actions.clearAllExports());
        }}
      >
        ClearExports
      </Button>
    </Box>
  );
}

function ConfigButton() {
  let reponame = useSelector((state) => state.repo.reponame);
  const dispatch = useDispatch();
  // let username = useSelector((state) => state.repo.username);
  const { data, loading, error } = useQuery(gql`
    query RepoConfig {
      repoConfig(name: "${reponame}")
    }
  `);
  const [updateRepoConfig, {}] = useMutation(
    gql`
      mutation UpdateRepoConfig($reponame: String, $config: String) {
        updateRepoConfig(name: $reponame, config: $config)
      }
    `,
    { refetchQueries: ["RepoConfig"] }
  );
  const [str, setStr] = useState("");

  useEffect(() => {
    // console.log(data);
    if (data) {
      dispatch(repoSlice.actions.setRepoConfig(JSON.parse(data.repoConfig)));
      setStr(data.repoConfig);
    }
  }, [data]);
  const repoConfig = useSelector((state) => state.repo.repoConfig);
  // console.log("repoConfig", repoConfig);
  // console.log("ConfigButton", data);
  // const [open, setOpen] = React.useState(false);
  // const handleOpen = () => setOpen(true);
  // const handleClose = () => setOpen(false);
  // const { isOpen, onOpen, onClose } = useDisclosure();
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
  };
  return (
    <div>
      <Button onClick={handleOpen}>Config</Button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Config
          </Typography>
          <Box>
            <Box>Double Click to Edit</Box>
            <Switch
              defaultChecked={repoConfig && repoConfig.doubleClickToEdit}
              onChange={(e) => {
                // dispatch(repoSlice.actions.setDevMode(e.target.checked));
                updateRepoConfig({
                  variables: {
                    reponame,
                    config: JSON.stringify({
                      doubleClickToEdit: e.target.checked,
                    }),
                  },
                });
              }}
            ></Switch>
          </Box>

          <Box>
            Dev Mode{" "}
            <Switch
              defaultChecked={repoConfig && repoConfig.devMode}
              onChange={(e) => {
                // console.log(e.target.checked);
                // dispatch(repoSlice.actions.setDevMode(e.target.checked));
                updateRepoConfig({
                  variables: {
                    reponame,
                    config: JSON.stringify({
                      devMode: e.target.checked,
                    }),
                  },
                });
              }}
            ></Switch>
          </Box>

          <Button mr={3} onClick={handleClose}>
            Close
          </Button>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
          </Typography>
          <MyMonaco
            onChange={(value) => {
              // dispatch(repoSlice.actions.setRepoConfig(value));
              setStr(value);
            }}
            value={str}
          ></MyMonaco>
          <Button
            onClick={() => {
              updateRepoConfig({
                variables: {
                  reponame,
                  config: JSON.stringify(JSON.parse(str)),
                },
              });
            }}
          >
            Save
          </Button>
        </Box>
      </Modal>
    </div>
  );
}

export function Sidebar() {
  return (
    <Box
      sx={{
        mx: 1,
        p: 2,
        boxShadow: 3,
        borderRadius: 2,
        background: grey[50],
      }}
    >
      <Box
        sx={{
          boxShadow: 3,
          p: 2,
          borderRadius: 2,
          background: grey[50],
        }}
      >
        <SidebarSession />
      </Box>
      <Divider my={2} />
      <Box
        sx={{
          boxShadow: 3,
          p: 2,
          borderRadius: 2,
          background: grey[50],
        }}
      >
        {/* <GitBar /> */}
        <Flex wrap="wrap">
          <GitExportButton />
        </Flex>
      </Box>
      <Divider my={2} />

      <Box
        sx={{
          boxShadow: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: grey[50],
        }}
      >
        <SidebarTest />
      </Box>
      <Divider my={2} />
      <Box
        sx={{
          boxShadow: 3,
          p: 2,
          borderRadius: 2,
          bg: grey[50],
        }}
      >
        <SidebarRuntime />
        <SidebarKernel />
        {window.codepodio && <ActiveSessions />}
      </Box>
      <Box sx={{ boxShadow: 3, p: 2, borderRadius: 2, bg: grey[50] }}>
        <ToastError />
        <ApplyAll />
      </Box>
      <Divider my={2} />
      <ConfigButton />
    </Box>
  );
}
