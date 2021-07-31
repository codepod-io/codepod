import MonacoEditor from "react-monaco-editor";

export function MyMonaco({
  lang = "javascript",
  value = "\n\n\n",
  onChange = () => {},
  onRun = () => {},
}) {
  // there's no racket language support
  if (lang === "racket") {
    lang = "scheme";
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
      }}
      onChange={onChange}
      editorDidMount={(editor, monaco) => {
        // console.log(Math.min(1000, editor.getContentHeight()));
        const updateHeight = () => {
          // max height: 400
          const contentHeight = Math.min(400, editor.getContentHeight());
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
      }}
    />
  );
}
