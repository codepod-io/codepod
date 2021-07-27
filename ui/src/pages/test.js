import React, { useState } from "react";
import { MySlateExample } from "../components/MySlate";

import { Box, Button, Heading } from "@chakra-ui/react";

import io from "socket.io-client";

import { XTerm } from "../components/MyXTerm";
import { Terminal } from "xterm";
import { MyMonaco } from "../components/MyMonaco";

export default function Test() {
  return (
    <Box maxW="5xl" m="auto" minH="lg">
      <Heading>Test</Heading>
      <MyMonaco />
    </Box>
  );
}
