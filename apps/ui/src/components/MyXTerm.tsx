import React, { useRef, useEffect } from "react";
import { FitAddon } from "xterm-addon-fit";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

export function DummyTerm() {
  let term = new Terminal();
  function prompt() {
    var shellprompt = "$ ";
    term.write("\r\n" + shellprompt);
  }
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m \r\n");
  term.write("This is a dummy terminal.\r\n$ ");
  term.onKey((key) => {
    const char = key.domEvent.key;
    if (char === "Enter") {
      prompt();
    } else if (char === "Backspace") {
      term.write("\b \b");
    } else {
      term.write(char);
      // fitAddon.fit();
    }
  });
  return term;
}

export function XTerm({ term = DummyTerm() }) {
  // initXTerm(term);
  const theterm = useRef(null);
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  useEffect(() => {
    if (theterm.current) {
      term.open(theterm.current);
      // term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m \r\n$ ");
      term.focus();
      fitAddon.fit();
    }
    return () => {
      term.dispose();
    };
  }, []);

  // Add logic around `term`
  // FIXME still a small margin on bottom, not sure where it came from
  return <div style={{ height: "100%" }} ref={theterm} />;
}

// DEPRECATED
function MyXTerm({ onData = (data) => {} }) {
  const theterm = useRef(null);
  const term = new Terminal();
  // term.setOption("theme", { background: "#fdf6e3" });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  function prompt() {
    var shellprompt = "$ ";
    term.write("\r\n" + shellprompt);
  }
  term.onKey((key) => {
    const char = key.domEvent.key;
    if (char === "Enter") {
      prompt();
    } else if (char === "Backspace") {
      term.write("\b \b");
    } else {
      term.write(char);
      // fitAddon.fit();
    }
  });

  term.onData(onData);

  // useRef?
  useEffect(() => {
    if (theterm.current) {
      // console.log(term);
      // console.log(theterm.current);
      // console.log("...");
      term.open(theterm.current);
      term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m \r\n$ ");
      term.focus();
      fitAddon.fit();
      // term.onData((data) => {
      //   console.log("On data", data);
      //   term.write(data);
      // });
      // term.onKey(() => {
      //   console.log("key");
      // });
    }
  }, []);

  // Add logic around `term`
  // FIXME still a small margin on bottom, not sure where it came from
  return <div style={{ height: "100%" }} ref={theterm} />;
}
