import React, { useState } from "react";
import { MySlateExample } from "../components/MySlate";

import { Box, Button, Heading } from "@chakra-ui/react";

import io from "socket.io-client";

import MyXTerm from "../components/MyXTerm";

export default function Test() {
  const [socket, setSocket] = useState(io("http://localhost:4000"));
  socket.on("terminalOutput", (data) => {
    // TODO write to the terminal
    console.log("output", data);
  });

  return (
    <Box maxW="lg" align="center" m="auto">
      <Heading>Test</Heading>
      <Button
        onClick={() => {
          setSocket(io("http://localhost:4000"));
        }}
      >
        Connect
      </Button>
      <Box border="1px" w="sm" h="8rem">
        <MyXTerm
          onData={(data) => {
            socket.emit("terminalInput", data);
          }}
        />
      </Box>
      <Button
        onClick={() => {
          if (!socket) {
            console.log("Not connected!");
          } else {
            socket.emit("message", "hello");
          }
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
