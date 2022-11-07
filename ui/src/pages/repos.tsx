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
    </Box>
  );
}

function Repos() {
  const { loading, error, data } = useQuery(FETCH_REPOS);
  const { me } = useMe();
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  let repos = data.myRepos.slice().reverse();
  return (
    <Box sx={{ pt: 4 }}>
      <Box>
        Hello, {me?.firstname}! Please open or create a repository to get
        started.
      </Box>
      <CreateRepoForm />
      <Typography variant="h2" gutterBottom component="div">
        Your repos {repos.length}:
      </Typography>
      {repos.map((repo) => (
        <RepoLine repo={repo} key={repo.id} />
      ))}
    </Box>
  );
}

function CreateRepoForm(props) {
  const [error, setError] = useState(null);
  const [createRepo] = useMutation(
    gql`
      mutation CreateRepo($name: String!, $id: ID!) {
        createRepo(name: $name, id: $id) {
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

              <Button type="submit" size="large" disabled={isSubmitting}>
                Create New Repo
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
