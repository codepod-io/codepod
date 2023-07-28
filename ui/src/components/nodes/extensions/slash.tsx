import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  ErrorConstant,
  extension,
  ExtensionTag,
  FromToProps,
  GetMarkRange,
  getMarkRange,
  getMatchString,
  Handler,
  InputRulesExtension,
  invariant,
  isElementDomNode,
  isMarkActive,
  isPlainObject,
  isString,
  LEAF_NODE_REPLACING_CHARACTER,
  MarkExtension,
  MarkExtensionSpec,
  MarkSpecOverride,
  omitExtraAttributes,
  pick,
  ProsemirrorAttributes,
  RangeProps,
  removeMark,
  replaceText,
  ShouldSkipProps,
  Static,
} from "@remirror/core";

import {
  createRegexFromSuggester,
  DEFAULT_SUGGESTER,
  isInvalidSplitReason,
  isRemovedReason,
  isSelectionExitReason,
  isSplitReason,
  MatchValue,
  RangeWithCursor,
  SuggestChangeHandlerProps,
  Suggester,
} from "@remirror/pm/suggest";
import { PlainExtension } from "remirror";

/**
 * The static settings passed into a mention
 */
export interface MentionOptions
  extends Pick<
    Suggester,
    | "invalidNodes"
    | "validNodes"
    | "invalidMarks"
    | "validMarks"
    | "isValidPosition"
    | "disableDecorations"
  > {
  /**
   * Provide a custom tag for the mention
   */
  mentionTag?: Static<string>;

  /**
   * Provide the custom matchers that will be used to match mention text in the
   * editor.
   */
  matchers: Static<MentionExtensionMatcher[]>;

  /**
   * Text to append after the mention has been added.
   *
   * **NOTE**: If you're using whitespace characters but it doesn't seem to work
   * for you make sure you're using the css provided in `@remirror/styles`.
   *
   * The `white-space: pre-wrap;` is what allows editors to add space characters
   * at the end of a section.
   *
   * @defaultValue ''
   */
  appendText?: string;

  /**
   * Tag for the prosemirror decoration which wraps an active match.
   *
   * @defaultValue 'span'
   */
  suggestTag?: string;

  /**
   * Called whenever a suggestion becomes active or changes in any way.
   *
   * @remarks
   *
   * It receives a parameters object with the `reason` for the change for more
   * granular control.
   *
   * The second parameter is a function that can be called to handle exits
   * automatically. This is useful if you're mention can be any possible value,
   * e.g. a `#hashtag`. Call it with the optional attributes to automatically
   * create a mention.
   *
   * @defaultValue () => void
   */
  onChange?: Handler<MentionChangeHandler>;

  /**
   * Listen for click events to the mention extension.
   */
  onClick?: Handler<
    (event: MouseEvent, markRange: GetMarkRange) => boolean | undefined | void
  >;

  /**
   * A predicate check for whether the mention is valid. It proves the mention
   * mark and it's attributes as well as the text it contains.
   *
   * This is used for checking that a recent update to the document hasn't made
   * a mention invalid.
   *
   * For example a mention for `@valid` => `valid` would be considered
   * invalidating. Return false to remove the mention.
   *
   * @param attrs - the attrs for the mention
   * @param text - the text which is wrapped by the mention
   */
  isMentionValid?: (
    attrs: NamedMentionExtensionAttributes,
    text: string
  ) => boolean;
}

