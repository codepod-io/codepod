import { useEffect, useContext, useState, useRef } from "react";
import AddIcon from "@mui/icons-material/Add";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircleIcon from "@mui/icons-material/Circle";
import CircularProgress from "@mui/material/CircularProgress";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import DeleteIcon from "@mui/icons-material/Delete";
import Divider from "@mui/material/Divider";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Paper from "@mui/material/Paper";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Popover from "@mui/material/Popover";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";

import { gql, useMutation } from "@apollo/client";
import { useStore } from "zustand";

import { RepoContext } from "../lib/store";
import {
  ListItemIcon,
  ListItemButton,
  Stack,
  ListItemText,
} from "@mui/material";
import { myNanoId } from "../lib/utils/utils";
import { match } from "ts-pattern";

const RuntimeItem = ({ runtimeId }) => {
  const store = useContext(RepoContext)!;
  const runtimeMap =
    useStore(store, (state) => state.getRuntimeMap()) || new Map();
  // Observe runtime change
  const runtimeChanged = useStore(store, (state) => state.runtimeChanged);
  // A dummy useEffect to indicate that runtimeChanged is used.
  useEffect(() => {}, [runtimeChanged]);
  const activeRuntime = useStore(store, (state) => state.activeRuntime);
  const setActiveRuntime = useStore(store, (state) => state.setActiveRuntime);
  const runtime = runtimeMap.get(runtimeId) || { wsStatus: "unknown" };
  const repoId = useStore(store, (state) => state.repoId);

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

  const runtimeStatusColors = { idle: "green", busy: "yellow", default: "red" };
  const runtimeStatus = runtime.status ?? "default";
  const wsStatusConfig = {
    connected: { title: "connected", color: "green" },
    connecting: { title: "connecting", color: "yellow" },
    default: { title: "disconnected", color: "red" },
  };
  const wsStatus = wsStatusConfig[runtime.wsStatus || "default"];

  return (
    <ListItem key={runtimeId} disablePadding sx={{ margin: 0 }}>
      {activeRuntime === runtimeId && (
        <Tooltip title={wsStatus.title}>
          <ListItemIcon>
            <CircleIcon style={{ color: wsStatus.color }} />
          </ListItemIcon>
        </Tooltip>
      )}

      {activeRuntime === runtimeId && (
        <Divider orientation="vertical" flexItem />
      )}
      <Tooltip title="activate">
        <ListItemButton
          sx={{
            padding: 0,
            margin: 0,
          }}
          onClick={() => {
            setActiveRuntime(runtimeId);
          }}
          disabled={activeRuntime === runtimeId}
        >
          <ListItemIcon
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <PlayArrowIcon fontSize="inherit" />
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>
      <Tooltip title="refresh">
        <ListItemButton
          sx={{
            padding: 0,
            margin: 0,
          }}
          onClick={() => {
            requestKernelStatus({
              variables: {
                runtimeId,
              },
            });
          }}
        >
          <ListItemIcon
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <RefreshIcon fontSize="inherit" />
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>
      <Tooltip title="interrupt">
        <ListItemButton
          sx={{
            padding: 0,
            margin: 0,
          }}
          onClick={() => {
            interruptKernel({
              variables: {
                runtimeId,
              },
            });
          }}
        >
          <ListItemIcon
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <StopIcon fontSize="inherit" />
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>
      <Tooltip title="disconnect">
        <ListItemButton
          sx={{
            padding: 0,
            margin: 0,
          }}
          onClick={() => {
            disconnectRuntime({ variables: { runtimeId, repoId } });
          }}
        >
          <ListItemIcon
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <LinkOffIcon fontSize="inherit" />
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />
      <ListItemText primary="Status: " sx={{ ml: "4px" }} />
      <ListItemText
        primary={
          runtimeStatus === "idle"
            ? "idle"
            : runtimeStatus === "busy"
            ? "busy"
            : "Not connected"
        }
        primaryTypographyProps={{
          style: { color: runtimeStatusColors[runtimeStatus] },
        }}
        sx={{ mr: "4px" }}
      />
      <ListItemText
        primary={`ID: ${(runtimeId || "").substring(0, 8)}`}
        sx={{ mr: "4px" }}
      />
      <Divider orientation="vertical" flexItem />
      {activeRuntime !== runtimeId && (
        <Tooltip title="delete">
          <ListItemButton
            sx={{
              padding: 0,
              margin: 0,
            }}
            onClick={() => {
              killRuntime({ variables: { runtimeId, repoId: repoId } });
            }}
          >
            <ListItemIcon
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <DeleteIcon fontSize="inherit" />
            </ListItemIcon>
          </ListItemButton>
        </Tooltip>
      )}
    </ListItem>
  );
};

