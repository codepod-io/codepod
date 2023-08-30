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
import { Stack } from "@mui/material";
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
    disconnected: { title: "disconnected", color: "red" },
    connecting: { title: "connecting", color: "yellow" },
  };
  const wsStatus = wsStatusConfig[runtime.wsStatus || ""] ?? "default";

  useEffect(() => {
    // if the runtime is disconnected, keep trying to connect.
    if (runtime) {
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
    }
  }, [runtime]);

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{
        paddingLeft: "8px",
        height: 20,
      }}
    >
      {activeRuntime === runtimeId &&
        (wsStatus ? (
          <Tooltip title={wsStatus.title}>
            <CircleIcon style={{ color: wsStatus.color }} />
          </Tooltip>
        ) : (
          <Box color="red" component="span">
            {runtime!.wsStatus || "unknown"}
            <Button
              onClick={() => {
                connect({
                  variables: {
                    runtimeId,
                    repoId,
                  },
                });
              }}
              sx={{ color: "red" }}
            >
              retry
            </Button>
          </Box>
        ))}

      {activeRuntime === runtimeId && (
        <Divider orientation="vertical" flexItem />
      )}
      <Tooltip title="activate">
        <IconButton
          onClick={() => {
            setActiveRuntime(runtimeId);
          }}
          disabled={activeRuntime === runtimeId}
        >
          <PlayArrowIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Tooltip title="refresh">
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
      </Tooltip>
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
      <Tooltip title="disconnect">
        <IconButton
          size="small"
          onClick={() => {
            disconnectRuntime({ variables: { runtimeId, repoId } });
          }}
        >
          <LinkOffIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      <Box
        color="inherit"
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            paddingLeft: "4px",
            paddingRight: "4px",
          }}
        >
          Status:{" "}
        </Paper>
        <Box color={runtimeStatusColors[status]} component="span">
          {runtimeStatus === "idle"
            ? "idle"
            : runtimeStatus === "busy"
            ? "busy"
            : "Not connected"}
        </Box>
      </Box>
      <Paper
        elevation={0}
        sx={{
          paddingLeft: "4px",
          paddingRight: "4px",
        }}
      >
        ID: {(runtimeId || "").substring(0, 8)}
      </Paper>

      <Divider orientation="vertical" flexItem />
      {activeRuntime !== runtimeId && (
        <Tooltip title="delete">
          <IconButton
            size="small"
            onClick={() => {
              killRuntime({ variables: { runtimeId, repoId: repoId } });
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
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

  const [spawnRuntime] = useMutation(
    gql`
      mutation SpawnRuntime($runtimeId: String, $repoId: String) {
        spawnRuntime(runtimeId: $runtimeId, repoId: $repoId)
      }
    `,
    { context: { clientName: "spawner" } }
  );

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
        <ListItem ref={listItemRef}>
          <RuntimeItem
            key={activeRuntime}
            runtimeId={activeRuntime || ids[0]}
          />
        </ListItem>
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
              <ListItem>
                <RuntimeItem key={runtimeId} runtimeId={runtimeId} />
              </ListItem>
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
  height: number;
  drawerWidth: number;
};

export const BottomAppBar: React.FC<BottomAppBarProps> = ({
  open = false,
  height = 5,
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
        height: { height },
        transition: "width 195ms cubic-bezier(0.4, 0, 0.6, 1) 0ms",
        top: "auto",
        bottom: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
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
