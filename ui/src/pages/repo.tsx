import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

import { useEffect, useState, useRef, useContext } from "react";

import { useStore } from "zustand";

import { createRepoStore, RepoContext } from "../lib/store";

import { Canvas } from "../components/Canvas";
import { Sidebar } from "../components/Sidebar";
import { useApolloClient } from "@apollo/client";
import { useAuth0 } from "@auth0/auth0-react";

function RepoWrapper({ children }) {
  // this component is used to provide foldable sidebar
  const [show, setShow] = useState(true);
  let sidebar_width = 0.12;
  return (
    <Box m="auto" height="100%">
      <Box
        sx={{
          display: "inline-block",
          verticalAlign: "top",
          height: "100%",
          width: show ? sidebar_width : 0,
          overflow: "auto",
        }}
      >
        <Box sx={{ display: "flex" }}>
          {/* <Spacer /> */}
          <Button
            onClick={() => {
              setShow(!show);
            }}
            size="small"
            // variant="ghost"
          >
            {show ? "Hide" : "Show"}
          </Button>
        </Box>
        <Box sx={{ mx: 2, my: 1 }}>
          <Sidebar />
        </Box>
      </Box>

      <Box
        sx={{
          display: "inline-block",
          verticalAlign: "top",
          height: "100%",
          width: show ? 1 - sidebar_width : 1,
          overflow: "scroll",
        }}
      >
        <Box
          style={{
            position: "absolute",
            margin: "5px",
            top: "50px",
            left: "5px",
          }}
          zIndex={100}
          visibility={show ? "hidden" : "inherit"}
        >
          <Button
            onClick={() => {
              setShow(!show);
            }}
            size="small"
            // variant="ghost"
          >
            {show ? "Hide" : "Show"}
          </Button>
        </Box>
        {children}
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
  const repoLoaded = useStore(store, (state) => state.repoLoaded);
  const setUser = useStore(store, (state) => state.setUser);
  const provider = useStore(store, (state) => state.provider);
  const addClient = useStore(store, (state) => state.addClient);
  const deleteClient = useStore(store, (state) => state.deleteClient);
  const { user, isLoading, isAuthenticated, loginWithRedirect } = useAuth0();
  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      loginWithRedirect({ appState: { targetUrl: window.location.pathname } });
  }, [isAuthenticated, isLoading, loginWithRedirect]);

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
    // load the repo. It is actually not a queue, just an async thunk
    loadRepo(client, id!);
    if (user) {
      setUser(user);
    }
  }, [client, id, loadRepo, resetState, setRepo, setUser, user]);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.
  if (isLoading) return <Box>Loading user</Box>;
  if (!user) return <Box>Loading</Box>;

  // TOFIX: consider more types of error and display detailed error message in the future
  // TOFIX: if the repo is not found, sidebar should not be rendered and runtime should not be lanuched.
  if (!repoLoaded && loadError) {
    return <NotFoundAlert error={loadError.message} />;
  }

  return (
    <RepoWrapper>
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
