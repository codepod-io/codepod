import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

import Grid from "@mui/material/Grid";

import { useNavigate } from "react-router-dom";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import React, { useEffect, useState } from "react";
import { FaFacebook, FaGithub, FaGoogle } from "react-icons/fa";
import { Formik } from "formik";

import { useAuth } from "../lib/auth";

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
        <Divider sx={{ borderColor: "currentcolor" }} />
      </Box>
      <Text as="span" px="3" color="gray.600" fontWeight="medium">
        {children}
      </Text>
      <Box flex="1">
        <Divider sx={{ borderColor: "currentcolor" }} />
      </Box>
    </Flex>
  );
};

///////// LoginForm

function LoginForm(props) {
  /* eslint-disable no-unused-vars */
  const { signIn, isSignedIn } = useAuth();
  const [error, setError] = useState(null);
  return (
    <Formik
      initialValues={{ email: "", password: "" }}
      onSubmit={(values, { setSubmitting }) => {
        console.log("Logging in");
        console.log(values);
        console.log([values.email, values.password]);
        setError(null);
        return signIn({
          email: values.email,
          password: values.password,
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
              <FormControl id="email">
                <FormLabel>Email</FormLabel>
                <TextField
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
              <Button
                type="submit"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                Sign in
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
  // FIXME alternatives?
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
      <TextField
        ref={mergeRef}
        name="password"
        type={isOpen ? "text" : "password"}
        autoComplete="current-password"
        onChange={props.handleChange}
        onBlur={props.handleBlur}
        required
        // {...props}
      />
    </FormControl>
  );
});
PasswordField.displayName = "PasswordField";

export default function Login() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);
  return (
    <Box
      sx={{
        bg: "gray.50",
        minH: "100vh",
        py: "12",
        px: {
          base: "4",
          lg: "8",
        },
      }}
    >
      <Box
        sx={{
          maxWidth: "md",
          mx: "auto",
        }}
      >
        <Typography variant="h2" gutterBottom component="div">
          Sign in to your account
        </Typography>
        <Text
          sx={{
            mt: "4",
            mb: "8",
            align: "center",
            maxWidth: "md",
            fontWeight: "medium",
          }}
        >
          <Text as="span">Don&apos;t have an account?</Text>
          <Link component={ReactLink} to="/signup">
            Sign up for free
          </Link>
        </Text>
        <Card>
          <LoginForm />
          <DividerWithText mt="6">or continue with</DividerWithText>
          <Grid
            container
            spacing={2}
            sx={{
              mt: 3,
            }}
          >
            <Grid item xs={4}>
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
            <Grid item xs={4}>
              <Button color="currentColor" variant="outline">
                {/* <VisuallyHidden>Login with Google</VisuallyHidden> */}
                <FaGoogle />
              </Button>
            </Grid>
            <Grid item xs={4}>
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
