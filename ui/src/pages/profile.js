import { useMutation } from "@apollo/client";
import {
  Center,
  Box,
  Code,
  Flex,
  Button,
  Heading,
  SimpleGrid,
  Text,
  useColorModeValue,
  VisuallyHidden,
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
} from "@chakra-ui/react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

import { chakra } from "@chakra-ui/system";

import React, { useEffect, useState } from "react";
import { Formik } from "formik";

import { useAuth } from "../lib/auth";
import useMe from "../lib/me";

function UpdateForm({ me }) {
  let [updateUser, {}] = useMutation(
    gql`
      mutation UpdateUser($username: String, $name: String, $email: String) {
        updateUser(username: $username, name: $name, email: $email)
      }
    `,
    { refetchQueries: ["Me"] }
  );

  /* eslint-disable no-unused-vars */
  const [error, setError] = useState(null);
  return (
    <Formik
      initialValues={{ email: me.email, name: me.name }}
      validate={(values) => {
        const errors = {};
        if (!values.email) {
          errors.email = "Required";
        } else if (
          !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
        ) {
          errors.email = "Invalid email address";
        }
        return errors;
      }}
      onSubmit={(values, { setSubmitting }) => {
        setError(null);
        console.log("update:", values);
        updateUser({
          variables: {
            username: me.username,
            email: values.email,
            name: values.name,
          },
        });
        return true;
        // return signUp({
        //   email: values.email,
        //   username: values.username,
        //   password: values.password,
        //   invitation: values.invitation,
        // }).catch((err) => {
        //   // TODO use more user friendly error message
        //   setError(err.message);
        // });
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
          <chakra.form onSubmit={handleSubmit}>
            <Stack spacing="6">
              <FormControl id="username">
                <FormLabel>Username</FormLabel>
                <Input
                  name="username"
                  type="username"
                  autoComplete="username"
                  value={me.username}
                  // onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  isDisabled
                />
              </FormControl>
              <FormControl id="name">
                <FormLabel>Full Name</FormLabel>
                <Input
                  name="name"
                  type="name"
                  autoComplete="name"
                  value={values.name || ""}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
              </FormControl>
              <FormControl id="email">
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
              </FormControl>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                Update
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

export default function Profile() {
  const { me } = useMe();

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <Center>
        <Text>Profile Page</Text>
        <Text>Please Log In</Text>
      </Center>
    );
  }

  return (
    <Center>
      <Flex direction="column">
        <Text>Profile page</Text>
        <Text>Hello {me.name}</Text>
        <Box>Name: {me.name || "NULL"}</Box>
        <Text>Username: {me.username}</Text>
        <Code>{JSON.stringify(me)}</Code>
        <Divider />
        <UpdateForm me={me} />
      </Flex>
    </Center>
  );
}
