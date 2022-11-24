import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState } from "react";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

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
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ShareIcon from "@mui/icons-material/Share";
import Chip from "@mui/material/Chip";
import { ShareProjDialog } from "../../components/ShareProjDialog";
import CreateRepoForm from "./CreateRepoForm";
import useMe from "../../lib/me";

enum RepoTypes {
  repo = "myRepos",
  collab = "myCollabRepos",
}
enum RepoHint {
  myRepos = "Please create a new repo",
  myCollabRepos = "Shared repos is empty",
}
enum RepoTitleHint {
  myRepos = "Your repos",
  myCollabRepos = "Shared repos",
}
const FETCH_REPOS = gql`
  query GetRepos {
    myRepos {
      name
      id
      public
    }
  }
`;

const FETCH_COLLAB_REPOS = gql`
  query GetCollabRepos {
    myCollabRepos {
      name
      id
      public
    }
  }
`;

function RepoLine({ repo, deletable, sharable }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [deleteRepo] = useMutation(
    gql`
      mutation deleteRepo($name: String) {
        deleteRepo(name: $name)
      }
    `,
    {
      refetchQueries: ["GetRepos"],
    }
  );
  const [killRuntime] = useMutation(
    gql`
      mutation killRuntime($sessionId: String!) {
        killRuntime(sessionId: $sessionId)
      }
    `,
    {
      refetchQueries: [
        {
          query: gql`
            query {
              listAllRuntimes
            }
          `,
        },
      ],
    }
  );
  const { loading: rt_loading, data: rt_data } = useQuery(gql`
    query {
      listAllRuntimes
    }
  `);
  const [killing, setKilling] = useState(false);
  const status = !rt_loading && rt_data.listAllRuntimes.includes(repo.id);
  return (
    <TableRow
      key={repo.id}
      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
    >
      <TableCell align="center">
        <Link component={ReactLink} to={`/repo/${repo.id}`}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <SourceIcon
              sx={{
                marginRight: "5px",
              }}
            />
            {`${repo.name}`}
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
      <TableCell align="left">{status ? "Running" : "NA"}</TableCell>
      <TableCell align="left">
        {deletable && (
          <Tooltip title="Delete Repo">
            <IconButton
              size="small"
              onClick={async () => {
                // FIXME ensure the runtime is killed
                deleteRepo({
                  variables: {
                    name: repo.name,
                  },
                });
              }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
        {status ? (
          <Tooltip title="Kill runtime">
            <IconButton
              disabled={killing}
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
        {sharable && (
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
        )}
      </TableCell>
    </TableRow>
  );
}

function Repos({ url = FETCH_REPOS, type = RepoTypes.repo }) {
  const { loading, error, data } = useQuery(url);
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  const repos = data[type].slice().reverse();
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
          {RepoTitleHint[type]} ({repos.length})
        </Box>
        {type === RepoTypes.repo && <CreateRepoForm />}
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell align="left">Name</TableCell>
              <TableCell align="left">Visibility</TableCell>
              <TableCell align="left">Status</TableCell>
              <TableCell align="left">Operations</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {repos.map((repo) => (
              <RepoLine
                repo={repo}
                deletable={type === RepoTypes.repo}
                sharable={type === RepoTypes.repo}
                key={repo.id}
              />
            ))}
          </TableBody>
        </Table>
        {repos.length === 0 ? (
          <Box
            sx={{
              padding: "20px",
              color: "#6B87A2",
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
              width: "100%",
              justifyContent: "center",
            }}
          >
            {RepoHint[type]}
          </Box>
        ) : null}
      </TableContainer>
    </Box>
  );
}
export default function Page() {
  const { me } = useMe();
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
        👋 Welcome, {me?.firstname}! Please open or create a repository to get
        started.
      </Box>
      <Repos />
      <Repos url={FETCH_COLLAB_REPOS} type={RepoTypes.collab} />
    </Box>
  );
}
