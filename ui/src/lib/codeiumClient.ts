import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
} from "@bufbuild/connect";
import { createConnectTransport } from "@bufbuild/connect-web";
import { PartialMessage } from "@bufbuild/protobuf";
import { v4 as uuidv4 } from "uuid";
import { Metadata } from "../proto/exa/codeium_common_pb/codeium_common_pb";
import { LanguageServerService } from "../proto/exa/language_server_pb/language_server_connect";
import {
  AcceptCompletionRequest,
  GetCompletionsRequest,
  GetCompletionsResponse,
} from "../proto/exa/language_server_pb/language_server_pb";

const EXTENSION_NAME = "chrome";
const EXTENSION_VERSION = "1.2.18";
const BASE_URL = "https://server.codeium.com";

function languageServerClient(): PromiseClient<typeof LanguageServerService> {
  const transport = createConnectTransport({
    baseUrl: BASE_URL,
    useBinaryFormat: true,
  });
  return createPromiseClient(LanguageServerService, transport);
}

export interface IdeInfo {
  ideName: string;
  ideVersion: string;
}

export class LanguageServerClient {
  private requestId = 0;
  private sessionId = uuidv4();

  client: PromiseClient<typeof LanguageServerService> = languageServerClient();
  apiKey: string;

  private abortController?: AbortController;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getHeaders(apiKey: string | undefined): Record<string, string> {
    if (apiKey === undefined) {
      return {};
    }
    const Authorization = `Basic ${apiKey}-${this.sessionId}`;
    return { Authorization };
  }

  async getCompletions(
    request: GetCompletionsRequest
  ): Promise<GetCompletionsResponse | undefined> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const getCompletionsPromise = this.client.getCompletions(request, {
      signal,
      headers: this.getHeaders(request.metadata?.apiKey),
    });
    try {
      console.log("codeium request", request);
      return await getCompletionsPromise;
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      console.log(err);
      //   if (err instanceof ConnectError) {
      //     if (err.code != Code.Canceled) {
      //       console.log(err.message);
      //       await chrome.runtime.sendMessage(chrome.runtime.id, {
      //         type: 'error',
      //         message: err.message,
      //       });
      //     }
      //   } else {
      //     console.log((err as Error).message);
      //     await chrome.runtime.sendMessage(chrome.runtime.id, {
      //       type: 'error',
      //       message: (err as Error).message,
      //     });
      //   }
      return;
    }
  }

  getMetadata(ideInfo: IdeInfo, apiKey: string): Metadata {
    return new Metadata({
      ideName: ideInfo.ideName,
      ideVersion: ideInfo.ideVersion,
      extensionName: EXTENSION_NAME,
      extensionVersion: EXTENSION_VERSION,
      apiKey,
      locale: navigator.language,
      sessionId: this.sessionId,
      requestId: BigInt(++this.requestId),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  }

  async acceptedLastCompletion(
    // acceptCompletionRequest: PartialMessage<AcceptCompletionRequest>
    ideInfo: IdeInfo,
    apiKey: string,
    completionId: string
  ): Promise<void> {
    try {
      const request = new AcceptCompletionRequest({
        metadata: this.getMetadata(ideInfo, apiKey),
        completionId,
      });
      await this.client.acceptCompletion(request, {
        headers: this.getHeaders(request.metadata?.apiKey),
      });
    } catch (err) {
      console.log((err as Error).message);
    }
  }
}
