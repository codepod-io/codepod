import { monaco } from "react-monaco-editor";

class MonacoRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;

  constructor(start: monaco.IPosition, end: monaco.IPosition) {
    this.startLineNumber = start.lineNumber;
    this.startColumn = start.column;
    this.endLineNumber = end.lineNumber;
    this.endColumn = end.column;
  }
}

function text2CompletionItems(
  text: string,
  position: monaco.Position
): monaco.languages.InlineCompletion {
  const startPosition = { lineNumber: position.lineNumber, column: 1 };
  const endPosition = position;
  console.log("startPosition", startPosition, text);
  const range = new MonacoRange(startPosition, endPosition);
  const inlineCompletionItem: monaco.languages.InlineCompletion = {
    insertText: text,
    range,
    command: {
      id: "codeium.acceptCompletion",
      title: "Accept Completion",
      arguments: [
        "apiKey",
        "completionItem.completion.completionId",
        undefined,
      ],
    },
  };
  return inlineCompletionItem;
}

export class MonacoCompletionProvider
  implements monaco.languages.InlineCompletionsProvider
{
  client: null;
  items: monaco.languages.InlineCompletion[] = [];
  defaultItems: string[] = [];
  constructor() {
    console.log("MonacoCompletionProvider constructor");
    this.client = null;
    this.defaultItems = ["hello world\nhello world2"];
  }
  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    return {
      items: this.defaultItems.map((item) =>
        text2CompletionItems(item, position)
      ),
    };
  }

  handleItemDidShow(): void {
    // Do nothing.
  }

  freeInlineCompletions(): void {
    // Do nothing.
  }
}
