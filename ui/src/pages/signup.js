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

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import React, { useEffect, useState } from "react";
import { FaFacebook, FaGithub, FaGoogle } from "react-icons/fa";
import { HiEye, HiEyeOff } from "react-icons/hi";
import { Formik } from "formik";

import { useAuth } from "../lib/auth";
import { useHistory } from "react-router-dom";

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function Text(props) {
  return (
    <Box component="span" {...props}>
      {props.children}
    </Box>
  );
}

//////////
// Card

export const Card = (props) => (
  <Box
    bg="white"
    py="8"
    px={{
      base: "4",
      md: "10",
    }}
    shadow="base"
    rounded={{
      sm: "lg",
    }}
    {...props}
  />
);

////////
// Divider

export const DividerWithText = (props) => {
  const { children, ...flexProps } = props;
  return (
    <Flex align="center" color="gray.300" {...flexProps}>
      <Box flex="1">
        <Divider borderColor="currentcolor" />
      </Box>
      <Text as="span" px="3" color="gray.600" fontWeight="medium">
        {children}
      </Text>
      <Box flex="1">
        <Divider borderColor="currentcolor" />
      </Box>
    </Flex>
  );
};

///////// LoginForm

function SignupForm(props) {
  /* eslint-disable no-unused-vars */
  const { signUp, isSignedIn } = useAuth();
  const [error, setError] = useState(null);
  return (
    <Formik
      initialValues={{ email: "", password: "", invitation: "" }}
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
        return signUp({
          email: values.email,
          username: values.username,
          password: values.password,
          invitation: values.invitation,
        }).catch((err) => {
          // TODO use more user friendly error message
          setError(err.message);
        });
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
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
              </FormControl>
              {/* Passing handlers in seems messy.*/}
              <PasswordField
                handleChange={handleChange}
                handleBlur={handleBlur}
              />
              <FormControl id="invitation">
                <FormLabel>Invitation Code</FormLabel>
                <Input
                  name="invitation"
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
                Sign up
              </Button>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
        </div>
      )}
    </Formik>
  );
}

///////// Password

export const PasswordField = React.forwardRef((props, ref) => {
  const [isOpen, setOpen] = useState(false);
  const inputRef = React.useRef(null);
  // const mergeRef = useMergeRefs(inputRef, ref);
  const mergeRef = inputRef;

  const onClickReveal = () => {
    setOpen(!isOpen);
    const input = inputRef.current;

    if (input) {
      input.focus({
        preventScroll: true,
      });
      const length = input.value.length * 2;
      requestAnimationFrame(() => {
        input.setSelectionRange(length, length);
      });
    }
  };

  return (
    <FormControl id="password">
      <Flex justify="space-between">
        <FormLabel>Password</FormLabel>
        <Box as="a" color="blue.600" fontWeight="semibold" fontSize="sm">
          Forgot Password?
        </Box>
      </Flex>
      {/* <InputRightElement>
        <IconButton
          bg="transparent !important"
          variant="ghost"
          aria-label={isOpen ? "Mask password" : "Reveal password"}
          icon={isOpen ? <HiEyeOff /> : <HiEye />}
          onClick={onClickReveal}
        />
      </InputRightElement> */}
      <Input
        ref={mergeRef}
        name="password"
        type={isOpen ? "text" : "password"}
        autoComplete="current-password"
        onChange={props.handleChange}
        onBlur={props.handleBlur}
        required
        //   {...props}
      />
    </FormControl>
  );
});
PasswordField.displayName = "PasswordField";

export default function Signup() {
  const { isSignedIn } = useAuth();
  let history = useHistory();
  useEffect(() => {
    if (isSignedIn()) {
      history.push("/");
    }
  }, [isSignedIn]);
  return (
    <Box
      //   bg={useColorModeValue("gray.50", "inherit")}
      minH="100vh"
      py="12"
      px={{
        base: "4",
        lg: "8",
      }}
    >
      <Box maxW="md" mx="auto">
        <Typography
          variant="h2"
          textAlign="center"
          size="xl"
          fontWeight="extrabold"
        >
          Sign up an account
        </Typography>
        <Text mt="4" mb="8" align="center" maxW="md" fontWeight="medium">
          <Text as="span">Already have an account?</Text>
          <Link component={ReactLink} to="/login">
            Login
          </Link>
        </Text>
        <Card>
          <SignupForm />
          <DividerWithText mt="6">or continue with</DividerWithText>
          <Grid
            container
            spacing={2}
            sx={{
              mt: 3,
            }}
          >
            <Grid item>
              <Button
                color="currentColor"
                variant="outline"
                onClick={() => {
                  console.log("hello");
                }}
              >
                {/* <VisuallyHidden>Login with Facebook</VisuallyHidden> */}
                <FaFacebook />
              </Button>
            </Grid>
            <Grid item>
              <Button color="currentColor" variant="outline">
                {/* <VisuallyHidden>Login with Google</VisuallyHidden> */}
                <FaGoogle />
              </Button>
            </Grid>
            <Grid item>
              <Button color="currentColor" variant="outline">
                {/* <VisuallyHidden>Login with Github</VisuallyHidden> */}
                <FaGithub />
              </Button>
            </Grid>
          </Grid>
        </Card>
      </Box>
    </Box>
  );
}
