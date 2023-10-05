import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Button from "@mui/material/Button";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useEffect, useState, useRef, useContext, memo } from "react";

import * as React from "react";

import { useStore } from "zustand";

import { createRepoStore, RepoContext } from "../lib/store";

import { useMe } from "../lib/me";
import { Canvas } from "../components/Canvas";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  Breadcrumbs,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { initParser } from "../lib/parser";

import { usePrompt } from "../lib/prompt";

const HeaderItem = memo<any>(() => {
  const store = useContext(RepoContext)!;
  const repoName = useStore(store, (state) => state.repoName);
  const repoNameDirty = useStore(store, (state) => state.repoNameDirty);
  const setRepoName = useStore(store, (state) => state.setRepoName);
  const apolloClient = useApolloClient();
  const remoteUpdateRepoName = useStore(
    store,
    (state) => state.remoteUpdateRepoName
  );
  const editMode = useStore(store, (state) => state.editMode);

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
      disabled={editMode === "view"}
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

function RepoHeader({ id }) {
  const store = useContext(RepoContext)!;

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
  return (
    <Header>
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          alignItems: "baseline",
          display: "flex",
          flexGrow: 1,
        }}
      >
        <Link component={ReactLink} underline="hover" to="/">
          <Typography noWrap>CodePod</Typography>
        </Link>
        {/* <HeaderItem /> */}
      </Breadcrumbs>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          paddingRight: "10px",
        }}
      >
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
      </Box>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          paddingRight: "10px",
        }}
      >
        <Button
          endIcon={<ShareIcon />}
          onClick={() => setShareOpen(true)}
          variant="contained"
        >
          Share
        </Button>
      </Box>
    </Header>
  );
}

/**
 * Wrap the repo page with a header, a sidebar and a canvas.
 */
function HeaderWrapper({ children, id }) {
  const store = useContext(RepoContext)!;
  const isSidebarOnLeftHand = useStore(
    store,
    (state) => state.isSidebarOnLeftHand
  );
  const [open, setOpen] = useState(true);
  let sidebar_width = "240px";
  let header_height = "50px";

  return (
    <Box
      sx={{
        height: "100%",
      }}
    >
      {/* The header. */}
      <RepoHeader id={id} />
      {/* The sidebar */}
      <Drawer
        sx={{
          width: sidebar_width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: sidebar_width,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor={isSidebarOnLeftHand ? "left" : "right"}
        open={open}
      >
        <Box
          sx={{
            pt: header_height,
            verticalAlign: "top",
            height: "100%",
            overflow: "auto",
          }}
        >
          <Box sx={{ mx: 2, my: 1 }}>
            <Sidebar />
          </Box>
        </Box>
      </Drawer>

      {/* The button to toggle sidebar. */}
      <Box
        style={{
          position: "absolute",
          margin: "5px",
          top: header_height,
          ...(isSidebarOnLeftHand && { left: open ? sidebar_width : 0 }),
          ...(!isSidebarOnLeftHand && { right: open ? sidebar_width : 0 }),
          transition: "all .2s",
          zIndex: 100,
        }}
      >
        <IconButton
          onClick={() => {
            setOpen(!open);
          }}
          size="small"
          color="primary"
        >
          {isSidebarOnLeftHand ? (
            open ? (
              <ChevronLeftIcon />
            ) : (
              <ChevronRightIcon />
            )
          ) : open ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>
      </Box>

      {/* The Canvas */}
      <Box
        sx={{
          display: "inline-flex",
          flexGrow: 1,
          verticalAlign: "top",
          height: "100%",
          ...(isSidebarOnLeftHand && { ml: open ? sidebar_width : 0 }),
          width: open ? `calc(100% - ${sidebar_width})` : "100%",
          overflow: "scroll",
        }}
      >
        <Box
          sx={{
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            pt: header_height,
            mx: "auto",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function NotFoundAlert({}) {
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        The repo you are looking for is not found. Please check the URL. Go back
        your{" "}
        <Link component={ReactLink} to="/">
          dashboard
        </Link>
      </Alert>
    </Box>
  );
}

function RepoLoader({ id, children }) {
  // load the repo
  let query = gql`
    query Repo {
      repo {
        id
        name
      }
    }
  `;
  // FIXME this should be a mutation as it changes the last access time.
  const { data, loading, error } = useQuery(query, {
    variables: {
      id,
    },
    // CAUTION I must set this because refetechQueries does not work.
    fetchPolicy: "no-cache",
  });
  const store = useContext(RepoContext)!;
  const setEditMode = useStore(store, (state) => state.setEditMode);

  if (loading) return <Box>Loading</Box>;
  if (error) {
    return <Box>Error: Repo not found, {error.message}</Box>;
  }
  if (!data || !data.repo) return <NotFoundAlert />;
  setEditMode("edit");
  return children;
}

/**
 * This loads repo metadata.
 */
function ParserWrapper({ children }) {
  const store = useContext(RepoContext)!;
  const parseAllPods = useStore(store, (state) => state.parseAllPods);
  const resolveAllPods = useStore(store, (state) => state.resolveAllPods);
  const [parserLoaded, setParserLoaded] = useState(false);
  const scopedVars = useStore(store, (state) => state.scopedVars);

  useEffect(() => {
    initParser("/", () => {
      setParserLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (parserLoaded) {
      parseAllPods();
      resolveAllPods();
    }
  }, [parseAllPods, parserLoaded, resolveAllPods, scopedVars]);

  return children;
}

function WaitForProvider({ children, yjsWsUrl }) {
  const store = useContext(RepoContext)!;
  const providerSynced = useStore(store, (state) => state.providerSynced);
  const disconnectYjs = useStore(store, (state) => state.disconnectYjs);
  const connectYjs = useStore(store, (state) => state.connectYjs);
  const { me } = useMe();
  useEffect(() => {
    connectYjs({ yjsWsUrl, name: me?.firstname || "Anonymous" });
    return () => {
      disconnectYjs();
    };
  }, [connectYjs, disconnectYjs]);
  if (!providerSynced) return <Box>Loading Yjs Doc ..</Box>;
  return children;
}

/**
 * This loads users.
 */
function UserWrapper({ children }) {
  const { loading } = useMe();

  if (loading) return <Box>Loading ..</Box>;

  return children;
}

export function Repo({ yjsWsUrl }) {
  let { id } = useParams();
  const store = useRef(createRepoStore()).current;

  const setRepo = useStore(store, (state) => state.setRepo);
  // console.log("load store", useRef(createRepoStore()));
  useEffect(() => {
    setRepo(id!);
  }, []);
  return (
    <RepoContext.Provider value={store}>
      <UserWrapper>
        <RepoLoader id={id}>
          <WaitForProvider yjsWsUrl={yjsWsUrl}>
            <ParserWrapper>
              <HeaderWrapper id={id}>
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
              </HeaderWrapper>
            </ParserWrapper>
          </WaitForProvider>
        </RepoLoader>
      </UserWrapper>
    </RepoContext.Provider>
  );
}
