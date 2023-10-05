import { Position } from "monaco-editor";
import { useState, useContext, memo, useCallback, useEffect } from "react";
import MonacoEditor, { MonacoDiffEditor } from "react-monaco-editor";
import { monaco } from "react-monaco-editor";
import { Node } from "reactflow";
import { useStore } from "zustand";
import * as Y from "yjs";

import { RepoContext } from "../lib/store";
import { MonacoBinding } from "y-monaco";
import { useReactFlow } from "reactflow";
import { Annotation } from "../lib/parser";
import { useApolloClient } from "@apollo/client";

const theme: monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f3f3f340",
    "editor.lineHighlightBackground": "#f3f3f340",
  },
};
monaco.editor.defineTheme("codepod", theme);
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

/**
 * Highlight the given symbol table annotations in the editor, including
 * function definitions and callsites, and variable definitions and references.
 * @param editor The Monaco editor instance.
 * @param annotations The annotations to highlight.
 */
function highlightAnnotations(
  editor: monaco.editor.IStandaloneCodeEditor & { oldDecorations?: any[] },
  annotations: Annotation[]
) {
  if (!editor.oldDecorations) {
    editor.oldDecorations = [];
  }
  // 1. get the positions
  let decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const {
    type,
    name,
    origin,
    startPosition,
    endPosition,
  } of annotations) {
    decorations.push({
      range: new monaco.Range(
        startPosition.row + 1,
        startPosition.column + 1,
        endPosition.row + 1,
        endPosition.column + 1
      ),
      options: {
        isWholeLine: false,
        inlineClassName:
          (() => {
            switch (type) {
              case "function":
                return "myDecoration-function";
              case "vardef":
                return "myDecoration-vardef";
              case "callsite":
                // NOTE using the same style for both callsite and varuse.
                // return "myDecoration-callsite";
                return "myDecoration-varuse";
              case "varuse":
                return "myDecoration-varuse";
              case "bridge":
                return "myDecoration-bridge-unused";
              default:
                throw new Error("unknown type: " + type);
            }
          })() + (origin ? "" : " my-underline"),
        hoverMessage: {
          value: `${name} -> ${origin}`,
        },
      },
    });
  }
  // 2. apply decorations
  editor.oldDecorations = editor.deltaDecorations(
    editor.oldDecorations,
    decorations
  );
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

interface MyMonacoProps {
  id: string;
  fontSize: number;
}

export const MyMonaco = memo<MyMonacoProps>(function MyMonaco({
  id = "0",
  fontSize = 14,
}) {
  // there's no racket language support
  console.debug("[perf] rendering MyMonaco", id);
  const store = useContext(RepoContext)!;
  const showLineNumbers = useStore(store, (state) => state.showLineNumbers);
  const yjsRun = useStore(store, (state) => state.yjsRun);
  const apolloClient = useApolloClient();
  const focusedEditor = useStore(store, (state) => state.focusedEditor);
  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);
  const annotations = useStore(
    store,
    (state) => state.parseResult[id]?.annotations
  );
  const showAnnotations = useStore(store, (state) => state.showAnnotations);
  const scopedVars = useStore(store, (state) => state.scopedVars);
  const updateView = useStore(store, (state) => state.updateView);

  // TODO support other languages.
  let lang = "python";
  let [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (focusedEditor === id) {
      editor?.focus();
    }
  }, [focusedEditor]);

  useEffect(() => {
    if (!editor) return;
    if (showAnnotations) {
      highlightAnnotations(editor, annotations || []);
    } else {
      highlightAnnotations(editor, []);
    }
  }, [annotations, editor, showAnnotations, scopedVars]);

  if (lang === "racket") {
    lang = "scheme";
  }

  const provider = useStore(store, (state) => state.provider);
  const codeMap = useStore(store, (state) => state.getCodeMap());

  const selectPod = useStore(store, (state) => state.selectPod);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const editMode = useStore(store, (state) => state.editMode);

  // FIXME useCallback?
  function onEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco
  ) {
    setEditor(editor);
    // console.log(Math.min(1000, editor.getContentHeight()));
    const updateHeight = ({ contentHeight }) => {
      const editorElement = editor.getDomNode();
      if (!editorElement) {
        return;
      }
      editorElement.style.height = `${contentHeight}px`;
      editor.layout();
    };
    editor.onDidBlurEditorText(() => {
      setFocusedEditor(undefined);
    });
    editor.onDidFocusEditorText(() => {
      if (resetSelection()) updateView();
    });
    editor.onDidContentSizeChange(updateHeight);
    // Note: must use addAction instead of addCommand. The addCommand is not
    // working because it is bound to only the latest Monaco instance. This is a
    // known bug: https://github.com/microsoft/monaco-editor/issues/2947
    editor.addAction({
      id: "Run",
      label: "Run",
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => {
        yjsRun(id, apolloClient);
      },
    });
    editor.addAction({
      id: "Leave-editor",
      label: "Leave editor",
      keybindings: [monaco.KeyCode.Escape],
      run: () => {
        if (document.activeElement) {
          (document.activeElement as any).blur();
          setFocusedEditor(undefined);
          resetSelection();
          selectPod(id, true);
        }
      },
    });

    // editor.onDidChangeModelContent(async (e) => {
    //   // content is value?
    //   updateGitGutter(editor);
    // });

    // bind it to the ytext with pod id
    if (!codeMap.has(id)) {
      throw new Error("codeMap doesn't have pod " + id);
    }
    const ytext = codeMap.get(id)!;
    new MonacoBinding(
      ytext,
      editor.getModel()!,
      new Set([editor]),
      provider?.awareness
    );

    // FIXME: make sure the provider.wsconnected is true or it won't display any content.
  }

  return (
    <MonacoEditor
      language={lang}
      theme="codepod"
      options={{
        selectOnLineNumbers: true,
        readOnly: editMode === "view" || focusedEditor !== id,
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
        fontSize,
      }}
      editorDidMount={onEditorDidMount}
    />
  );
});
