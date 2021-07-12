import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState } from "react";
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

function Repos() {
  const { loading, error, data } = useQuery(
    gql`
      query Repos {
        myRepos {
          name
          id
        }
      }
    `
  );
  const { me } = useMe();
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;
  return (
    <Box>
      <CreateRepoForm />
      <Heading>Your repos {data.myRepos.length}:</Heading>
      {data.myRepos.map((repo) => (
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

const CREATE_REPO = gql`
  mutation CreateRepo($name: String!) {
    CreateRepo(name: $name) {
      name
    }
  }
`;

function CreateRepoForm(props) {
  const [error, setError] = useState(null);
  // const [createRepo, { data }] = useMutation(CREATE_REPO);
  const [createRepo, { data }] = useMutation(gql`
    mutation CreateRepo($name: String!) {
      createRepo(name: $name) {
        id
        name
      }
    }
  `);
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
        console.log(data);
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
