import { useQuery, useMutation, gql, useApolloClient } from "@apollo/client";
import React, { useState, useEffect, useCallback } from "react";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import CircularProgress from "@mui/material/CircularProgress";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import PublicOffIcon from "@mui/icons-material/PublicOff";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import useMe from "../lib/me";
import { getUpTime } from "../lib/utils";
import {
  Button,
  Card,
  CardActions,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import { useAuth } from "../lib/auth";
import { GoogleSignin } from "./login";
import { timeDifference } from "../lib/utils";
import { useSnackbar } from "notistack";

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
      refetchQueries: ["GetDashboardRepos"],
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

const Star = ({ repo }) => {
  const { me } = useMe();
  const [star, { loading: starLoading }] = useMutation(
    gql`
      mutation star($repoId: ID!) {
        star(repoId: $repoId)
      }
    `,
    {
      refetchQueries: ["GetDashboardRepos"],
    }
  );
  const [unstar, { loading: unstarLoading }] = useMutation(
    gql`
      mutation unstar($repoId: ID!) {
        unstar(repoId: $repoId)
      }
    `,
    {
      refetchQueries: ["GetDashboardRepos"],
    }
  );
  const isStarred = repo.stargazers?.map((_) => _.id).includes(me.id);
  return (
    <>
      {isStarred ? (
        <Tooltip title="unstar">
          <Button
            size="small"
            variant="text"
            color="inherit"
            sx={{
              borderRadius: "10px",
              borderColor: "lightgray",
            }}
            onClick={() => {
              unstar({ variables: { repoId: repo.id } });
            }}
            disabled={unstarLoading}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <StarIcon
                fontSize="inherit"
                sx={{
                  color: "orange",
                }}
              />
              <Box>{repo.stargazers.length}</Box>
            </Stack>
          </Button>
        </Tooltip>
      ) : (
        <Tooltip title="star">
          <Button
            size="small"
            color="inherit"
            variant="text"
            sx={{
              borderRadius: "10px",
              borderColor: "lightgray",
            }}
            onClick={() => {
              star({ variables: { repoId: repo.id } });
            }}
            disabled={starLoading}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <StarBorderIcon
                fontSize="inherit"
                sx={{
                  color: "black",
                }}
              />
              <Box>{repo.stargazers.length}</Box>
            </Stack>
          </Button>
        </Tooltip>
      )}
    </>
  );
};

const KillRuntimeButton = ({ repo }) => {
  const { loading, data } = useQuery(gql`
    query ListAllRuntimes {
      listAllRuntimes {
        sessionId
        lastActive
      }
    }
  `);
  const { me } = useMe();
  const [killRuntime, { loading: killing }] = useMutation(
    gql`
      mutation killRuntime($sessionId: String!) {
        killRuntime(sessionId: $sessionId)
      }
    `,
    {
      refetchQueries: ["ListAllRuntimes"],
    }
  );

  if (loading) return null;
  const info = data.listAllRuntimes.find(
    ({ sessionId }) => sessionId === `${me.id}_${repo.id}`
  );
  if (!info) return null;
  if (!info.lastActive) return null;
  return (
    <Box>
      {/* last active: {getUpTime(info.lastActive)} */}
      <Tooltip title={getUpTime(info.lastActive)} placement="top">
        {/* <Box> */}
        <Tooltip title="Kill runtime">
          <IconButton
            disabled={killing}
            size="small"
            onClick={async () => {
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
        {/* </Box> */}
      </Tooltip>
    </Box>
  );
};

const DeleteRepoButton = ({ repo }) => {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const [deleteRepo, { loading }] = useMutation(
    gql`
      mutation deleteRepo($id: ID!) {
        deleteRepo(id: $id)
      }
    `,
    {
      refetchQueries: ["GetDashboardRepos"],
      onCompleted() {
        enqueueSnackbar("Successfully deleted repo", { variant: "success" });
      },
      onError() {
        enqueueSnackbar("Failed to delete repo", { variant: "error" });
      },
    }
  );
  return (
    <Box>
      <Tooltip title="Delete Repo">
        <IconButton
          disabled={loading}
          size="small"
          onClick={() => {
            setOpen(true);
          }}
        >
          {loading ? (
            <CircularProgress size="14px" />
          ) : (
            <DeleteIcon fontSize="inherit" />
          )}
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
        <DialogTitle>{`Delete ${repo.name}`}</DialogTitle>
        <DialogContent>Are you sure?</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              deleteRepo({
                variables: {
                  id: repo.id,
                },
              });
              setOpen(false);
            }}
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const RepoCard = ({ repo }) => {
  const { me } = useMe();
  // peiredically re-render so that the "last viwed time" and "lact active time"
  // are updated every second.
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <Card sx={{ minWidth: 275, maxWidth: 275 }}>
      <CardHeader
        avatar={
          <Box>
            {repo.userId !== me.id ? (
              <Tooltip title="Shared with me">
                <GroupsIcon fontSize="small" color="primary" />
              </Tooltip>
            ) : repo.public ? (
              <Tooltip title="public">
                <PublicIcon fontSize="small" color="success" />
              </Tooltip>
            ) : (
              <Tooltip title="private">
                <PublicOffIcon fontSize="small" color="error" />
              </Tooltip>
            )}
          </Box>
        }
        action={
          // TODO replace with a drop-down menu.
          <IconButton aria-label="settings" disabled={true}>
            <MoreVertIcon />
          </IconButton>
        }
        title={
          <Box>
            <Link
              component={ReactLink}
              to={`/repo/${repo.id}`}
              sx={{ display: "inline" }}
            >
              <Stack direction="row">
                <DescriptionOutlinedIcon
                  sx={{
                    marginRight: "5px",
                  }}
                />
                {repo.name || "Untitled"}
              </Stack>
            </Link>
          </Box>
        }
        subheader={
          <Stack direction="row">
            Viewed{" "}
            {timeDifference(new Date(), new Date(parseInt(repo.accessedAt)))}
          </Stack>
        }
      />
      {/* <CardContent></CardContent> */}
      <CardActions disableSpacing>
        <Star repo={repo} />
        <Box
          sx={{
            marginLeft: "auto",
          }}
        >
          <KillRuntimeButton repo={repo} />
        </Box>

        <DeleteRepoButton repo={repo} />
      </CardActions>
    </Card>
  );
};

const RepoLists = () => {
  const { loading, error, data } = useQuery(gql`
    query GetDashboardRepos {
      getDashboardRepos {
        name
        id
        userId
        public
        stargazers {
          id
        }
        updatedAt
        createdAt
        accessedAt
      }
    }
  `);

  if (loading) {
    return <CircularProgress />;
  }
  if (error) {
    return <Box>ERROR: {error.message}</Box>;
  }
  const repos = data.getDashboardRepos.slice();
  // sort repos by last access time
  repos.sort((a, b) => {
    if (a.accessedAt && b.accessedAt) {
      return parseInt(b.accessedAt) - parseInt(a.accessedAt);
    } else if (a.accessedAt) {
      return -1;
    } else if (b.accessedAt) {
      return 1;
    } else {
      return 0;
    }
  });
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
          You don't have any projects yet. Click "Create New Project" to get
          started.
        </Box>
      )}
      <Box display="flex" flexWrap="wrap">
        {repos.map((repo) => (
          <Box sx={{ m: 1 }}>
            <RepoCard repo={repo} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default function Page() {
  const { me } = useMe();
  const { hasToken, loginGuest, isSignedIn } = useAuth();

  useEffect(() => {
    if (!hasToken()) {
      loginGuest();
    }
  }, [hasToken]);

  if (!me) {
    return <Box>Loading user ..</Box>;
  }
  return (
    <Box sx={{ maxWidth: "md", alignItems: "center", m: "auto" }}>
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
        <Box sx={{ alignItems: "center", m: "auto" }}>
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
