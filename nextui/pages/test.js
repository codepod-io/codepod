import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Formik } from "formik";
import { chakra } from "@chakra-ui/system";
import { MySlateExample } from "../components/MySlate";

import {
  Box,
  Textarea,
  Checkbox,
  Switch,
  //   Editable,
  //   EditableInput,
  //   EditablePreview,
  Center,
  Grid,
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

import io from "socket.io-client";

import dynamic from "next/dynamic";
const MyXTerm = dynamic(() => import("../components/MyXTerm"), {
  ssr: false,
});

export default function Test() {
  const socket = io("http://localhost:4000");
  socket.emit("message", "hello");
  return (
    <Box maxW="lg" align="center" m="auto">
      <Heading>Test</Heading>
      <Box border="1px" w="sm" h="8rem">
        <MyXTerm />
      </Box>
      <Button
        onClick={() => {
          socket.emit("message", "hello");
        }}
      >
        send
      </Button>
      <Box border="1px">
        <MySlateExample />
      </Box>
    </Box>
  );
}
