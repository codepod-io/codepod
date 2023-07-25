import TurndownService from "turndown";

import { PlainExtension, StateUpdateLifecycleProps, extension } from "remirror";

interface CodePodSyncOptions {
  // Options are `Dynamic` by default.
  id: string;
  setPodContent: any;
  setPodRichContent: any;
}

@extension<CodePodSyncOptions>({
  defaultOptions: {
    id: "defaultId",
    setPodContent: () => {},
    setPodRichContent: () => {},
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class CodePodSyncExtension extends PlainExtension<CodePodSyncOptions> {
  firstUpdate = true;
  turndownService = new TurndownService();
  get name(): string {
    return "codepod-sync";
  }
  onStateUpdate({ state, tr }: StateUpdateLifecycleProps) {
    if (tr?.docChanged) {
      this.options.setPodContent(
        {
          id: this.options.id,
          content: state.doc.toJSON(),
        },
        this.firstUpdate
        // true
      );
      this.firstUpdate = false;
    }

    var markdown = this.turndownService.turndown(
      this.store.helpers.getHTML(state)
    );
    this.options.setPodRichContent({
      id: this.options.id,
      richContent: markdown,
    });
  }
}
