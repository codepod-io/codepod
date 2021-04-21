import Head from "next/head";
import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState } from "react";

import {
  Box,
  Flex,
  Button,
  Heading,
  SimpleGrid,
  Text,
  useColorModeValue,
  VisuallyHidden,
  useToken,
  Stack,
  FormControl,
  FormLabel,
  Input,
  Divider,
  useDisclosure,
  useMergeRefs,
  useColorModeValue as mode,
  InputGroup,
  InputRightElement,
  IconButton,
  Alert,
  AlertIcon,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Formik } from "formik";
import { chakra } from "@chakra-ui/system";

const CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      username
    }
  }
`;

function CurrentUser() {
  const { loading, error, data } = useQuery(CURRENT_USER);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;
  console.log(data);
  return <Text>Hello {data.currentUser.username}!</Text>;
}

function Repos() {
  const { loading, error, data } = useQuery(gql`
    query Repos {
      Repo {
        name
      }
    }
  `);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;
  console.log(data);
  return (
    <Box>
      <CreateRepoForm />
      <Heading>Your repos {data.Repo.length}:</Heading>
      {data.Repo.map((repo) => (
        <Text>{repo.name}</Text>
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
  const [createRepo, { data }] = useMutation(CREATE_REPO);
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
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
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
      <CurrentUser />
      {/* TODO the repos of this user */}
      <Repos />
    </Box>
  );
}
