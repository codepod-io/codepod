import { useMutation } from "@apollo/client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Input from "@mui/material/Input";
import InputLabel from "@mui/material/InputLabel";

import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

import Grid from "@mui/material/Grid";

import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

import React, { useEffect, useState } from "react";
import { Formik } from "formik";

import { useAuth } from "../lib/auth";
import useMe from "../lib/me";

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

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
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{ mt: 1 }}
          >
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
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                Update
              </Button>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
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
      <Box>
        <Box>Profile Page</Box>
        <Box>Please Log In</Box>
      </Box>
    );
  }

  return (
    <Box>
      <Flex direction="column">
        <Box>Profile page</Box>
        <Box>Hello {me.name}</Box>
        <Box>Name: {me.name || "NULL"}</Box>
        <Box>Username: {me.username}</Box>
        <Box component="pre">{JSON.stringify(me)}</Box>
        <Divider />
        <UpdateForm me={me} />
      </Flex>
    </Box>
  );
}
