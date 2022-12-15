import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import { gql, useApolloClient, useMutation } from "@apollo/client";

import { useEffect, useState, useRef, useContext } from "react";

import { useStore } from "zustand";

import { createRepoStore, RepoContext } from "../lib/store";

import useMe from "../lib/me";
import { Canvas } from "../components/Canvas";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Stack, TextField } from "@mui/material";
import { useAuth } from "../lib/auth";

const DrawerWidth = 240;
const SIDEBAR_KEY = "sidebar";

function RepoWrapper({ children, id }) {
  // this component is used to provide a foldable layout
  const [open, setOpen] = useLocalStorage(SIDEBAR_KEY, true);

  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const setRepoName = useStore(store, (state) => state.setRepoName);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);

  const [updateRepo, { error }] = useMutation(
    gql`
      mutation UpdateRepo($id: ID!, $name: String) {
        updateRepo(id: $id, name: $name)
      }
    `,
    { refetchQueries: ["GetRepos", "GetCollabRepos"] }
  );

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
          inRepo={true}
          setShareOpen={() => setShareOpen(true)}
          breadcrumbItem={
            <Stack direction="row">
              <TextField
                hiddenLabel
                placeholder="Untitled"
                value={repoName || ""}
                size="small"
                sx={{
                  maxWidth: "100%",
                }}
                onChange={(e) => {
                  const name = e.target.value;
                  setRepoName(name);
                  updateRepo({
                    variables: {
                      id,
                      name,
                    },
                  });
                }}
              />
              {error && <Box>ERROR: {error.message}</Box>}
            </Stack>
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

function RepoImpl() {
  let { id } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const resetState = useStore(store, (state) => state.resetState);
  const setRepo = useStore(store, (state) => state.setRepo);
  const client = useApolloClient();
  const loadRepo = useStore(store, (state) => state.loadRepo);
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
      console.log(awareness);
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
    resetState();
    setRepo(id!);
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
  }, [
    client,
    id,
    loadRepo,
    resetState,
    setRepo,
    me,
    loading,
    setUser,
    hasToken,
  ]);

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
  const store = useRef(createRepoStore()).current;
  const disconnect = useStore(store, (state) => state.disconnect);
  // console.log("load store", useRef(createRepoStore()));
  useEffect(() => {
    // const provider = useStore(store, (state) => state.provider);
    // clean up the connected provider after exiting the page
    return disconnect;
  }, [store]);
  return (
    <RepoContext.Provider value={store}>
      <RepoImpl />
    </RepoContext.Provider>
  );
}
