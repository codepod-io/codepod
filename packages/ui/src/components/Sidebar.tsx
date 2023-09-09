import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Popover from "@mui/material/Popover";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Drawer from "@mui/material/Drawer";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Typography from "@mui/material/Typography";
import TreeView from "@mui/lab/TreeView";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeItem from "@mui/lab/TreeItem";

import { useSnackbar, VariantType } from "notistack";

import { Node as ReactflowNode } from "reactflow";
import { NodeData } from "../lib/store/canvasSlice";
import * as Y from "yjs";

import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client";
import { useStore } from "zustand";
import { MyKBar } from "./MyKBar";

import { usePrompt } from "../lib/prompt";

import { RepoContext } from "../lib/store";

import { sortNodes, downloadLink, repo2ipynb } from "./nodes/utils";

import {
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Slider,
  Input,
  Grid,
  Paper,
  Menu,
} from "@mui/material";
import { getUpTime, myNanoId } from "../lib/utils/utils";
import { toSvg } from "html-to-image";
import { match } from "ts-pattern";

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

const RuntimeMoreMenu = ({ runtimeId }) => {
  // menu logic
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  // codepod logic
  const store = useContext(RepoContext)!;
  const setActiveRuntime = useStore(store, (state) => state.setActiveRuntime);
  const activeRuntime = useStore(store, (state) => state.activeRuntime);
  const runtimeMap = useStore(store, (state) => state.getRuntimeMap());
  const repoId = useStore(store, (state) => state.repoId);

  const [killRuntime] = useMutation(
    gql`
      mutation KillRuntime($runtimeId: String, $repoId: String) {
        killRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );

  const [disconnectRuntime] = useMutation(
    gql`
      mutation DisconnectRuntime($runtimeId: String, $repoId: String) {
        disconnectRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );

  return (
    <Box component="span">
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          onClick={() => {
            setActiveRuntime(runtimeId);
            handleClose();
          }}
          disabled={activeRuntime === runtimeId}
        >
          Activate
        </MenuItem>
        <MenuItem
          onClick={() => {
            disconnectRuntime({ variables: { runtimeId, repoId } });
            handleClose();
          }}
        >
          Disconnect
        </MenuItem>
        <MenuItem
          onClick={() => {
            killRuntime({ variables: { runtimeId, repoId: repoId } });
            handleClose();
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

const RuntimeItem = ({ runtimeId }) => {
  const store = useContext(RepoContext)!;
  const runtimeMap = useStore(store, (state) => state.getRuntimeMap());
  // Observe runtime change
  const runtimeChanged = useStore(store, (state) => state.runtimeChanged);
  // A dummy useEffect to indicate that runtimeChanged is used.
  useEffect(() => {}, [runtimeChanged]);
  const activeRuntime = useStore(store, (state) => state.activeRuntime);
  const runtime = runtimeMap.get(runtimeId)!;
  const repoId = useStore(store, (state) => state.repoId);
  const [connect] = useMutation(
    gql`
      mutation ConnectRuntime($runtimeId: String, $repoId: String) {
        connectRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );
  const [requestKernelStatus] = useMutation(
    gql`
      mutation RequestKernelStatus($runtimeId: String) {
        requestKernelStatus(runtimeId: $runtimeId)
      }
    `,
    { context: { clientName: "spawner" } }
  );
  const [interruptKernel] = useMutation(
    gql`
      mutation InterruptKernel($runtimeId: String) {
        interruptKernel(runtimeId: $runtimeId)
      }
    `,
    { context: { clientName: "spawner" } }
  );

  useEffect(() => {
    // if the runtime is disconnected, keep trying to connect.
    if (runtime.wsStatus !== "connected") {
      const interval = setInterval(
        () => {
          console.log("try connecting to runtime", runtimeId);
          connect({
            variables: {
              runtimeId,
              repoId,
            },
          });
        },
        // ping every 3 seconds
        3000
      );
      return () => clearInterval(interval);
    }
  }, [runtime]);

  return (
    <Box
      sx={{
        opacity: activeRuntime === runtimeId ? 1 : 0.3,
      }}
    >
      <Paper>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          ID: {runtimeId.substring(0, 8)}
        </Typography>

        <Typography variant="body1">
          Conn:{" "}
          {match(runtime.wsStatus)
            .with("connected", () => (
              <Box color="green" component="span">
                connected
              </Box>
            ))
            .with("connecting", () => (
              <Box color="yellow" component="span">
                connecting
              </Box>
            ))
            .otherwise(() => (
              <Box color="red" component="span">
                Disconnected{" "}
              </Box>
            ))}
          <RuntimeMoreMenu runtimeId={runtimeId} />
        </Typography>
        <Typography variant="body1">
          Status:{" "}
          {match(runtime.status)
            .with("idle", () => (
              <Box color="green" component="span">
                idle
              </Box>
            ))
            .with("busy", () => (
              <Box color="yellow" component="span">
                busy
              </Box>
            ))
            .otherwise(() => runtime.status)}
          <IconButton
            size="small"
            onClick={() => {
              requestKernelStatus({
                variables: {
                  runtimeId,
                },
              });
            }}
          >
            <RefreshIcon fontSize="inherit" />
          </IconButton>
          <Tooltip title="interrupt">
            <IconButton
              size="small"
              onClick={() => {
                interruptKernel({
                  variables: {
                    runtimeId,
                  },
                });
              }}
            >
              <StopIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Typography>
      </Paper>
    </Box>
  );
};

const YjsRuntimeStatus = () => {
  const store = useContext(RepoContext)!;
  const repoId = useStore(store, (state) => state.repoId);
  const runtimeMap = useStore(store, (state) => state.getRuntimeMap());
  // Observe runtime change
  const runtimeChanged = useStore(store, (state) => state.runtimeChanged);
  const ids = Array.from<string>(runtimeMap.keys());
  const [spawnRuntime] = useMutation(
    gql`
      mutation SpawnRuntime($runtimeId: String, $repoId: String) {
        spawnRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );
  return (
    <>
      <Typography variant="h6">Runtime</Typography>
      <Button
        onClick={() => {
          const id = myNanoId();
          spawnRuntime({ variables: { runtimeId: id, repoId: repoId } });
        }}
      >
        Create New Runtime
      </Button>

      {ids.map((runtimeId) => (
        <RuntimeItem key={runtimeId} runtimeId={runtimeId} />
      ))}
    </>
  );
};

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

function ExportJupyterNB() {
  const { id: repoId } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const resultMap = useStore(store, (state) => state.getResultMap());
  const codeMap = useStore(store, (state) => state.getCodeMap());
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const fileContent = repo2ipynb(
      nodesMap,
      codeMap,
      resultMap,
      repoId,
      repoName
    );
    const dataUrl =
      "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent);
    const filename = `${
      repoName || "Untitled"
    }-${new Date().toISOString()}.ipynb`;
    // Generate the download link on the fly
    downloadLink(dataUrl, filename);
    setLoading(false);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={loading}
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
      downloadLink(dataUrl, filename);
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
      <ExportJupyterNB />
      <ExportSVG />
    </Stack>
  );
}

function PodTreeItem({ id, node2children }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const selectPod = useStore(store, (state) => state.selectPod);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const setCenterSelection = useStore(
    store,
    (state) => state.setCenterSelection
  );

  if (!node2children.has(id)) return null;
  const children = node2children.get(id);
  return (
    <TreeItem
      key={id}
      nodeId={id}
      label={id.substring(0, 8)}
      onClick={() => {
        resetSelection();
        selectPod(id, true);
        setCenterSelection(true);
      }}
    >
      {children.length > 0 &&
        children.map((child) => (
          <PodTreeItem key={child} id={child} node2children={node2children} />
        ))}
    </TreeItem>
  );
}

function TableofPods() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const node2children = useStore(store, (state) => state.node2children);
  // Set all nodes to expanded. Disable the collapse/expand for now.
  const allIds = Array.from(node2children.keys());

  return (
    <TreeView
      aria-label="multi-select"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={allIds}
      multiSelect
    >
      {node2children.size > 0 &&
        node2children!
          .get("ROOT")!
          .map((child) => (
            <PodTreeItem key={child} id={child} node2children={node2children} />
          ))}
    </TreeView>
  );
}

export const Sidebar = () => {
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
          padding: "8px 16px",
        }}
      >
        <Stack>
          {!isGuest && (
            <Box>
              {/* <SyncStatus /> */}
              <YjsSyncStatus />
              <Divider />
              <YjsRuntimeStatus />
            </Box>
          )}
          <Divider />
          <Typography variant="h6">Export to ..</Typography>
          <ExportButtons />

          <Divider />
          <Typography variant="h6">Site Settings</Typography>
          <SidebarSettings />
          <ToastError />

          <Divider />
          <Typography variant="h6">Table of Pods</Typography>
          <TableofPods />
        </Stack>
      </Box>
    </>
  );
};