/**
 * The mention extension wraps mentions as a prosemirror mark. It allows for
 * fluid social experiences to be built. The implementation was inspired by the
 * way twitter and similar social sites allows mentions to be edited after
 * they've been created.
 *
 * @remarks
 *
 * Mentions have the following features
 * - An activation character or regex pattern which you define.
 * - A min number of characters before mentions are suggested
 * - Ability to exclude matching character.
 * - Ability to wrap content in a decoration which excludes mentions from being
 *   suggested.
 * - Decorations for in-progress mentions
 */
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
  cancelMention(
    config: NamedMentionExtensionAttributes & KeepSelectionProps
  ): CommandFunction {
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

export interface OptionalMentionExtensionProps {
  /**
   * The text to append to the replacement.
   *
   * @defaultValue ''
   */
  appendText?: string;

  /**
   * The range of the requested selection.
   */
  range?: RangeWithCursor;

  /**
   * Whether to replace the whole match (`full`) or just the part up until the
   * cursor (`partial`).
   */
  replacementType?: keyof MatchValue;
}

interface KeepSelectionProps {
  /**
   * Whether to preserve the original selection after the replacement has
   * occurred.
   */
  keepSelection?: boolean;
}

/**
 * The attrs that will be added to the node. ID and label are plucked and used
 * while attributes like href and role can be assigned as desired.
 */
export type MentionExtensionAttributes = ProsemirrorAttributes<
  OptionalMentionExtensionProps & {
    /**
     * A unique identifier for the suggesters node
     */
    id: string;

    /**
     * The text to be placed within the suggesters node
     */
    label: string;
  }
>;

export type NamedMentionExtensionAttributes = ProsemirrorAttributes<
  OptionalMentionExtensionProps & {
    /**
     * A unique identifier for the suggesters node
     */
    id: string;

    /**
     * The text to be placed within the suggesters node
     */
    label: string;
  } & {
    /**
     * The identifying name for the active matcher. This is stored as an
     * attribute on the HTML that will be produced
     */
    name: string;
  }
>;

/**
 * The options for the matchers which can be created by this extension.
 */
export interface MentionExtensionMatcher
  extends Pick<
    Suggester,
    | "char"
    | "name"
    | "startOfLine"
    | "supportedCharacters"
    | "validPrefixCharacters"
    | "invalidPrefixCharacters"
    | "matchOffset"
    | "suggestClassName"
  > {
  /**
   * Provide customs class names for the completed mention
   */
  mentionClassName?: string;

  /**
   * Text to append after the suggestion has been added.
   *
   * @defaultValue ''
   */
  appendText?: string;
}

export type MentionChangeHandlerCommand = (
  attrs?: MentionChangeHandlerCommandAttributes
) => void;

export interface MentionChangeHandlerProps extends SuggestChangeHandlerProps {
  /**
   * The default text to be appended if text should be appended.
   */
  defaultAppendTextValue: string;
}

/**
 * A handler that will be called whenever the the active matchers are updated or
 * exited. The second argument which is the exit command is a function which is
 * only available when the matching suggester has been exited.
 */
export type MentionChangeHandler = (
  handlerState: MentionChangeHandlerProps,
  command: (attrs?: MentionChangeHandlerCommandAttributes) => void
) => void;

/**
 * The dynamic properties used to change the behavior of the mentions created.
 */
export type MentionChangeHandlerCommandAttributes = ProsemirrorAttributes<
  Partial<
    Pick<MentionExtensionAttributes, "appendText" | "replacementType">
  > & {
    /**
     * The ID to apply the mention.
     *
     * @defaultValue query.full
     */
    id?: string;

    /**
     * The text that is displayed within the mention bounds.
     *
     * @defaultValue text.full
     */
    label?: string;
  }
>;

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
 * Check that the attributes exist and are valid for the mention update command
 * method.
 */
function isValidMentionAttributes(
  attributes: unknown
): attributes is NamedMentionExtensionAttributes {
  return !!(
    attributes &&
    isPlainObject(attributes) &&
    attributes.id &&
    isString(attributes.id) &&
    attributes.label &&
    isString(attributes.label) &&
    attributes.name &&
    isString(attributes.name)
  );
}

/**
 * Gets the matcher from the list of matchers if it exists.
 *
 * @param name - the name of the matcher to find
 * @param matchers - the list of matchers to search through
 */
function getMatcher(name: string, matchers: MentionExtensionMatcher[]) {
  const matcher = matchers.find((matcher) => matcher.name === name);
  return matcher ? { ...DEFAULT_MATCHER, ...matcher } : undefined;
}

/**
 * Get the append text value which needs to be handled carefully since it can
 * also be an empty string.
 */
function getAppendText(
  preferred: string | undefined,
  fallback: string | undefined
) {
  if (isString(preferred)) {
    return preferred;
  }

  if (isString(fallback)) {
    return fallback;
  }

  return DEFAULT_MATCHER.appendText;
}

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
