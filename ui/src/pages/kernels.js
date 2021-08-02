import { Box, Text, Heading } from "@chakra-ui/react";
import io from "socket.io-client";
import { Terminal } from "xterm";
import { XTerm, DummyTerm } from "../components/MyXTerm";

function getNewTerm(lang) {
  if (!lang) return DummyTerm();
  console.log("connecting to socket ..");
  // FIXME /ws url
  let socket = io(`https://${window.location.hostname}/graphql`);
  console.log("spawning ..");
  socket.emit("kernelTerminalSpawn", lang);
  let term = new Terminal();
  console.log("setting callbacks ..");
  term.onData((data) => {
    console.log("sending input");
    socket.emit("kernelTerminalInput", { lang, data });
  });
  socket.on("kernelTerminalOutput", ({ lang: lang2, data }) => {
    if (lang === lang2) {
      term.write(data);
    }
  });
  return term;
}

export default function Kernels() {
  const juliaTerm = getNewTerm("julia");
  const dummyTerm = getNewTerm();
  return (
    <Box>
      <Heading>Kernel Terminal</Heading>

      <Box w="lg" m="auto">
        <Text>Julia</Text>
        <XTerm term={juliaTerm}></XTerm>

        <Text>Dummy</Text>
        <XTerm term={dummyTerm}></XTerm>
      </Box>
    </Box>
  );
}
