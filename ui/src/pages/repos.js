import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useEffect, useState } from "react";
import useMe from "../lib/me";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";

import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

import { Formik } from "formik";

function Text(props) {
  return (
    <Box component="span" {...props}>
      {props.children}
    </Box>
  );
}

const FETCH_REPOS = gql`
  query GetRepos {
    myRepos {
      name
      id
    }
  }
`;

function Repos() {
  const { loading, error, data } = useQuery(FETCH_REPOS);
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
  const { me } = useMe();
  if (loading) return <p>Loading...</p>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  let repos = data.myRepos.slice().reverse();
  return (
    <Box>
      <CreateRepoForm />
      <Typography variant="h2" gutterBottom component="div">
        Your repos {repos.length}:
      </Typography>
      {repos.map((repo) => (
        <div key={repo.id}>
          The link:{" "}
          <Link
            component={ReactLink}
            to={`/${me?.username}/${repo.name}`}
          >{`/${me?.username}/${repo.name}`}</Link>
          <Button
            size="xs"
            sx={{
              color: "red",
            }}
            onClick={() => {
              deleteRepo({
                variables: {
                  name: repo.name,
                },
              });
            }}
          >
            Delete
          </Button>
        </div>
      ))}
    </Box>
  );
}

function CreateRepoForm(props) {
  const [error, setError] = useState(null);
  const [createRepo, {}] = useMutation(
    gql`
      mutation CreateRepo($name: String!) {
        createRepo(name: $name)
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
        const errors = {};
        if (!values.reponame) {
          errors.reponame = "Required";
        }
        return errors;
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

              <Button
                type="submit"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
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
