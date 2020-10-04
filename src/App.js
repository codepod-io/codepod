import React, { useEffect, useRef, useState } from "react";
import './tailwind.output.css';
import "codemirror/lib/codemirror.css"
import "./App.css";
import Editor from "@monaco-editor/react";

import "codemirror/mode/python/python"
import "codemirror/addon/search/match-highlighter"

import CodeMirror from 'codemirror'

// import 'codemirror/keymap/emacs';
// import 'codemirror/keymap/vim';
// import 'codemirror/keymap/sublime';
// import 'codemirror/theme/monokai.css';

function MyBasicEditor() {
  return <Editor height="90vh" language="javascript" />;
}

function MyEditor3(props = {}, ref) {
  const {value=''} = props;
  // "function myScript(){return 100;}\n"
  const textareaRef = useRef();
  const [editor, setEditor] = useState();

  useEffect(() => {
    var editor = CodeMirror(
    // var editor = CodeMirror.fromTextArea(
      // document.getElementById("editor"),
      textareaRef.current,
      {
        lineNumbers: true,
      // viewportMargin: Infinity,
      // mode: "python",
      value: value,
      mode:  "python",
      highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: true}
    });
    return () => {
      editor.toTextArea();
      setEditor(undefined);
    }
  }, [editor])
  
  return <div ref={textareaRef} className="box-border border-4 container mx-auto text-left m-2 w-10/12">
  {/* <textarea 
    ref={textareaRef}
    // id="editor"
    // className="h-auto"
    ></textarea> */}
    </div>
}

function MyEditor2() {
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("javascript");
  const [isEditorReady, setIsEditorReady] = useState(false);

  function handleEditorDidMount() {
    setIsEditorReady(true);
  }

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  function toggleLanguage() {
    setLanguage(language === "javascript" ? "python" : "javascript");
  }


  const code = 'import os';

  const code1 = `def foo():
    return 2`;

    const code2 = `def bar():
    return 3`;

    const code3 = `def foobar():
    return foo() + bar()`

    const code4 = `import os
var = foobar()
var`

  return (
    <>
    <h1 className='h1'>PDP!</h1>
    <div>
      {/* <Pebble>

      </Pebble> */}
      <MyEditor3 value={code1}/>
      <MyEditor3 value={code2}/>
      <MyEditor3 value={code3}/>
      <MyEditor3 value={code4}/>

    </div>
    </>
  );
}

function Pebble() {
  return (
    <div>
      <MyEditor2 />
    </div>
  );
}

export default function App() {
  return (
    <div className="App">
      <h1>PDP: the Pebble Development Platform</h1>
      <h2>Start editing to see some magic happen!</h2>
      {/* <MyBasicEditor /> */}
      <p className="text-blue-300">some random staff</p>
      <Pebble />
    </div>
  );
}
