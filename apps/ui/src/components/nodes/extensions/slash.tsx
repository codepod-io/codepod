// Adapted from https://github.com/remirror/remirror/blob/main/packages/remirror__extension-mention/src/mention-extension.ts

import {
  command,
  CommandFunction,
  extension,
  FromToProps,
  pick,
} from "@remirror/core";

import {
  DEFAULT_SUGGESTER,
  isSelectionExitReason,
  isSplitReason,
  SuggestChangeHandlerProps,
  Suggester,
} from "@remirror/pm/suggest";
import { PlainExtension } from "remirror";
import {
  MentionChangeHandlerCommandAttributes,
  MentionOptions,
  NamedMentionExtensionAttributes,
} from "remirror/extensions";

@extension<MentionOptions>({
  defaultOptions: {
    mentionTag: "a" as const,
    matchers: [],
    appendText: "",
    suggestTag: "a" as const,
    disableDecorations: false,
    invalidMarks: [],
    invalidNodes: [],
    isValidPosition: () => true,
    validMarks: null,
    validNodes: null,
    isMentionValid: isMentionValidDefault,
  },
  handlerKeyOptions: { onClick: { earlyReturnValue: true } },
  handlerKeys: ["onChange", "onClick"],
  staticKeys: ["mentionTag", "matchers"],
})
export class SlashExtension extends PlainExtension<MentionOptions> {
  get name() {
    return "slash" as const;
  }

  /**
   * Create the suggesters from the matchers that were passed into the editor.
   */
  createSuggesters(): Suggester[] {
    let cachedRange: FromToProps | undefined;

    const options = pick(this.options, [
      "invalidMarks",
      "invalidNodes",
      "isValidPosition",
      "validMarks",
      "validNodes",
      "suggestTag",
      "disableDecorations",
    ]);

    return this.options.matchers.map<Suggester>((matcher) => ({
      ...DEFAULT_MATCHER,
      ...options,
      ...matcher,
      onChange: (props) => {
        const command = (attrs: MentionChangeHandlerCommandAttributes = {}) => {
          this.mentionExitHandler(
            props,
            attrs
          )(this.store.helpers.getCommandProp());
        };

        this.options.onChange(
          { ...props, defaultAppendTextValue: this.options.appendText },
          command
        );
      },
    }));
  }

  /**
   * This is the command which can be called from the `onChange` handler to
   * automatically handle exits for you. It decides whether a mention should
   * be updated, removed or created and also handles invalid splits.
   *
   * It does nothing for changes and only acts when an exit occurred.
   *
   * @param handler - the parameter that was passed through to the
   * `onChange` handler.
   * @param attrs - the options which set the values that will be used (in
   * case you want to override the defaults).
   */
  @command()
  mentionExitHandler(
    handler: SuggestChangeHandlerProps,
    attrs: MentionChangeHandlerCommandAttributes = {}
  ): CommandFunction {
    return (props) => {
      const reason = handler.exitReason ?? handler.changeReason;

      const { tr } = props;
      const { range, text, query, name } = handler;
      const { from, to } = range;

      // const command = this.createMention.bind(this);
      const command = this.cancelMention.bind(this);

      // Destructure the `attrs` and using the defaults.
      const {
        replacementType = isSplitReason(reason) ? "partial" : "full",
        id = query[replacementType],
        label = text[replacementType],
        appendText = this.options.appendText,
        ...rest
      } = attrs;

      // Make sure to preserve the selection, if the reason for the exit was a
      // cursor movement and not due to text being added to the document.
      const keepSelection = isSelectionExitReason(reason);

      return command({
        name,
        id,
        label,
        appendText,
        replacementType,
        range,
        keepSelection,
        ...rest,
      })(props);
    };
  }

  @command()
  cancelMention(config: NamedMentionExtensionAttributes): CommandFunction {
    const {
      range,
      appendText,
      replacementType,
      keepSelection,
      name,
      ...attributes
    } = config;
    return (props) => {
      const { tr, dispatch } = props;
      const { from, to } = {
        from: range?.from ?? tr.selection.from,
        to: range?.cursor ?? tr.selection.to,
      };

      dispatch?.(tr.delete(from, to));
      return true;
    };
  }
}

/**
 * The default matcher to use when none is provided in options
 */
const DEFAULT_MATCHER = {
  ...pick(DEFAULT_SUGGESTER, [
    "startOfLine",
    "supportedCharacters",
    "validPrefixCharacters",
    "invalidPrefixCharacters",
    "suggestClassName",
  ]),
  appendText: "",
  matchOffset: 1,
  mentionClassName: "mention",
};

/**
 * Checks whether the mention is valid and hasn't been edited since being
 * created.
 */
export function isMentionValidDefault(
  attrs: NamedMentionExtensionAttributes,
  text: string
): boolean {
  return attrs.label === text;
}
