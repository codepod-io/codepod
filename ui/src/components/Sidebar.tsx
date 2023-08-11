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
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import Typography from "@mui/material/Typography";
import { useSnackbar, VariantType } from "notistack";

import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client";
import { useStore } from "zustand";
import { MyKBar } from "./MyKBar";

import { usePrompt } from "../lib/prompt";

import { RepoContext } from "../lib/store";

import useMe from "../lib/me";
import {
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Slider,
  Input,
  Grid,
} from "@mui/material";
import { getUpTime } from "../lib/utils";
import { registerCompletion } from "../lib/monacoCompletionProvider";
import { SettingDialog } from "./SettingDialog";
import { toSvg } from "html-to-image";
import { match } from "ts-pattern";

const defaultAPIKey = process.env.REACT_APP_CODEIUM_API_KEY;

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
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoRunLayout = useStore(store, (state) => state.setAutoRunLayout);
  const contextualZoom = useStore(store, (state) => state.contextualZoom);
  const setContextualZoom = useStore(store, (state) => state.setContextualZoom);
  const autoCompletion = useStore(
    store,
    (state) => !isGuest && state.autoCompletion
  );

  const setAutoCompletion = useStore(store, (state) => state.setAutoCompletion);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const apiKey = useStore(store, (state) =>
    state.isCustomToken
      ? state.user.codeiumAPIKey ?? defaultAPIKey
      : defaultAPIKey
  );
  const setSettingOpen = useStore(store, (state) => state.setSettingOpen);

  const contextualZoomParams = useStore(
    store,
    (state) => state.contextualZoomParams
  );
  const setContextualZoomParams = useStore(
    store,
    (state) => state.setContextualZoomParams
  );
  const restoreParamsDefault = useStore(
    store,
    (state) => state.restoreParamsDefault
  );
  useEffect(() => {
    if (autoCompletion && apiKey) {
      const dispose = registerCompletion(apiKey);
      if (dispose !== null) {
        return dispose;
      }
    }
  }, [autoCompletion, apiKey]);

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
        {contextualZoom && (
          <Stack alignItems="center">
            L0 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[0]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      0,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      0,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 0, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 0, 8);
                    }
                  }}
                  value={contextualZoomParams[0]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L1 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[1]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      1,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      1,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 1, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 1, 8);
                    }
                  }}
                  value={contextualZoomParams[1]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L2 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[2]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      2,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      2,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 2, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 2, 8);
                    }
                  }}
                  value={contextualZoomParams[2]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L3 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={Number(contextualZoomParams[3])}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      3,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      3,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 3, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 3, 8);
                    }
                  }}
                  value={contextualZoomParams[3]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L4+ Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={Number(contextualZoomParams.next)}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      4,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      4,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 4, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 4, 8);
                    }
                  }}
                  value={contextualZoomParams.next}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            <Button onClick={() => restoreParamsDefault()}>
              Restore Default
            </Button>
          </Stack>
        )}
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
        <Tooltip title={"Auto Completion"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={!!(apiKey && autoCompletion)}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    if (apiKey) {
                      setAutoCompletion(event.target.checked);
                    } else {
                      setSettingOpen(true);
                    }
                  }}
                />
              }
              label={
                <>
                  Auto Completion
                  <Tooltip
                    title={"Help"}
                    disableInteractive
                    sx={{ display: "inline" }}
                  >
                    <Box>
                      <IconButton
                        size="small"
                        sx={{ display: "inline" }}
                        onClick={() => setSettingOpen(true)}
                        disabled={isGuest}
                      >
                        <HelpOutlineOutlinedIcon
                          sx={{ fontSize: 14 }}
                        ></HelpOutlineOutlinedIcon>
                      </IconButton>
                    </Box>
                  </Tooltip>
                </>
              }
              disabled={isGuest}
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
  // FIXME show prompt if user has unsynced Yjs changes.
  //
  // usePrompt(
  //   `You have unsaved ${dirtyIds.length} changes. Are you sure you want to leave?`,
  //   dirtyIds.length > 0
  // );

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

function YjsSyncStatus() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // FIXME performance issue
  const yjsStatus = useStore(store, (state) => state.yjsStatus);
  const yjsSyncStatus = useStore(store, (state) => state.yjsSyncStatus);
  return (
    <Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "center",
        }}
      >
        {/* Synced? <Box>{provider?.synced}</Box> */}
        {/* {yjsStatus} */}
        Sync Server:
        {match(yjsStatus)
          .with("connected", () => <Box color="green">connected</Box>)
          .with("disconnected", () => <Box color="red">disconnected</Box>)
          .with("connecting", () => <Box color="yellow">connecting</Box>)
          // .with("syncing", () => <Box color="green">online</Box>)
          .otherwise(() => `${yjsStatus}`)}
      </Stack>
      <Stack direction="row" spacing={2}>
        Sync Status:
        {match(yjsSyncStatus)
          .with("uploading", () => <Box color="yellow">uploading</Box>)
          .with("synced", () => <Box color="green">synced</Box>)
          .otherwise(() => `Unknown: ${yjsSyncStatus}`)}
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
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
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
      let element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(data.exportJSON)
      );
      const filename = `${
        repoName || "Untitled"
      }-${new Date().toISOString()}.json`;
      element.setAttribute("download", filename);

      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  }, [data]);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        onClick={() => {
          // call export graphQL api to get JSON string
          exportJSON({ variables: { repoId } });
        }}
        disabled={false}
      >
        Raw JSON
      </Button>
      {error && <Box>Error: {error.message}</Box>}
    </>
  );
}

