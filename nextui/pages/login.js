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
import { chakra } from "@chakra-ui/system";

import React, { useState } from "react";
import { FaFacebook, FaGithub, FaGoogle } from "react-icons/fa";
import { HiEye, HiEyeOff } from "react-icons/hi";
import { Formik } from "formik";
import { useRouter } from "next/router";
import Link from "next/link";

import { useAuth } from "../lib/auth";
import { StyledLink } from "../components/utils";

//////////
// Card

export const Card = (props) => (
  <Box
    bg={useColorModeValue("white", "gray.700")}
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
      <Text
        as="span"
        px="3"
        color={useColorModeValue("gray.600", "gray.400")}
        fontWeight="medium"
      >
        {children}
      </Text>
      <Box flex="1">
        <Divider borderColor="currentcolor" />
      </Box>
    </Flex>
  );
};

///////// LoginForm

function LoginForm(props) {
  const { signIn, isSignedIn } = useAuth();
  const [error, setError] = useState(null);
  return (
    <Formik
      initialValues={{ username: "", password: "" }}
      onSubmit={(values, { setSubmitting }) => {
        console.log("Logging in");
        console.log(values);
        console.log([values.username, values.password]);
        setError(null);
        return signIn({
          username: values.username,
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
          <chakra.form
            //   onSubmit={(e) => {
            //     e.preventDefault(); // your login logic here
            //     // signIn();
            //   }}
            onSubmit={handleSubmit}
            {...props}
          >
            <Stack spacing="6">
              <FormControl id="username">
                <FormLabel>Username or Email</FormLabel>
                <Input
                  name="username"
                  type="username"
                  autoComplete="username"
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
                colorScheme="blue"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                Sign in
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

///////// Password

export const PasswordField = React.forwardRef((props, ref) => {
  const { isOpen, onToggle } = useDisclosure();
  const inputRef = React.useRef(null);
  const mergeRef = useMergeRefs(inputRef, ref);

  const onClickReveal = () => {
    onToggle();
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
        <Box
          as="a"
          color={mode("blue.600", "blue.200")}
          fontWeight="semibold"
          fontSize="sm"
        >
          Forgot Password?
        </Box>
      </Flex>
      <InputGroup>
        <InputRightElement>
          <IconButton
            bg="transparent !important"
            variant="ghost"
            aria-label={isOpen ? "Mask password" : "Reveal password"}
            icon={isOpen ? <HiEyeOff /> : <HiEye />}
            onClick={onClickReveal}
          />
        </InputRightElement>
        <Input
          ref={mergeRef}
          name="password"
          type={isOpen ? "text" : "password"}
          autoComplete="current-password"
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          required
          // {...props}
        />
      </InputGroup>
    </FormControl>
  );
});
PasswordField.displayName = "PasswordField";

export default function Login() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  if (isSignedIn()) {
    router.push("/");
  }
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
        <Heading textAlign="center" size="xl" fontWeight="extrabold">
          Sign in to your account
        </Heading>
        <Text mt="4" mb="8" align="center" maxW="md" fontWeight="medium">
          <Text as="span">Don&apos;t have an account?</Text>
          <StyledLink href="/signup">Sign up for free</StyledLink>
        </Text>
        <Card>
          <LoginForm />
          <DividerWithText mt="6">or continue with</DividerWithText>
          <SimpleGrid mt="6" columns={3} spacing="3">
            <Button
              color="currentColor"
              variant="outline"
              onClick={() => {
                console.log("hello");
              }}
            >
              <VisuallyHidden>Login with Facebook</VisuallyHidden>
              <FaFacebook />
            </Button>
            <Button color="currentColor" variant="outline">
              <VisuallyHidden>Login with Google</VisuallyHidden>
              <FaGoogle />
            </Button>
            <Button color="currentColor" variant="outline">
              <VisuallyHidden>Login with Github</VisuallyHidden>
              <FaGithub />
            </Button>
          </SimpleGrid>
        </Card>
      </Box>
    </Box>
  );
}
