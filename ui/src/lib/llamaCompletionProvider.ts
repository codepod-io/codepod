import { monaco } from "react-monaco-editor";
import { trpcProxyClient } from "./trpc";

export class llamaInlineCompletionProvider
  implements monaco.languages.InlineCompletionsProvider
{
  private readonly podId: string;
  private readonly editor: monaco.editor.IStandaloneCodeEditor;
  private isFetchingSuggestions: boolean; // Flag to track if a fetch operation is in progress

  constructor(podId: string, editor: monaco.editor.IStandaloneCodeEditor) {
    this.podId = podId;
    this.editor = editor;
    this.isFetchingSuggestions = false; // Initialize the flag
  }

  private async provideSuggestions(input: string) {
    if (/^\s*$/.test(input || " ")) {
      return "";
    }

    const suggestion = await trpcProxyClient.spawner.codeAutoComplete.mutate({
      code: input,
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
    if (!this.editor.hasTextFocus()) {
      return;
    }
    if (token.isCancellationRequested) {
      return;
    }

    if (!this.isFetchingSuggestions) {
      this.isFetchingSuggestions = true;
      try {
        const suggestion = await this.provideSuggestions(
          model.getValue() || " "
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
