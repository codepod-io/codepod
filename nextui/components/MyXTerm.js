import React, { useRef, useEffect, useState } from "react";
import { FitAddon } from "xterm-addon-fit";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
const className = require("classnames");
// import { className } from "classnames";
import { Resizable } from "re-resizable";

export default function MyXTerm({ onData = (data) => {} }) {
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
  return (
    // <Resizable
    //   defaultSize={{
    //     width: 320,
    //     height: 200,
    //   }}
    // >
    //   {/* Sample with default size */}
    //   <div ref={theterm} />
    // </Resizable>
    <Resizable
      width={350}
      height={350}
      style={{
        background: "firebrick",
        padding: "0.4em",
        margin: "1em",
      }}
    >
      <div id="xterm" ref={theterm} style={{ height: "100%", width: "100%" }} />
      {/* <ResizeObserver
        onResize={(rect) => {
          fitAddon.fit();
          console.log("Resized. New bounds:", rect.width, "x", rect.height);
        }}
        onPosition={(rect) => {
          console.log("Moved. New position:", rect.left, "x", rect.top);
        }}
      /> */}
    </Resizable>
  );
}
