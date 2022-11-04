import { useEffect, useState, useContext } from "react";

import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";

import { grey } from "@mui/material/colors";

import { useSnackbar, VariantType } from "notistack";

import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client";

import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import { useStore } from "zustand";

import { usePrompt } from "../lib/prompt";

import { RepoContext, selectNumDirty } from "../lib/store";

import useMe from "../lib/me";

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function SidebarSession() {
  let { id } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  let sessionId = useStore(store, (state) => state.sessionId);
  const repoName = useStore(store, (state) => state.repoName);

  console.log(`Repo ID: ${id} Session ID: ${sessionId}`);

  return (
    <Box>
      <Box>
        Project Name: <Box color="blue">{repoName || "Untitled"}</Box>
      </Box>
    </Box>
  );
}

function SidebarRuntime() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const runtimeConnected = useStore(store, (state) => state.runtimeConnected);
  const wsConnect = useStore(store, (state) => state.wsConnect);
  const client = useApolloClient();
  const wsDisconnect = useStore(store, (state) => state.wsDisconnect);
  const { loading, me } = useMe();
  let { id: repoId } = useParams();
  useEffect(() => {
    console.log("Connecting to runtime at the beginning ..");
    wsConnect(client, `${me.id}_${repoId}`);
  }, []);
  if (loading) return <Box>loading</Box>;
  return (
    <Box>
      <Box>
        Runtime connected?{" "}
        {runtimeConnected ? (
          <Box component="span" color="green">
            Yes
          </Box>
        ) : (
          <Box component="span" color="red">
            No
          </Box>
        )}
      </Box>
      <Box sx={{ display: "flex" }}>
        <Button
          size="small"
          onClick={() => {
            wsConnect(client, `${me.id}_${repoId}`);
          }}
        >
          Connect
        </Button>
        {/* <Spacer /> */}
        <Button
          size="small"
          onClick={() => {
            wsDisconnect();
          }}
        >
          Disconnect
        </Button>
      </Box>
    </Box>
  );
}

function SidebarKernel() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const kernels = useStore(store, (state) => state.kernels);
  const runtimeConnected = useStore(store, (state) => state.runtimeConnected);
  const wsRequestStatus = useStore(store, (state) => state.wsRequestStatus);
  const wsInterruptKernel = useStore(store, (state) => state.wsInterruptKernel);
  return (
    <Box>
      {/* CAUTION Object.entries is very tricky. Must use for .. of, and the destructure must be [k,v] LIST */}
      {Object.entries(kernels).map(([lang, kernel]) => (
        <Box key={`lang-${lang}`}>
          <Box>
            <Box component="span" color="blue">
              {lang}
            </Box>{" "}
            {runtimeConnected ? (
              <Box component="span" color="green">
                {kernel.status ? kernel.status : "Unknown"}
              </Box>
            ) : (
              <Box color="red" component="span">
                NA
              </Box>
            )}
            <Tooltip title="refresh status">
              <IconButton
                size="small"
                onClick={() => {
                  wsRequestStatus({ lang });
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="interrupt">
              <IconButton
                size="small"
                onClick={() => {
                  wsInterruptKernel({ lang });
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
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const numDirty = useStore(store, selectNumDirty());
  const clearAllResults = useStore(store, (s) => s.clearAllResults);
  const remoteUpdateAllPods = useStore(store, (s) => s.remoteUpdateAllPods);
  usePrompt(
    `You have unsaved ${numDirty} changes. Are you sure you want to leave?`,
    numDirty > 0
  );

  let [intervalId, setIntervalId] =
    useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    console.log("Setting interval");
    let id = setInterval(() => {
      // websocket resets after 60s of idle by most firewalls
      console.log("periodically saving ..");
      remoteUpdateAllPods();
    }, 1000);
    return () => {
      console.log("removing interval");
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Button
        size="small"
        disabled={numDirty === 0}
        onClick={() => {
          remoteUpdateAllPods();
        }}
      >
        <CloudUploadIcon />
        {numDirty > 0 ? (
          <Box component="span" color="blue" mx={1}>
            save {numDirty} to cloud
          </Box>
        ) : (
          <Box component="span" color="grey" mx={1}>
            Saved to cloud.
          </Box>
        )}
      </Button>

      <Flex>
        <Button
          size="small"
          onClick={() => {
            clearAllResults();
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
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const runtimeConnected = useStore(store, (state) => state.runtimeConnected);
  useEffect(() => {
    console.log("----- refetching active sessions ..");
    refetch();
  }, [runtimeConnected, refetch]);
  const [killSession] = useMutation(
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
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const { enqueueSnackbar } = useSnackbar();
  const error = useStore(store, (state) => state.error);
  const clearError = useStore(store, (state) => state.clearError);
  useEffect(() => {
    if (error) {
      enqueueSnackbar(`ERROR: ${error.msg}`, {
        variant: error.type as VariantType,
      });
      // I'll need to clear this msg once it is displayed
      clearError();
    }
  }, [error, enqueueSnackbar, clearError]);
  return <Box></Box>;
}

function SidebarTest() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const foldAll = useStore(store, (state) => state.foldAll);
  const unfoldAll = useStore(store, (state) => state.unfoldAll);
  const clearAllExports = useStore(store, (state) => state.clearAllExports);

  return (
    <Box>
      SidebarTest
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          foldAll();
        }}
      >
        Fold All
      </Button>
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          unfoldAll();
        }}
      >
        Unfold All
      </Button>
      <Button
        onClick={() => {
          clearAllExports();
        }}
      >
        ClearExports
      </Button>
    </Box>
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
      <Divider sx={{ my: 2 }} />
      <Box sx={{ boxShadow: 3, p: 2, borderRadius: 2, bg: grey[50] }}>
        <ToastError />
        <ApplyAll />
      </Box>
      <Divider sx={{ my: 2 }} />

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
      <Divider sx={{ my: 2 }} />
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

      <Divider sx={{ my: 2 }} />
      {/* <ConfigButton /> */}
    </Box>
  );
}
