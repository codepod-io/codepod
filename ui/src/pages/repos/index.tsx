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
import CreateRepoForm from "./CreateRepoForm";
import useMe from "../../lib/me";

const FETCH_REPOS = gql`
  query GetRepos {
    myRepos {
      name
      id
    }
  }
`;

function RepoLine({ repo }) {
  const { me } = useMe();
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
      <TableCell align="left">{status ? "Running" : "NA"}</TableCell>
      <TableCell align="left">
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
      </TableCell>
    </TableRow>
  );
}

function Repos() {
  const { loading, error, data } = useQuery(FETCH_REPOS);
  const { me } = useMe();
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  let repos = data.myRepos.slice().reverse();
  return (
    <Box>
      <Box
        sx={{
          fontSize: "14px",
          paddingTop: "10px",
          color: "#6B87A2",
        }}
      >
        👋 Welcome, {me?.firstname}! Please open or create a repository to get
        started.
      </Box>
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
          Total repos ({repos.length})
        </Box>
        <CreateRepoForm />
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell align="left">Name</TableCell>
              <TableCell align="left">Status</TableCell>
              <TableCell align="left">Operations</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {repos.map((repo) => (
              <RepoLine repo={repo} key={repo.id} />
            ))}
          </TableBody>
       
        </Table>
        {repos.length === 0 ? <Box
            sx={{
                padding: '20px',
                color: '#6B87A2',
                fontSize: '18px',
                fontWeight: 600,
                display: 'flex',
                width: '100%',
                justifyContent: 'center'
            }}>Please create a new repo </Box> : null}
      </TableContainer>
    </Box>
  );
}

export default function Page() {
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      {/* TODO some meta information about the user */}
      {/* <CurrentUser /> */}
      {/* TODO the repos of this user */}
      <Repos />
    </Box>
  );
}
