import { monaco } from "react-monaco-editor";
import { v4 as uuidv4 } from "uuid";
import { LanguageServerClient } from "./codeiumClient";
import {
  numUtf8BytesToNumCodeUnits,
  TextAndOffsets,
  computeTextAndOffsets,
} from "./notebook";
import {
  CompletionItem,
  GetCompletionsRequest,
} from "../proto/exa/language_server_pb/language_server_pb";
import { Language } from "../proto/exa/codeium_common_pb/codeium_common_pb";

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

function getValueAndStartOffset(model: monaco.editor.ITextModel | string): {
  value: string;
  utf16Offset: number;
} {
  const originalValue = typeof model === "string" ? model : model.getValue();
  return { value: originalValue, utf16Offset: 0 };
}

function createInlineCompletionItem(
  completionItem: CompletionItem,
  document: monaco.editor.ITextModel,
  additionalUtf8ByteOffset: number,
  apiKey: string,
  editor?: monaco.editor.ICodeEditor
): monaco.languages.InlineCompletion | undefined {
  if (!completionItem.completion || !completionItem.range) {
    return undefined;
  }

  // Create and return inlineCompletionItem.
  const { value: text, utf16Offset } = getValueAndStartOffset(document);
  const startPosition = document.getPositionAt(
    utf16Offset +
      numUtf8BytesToNumCodeUnits(
        text,
        Number(completionItem.range.startOffset) - additionalUtf8ByteOffset
      )
  );
  const endPosition = document.getPositionAt(
    utf16Offset +
      numUtf8BytesToNumCodeUnits(
        text,
        Number(completionItem.range.endOffset) - additionalUtf8ByteOffset
      )
  );
  const range = new MonacoRange(startPosition, endPosition);
  let completionText = completionItem.completion.text;
  let callback: (() => void) | undefined = undefined;
  if (
    editor &&
    completionItem.suffix &&
    completionItem.suffix.text.length > 0
  ) {
    // Add suffix to the completion text.
    completionText += completionItem.suffix.text;
    // Create callback to move cursor after accept.
    // Note that this is a hack to get around Monaco's API limitations.
    // There's no need to convert to code units since we only use simple characters.
    const deltaCursorOffset = Number(completionItem.suffix.deltaCursorOffset);
    callback = () => {
      const selection = editor.getSelection();
      if (selection === null) {
        console.warn("Unexpected, no selection");
        return;
      }
      const newPosition = document.getPositionAt(
        document.getOffsetAt(selection.getPosition()) + deltaCursorOffset
      );
      editor.setSelection(new MonacoRange(newPosition, newPosition));
    };
  }

  const inlineCompletionItem: monaco.languages.InlineCompletion = {
    insertText: completionText,
    range,
    command: {
      id: "codeium.acceptCompletion",
      title: "Accept Completion",
      arguments: [apiKey, completionItem.completion.completionId, callback],
    },
  };
  return inlineCompletionItem;
}

export class MonacoCompletionProvider
  implements monaco.languages.InlineCompletionsProvider
{
  modelUriToEditor = new Map<string, monaco.editor.ICodeEditor>();
  client: LanguageServerClient;
  constructor(readonly apiKey: string) {
    this.client = new LanguageServerClient(apiKey);
  }

  private ideinfo = {
    ideName: "monaco",
    ideVersion: `unknown-${window.location.hostname}`,
  };

  private absolutePath(model: monaco.editor.ITextModel): string | undefined {
    // Given we are using path, note the docs on fsPath: https://microsoft.github.io/monaco-editor/api/classes/monaco.Uri.html#fsPath
    return model.uri.path;
    // TODO(prem): Adopt some site-specific convention.
  }

  private computeTextAndOffsets(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): TextAndOffsets {
    return computeTextAndOffsets({
      textModels: [model],
      currentTextModel: model,
      utf16CodeUnitOffset:
        model.getOffsetAt(position) - getValueAndStartOffset(model).utf16Offset,
      getText: (model) => getValueAndStartOffset(model).value,
      getLanguage: (model) => Language.PYTHON,
    });
  }

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    const apiKey = this.apiKey;
    if (apiKey === undefined) {
      return;
    }

    const { text, utf8ByteOffset, additionalUtf8ByteOffset } =
      this.computeTextAndOffsets(model, position);
    const numUtf8Bytes = additionalUtf8ByteOffset + utf8ByteOffset;
    try {
      const request = new GetCompletionsRequest({
        metadata: this.client.getMetadata(this.ideinfo, apiKey),
        document: {
          text: text,
          editorLanguage: "python",
          language: Language.PYTHON,
          cursorOffset: BigInt(numUtf8Bytes),
          lineEnding: "\n",
          relativePath: undefined,
          absolutePath: this.absolutePath(model),
        },
        editorOptions: {
          tabSize: BigInt(model.getOptions().tabSize),
          insertSpaces: model.getOptions().insertSpaces,
        },
      });
      const response = await this.client.getCompletions(request);
      if (response === undefined) {
        return { items: [] };
      }
      const items = response.completionItems
        .map((completionItem) =>
          createInlineCompletionItem(
            completionItem,
            model,
            additionalUtf8ByteOffset,
            apiKey,
            this.modelUriToEditor.get(model.uri.toString())
          )
        )
        .filter(
          (item): item is monaco.languages.InlineCompletion =>
            item !== undefined
        );
      return { items };
    } catch (e) {
      console.log(e);
      return { items: [] };
    }
  }

  handleItemDidShow(): void {
    // Do nothing.
  }

  freeInlineCompletions(): void {
    // Do nothing.
  }

  async acceptedLastCompletion(
    apiKey: string,
    completionId: string
  ): Promise<void> {
    await this.client.acceptedLastCompletion(
      this.ideinfo,
      apiKey,
      completionId
    );
  }
}

export const openTokenPage = () => {
  const PROFILE_URL = "https://www.codeium.com/profile";
  const params = new URLSearchParams({
    response_type: "token",
    redirect_uri: "chrome-show-auth-token",
    scope: "openid profile email",
    prompt: "login",
    redirect_parameters_type: "query",
    state: uuidv4(),
  });
  window.open(`${PROFILE_URL}?${params}`);
};

export async function registerUser(
  token: string
): Promise<{ api_key: string; name: string; error?: any }> {
  const url = new URL("register_user/", "https://api.codeium.com");
  const response = await fetch(url.toString(), {
    body: JSON.stringify({ firebase_id_token: token }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    return { api_key: "", name: "", error: response.status };
  }
  const user = await response.json();
  return user as { api_key: string; name: string };
}

export function registerCompletion(apiKey: string) {
  const completionProvider = new MonacoCompletionProvider(apiKey);
  try {
    const { dispose } = monaco.languages.registerInlineCompletionsProvider(
      { pattern: "**" },
      completionProvider
    );
    monaco.editor.registerCommand(
      "codeium.acceptCompletion",
      (
        _: unknown,
        apiKey: string,
        completionId: string,
        callback?: () => void
      ) => {
        callback?.();
        completionProvider.acceptedLastCompletion(apiKey, completionId);
      }
    );
    return dispose;
  } catch (e) {
    console.log(e);
    return null;
  }
}
