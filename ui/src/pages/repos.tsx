import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState } from "react";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";

import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import CircularProgress from "@mui/material/CircularProgress";
import ShareIcon from "@mui/icons-material/Share";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { ShareProjDialog } from "../components/ShareProjDialog";

import { Formik } from "formik";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

import useMe from "../lib/me";
const nanoid = customAlphabet(nolookalikes, 10);

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
  return (
    <Box
      sx={{
        display: "flex",
        // flexDirection: "column"
        alignItems: "center",
      }}
    >
      The link:{" "}
      <Link
        component={ReactLink}
        to={`/repo/${repo.id}`}
      >{`${repo.name}`}</Link>
      <Chip
        label={repo.public ? "public" : "private"}
        size="small"
        variant={repo.public ? "outlined" : "filled"}
      ></Chip>
      {sharable && (
        <Button
          size="small"
          sx={{ color: "#008000" }}
          endIcon={<ShareIcon />}
          onClick={() => setOpen(true)}
        >
          Share
        </Button>
      )}
      {deletable && (
        <Button
          size="small"
          sx={{
            color: "red",
          }}
          onClick={async () => {
            // FIXME ensure the runtime is killed
            deleteRepo({
              variables: {
                name: repo.name,
              },
            });
          }}
        >
          Delete
        </Button>
      )}
      {!rt_loading && rt_data.listAllRuntimes.includes(repo.id) && (
        <Box>
          Runtime Active{" "}
          <Button
            size="small"
            disabled={killing}
            sx={{ color: "red" }}
            onClick={() => {
              // FIXME when to set killing=false?
              setKilling(true);
              killRuntime({
                variables: {
                  sessionId: `${me.id}_${repo.id}`,
                },
              });
            }}
          >
            kill {killing && <CircularProgress />}
          </Button>
        </Box>
      )}
      <ShareProjDialog
        open={open}
        title={repo.name}
        onClose={() => setOpen(false)}
        id={repo.id}
      />
    </Box>
  );
}

function RepoList() {
  const { loading, error, data } = useQuery(FETCH_REPOS);
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  let repos = data.myRepos.slice().reverse();
  return (
    <>
      <Typography variant="h4" gutterBottom component="div">
        Your repos ({repos.length}):
      </Typography>
      {repos.map((repo) => (
        <RepoLine repo={repo} deletable={true} sharable={true} key={repo.id} />
      ))}
    </>
  );
}

// Almost the same as RepoList, consider re-using code later
function CollabRepoList() {
  const { loading, error, data } = useQuery(FETCH_COLLAB_REPOS);
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  let repos = data.myCollabRepos.slice().reverse();
  return (
    <>
      <Typography variant="h4" gutterBottom component="div">
        Shared repos ({repos.length}):
      </Typography>
      {repos.map((repo) => (
        <RepoLine
          repo={repo}
          deletable={false}
          sharable={false}
          key={repo.id}
        />
      ))}
    </>
  );
}

function Repos() {
  // const { loading, error, data } = useQuery(FETCH_REPOS);
  const { me } = useMe();

  // if (error) return <Alert severity="error">{error.message}</Alert>;
  // let repos = data.myRepos.slice().reverse();
  return (
    <Box sx={{ pt: 4 }}>
      <Box>
        Hello, {me?.firstname}! Please open or create a repository to get
        started.
      </Box>
      <CreateRepoForm />
      <RepoList />
      <CollabRepoList />
    </Box>
  );
}

function CreateRepoForm(props) {
  const [error, setError] = useState(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const [createRepo] = useMutation(
    gql`
      mutation CreateRepo($name: String!, $id: ID!, $isPublic: Boolean) {
        createRepo(name: $name, id: $id, isPublic: $isPublic) {
          name
        }
      }
    `,
    {
      refetchQueries: [
        // using this did not work
        // FETCH_REPOS,
        "GetRepos",
      ],
    }
  );
  return (
    <Formik
      initialValues={{ reponame: "" }}
      validate={(values) => {
        if (!values.reponame) {
          return { reponame: "Required" };
        }
        return {};
      }}
      onSubmit={(values, { setSubmitting, resetForm }) => {
        console.log("...");
        // clear the field
        // values.reponame = "";
        console.log(values);
        setError(null);
        console.log("creating the repo ..");
        createRepo({
          variables: {
            name: values.reponame,
            id: "repo_" + nanoid(),
            isPublic: !isPrivate,
          },
        });
        setSubmitting(false);
        // resetForm({ values: { reponame: "" } });
        resetForm();
        // Formik.resetForm();

        console.log("should be not submitting?");
        // return;
      }}
    >
      {({ values, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <div>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{ mt: 1 }}
          >
            <Stack spacing="6">
              <FormControl id="reponame">
                <FormLabel>Repo Name:</FormLabel>
                <TextField
                  name="reponame"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  // HEBI: ??? This is super weired. Otherwise the form input is not cleared.
                  // https://github.com/formium/formik/issues/446#issuecomment-451121289
                  value={values.reponame || ""}
                />
              </FormControl>

              <FormControlLabel
                sx={{ alignItems: "center" }}
                control={
                  <Switch
                    defaultChecked
                    onChange={(e) => {
                      setIsPrivate(e.target.checked);
                    }}
                  />
                }
                // checked={isPrivate}
                label={isPrivate ? "Private" : "Public"}
              />

              <Button type="submit" size="large" disabled={isSubmitting}>
                Create a New {isPrivate ? "Private" : "Public"} Repo
              </Button>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
        </div>
      )}
    </Formik>
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
