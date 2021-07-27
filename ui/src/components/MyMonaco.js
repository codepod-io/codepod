import MonacoEditor from "react-monaco-editor";

export function MyMonaco() {
  return (
    <MonacoEditor
      language="javascript"
      theme="vs-dark"
      // initial height: 3 lines
      value={"\n\n\n"}
      options={{
        selectOnLineNumbers: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
      }}
      onChange={() => {}}
      editorDidMount={(editor, monaco) => {
        console.log("Did mount!");
        console.log(editor);
        console.log(monaco);
        // console.log(Math.min(1000, editor.getContentHeight()));
        const updateHeight = () => {
          // max height: 400
          const contentHeight = Math.min(400, editor.getContentHeight());
          console.log("target height:", contentHeight);
          const editorElement = editor.getDomNode();
          if (!editorElement) {
            return;
          }
          editorElement.style.height = `${contentHeight}px`;
          // width: 800
          editor.layout({ width: 800, height: contentHeight });
        };
        editor.onDidContentSizeChange(updateHeight);
      }}
    />
  );
}
