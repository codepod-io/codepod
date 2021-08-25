import React, { useState } from "react";
import { MySlateExample } from "../components/MySlate";

import { Box, Button, Heading } from "@chakra-ui/react";

import io from "socket.io-client";

import { XTerm } from "../components/MyXTerm";
import { Terminal } from "xterm";
import { MyMonaco } from "../components/MyMonaco";

import Stomp from "stompjs";

export default function Test() {
  var ws = new WebSocket("ws://codepod.test:15674/ws");
  var client = Stomp.over(ws);
  var on_connect = function () {
    console.log("connected");
    client.send("/queue/test", { priority: 9 }, "Hello, STOMP");
    var subscription = client.subscribe("/queue/test", function (message) {
      // called when the client receives a STOMP message from the server
      if (message.body) {
        console.log("got message with body " + message.body);
      } else {
        console.log("got empty message");
      }
    });
    // subscription.unsubscribe()
  };
  var on_error = function () {
    console.log("error");
  };
  client.connect("guest", "guest", on_connect, on_error, "/");
  return (
    <Box maxW="5xl" m="auto" minH="lg">
      <Heading>Test</Heading>
      {/* <MyMonaco /> */}
    </Box>
  );
}
