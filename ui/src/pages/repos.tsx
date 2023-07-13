import { useQuery, useMutation, gql, useApolloClient } from "@apollo/client";
import React, { useState, useEffect, useCallback } from "react";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import DeleteIcon from "@mui/icons-material/Delete";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import CircularProgress from "@mui/material/CircularProgress";
import SourceIcon from "@mui/icons-material/Source";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ShareIcon from "@mui/icons-material/Share";
import Chip from "@mui/material/Chip";
import { ShareProjDialog } from "../components/ShareProjDialog";
import useMe from "../lib/me";
import { getUpTime } from "../lib/utils";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  useTheme,
} from "@mui/material";
import { useAuth } from "../lib/auth";
import { GoogleSignin } from "./login";
import { timeDifference } from "../lib/utils";
import { useSnackbar } from "notistack";

const GET_REPOS = gql`
  query GetRepos {
    myRepos {
      name
      id
      public
      updatedAt
      createdAt
    }
  }
`;

function RepoLine({
  repo,
  deletable,
  sharable,
  runtimeInfo,
  onDeleteRepo,
  deleting,
}) {
  const { me } = useMe();
  const theme = useTheme();
  const [killRuntime] = useMutation(
    gql`
      mutation killRuntime($sessionId: String!) {
        killRuntime(sessionId: $sessionId)
      }
    `,
    {
      refetchQueries: ["ListAllRuntimes"],
    }
  );

  // haochen: any reason not using Loading state from useMutation?
  const [killing, setKilling] = useState(false);
  return (
    <TableRow
      key={repo.id}
      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
    >
      <TableCell align="center">
        <Link
          component={ReactLink}
          to={`/repo/${repo.id}`}
          sx={
            deleting && {
              color: theme.palette.action.disabled,
              textDecorationColor: theme.palette.action.disabled,
              pointerEvents: "none",
            }
          }
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <DescriptionOutlinedIcon
              sx={{
                marginRight: "5px",
              }}
            />
            {repo.name || "Untitled"}
          </Box>
        </Link>
      </TableCell>
      <TableCell align="left">
        <Chip
          label={repo.public ? "public" : "private"}
          size="small"
          variant={repo.public ? "outlined" : "filled"}
        ></Chip>
      </TableCell>
      <TableCell align="left">
        {runtimeInfo
          ? runtimeInfo.lastActive
            ? "last active: " + getUpTime(runtimeInfo.lastActive)
            : "running"
          : "-"}
      </TableCell>
      <TableCell align="left">
        {timeDifference(new Date(), new Date(parseInt(repo.updatedAt)))}
      </TableCell>
      <TableCell align="left">
        {deletable && (
          <Tooltip title="Delete Repo">
            <IconButton
              disabled={deleting}
              size="small"
              onClick={() => {
                // FIXME ensure the runtime is killed
                onDeleteRepo(repo);
              }}
            >
              {deleting ? (
                <CircularProgress size="14px" />
              ) : (
                <DeleteIcon fontSize="inherit" />
              )}
            </IconButton>
          </Tooltip>
        )}
        {runtimeInfo ? (
          <Tooltip title="Kill runtime">
            <IconButton
              disabled={killing || deleting}
              size="small"
              onClick={async () => {
                // FIXME when to set killing=false?
                setKilling(true);
                killRuntime({
                  variables: {
                    sessionId: `${me.id}_${repo.id}`,
                  },
                });
              }}
            >
              {killing ? (
                <CircularProgress size="14px" />
              ) : (
                <StopCircleIcon fontSize="inherit" />
              )}
            </IconButton>
          </Tooltip>
        ) : null}
        {/* {sharable && (
          <>
            <Tooltip title="Share">
              <IconButton size="small" onClick={() => setOpen(true)}>
                <ShareIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <ShareProjDialog
              open={open}
              title={repo.name}
              onClose={() => setOpen(false)}
              id={repo.id}
            />
          </>
        )} */}
      </TableCell>
    </TableRow>
  );
}

function RepoHintText({ children }) {
  return (
    <Box
      sx={{
        padding: "20px",
        color: "#6B87A2",
        fontSize: "18px",
        fontWeight: 600,
        display: "flex",
        // width: "100%",
        justifyContent: "center",
        alignContent: "center",
      }}
    >
      {children}
    </Box>
  );
}

function CreateRepoForm(props) {
  const [createRepo] = useMutation(
    gql`
      mutation CreateRepo {
        createRepo {
          id
        }
      }
    `,
    {
      refetchQueries: ["GetRepos"],
    }
  );
  const navigate = useNavigate();
  return (
    <Box>
      <Button
        variant="contained"
        onClick={async () => {
          let res = await createRepo();
          if (res.data.createRepo.id) {
            navigate(`/repo/${res.data.createRepo.id}`);
          }
        }}
      >
        Create New Project
      </Button>
    </Box>
  );
}

