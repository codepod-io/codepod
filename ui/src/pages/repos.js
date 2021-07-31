import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useEffect, useState } from "react";
import useMe from "../lib/me";
import { StyledLink as Link } from "../components/utils";

import {
  Box,
  Button,
  Heading,
  Text,
  Stack,
  FormControl,
  FormLabel,
  Input,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { Formik } from "formik";
import { chakra } from "@chakra-ui/system";

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
  const { me } = useMe();
  if (loading) return <p>Loading...</p>;
  if (error)
    return (
      <Alert status="error">
        <AlertIcon />
        {error.message}
      </Alert>
    );
  let repos = data.myRepos;
  return (
    <Box>
      <CreateRepoForm />
      <Heading>Your repos {repos.length}:</Heading>
      {repos.map((repo) => (
        <Text key={repo.id}>
          The link:{" "}
          <Link
            to={`/${me?.username}/${repo.name}`}
          >{`/${me?.username}/${repo.name}`}</Link>
        </Text>
      ))}
    </Box>
  );
}

function CreateRepoForm(props) {
  const [error, setError] = useState(null);
  const [createRepo, {}] = useMutation(
    gql`
      mutation CreateRepo($name: String!) {
        createRepo(name: $name) {
          id
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
          <chakra.form onSubmit={handleSubmit} {...props}>
            <Stack spacing="6">
              <FormControl id="reponame">
                <FormLabel>Repo Name:</FormLabel>
                <Input
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
                colorScheme="blue"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                Create New Repo
              </Button>
              {error && (
                <Alert status="error">
                  <AlertIcon />
                  {error}
                </Alert>
              )}
            </Stack>
          </chakra.form>
        </div>
      )}
    </Formik>
  );
}

export default function Page() {
  return (
    <Box maxW="lg" align="center" m="auto">
      {/* TODO some meta information about the user */}
      {/* <CurrentUser /> */}
      {/* TODO the repos of this user */}
      <Repos />
    </Box>
  );
}
