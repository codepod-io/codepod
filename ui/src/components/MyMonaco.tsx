import { Position } from "monaco-editor";
import { useState, useContext } from "react";
import MonacoEditor, { MonacoDiffEditor } from "react-monaco-editor";
import { monaco } from "react-monaco-editor";
import { useStore } from "zustand";
import { RepoContext } from "../lib/store";
import { MonacoBinding } from "y-monaco";

monaco.languages.setLanguageConfiguration("julia", {
  indentationRules: {
    increaseIndentPattern:
      /^(\s*|.*=\s*|.*@\w*\s*)[\w\s]*(?:["'`][^"'`]*["'`])*[\w\s]*\b(if|while|for|function|macro|(mutable\s+)?struct|abstract\s+type|primitive\s+type|let|quote|try|begin|.*\)\s*do|else|elseif|catch|finally)\b(?!(?:.*\bend\b[^\]]*)|(?:[^[]*\].*)$).*$/,
    decreaseIndentPattern: /^\s*(end|else|elseif|catch|finally)\b.*$/,
  },
});

function construct_indent(pos, indent) {
  return [
    {
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: 1,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: " ".repeat(indent),
    },
  ];
}
function decide_indent_open(line) {
  // Assume line has more (. Decide the indent
  let ct = 0;
  for (let i = line.length - 1; i >= 0; i--) {
    if (line[i] === ")" || line[i] === "]") {
      ct += 1;
    } else if (line[i] === "(" || line[i] === "[") {
      ct -= 1;
    }
    if (ct === -1) {
      // check the pattern
      if (
        line.substring(i).match(/^\((define|lambda|let|for|match|case|when).*/)
      ) {
        return i + 2;
      }
      if (line.substring(i).match(/^[([]{2}/)) {
        return i + 1;
      }
      // trim right, and find " "
      let match = line.substring(i).trimRight().match(/\s/);
      if (match) {
        return i + match.index + 1;
      } else {
        return i + 2;
      }
    }
  }
}

function racket_format(model) {
  // console.log("executing formatting");
  // 1. scan from pos 1,1
  // record current indent, from 0
  // for each line, see how many () are there in this line
  // - if n_open = n_close: next_indent = currnet_indent
  // - if n_open > n_close: from right, find the first unpaired open (
  // - if n_open < n_close: find the last close, and find the match brackets
  let indent = 0;
  let shifts: { [key: number]: number } = {};
  for (let linum = 1; linum <= model.getLineCount(); linum += 1) {
    let line = model.getLineContent(linum);
    if (line.trim().length === 0) {
      // console.log("line empty");
      continue;
    }
    // console.log("indent:", linum, indent);
    let old_indent = line.length - line.trimLeft().length;
    if (indent !== old_indent) {
      shifts[linum] = indent - old_indent;
    }
    let n_open = (line.match(/\(|\[/g) || []).length;
    let n_close = (line.match(/\)|\]/g) || []).length;
    if (n_open === n_close) {
      // console.log("equal open/close parens");
      continue;
    } else if (n_open > n_close) {
      indent = decide_indent_open(line) + (shifts[linum] || 0);
    } else {
      // find the last close
      // CAUTION I have to have the "new" keyword here, otherwise Error
      let end_pos = new Position(linum, model.getLineMaxColumn(linum));
      let range = model.findPreviousMatch(")", end_pos, false).range;
      let pos = new Position(range.endLineNumber, range.endColumn);
      let match = model.matchBracket(pos);
      // this is actually a unmatched parenthesis
      if (!match) {
        console.log("warning: unmatched parens");
        return [];
      }
      let openPos = match[1];
      let shift = shifts[openPos.startLineNumber] || 0;

      // detect (define (XXX)
      let line2 = model.getLineContent(openPos.startLineNumber);
      let match2 = line2
        .substring(0, openPos.startColumn)
        .match(/\((define|lambda|let\*?|for|for\/list)\s*\($/);
      if (match2) {
        indent = match2.index + 2 + shift;
      } else {
        indent = openPos.startColumn - 1 + shift;
      }
    }
  }
  // console.log("shifts:", shifts);
  // console.log("computing edits ..");
  let res: any[] = [];
  for (const [linum, shift] of Object.entries(shifts)) {
    let edit = {
      range: {
        startLineNumber: parseInt(linum),
        startColumn: 1,
        endLineNumber: parseInt(linum),
        endColumn: Math.max(1 - shift, 1),
      },
      text: " ".repeat(Math.max(0, shift)),
    };
    res.push(edit);
  }
  // console.log("edits:", res);
  return res;
}

monaco.languages.registerDocumentFormattingEditProvider("scheme", {
  // CAUTION this won't give error feedback
  provideDocumentFormattingEdits: racket_format,
});

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
          const editorElement = editor.getContainerDomNode();
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

async function computeDiff(
  original,
  modified
): Promise<monaco.editor.ILineChange[] | null> {
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
  let decorations: any[] = [];
  for (const diff of diffs || []) {
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
  id = "0",
  gitvalue = null,
  onChange = (value) => {},
  onRun = () => {},
  onLayout = (height) => {},
}) {
  // console.log("rendering monaco ..");
  // there's no racket language support
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const showLineNumbers = useStore(store, (state) => state.showLineNumbers);

  if (lang === "racket") {
    lang = "scheme";
  }
  let [editor, setEditor] = useState<any>(null);
  if (editor) {
    // console.log("mounting gitgutter updater");
    editor.staged = gitvalue;
    updateGitGutter(editor);
  }
  const provider = useStore(store, (state) => state.provider);
  const ydoc = useStore(store, (state) => state.ydoc);
  const awareness = provider?.awareness;

  function onEditorDidMount(editor, monaco) {
    // console.log("did mount");
    setEditor(editor);
    // console.log(Math.min(1000, editor.getContentHeight()));
    const updateHeight = () => {
      // max height: 400
      const contentHeight = Math.max(
        100,
        editor.getContentHeight()
        // Math.min(400, editor.getContentHeight())
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
      onLayout(`${contentHeight}px`);
    };
    editor.onDidContentSizeChange(updateHeight);
    // FIXME clean up?
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, function () {
      onRun();
    });
    editor.onDidChangeModelContent(async (e) => {
      // content is value?
      updateGitGutter(editor);
    });

    // bind it to the ytext with pod id
    const ytext = ydoc.getText("monaco-" + id);
    const monacoBinding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      awareness
    );

    const init = () => {
      if (!ytext._start && ytext.length === 0) {
        ytext.insert(0, value);
      }
    };

    if (!provider || !provider.wsconnected) {
      // TODO: consider offline situation later
      console.log("editor", provider?.wsconnected, provider, editor.getModel());
      // editor.getModel().setValue(value);
      return;
    } else if (provider.synced) {
      init();
    } else {
      provider.once("synced", init);
    }

    // FIXME: make sure the provider.wsconnected is true or it won't display any content.
  }

  return (
    <MonacoEditor
      language={lang}
      // value={value}
      // theme="vs-dark"
      options={{
        selectOnLineNumbers: true,
        // This scrollBeyondLastLine is super important. Without this, it will
        // try to adjust height infinitely.
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: "full",
        // autoIndent: true,
        overviewRulerLanes: 0,
        automaticLayout: true,
        lineNumbers: showLineNumbers ? "on" : "off",
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          vertical: "hidden",
        },
      }}
      onChange={onChange}
      editorDidMount={onEditorDidMount}
    />
  );
}