function ExportJupyterNB() {
  const { id: repoId } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const pods = useStore(store, (state) => state.pods);
  const filename = `${
    repoName || "Untitled"
  }-${new Date().toISOString()}.ipynb`;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);

    // Hard-code Jupyter cell format. Reference, https://nbformat.readthedocs.io/en/latest/format_description.html
    let jupyterCellList: {
      cell_type: string;
      execution_count?: number;
      metadata: object;
      source: string[];
      outputs?: object[];
    }[] = [];

    // Queue to sort the pods geographically
    let q = new Array();
    // adjacency list for podId -> parentId mapping
    let adj = {};
    q.push([pods["ROOT"], "0.0"]);
    while (q.length > 0) {
      let [curPod, curScore] = q.shift();

      // sort the pods geographically(top-down, left-right)
      let sortedChildren = curPod.children
        .map((x) => x.id)
        .sort((id1, id2) => {
          let pod1 = pods[id1];
          let pod2 = pods[id2];
          if (pod1 && pod2) {
            if (pod1.y === pod2.y) {
              return pod1.x - pod2.x;
            } else {
              return pod1.y - pod2.y;
            }
          } else {
            return 0;
          }
        });

      for (let i = 0; i < sortedChildren.length; i++) {
        let pod = pods[sortedChildren[i]];
        let geoScore = curScore + `${i + 1}`;
        adj[pod.id] = {
          name: pod.name,
          parentId: pod.parent,
          geoScore: geoScore,
        };

        if (pod.type == "SCOPE") {
          q.push([pod, geoScore.substring(0, 2) + "0" + geoScore.substring(2)]);
        } else if (pod.type == "CODE") {
          let podOutput: any[] = [];
          for (const result of pod.result!) {
            switch (result.type) {
              case "execute_result":
                podOutput.push({
                  output_type: result.type,
                  data: {
                    "text/plain": (result.text || "")
                      .split(/\r?\n/)
                      .map((line) => line + "\n") || [""],
                  },
                  execution_count: pod.exec_count,
                });
                break;
              case "display_data":
                podOutput.push({
                  output_type: result.type,
                  data: {
                    "text/plain": (result.text || "")
                      .split(/\r?\n/)
                      .map((line) => line + "\n") || [""],
                    "image/png": result.image,
                  },
                });
                break;
              case "stream_stdout":
                podOutput.push({
                  output_type: "stream",
                  name: "stdout",
                  text: (result.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n"),
                });
                break;
              case "stream_stderr":
                podOutput.push({
                  output_type: "stream",
                  name: "stderr",
                  text: (result.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n"),
                });
                break;
              default:
                break;
            }
          }
          if (pod.error) {
            podOutput.push({
              output_type: "error",
              ename: pod.error?.ename,
              evalue: pod.error?.evalue,
              traceback: pod.error?.stacktrace,
            });
          }
          jupyterCellList.push({
            cell_type: "code",
            execution_count: pod.exec_count,
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: [pod.content || ""],
            outputs: podOutput,
          });
        } else if (pod.type == "RICH") {
          jupyterCellList.push({
            cell_type: "markdown",
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: [pod.richContent || ""],
          });
        }
      }
    }

    // sort the generated cells by their geoScore
    jupyterCellList.sort((cell1, cell2) => {
      if (
        Number(cell1.metadata["geoScore"]) < Number(cell2.metadata["geoScore"])
      ) {
        return -1;
      } else {
        return 1;
      }
    });

    // Append the scope structure as comment for each cell and format source
    for (const cell of jupyterCellList) {
      let scopes: string[] = [];
      let parentId = adj[cell.metadata["id"]].parentId;

      // iterative {parentId,name} retrieval
      while (parentId && parentId != "ROOT") {
        scopes.push(adj[parentId].name);
        parentId = adj[parentId].parentId;
      }

      // Add scope structure as a block comment at the head of each cell
      // FIXME, RICH pod should have a different format
      let scopeStructureAsComment =
        scopes.length > 0
          ? [
              "'''\n",
              `CodePod Scope structure: ${scopes.reverse().join("/")}\n`,
              "'''\n",
            ]
          : [""];

      const sourceArray = cell.source[0]
        .split(/\r?\n/)
        .map((line) => line + "\n");

      cell.source = [...scopeStructureAsComment, ...sourceArray];
    }

    const fileContent = JSON.stringify(
      {
        // hard-code Jupyter Notebook top-level metadata
        metadata: {
          name: repoName,
          kernelspec: {
            name: "python3",
            display_name: "Python 3",
          },
          language_info: { name: "python" },
          Codepod_version: "v0.0.1",
          Codepod_repo_id: `${repoId}`,
        },
        nbformat: 4.0,
        nbformat_minor: 0,
        cells: jupyterCellList,
      },
      null,
      4
    );

    // Generate the download link on the fly
    let element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setLoading(false);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={false}
    >
      Jupyter Notebook
    </Button>
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
      <ExportJupyterNB />
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
  const settingOpen = useStore(store, (state) => state.settingOpen);
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
                {/* <SyncStatus /> */}
                <YjsSyncStatus />
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

      {settingOpen && <SettingDialog open={settingOpen} />}
    </>
  );
};