const RuntimeStatus = () => {
  const store = useContext(RepoContext)!;
  const repoId = useStore(store, (state) => state.repoId);
  const runtimeMap =
    useStore(store, (state) => state.getRuntimeMap()) || new Map();
  // Observe runtime change
  const activeRuntime = useStore(store, (state) => state.activeRuntime);
  const runtimeChanged = useStore(store, (state) => state.runtimeChanged);
  const ids = Array.from<string>(runtimeMap.keys());
  const listItemRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  useEffect(() => {}, [runtimeChanged]);
  const [spawnRuntime] = useMutation(
    gql`
      mutation SpawnRuntime($runtimeId: String, $repoId: String) {
        spawnRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );
  const [connect] = useMutation(
    gql`
      mutation ConnectRuntime($runtimeId: String, $repoId: String) {
        connectRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );
  useEffect(() => {
    // if the active runtime is disconnected, keep trying to connect.
    if (activeRuntime) {
      if (runtimeMap.get(activeRuntime)!.wsStatus !== "connected") {
        const interval = setInterval(
          () => {
            console.log("try connecting to runtime", activeRuntime);
            connect({
              variables: {
                activeRuntime,
                repoId,
              },
            });
          },
          // ping every 3 seconds
          3000
        );
        return () => clearInterval(interval);
      }
    }
  }, [activeRuntime]);
  return (
    <Box
      sx={{
        top: "auto",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Paper elevation={0}>Runtime</Paper>
      <Tooltip title="Create new Runtime">
        <IconButton
          onClick={() => {
            const id = myNanoId();
            spawnRuntime({ variables: { runtimeId: id, repoId: repoId } });
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
      {ids.length > 1 ? (
        open ? (
          <Tooltip title="Show less runtime">
            <IconButton
              onClick={() => {
                setOpen(false);
                setAnchorEl(null);
              }}
            >
              <ExpandMore />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Show more runtime">
            <IconButton
              onClick={() => {
                setOpen(true);
                setAnchorEl(listItemRef.current);
              }}
            >
              <ExpandLess />
            </IconButton>
          </Tooltip>
        )
      ) : (
        <></>
      )}
      <List>
        <Box ref={listItemRef}>
          <RuntimeItem
            key={activeRuntime}
            runtimeId={activeRuntime || ids[0]}
          />
        </Box>
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={() => {
            setOpen(false);
          }}
          anchorOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
        >
          {Array.from<string>(runtimeMap.keys())
            .filter((runtimeId) => runtimeId !== activeRuntime)
            .map((runtimeId) => (
              <RuntimeItem key={runtimeId} runtimeId={runtimeId} />
            ))}
        </Popover>
      </List>
    </Box>
  );
};

function YjsSyncStatus() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  // FIXME performance issue
  const yjsStatus = useStore(store, (state) => state.yjsStatus);
  const yjsSyncStatus = useStore(store, (state) => state.yjsSyncStatus);
  const statusConfig = {
    connected: { title: "connected", color: "green" },
    disconnected: { title: "disconnected", color: "red" },
    connecting: { title: "connecting", color: "yellow" },
    default: { title: "unknown", color: "grey" },
  };
  const status = statusConfig[yjsStatus || ""] || statusConfig.default;
  return (
    <Stack direction="row" spacing={1}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Paper elevation={0}>Sync Server:</Paper>
        <Tooltip title={status.title}>
          <CircleIcon style={{ color: status.color }} />
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Paper elevation={0}>Sync Status:</Paper>
        {match(yjsSyncStatus)
          .with("uploading", () => (
            <Tooltip title="uploading">
              <CloudUploadIcon />
            </Tooltip>
          ))
          .with("synced", () => (
            <Tooltip title="synced">
              <CloudDoneIcon />
            </Tooltip>
          ))
          .otherwise(() => (
            <Tooltip title="disconnected">
              <CloudOffIcon />
            </Tooltip>
          ))}
      </Stack>
    </Stack>
  );
}

type BottomAppBarProps = {
  open: boolean;
  drawerWidth: number;
};

export const BottomAppBar: React.FC<BottomAppBarProps> = ({
  open = false,
  drawerWidth = 0,
}) => {
  // never render saving status / runtime module for a guest
  // FIXME: improve the implementation logic
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  return !isGuest ? (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{
        width: `calc(100% - ${open ? drawerWidth : 0}px)`,
        transition: "width 195ms cubic-bezier(0.4, 0, 0.6, 1) 0ms",
        top: "auto",
        bottom: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        maxHeight: "35px",
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{
          paddingLeft: "16px",
        }}
      >
        <YjsSyncStatus />
        <RuntimeStatus />
      </Stack>
    </AppBar>
  ) : (
    <></>
  );
};
