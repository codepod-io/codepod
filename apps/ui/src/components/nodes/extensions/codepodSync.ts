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
/**
 * This extension is used to sync the content of the editor with the pod.
 */
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
        // The first onChange event is triggered wehn the content is the same.
        // Skip it.
        this.firstUpdate
      );
      this.firstUpdate = false;

      var markdown = this.turndownService.turndown(
        this.store.helpers.getHTML(state)
      );
      this.options.setPodRichContent({
        id: this.options.id,
        richContent: markdown,
      });
    }
  }
}
