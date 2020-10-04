import React, { useState } from "react";
import "./styles.css";
import Editor from "@monaco-editor/react";
import { FillSpinner as Loader } from "react-spinners-kit";
import examples from "./examples";


import logo from './logo.svg';
import './App.css';
// import CodeMirror from 'codemirror'

// function Editor() {
//     // var myCodeMirror = CodeMirror(document.getElementById("myeditor"), {
//   //   value: "function myScript(){return 100;}\n",
//   //   mode:  "javascript"
//   // });
  
//   const ele = <div>
//     <p>My Editor</p>
//     <div id="myeditor"></div>
//   </div>
//   CodeMirror.fromTextArea(document.getElementById("myeditor"))
//   return ele
// }

import {Controlled as CodeMirror} from 'react-codemirror2'
import AceEditor from "react-ace";
import Editor from '@monaco-editor/react';

function MyEditor() {
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
  return (
    <>
      <button onClick={toggleTheme} disabled={!isEditorReady}>
        Toggle theme
      </button>
      <button onClick={toggleLanguage} disabled={!isEditorReady}>
        Toggle language
      </button>

      <Editor
        height="90vh" // By default, it fully fits with its parent
        theme={theme}
        language={language}
        // loading={<Loader />}
        // value={examples[language]}
        editorDidMount={handleEditorDidMount}
        options={{ lineNumbers: "off" }}
      />
    </>
  );
  // return <Editor height="90vh" language="javascript" />
}

function App() {
  return (
    <div className="App">
      <div>
        <p>Monaco</p>
        <MyEditor/>
      </div>
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      {/* <div>
        <p>Code Mirror</p>
        <CodeMirror
        onBeforeChange={(editor, data, value) => {
          this.setState({value});
        }}
        onChange={(editor, data, value) => {
        }}
      />
      </div>
      
      <div>
        <p>Ace Editor</p>
        <AceEditor
          mode="java"
          theme="github"
          // onChange={onChange}
          name="UNIQUE_ID_OF_DIV"
          editorProps={{ $blockScrolling: true }}
        />
      </div> */}

    </div>
  );
}

export default App;



      {/* <Editor
        // height="30vh" // By default, it fully fits with its parent
        // width="90%"
        theme={theme}
        language={language}
        loading={<Loader />}
        value={examples[language]}
        editorDidMount={handleEditorDidMount}
        options={{ lineNumbers: "off" }}
        className="h-auto"
      /> */}

      {/* <CodeMirror
        value={code}
        options={{
          // theme: 'monokai',
          // keyMap: 'vim',
          mode: 'python',
        }}
        className="box-border border-4"
      /> */}


      // import { FillSpinner as Loader } from "react-spinners-kit";
// import examples from "./examples";
// import CodeMirror from "./MyCodeMirror";
// import CodeMirror from '@uiw/react-codemirror';
// import {Controlled as CodeMirror} from 'react-codemirror2'