function RepoList({ repos }) {
  const { me } = useMe();
  const [clickedRepo, setClickedRepo] = useState<
    { id: string; name: string } | undefined
  >();
  const [isConfirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
    useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const client = useApolloClient();
  const [deleteRepo, deleteRepoResult] = useMutation(
    gql`
      mutation deleteRepo($id: ID!) {
        deleteRepo(id: $id)
      }
    `,
    {
      onCompleted() {
        client.writeQuery({
          query: GET_REPOS,
          data: {
            myRepos: repos.filter((repo) => repo.id !== clickedRepo?.id),
          },
        });
        enqueueSnackbar("Successfully deleted repo", { variant: "success" });
      },
      onError() {
        enqueueSnackbar("Failed to delete repo", { variant: "error" });
      },
    }
  );
  // FIXME once ttl is reached, the runtime is killed, but this query is not
  // updated.
  const { loading, data } = useQuery(gql`
    query ListAllRuntimes {
      listAllRuntimes {
        sessionId
        lastActive
      }
    }
  `);

  const onConfirmDeleteRepo = useCallback(() => {
    setConfirmDeleteDialogOpen(false);
    deleteRepo({
      variables: {
        id: clickedRepo?.id,
      },
    }).then(() => setClickedRepo(undefined));
  }, [clickedRepo?.id, deleteRepo]);

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="left">Name</TableCell>
              <TableCell align="left">Visibility</TableCell>
              <TableCell align="left">Status (TTL: 12h)</TableCell>
              <TableCell align="left">Last Viewed</TableCell>
              <TableCell align="left">Operations</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {repos.map((repo) => (
              <RepoLine
                repo={repo}
                deletable={true}
                deleting={
                  repo.id === clickedRepo?.id && deleteRepoResult.loading
                }
                sharable={true}
                runtimeInfo={
                  loading
                    ? null
                    : data.listAllRuntimes.find(
                        ({ sessionId }) => sessionId === `${me.id}_${repo.id}`
                      )
                }
                key={repo.id}
                onDeleteRepo={(repo) => {
                  setClickedRepo(repo);
                  setConfirmDeleteDialogOpen(true);
                }}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ConfirmDeleteDialog
        repoName={clickedRepo?.name}
        open={isConfirmDeleteDialogOpen}
        handleCancel={() => {
          setClickedRepo(undefined);
          setConfirmDeleteDialogOpen(false);
        }}
        handleConfirm={onConfirmDeleteRepo}
      />
    </>
  );
}

function MyRepos() {
  const { loading, error, data } = useQuery(GET_REPOS);

  if (loading) {
    return <CircularProgress />;
  }
  if (error) {
    return <Box>ERROR: {error.message}</Box>;
  }
  const repos = data.myRepos.slice();
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
        }}
      >
        <Box
          sx={{
            color: "#839DB5",
            fontSize: "25px",
          }}
        >
          My projects ({repos.length})
        </Box>
        <CreateRepoForm />
      </Box>

      {repos.length === 0 && (
        <RepoHintText>
          You don't have any projects yet. Click "Create New Project" to get
          started.
        </RepoHintText>
      )}
      <RepoList repos={repos} />
    </Box>
  );
}

function SharedWithMe() {
  const { loading, error, data } = useQuery(gql`
    query GetCollabRepos {
      myCollabRepos {
        name
        id
        public
        updatedAt
        createdAt
      }
    }
  `);
  if (loading) {
    return <CircularProgress />;
  }
  if (error) {
    return <Box>ERROR: {error.message}</Box>;
  }
  const repos = data.myCollabRepos.slice();
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
        }}
      >
        <Box
          sx={{
            color: "#839DB5",
            fontSize: "25px",
          }}
        >
          Projects shared with me ({repos.length})
        </Box>
      </Box>

      {repos.length > 0 ? (
        <RepoList repos={repos} />
      ) : (
        <RepoHintText>
          No projects are shared with you. You can share your projects with
          others by clicking "Share" in the project page.
        </RepoHintText>
      )}
    </Box>
  );
}

function NoLogginErrorAlert() {
  const nevigate = useNavigate();
  const [seconds, setSeconds] = useState<number | null>(3);

  useEffect(() => {
    if (seconds === 0) {
      setSeconds(null);
      nevigate("/login");
      return;
    }
    if (seconds === null) return;

    const timer = setTimeout(() => {
      setSeconds((prev) => prev! - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [nevigate, seconds]);

  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        Please login first! Automatically jump to{" "}
        <Link component={ReactLink} to="/login">
          login
        </Link>{" "}
        page in {seconds} seconds.
      </Alert>
    </Box>
  );
}

function RepoLists() {
  // peiredically re-render so that the "last active time" is updated
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <>
      <MyRepos />
      <SharedWithMe />
    </>
  );
}

function ConfirmDeleteDialog({
  open,
  repoName,
  handleConfirm,
  handleCancel,
}: {
  open: boolean;
  repoName?: string;
  handleConfirm: () => void;
  handleCancel: () => void;
}) {
  const name = repoName ?? "Repo";
  return (
    <Dialog open={open} onClose={handleCancel} fullWidth>
      <DialogTitle>{`Delete ${name}`}</DialogTitle>
      <DialogContent>Are you sure?</DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleConfirm} autoFocus>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Page() {
  const { me } = useMe();
  const { hasToken, loginGuest, isSignedIn } = useAuth();

  useEffect(() => {
    if (!hasToken()) {
      loginGuest();
    }
  }, [hasToken]);

  if (!me) {
    // return <NoLogginErrorAlert />;
    return <Box>Loading user ..</Box>;
  }
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      {/* TODO some meta information about the user */}
      {/* <CurrentUser /> */}
      {/* TODO the repos of this user */}
      <Box
        sx={{
          fontSize: "14px",
          paddingTop: "10px",
          color: "#6B87A2",
          position: "relative",
        }}
      >
        Welcome, {me?.firstname}! Please open or create a repository to get
        started.
      </Box>
      {!isSignedIn() && (
        <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
          <Alert severity="warning">
            Please note that you are a{" "}
            <Box component="span" color="red">
              Guest
            </Box>{" "}
            user. Please{" "}
            <Link component={ReactLink} to="/login">
              Login
            </Link>{" "}
            or
            <Link component={ReactLink} to="/signup">
              Signup
            </Link>{" "}
            to save your work.
            <GoogleSignin />
          </Alert>
        </Box>
      )}
      <RepoLists />
    </Box>
  );
}
