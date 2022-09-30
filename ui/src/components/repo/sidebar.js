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
import { usePrompt } from "./prompt";

import {
  repoSlice,
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
  let { id } = useParams();
  // const sessionId = useSelector((state) => state.repo.sessionId);
  let sessionId = useSelector((state) => state.repo.sessionId);
  const dispatch = useDispatch();

  return (
    <Box>
      <Box>
        Repo ID: <Box color="blue">{id}</Box>
      </Box>
      {/* <Text>SyncQueue: {queueL}</Text> */}
      <Box>
        Session ID: <Box color="blue">{sessionId}</Box>
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

function SidebarRuntime() {
  const sessionRuntime = useSelector((state) => state.repo.sessionRuntime);
  const runtimeConnected = useSelector((state) => state.repo.runtimeConnected);
  // const runtimes = useSelector((state) => state.repo.runtimes);

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
  const numDirty = useSelector(selectNumDirty());
  usePrompt(
    `You have unsaved ${numDirty} changes. Are you sure you want to leave?`,
    numDirty > 0
  );

  let update_intervalId = null;

  useEffect(() => {
    if (!update_intervalId) {
      // clearInterval(update_intervalId);
      update_intervalId = setInterval(() => {
        // websocket resets after 60s of idle by most firewalls
        // console.log("periodically saving ..");
        // dispatch(remoteUpdateAllPods());
      }, 1000);
    }
  }, []);

  return (
    <Box>
      <Button
        size="small"
        disabled={numDirty == 0}
        onClick={() => {
          dispatch(remoteUpdateAllPods());
        }}
      >
        <CloudUploadIcon />
        {numDirty > 0 ? (
          <Box as="span" color="blue" mx={1}>
            Saving {numDirty} to cloud ..
          </Box>
        ) : (
          <Box as="span" color="grey" mx={1}>
            Saved to cloud.
          </Box>
        )}
      </Button>

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
          onClick={() => {
            dispatch(repoSlice.actions.clearAllResults());
          }}
        >
          Clear All
        </Button>
      </Flex>
    </Box>
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
      <Box sx={{ boxShadow: 3, p: 2, borderRadius: 2, bg: grey[50] }}>
        <ToastError />
        <ApplyAll />
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
        <ActiveSessions />
      </Box>

      <Divider my={2} />
      {/* <ConfigButton /> */}
    </Box>
  );
}
