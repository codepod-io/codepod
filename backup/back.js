import Editor, { DiffEditor, useMonaco, loader } from "@monaco-editor/react";

function MyMonacoFromScratch() {
  useEffect(() => {
    monaco.editor.create(document.getElementById("container"), {
      value: "function hello() {\n\talert('Hello world!');\n}",
      language: "javascript",
    });
  }, []);
  return <div id="container"></div>;
}

<Box border="1px" w="lg" h="sm" m="auto">
  {/* <Editor
  height="90vh"
  defaultLanguage="javascript"
  defaultValue="// some comment"
/> */}
  {/* <MyMonaco /> */}
  {/* <MyMonacoFromScratch /> */}
  <CodeHighlightingExample />
</Box>;

function MyMonaco() {
  const monaco = useMonaco();
  useEffect(() => {
    // do conditional chaining
    // monaco?.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    // or make sure that it exists by other ways
    if (monaco) {
      console.log("here is the monaco instance:", monaco);
      // window.themonaco = monaco;
      // console.log(monaco.getContentHeight());
      const updateHeight = () => {
        const contentHeight = Math.min(1000, monaco.getContentHeight());
        container.style.width = `${width}px`;
        container.style.height = `${contentHeight}px`;
        try {
          ignoreEvent = true;
          monaco.layout({ width, height: contentHeight });
        } finally {
          ignoreEvent = false;
        }
      };
      // monaco.editor.onDidContentSizeChange(updateHeight);
      console.log(monaco.editor);
    }
  }, [monaco]);
  return (
    <Box w="lg" h="lg" border="1px">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        defaultValue="// some comment"
      />
    </Box>
  );
}

function MyCodeSlate() {
  const [value, setValue] = useState([
    {
      type: "paragraph",
      children: [
        {
          text: "<h1>Hi!</h1>",
        },
      ],
    },
  ]);
  return (
    <Box border="1px" w="sm">
      <CodeSlack
        value={value}
        onChange={(value) => setValue(value)}
        language="javascript"
      />
    </Box>
  );
}

return (
  <Textarea
    w="xs"
    onChange={(e) => {
      dispatch(
        repoSlice.actions.setPodContent({ id, content: e.target.value })
      );
    }}
    value={pod.content || ""}
    placeholder="Code here"
  ></Textarea>
);

export function useXTerm() {
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
  return term;
}

export function XTerm({ term }) {
  const theterm = useRef(null);
  useEffect(() => {
    if (theterm.current) {
      term.open(theterm.current);
      term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m \r\n$ ");
      term.focus();
      fitAddon.fit();
    }
  }, []);

  // Add logic around `term`
  // FIXME still a small margin on bottom, not sure where it came from
  return <div style={{ height: "100%" }} ref={theterm} />;
}
