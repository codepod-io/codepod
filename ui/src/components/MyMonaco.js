import { useState } from "react";
import MonacoEditor, { MonacoDiffEditor } from "react-monaco-editor";
import { monaco } from "react-monaco-editor";

export function MyMonacoDiff({ from, to }) {
  return (
    <MonacoDiffEditor
      // width="800"
      // height="600"
      language="javascript"
      original={from || ""}
      value={to || ""}
      options={{
        selectOnLineNumbers: true,
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        renderOverviewRuler: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
        renderSideBySide: false,
        readOnly: true,
      }}
      editorDidMount={(editor, monaco) => {
        // const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
        // const lineCount = editor.getModel()?.getLineCount() || 1
        // const height = editor.getTopForLineNumber(lineCount + 1) + lineHeight
        const updateHeight = () => {
          const one = editor.getOriginalEditor();
          const two = editor.getModifiedEditor();
          // console.log(
          //   "one, two",
          //   one.getContentHeight(),
          //   two.getContentHeight()
          // );

          // max height: 400
          const contentHeight = Math.min(
            400,
            Math.max(one.getContentHeight(), two.getContentHeight())
          );
          // console.log("target height:", contentHeight);
          const editorElement = editor.getDomNode();
          if (!editorElement) {
            return;
          }
          editorElement.style.height = `${contentHeight}px`;
          // console.log("do the updating ..");
          editor.layout();
        };

        editor.onDidUpdateDiff(() => {
          // console.log("updating diff ..");
          updateHeight();
        });
      }}
    />
  );
}

async function computeDiff(original, modified) {
  return new Promise((resolve, reject) => {
    // 1. get a diff editor
    // 2. onDidUpdateDiff
    // 3. get the diff and return
    const originalModel = monaco.editor.createModel(original);
    const modifiedModel = monaco.editor.createModel(modified);
    // a dummy element just for creating the diff editor
    let elem = document.createElement("div");
    var diffEditor = monaco.editor.createDiffEditor(elem, {
      // You can optionally disable the resizing
      enableSplitViewResizing: false,
    });
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
    diffEditor.onDidUpdateDiff(() => {
      // this is the result
      let res = diffEditor.getLineChanges();
      resolve(res);
    });
  });
}

async function updateGitGutter(editor) {
  if (!editor.oldDecorations) {
    editor.oldDecorations = [];
  }
  const gitvalue = editor.staged;
  const value = editor.getValue();
  // console.log("computing diff with", gitvalue, "value:", value);
  // console.log("editor.staged", editor.staged);
  let diffs = await computeDiff(gitvalue, value);
  // console.log("original", gitvalue);
  // console.log("modified", value);
  // console.log("diffs:", diffs);
  let decorations = [];
  for (const diff of diffs) {
    diff.originalStartLineNumber;
    diff.originalEndLineNumber;
    diff.modifiedStartLineNumber;
    diff.modifiedEndLineNumber;
    // newly added lines
    if (diff.originalStartLineNumber > diff.originalEndLineNumber) {
      // newly added
      decorations.push({
        range: new monaco.Range(
          diff.modifiedStartLineNumber,
          1,
          diff.modifiedEndLineNumber,
          1
        ),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: "myLineDecoration-add",
        },
      });
    } else {
      if (diff.modifiedStartLineNumber > diff.modifiedEndLineNumber) {
        // deleted
        decorations.push({
          range: new monaco.Range(
            diff.modifiedStartLineNumber,
            1,
            diff.modifiedStartLineNumber,
            1
          ),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "myLineDecoration-delete",
          },
        });
      } else {
        // modified
        decorations.push({
          range: new monaco.Range(
            diff.modifiedStartLineNumber,
            1,
            diff.modifiedEndLineNumber,
            1
          ),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "myLineDecoration-modified",
          },
        });
      }
    }
  }
  // FIXME this is delta, so need to get previous decos.
  editor.oldDecorations = editor.deltaDecorations(
    editor.oldDecorations,
    decorations
  );
}

// This is very weired. This component will re-render, but the Monaco instance will
// not, and the instance will only be mounted once. All variables, even a object
// like the pod object will be fixed at original state: changing pod.staged
// won't be visible in the editorDidMount callback.
export function MyMonaco({
  lang = "javascript",
  value = "",
  gitvalue = null,
  onChange = () => {},
  onRun = () => {},
}) {
  // console.log("rendering monaco ..");
  // there's no racket language support
  if (lang === "racket") {
    lang = "scheme";
  }
  let [editor, setEditor] = useState(null);
  if (editor) {
    // console.log("mounting gitgutter updater");
    editor.staged = gitvalue;
    updateGitGutter(editor);
  }
  return (
    <MonacoEditor
      language={lang}
      // theme="vs-dark"
      value={value}
      options={{
        selectOnLineNumbers: true,
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        formatOnPaste: true,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
      }}
      onChange={onChange}
      editorDidMount={(editor, monaco) => {
        // console.log("did mount");
        setEditor(editor);
        // console.log(Math.min(1000, editor.getContentHeight()));
        const updateHeight = () => {
          // max height: 400
          const contentHeight = Math.max(
            100,
            Math.min(400, editor.getContentHeight())
          );
          // console.log("target height:", contentHeight);
          const editorElement = editor.getDomNode();
          if (!editorElement) {
            return;
          }
          editorElement.style.height = `${contentHeight}px`;
          // width: 800
          // editor.layout({ width: 800, height: contentHeight });
          editor.layout();
        };
        editor.onDidContentSizeChange(updateHeight);
        // FIXME clean up?
        var myBinding = editor.addCommand(
          [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
          function () {
            onRun();
          }
        );
        editor.onDidChangeModelContent(async (e) => {
          // content is value?
          updateGitGutter(editor);
        });
      }}
    />
  );
}
