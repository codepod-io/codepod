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
import { Grid } from "@mui/material";

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
        Name:{" "}
        <Box component="span" color="blue">
          {repoName || "Error"}
        </Box>
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
    if (me) {
      console.log("Connecting to runtime at the beginning ..");
      wsConnect(client, `${me.id}_${repoId}`);
    }
  }, []);
  if (loading) return <Box>loading</Box>;
  return (
    <Box>
      <Box>
        Runtime{" "}
        {runtimeConnected ? (
          <Box component="span" color="green">
            connected
          </Box>
        ) : (
          <Box component="span" color="red">
            <Button
              size="small"
              onClick={() => {
                wsConnect(client, `${me.id}_${repoId}`);
              }}
            >
              Connect
            </Button>
          </Box>
        )}
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

function SyncStatus() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const numDirty = useStore(store, selectNumDirty());
  const clearAllResults = useStore(store, (s) => s.clearAllResults);
  const remoteUpdateAllPods = useStore(store, (s) => s.remoteUpdateAllPods);
  const client = useApolloClient();
  usePrompt(
    `You have unsaved ${numDirty} changes. Are you sure you want to leave?`,
    numDirty > 0
  );

  useEffect(() => {
    console.log("Setting interval");
    let id = setInterval(() => {
      // websocket resets after 60s of idle by most firewalls
      console.log("periodically saving ..");
      remoteUpdateAllPods(client);
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
          remoteUpdateAllPods(client);
        }}
      >
        <CloudUploadIcon />
        {numDirty > 0 ? (
          <Box component="span" color="blue" mx={1}>
            saving {numDirty} to cloud
          </Box>
        ) : (
          <Box component="span" color="grey" mx={1}>
            Saved to cloud.
          </Box>
        )}
      </Button>
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

export function Sidebar() {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <SyncStatus />
      </Grid>
      <Grid item xs={12}>
        {" "}
        <SidebarSession />
      </Grid>
      <Grid item xs={12}>
        <SidebarRuntime />
        <SidebarKernel />
      </Grid>
      <ToastError />
    </Grid>
  );
}
