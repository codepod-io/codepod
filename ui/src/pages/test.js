import React, { useState } from "react";
import { MySlateExample } from "../components/MySlate";

import { Box, Button, Heading } from "@chakra-ui/react";

import io from "socket.io-client";

import { XTerm } from "../components/MyXTerm";
import { Terminal } from "xterm";

export default function Test() {
  let socket = io("http://localhost:4000");
  let term = new Terminal();
  term.onData((data) => {
    socket.emit("terminalInput", data);
  });
  socket.on("terminalOutput", (data) => {
    term.write(data);
  });

  return (
    <Box maxW="5xl" align="center" m="auto">
      <Heading>Test</Heading>
      <Box border="1px" w="3xl" h="lg">
        <XTerm term={term} />
      </Box>
      <Heading>Term2</Heading>
      <Box border="1px" w="3xl" h="lg">
        <XTerm />
      </Box>
      <Box border="1px">
        <MySlateExample />
      </Box>
    </Box>
  );
}
