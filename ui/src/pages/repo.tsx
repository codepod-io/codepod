import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Button from "@mui/material/Button";
import { gql, useApolloClient, useMutation } from "@apollo/client";

import { useEffect, useState, useRef, useContext, memo } from "react";

import * as React from "react";

import { useStore } from "zustand";

import { createRepoStore, RepoContext } from "../lib/store";

import useMe from "../lib/me";
import { Canvas } from "../components/Canvas";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Stack, TextField, Tooltip } from "@mui/material";
import { useAuth } from "../lib/auth";
import { initParser } from "../lib/parser";

import { usePrompt } from "../lib/prompt";

const HeaderItem = memo<any>(({ id }) => {
  const store = useContext(RepoContext)!;
  const repoName = useStore(store, (state) => state.repoName);
  const repoNameDirty = useStore(store, (state) => state.repoNameDirty);
  const setRepoName = useStore(store, (state) => state.setRepoName);
  const apolloClient = useApolloClient();
  const remoteUpdateRepoName = useStore(
    store,
    (state) => state.remoteUpdateRepoName
  );
  const isOwner = useStore(store, (state) => state.role === "OWNER");

  usePrompt(
    "Repo name not saved. Do you want to leave this page?",
    repoNameDirty
  );

  useEffect(() => {
    remoteUpdateRepoName(apolloClient);
    let intervalId = setInterval(() => {
      remoteUpdateRepoName(apolloClient);
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [focus, setFocus] = useState(false);
  const [enter, setEnter] = useState(false);

  const textfield = (
    <TextField
      hiddenLabel
      placeholder="Untitled"
      value={repoName || ""}
      size="small"
      variant={focus ? undefined : "standard"}
      onFocus={() => {
        setFocus(true);
      }}
      onKeyDown={(e) => {
        if (["Enter", "Escape"].includes(e.key)) {
          e.preventDefault();
          setFocus(false);
        }
      }}
      onMouseEnter={() => {
        setEnter(true);
      }}
      onMouseLeave={() => {
        setEnter(false);
      }}
      autoFocus={focus ? true : false}
      onBlur={() => {
        setFocus(false);
      }}
      InputProps={{
        ...(focus
          ? {}
          : {
              disableUnderline: true,
            }),
      }}
      sx={{
        // Try to compute a correct width so that the textfield size changes
        // according to content size.
        width: `${((repoName?.length || 0) + 6) * 6}px`,
        minWidth: "100px",
        maxWidth: "500px",
        border: "none",
      }}
      disabled={!isOwner}
      onChange={(e) => {
        const name = e.target.value;
        setRepoName(name);
      }}
    />
  );

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
      }}
      spacing={1}
    >
      {!focus && enter ? (
        <Tooltip
          title="Edit"
          sx={{
            margin: 0,
            padding: 0,
          }}
          // placement="right"
          followCursor
        >
          {textfield}
        </Tooltip>
      ) : (
        textfield
      )}
      {repoNameDirty && <Box>saving..</Box>}
    </Stack>
  );
});

function RepoWrapper({ children, id }) {
  // this component is used to provide a foldable layout
  const [open, setOpen] = useLocalStorage("sidebar", true);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");

  const setShareOpen = useStore(store, (state) => state.setShareOpen);
  const navigate = useNavigate();
  const [copyRepo] = useMutation(
    gql`
      mutation CopyRepo($id: String!) {
        copyRepo(repoId: $id)
      }
    `,
    { variables: { id } }
  );
  // if(result.data.copyRepo){
  //   navigate(`/repo/${result.data.copyRepo}`);
  // }

  const DrawerWidth = 240;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Sidebar
        width={DrawerWidth}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
      />

      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          verticalAlign: "top",
          height: "100%",
          transition: "margin 195ms cubic-bezier(0.4, 0, 0.6, 1) 0ms",
          ml: open ? `${DrawerWidth}px` : 0,
        }}
      >
        <Header
          open={open}
          drawerWidth={DrawerWidth}
          breadcrumbItem={<HeaderItem id={id} />}
          shareButton={
            <Button
              endIcon={<ShareIcon />}
              onClick={() => setShareOpen(true)}
              variant="contained"
            >
              Share
            </Button>
          }
          forkButton={
            <Button
              endIcon={<ContentCopyIcon />}
              onClick={async () => {
                const result = await copyRepo();
                const newRepoId = result.data.copyRepo;
                window.open(`/repo/${newRepoId}`);
              }}
              variant="contained"
            >
              Make a copy
            </Button>
          }
        />
        <Box
          sx={{
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            pt: `52px`,
            mx: "auto",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function NotFoundAlert({ error }) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState<number | null>(3);

  useEffect(() => {
    if (seconds === 0) {
      setSeconds(null);
      navigate("/");
      return;
    }
    if (seconds === null) return;

    const timer = setTimeout(() => {
      setSeconds((prev) => prev! - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        <AlertTitle>Error: {error}</AlertTitle>
        The repo you are looking for is not found. Please check the URL. Go back
        your{" "}
        <Link component={ReactLink} to="/">
          dashboard
        </Link>{" "}
        page in {seconds} seconds.
      </Alert>
    </Box>
  );
}

function useRuntime() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const runtimeConnected = useStore(store, (state) => state.runtimeConnected);
  const wsConnect = useStore(store, (state) => state.wsConnect);
  const client = useApolloClient();
  const socket = useStore(store, (state) => state.socket);
  const { loading, me } = useMe();
  let { id: repoId } = useParams();
  // periodically check if the runtime is still connected
  useEffect(() => {
    if (me && !runtimeConnected) {
      wsConnect(client, `${me.id}_${repoId}`);
    }
    const interval = setInterval(() => {
      if (me && !runtimeConnected) {
        wsConnect(client, `${me.id}_${repoId}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [client, me, repoId, runtimeConnected, wsConnect]);
  // Periodically send ping to the server to keep the connection alive.
  // websocket resets after 60s of idle by most firewalls
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket) {
        console.log("sending ping to keep runtime alive ..");
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [socket]);
}

function RepoImpl() {
  let { id } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  useRuntime();
  const setRepo = useStore(store, (state) => state.setRepo);
  const client = useApolloClient();
  const loadRepo = useStore(store, (state) => state.loadRepo);
  const parseAllPods = useStore(store, (state) => state.parseAllPods);
  const resolveAllPods = useStore(store, (state) => state.resolveAllPods);
  const [parserLoaded, setParserLoaded] = useState(false);
  const scopedVars = useStore(store, (state) => state.scopedVars);
  const loadError = useStore(store, (state) => state.loadError);
  const setSessionId = useStore(store, (state) => state.setSessionId);
  const repoLoaded = useStore(store, (state) => state.repoLoaded);
  const setUser = useStore(store, (state) => state.setUser);
  const provider = useStore(store, (state) => state.provider);
  const addClient = useStore(store, (state) => state.addClient);
  const deleteClient = useStore(store, (state) => state.deleteClient);

  const { loading, me } = useMe();
  const { hasToken } = useAuth();
  useEffect(() => {
    if (me) {
      setSessionId(`${me.id}_${id}`);
    }
  }, [me, id, setSessionId]);

  useEffect(() => {
    if (provider) {
      const awareness = provider.awareness;
      awareness.on("update", (change) => {
        const states = awareness.getStates();
        const nodes = change.added.concat(change.updated);
        nodes.forEach((clientID) => {
          const user = states.get(clientID)?.user;
          if (user) {
            addClient(clientID, user.name, user.color);
          }
        });
        change.removed.forEach((clientID) => {
          deleteClient(clientID);
        });
      });
    }
  }, [addClient, deleteClient, provider]);

  useEffect(() => {
    initParser("/", () => {
      setParserLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (repoLoaded && parserLoaded) {
      parseAllPods();
      resolveAllPods();
    }
  }, [parseAllPods, parserLoaded, repoLoaded, resolveAllPods, scopedVars]);

  useEffect(() => {
    if (hasToken()) {
      if (!loading && me) {
        setUser(me);
        // load the repo. It is actually not a queue, just an async thunk
        loadRepo(client, id!);
      }
    } else {
      // not signed in, just load the repo
      loadRepo(client, id!);
    }
  }, [client, id, loadRepo, setRepo, me, loading, setUser, hasToken]);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.

  if (loading) return <Box>Loading</Box>;

  // TOFIX: consider more types of error and display detailed error message in the future
  // TOFIX: if the repo is not found, sidebar should not be rendered and runtime should not be lanuched.
  if (!repoLoaded && loadError) {
    return <NotFoundAlert error={loadError.message} />;
  }

  return (
    <RepoWrapper id={id}>
      {!repoLoaded && <Box>Repo Loading ...</Box>}
      {repoLoaded && (
        <Box
          height="100%"
          border="solid 3px black"
          p={2}
          boxSizing={"border-box"}
          // m={2}
          overflow="auto"
        >
          <Canvas />
        </Box>
      )}
    </RepoWrapper>
  );
}

export default function Repo() {
  let { id } = useParams();
  const store = useRef(createRepoStore()).current;
  const disconnectYjs = useStore(store, (state) => state.disconnectYjs);
  const connectYjs = useStore(store, (state) => state.connectYjs);
  const setRepo = useStore(store, (state) => state.setRepo);
  // console.log("load store", useRef(createRepoStore()));
  useEffect(() => {
    setRepo(id!);
    connectYjs();

    let intervalId = setInterval(() => {
      connectYjs();
    }, 1000);
    return () => {
      clearInterval(intervalId);
      // clean up the connected provider after exiting the page
      disconnectYjs();
    };
  }, [connectYjs, disconnectYjs, id, setRepo]);
  return (
    <RepoContext.Provider value={store}>
      <RepoImpl />
    </RepoContext.Provider>
  );
}
