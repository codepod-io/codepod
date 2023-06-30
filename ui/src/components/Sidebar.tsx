import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Drawer from "@mui/material/Drawer";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import Grid from "@mui/material/Grid";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Typography from "@mui/material/Typography";
import { useSnackbar, VariantType } from "notistack";

import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client";
import { useStore } from "zustand";
import { MyKBar } from "./MyKBar";

import { usePrompt } from "../lib/prompt";

import { RepoContext } from "../lib/store";

import useMe from "../lib/me";
import { FormControlLabel, FormGroup, Stack, Switch } from "@mui/material";
import { getUpTime } from "../lib/utils";
import { toSvg } from "html-to-image";

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function SidebarSettings() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const scopedVars = useStore(store, (state) => state.scopedVars);
  const setScopedVars = useStore(store, (state) => state.setScopedVars);
  const showAnnotations = useStore(store, (state) => state.showAnnotations);
  const setShowAnnotations = useStore(
    store,
    (state) => state.setShowAnnotations
  );
  const devMode = useStore(store, (state) => state.devMode);
  const setDevMode = useStore(store, (state) => state.setDevMode);
  const showLineNumbers = useStore(store, (state) => state.showLineNumbers);
  const setShowLineNumbers = useStore(
    store,
    (state) => state.setShowLineNumbers
  );
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoRunLayout = useStore(store, (state) => state.setAutoRunLayout);
  const contextualZoom = useStore(store, (state) => state.contextualZoom);
  const setContextualZoom = useStore(store, (state) => state.setContextualZoom);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  return (
    <Box>
      <Box>
        <Tooltip title={"Show Line Numbers"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showLineNumbers}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowLineNumbers(event.target.checked);
                  }}
                />
              }
              label="Show Line Numbers"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Enable Debug Mode, e.g., show pod IDs"}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={devMode}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setDevMode(event.target.checked);
                  }}
                />
              }
              label="Debug Mode"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Automatically run auto-layout at the end of node dragging."}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRunLayout}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setAutoRunLayout(event.target.checked);
                    if (event.target.checked) {
                      autoLayoutROOT();
                    }
                  }}
                />
              }
              label="Auto Run Layout"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Enable contextual zoom."} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={contextualZoom}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoom(event.target.checked);
                  }}
                />
              }
              label="Contextual Zoom"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Enable Scoped Variables"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={scopedVars}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setScopedVars(event.target.checked);
                  }}
                />
              }
              label="Scoped Variables"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Show Annotations in Editor"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showAnnotations}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowAnnotations(event.target.checked);
                  }}
                />
              }
              label="Enable Annotations"
            />
          </FormGroup>
        </Tooltip>
        {showAnnotations && (
          <Stack spacing={0.5}>
            <Box className="myDecoration-function">Function Definition</Box>
            <Box className="myDecoration-vardef">Variable Definition</Box>
            <Box className="myDecoration-varuse">Function/Variable Use</Box>
            <Box className="myDecoration-varuse my-underline">
              Undefined Variable
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function SidebarRuntime() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const runtimeConnected = useStore(store, (state) => state.runtimeConnected);
  const runtimeConnecting = useStore(store, (state) => state.runtimeConnecting);
  const { loading, me } = useMe();
  const client = useApolloClient();
  const restartRuntime = useStore(store, (state) => state.restartRuntime);
  let { id: repoId } = useParams();
  // get runtime information
  const { data, error } = useQuery(gql`
    query GetRuntimeInfo {
      infoRuntime(sessionId: "${me.id}_${repoId}") {
        startedAt
      }
    }
  `);
  // update time every second
  let [uptime, setUptime] = useState("");
  useEffect(() => {
    if (data?.infoRuntime?.startedAt) {
      setUptime(getUpTime(data.infoRuntime.startedAt));
    }
  }, [data]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (data?.infoRuntime?.startedAt) {
        setUptime(getUpTime(data.infoRuntime.startedAt));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data]);

  if (loading) return <Box>loading</Box>;
  return (
    <Box>
      <Box>
        {runtimeConnected && (
          <Stack>
            <Box>
              Runtime{" "}
              <Box component="span" color="green">
                connected
              </Box>
              <Tooltip title="restart">
                <IconButton
                  size="small"
                  onClick={() => {
                    restartRuntime(client, `${me.id}_${repoId}`);
                  }}
                >
                  <RestartAltIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box>Uptime: {uptime}</Box>

            <SidebarKernel />
          </Stack>
        )}
        {runtimeConnecting && <Box>Runtime connecting ..</Box>}
        {!runtimeConnected && !runtimeConnecting && (
          // NOTE: on restart runtime, the first several ws connection will
          // fail. Since we re-connect every second, here are showing the same
          // message to user.
          <Box>Runtime connecting ..</Box>
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
                <RefreshIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="interrupt">
              <IconButton
                size="small"
                onClick={() => {
                  wsInterruptKernel({ lang });
                }}
              >
                <StopIcon fontSize="inherit" />
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
  // FIXME performance issue
  const dirtyIds = useStore(store, (state) => {
    let res: string[] = [];
    if (state.repoLoaded) {
      for (const id in state.pods) {
        if (
          state.pods[id].dirty ||
          state.pods[id].dirtyPending ||
          state.pods[id].isSyncing
        ) {
          res.push(id);
        }
      }
    }
    return res;
  });
  const devMode = useStore(store, (state) => state.devMode);
  const clearAllResults = useStore(store, (s) => s.clearAllResults);
  const remoteUpdateAllPods = useStore(store, (s) => s.remoteUpdateAllPods);
  const client = useApolloClient();
  usePrompt(
    `You have unsaved ${dirtyIds.length} changes. Are you sure you want to leave?`,
    dirtyIds.length > 0
  );

  useEffect(() => {
    let id = setInterval(() => {
      remoteUpdateAllPods(client);
    }, 1000);
    return () => {
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Stack
        direction="row"
        spacing={2}
        color={dirtyIds.length === 0 ? "gray" : "blue"}
        sx={{
          alignItems: "center",
        }}
      >
        <CloudUploadIcon />
        {dirtyIds.length > 0 ? (
          <Box component="span" color="blue" mx={1}>
            saving {dirtyIds.length} to cloud
            {devMode && <pre>{JSON.stringify(dirtyIds)}</pre>}
          </Box>
        ) : (
          <Box component="span" color="grey" mx={1}>
            Saved to cloud.
          </Box>
        )}
      </Stack>
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

type SidebarProps = {
  width: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

function download(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ExportFile() {
  // an export component
  let { id: repoId } = useParams();
  // the useMutation for exportJSON
  const [exportJSON, { data, loading, error }] = useMutation(
    gql`
      mutation ExportFile($repoId: String!) {
        exportFile(repoId: $repoId)
      }
    `
  );
  useEffect(() => {
    if (data?.exportFile) {
      download(data.exportFile);
    }
  }, [data]);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        onClick={() => {
          // call export graphQL api to get the AWS S3 url
          exportJSON({ variables: { repoId } });
        }}
        disabled={true}
      >
        Python File
      </Button>
      {error && <Box>Error: {error?.message}</Box>}
    </>
  );
}

function ExportJSON() {
  // an export component
  let { id: repoId } = useParams();
  // the useMutation for exportJSON
  const [exportJSON, { data, loading, error }] = useMutation(
    gql`
      mutation ExportJSON($repoId: String!) {
        exportJSON(repoId: $repoId)
      }
    `
  );
  useEffect(() => {
    if (data?.exportJSON) {
      download(data.exportJSON);
    }
  }, [data]);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        onClick={() => {
          // call export graphQL api to get the AWS S3 url
          exportJSON({ variables: { repoId } });
        }}
        disabled={false}
      >
        Jupyter Notebook
      </Button>
      {error && <Box>Error: {error.message}</Box>}
    </>
  );
}

function ExportSVG() {
  // The name should contain the name of the repo, the ID of the repo, and the current date
  const { id: repoId } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const filename = `${repoName?.replaceAll(
    " ",
    "-"
  )}-${repoId}-${new Date().toISOString()}.svg`;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const elem = document.querySelector(".react-flow");
    if (!elem) return;
    toSvg(elem as HTMLElement, {
      filter: (node) => {
        // we don't want to add the minimap and the controls to the image
        if (
          node?.classList?.contains("react-flow__minimap") ||
          node?.classList?.contains("react-flow__controls")
        ) {
          return false;
        }

        return true;
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");

      a.setAttribute("download", filename);
      a.setAttribute("href", dataUrl);
      a.click();
      setLoading(false);
    });
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={loading}
    >
      Download Image
    </Button>
  );
}

function ExportButtons() {
  return (
    <Stack spacing={1}>
      <ExportFile />
      <ExportJSON />
      <ExportSVG />
    </Stack>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  width,
  open,
  onOpen,
  onClose,
}) => {
  // never render saving status / runtime module for a guest
  // FIXME: improve the implementation logic
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  return (
    <>
      <MyKBar />
      <Box
        sx={{
          position: "absolute",
          display: open ? "none" : "block",
          top: `54px`,
          left: 1,
        }}
      >
        <IconButton
          onClick={onOpen}
          sx={{
            zIndex: 1,
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Drawer
        sx={{
          width: width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: width,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            paddingLeft: "8px",
            height: 48,
          }}
        >
          <IconButton onClick={onClose}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider />
        <Box
          sx={{
            padding: "8px 16px",
          }}
        >
          <Stack>
            {!isGuest && (
              <Box>
                <SyncStatus />
                <Divider />
                <Typography variant="h6">Runtime Info</Typography>
                <SidebarRuntime />
              </Box>
            )}
            <Divider />
            <Typography variant="h6">Export to ..</Typography>
            <ExportButtons />

            <Divider />
            <Typography variant="h6">Site Settings</Typography>
            <SidebarSettings />
            <ToastError />
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};
