import { monaco } from "react-monaco-editor";

export class llamaInlineCompletionProvider
  implements monaco.languages.InlineCompletionsProvider
{
  private readonly podId: string;
  private readonly editor: monaco.editor.IStandaloneCodeEditor;
  private readonly trpc: any;
  private readonly manualMode: boolean;
  private isFetchingSuggestions: boolean; // Flag to track if a fetch operation is in progress

  constructor(
    podId: string,
    editor: monaco.editor.IStandaloneCodeEditor,
    trpc: any,
    manualMode: boolean
  ) {
    this.podId = podId;
    this.editor = editor;
    this.trpc = trpc;
    this.manualMode = manualMode;
    this.isFetchingSuggestions = false; // Initialize the flag
  }

  private async provideSuggestions(prefix: string, suffix: string) {
    const suggestion = await this.trpc.spawner.codeAutoComplete.mutate({
      inputPrefix: prefix,
      inputSuffix: suffix,
      podId: this.podId,
    });
    return suggestion;
  }
  public async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.IPosition,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    if (!this.editor.hasTextFocus() || token.isCancellationRequested) {
      return;
    }
    if (
      context.triggerKind ===
        monaco.languages.InlineCompletionTriggerKind.Automatic &&
      this.manualMode
    ) {
      return;
    }

    if (!this.isFetchingSuggestions) {
      this.isFetchingSuggestions = true;
      try {
        // Get text before the position
        let inputPrefix = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Get text after the position
        let inputSuffix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount()),
        });

        console.log(inputPrefix);
        console.log(inputSuffix);

        if (/^\s*$/.test(inputPrefix || " ")) {
          inputPrefix = inputPrefix.trim();
        }
        if (/^\s*$/.test(inputSuffix || " ")) {
          inputSuffix = inputSuffix.trim();
        }

        if (inputPrefix === "" && inputSuffix === "") {
          return;
        }
        const suggestion = await this.provideSuggestions(
          inputPrefix,
          inputSuffix
        );

        return {
          items: [
            {
              insertText: suggestion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
            },
          ],
        };
      } finally {
        this.isFetchingSuggestions = false;
      }
    }
  }

  handleItemDidShow?(
    completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>,
    item: monaco.languages.InlineCompletion
  ): void {}

  freeInlineCompletions(
    completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>
  ): void {}
}
