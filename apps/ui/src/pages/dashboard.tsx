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
import { useMe } from "../lib/auth";
import { getUpTime } from "../lib/utils/utils";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useAuth } from "../lib/auth";
import { GoogleSignin } from "./login";
import { timeDifference } from "../lib/utils/utils";
import { useSnackbar } from "notistack";
import { useTheme } from "@mui/material/styles";

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

const StarButton = ({ repo }) => {
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
          <IconButton
            size="small"
            onClick={() => {
              unstar({ variables: { repoId: repo.id } });
            }}
            disabled={unstarLoading}
          >
            <StarIcon
              fontSize="inherit"
              sx={{
                color: "orange",
              }}
            />
            {repo.stargazers.length}
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="star">
          <IconButton
            size="small"
            onClick={() => {
              star({ variables: { repoId: repo.id } });
            }}
            disabled={starLoading}
          >
            <StarBorderIcon fontSize="inherit" />
            {repo.stargazers.length}
          </IconButton>
        </Tooltip>
      )}
    </>
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
  const theme = useTheme();
  return (
    <Box>
      <Tooltip title="Delete Repo">
        <IconButton
          disabled={loading}
          size="small"
          sx={{
            "&:hover": {
              color: theme.palette.error.main,
            },
          }}
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
      <CardContent>
        <Stack direction="row" display="flex">
          <Link
            component={ReactLink}
            to={`/repo/${repo.id}`}
            sx={{
              alignItems: "center",
            }}
          >
            <Stack direction="row" display="inline-flex">
              <DescriptionOutlinedIcon
                sx={{
                  marginRight: "5px",
                }}
              />
              <Box component="span">{repo.name || "Untitled"}</Box>
            </Stack>
          </Link>
          <Box ml="auto">
            <StarButton repo={repo} />
          </Box>
        </Stack>
        <Typography variant="subtitle2" color="gray">
          <Stack direction="row">
            Viewed{" "}
            {timeDifference(new Date(), new Date(parseInt(repo.accessedAt)))}
          </Stack>
        </Typography>
      </CardContent>
      <CardActions disableSpacing>
        <Box>
          {repo.userId !== me.id && (
            <Tooltip title="Shared with me">
              <GroupsIcon fontSize="small" color="primary" />
            </Tooltip>
          )}
          {repo.public && (
            <Tooltip title="public">
              <PublicIcon fontSize="small" color="success" />
            </Tooltip>
          )}
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
          <Box sx={{ m: 1 }} key={repo.id}>
            <RepoCard repo={repo} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

function NoLogginErrorAlert() {
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        Please{" "}
        <Link component={ReactLink} to="/login">
          login
        </Link>{" "}
        first!
      </Alert>
    </Box>
  );
}

export function Dashboard() {
  const { loading, me } = useMe();
  if (loading)
    return (
      <Box sx={{ maxWidth: "md", alignItems: "center", m: "auto" }}>
        Loading ..
      </Box>
    );
  if (!me) {
    return <NoLogginErrorAlert />;
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
      <RepoLists />
    </Box>
  );
}
