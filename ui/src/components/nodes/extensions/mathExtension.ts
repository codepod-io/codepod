// Adapted from https://github.com/phxtho/poche/blob/main/src/components/remirror-editor/extensions/math-inline-extension/math-inline-extension.ts

import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  extension,
  ExtensionTag,
  NodeExtension,
  NodeExtensionSpec,
  NodeSpecOverride,
  PrioritizedKeyBindings,
} from "@remirror/core";
import { chainKeyBindingCommands, convertCommand } from "@remirror/core-utils";
import { InputRule, ProsemirrorPlugin } from "@remirror/pm";
import {
  deleteSelection,
  selectNodeBackward,
  joinBackward,
} from "@remirror/pm/commands";
import {
  REGEX_INLINE_MATH_DOLLARS_ESCAPED,
  REGEX_BLOCK_MATH_DOLLARS,
  insertMathCmd,
  mathBackspaceCmd,
  mathPlugin,
  makeInlineMathInputRule,
  makeBlockMathInputRule,
} from "@benrbray/prosemirror-math";
import {
  defaultInlineMathParseRules,
  defaultBlockMathParseRules,
} from "./mathParseRules";
// CSS
import "@benrbray/prosemirror-math/style/math.css";
import "katex/dist/katex.min.css";

export interface MathInlineOptions {}
export interface MathBlockOptions {}

@extension<MathInlineOptions>({
  defaultOptions: {},
})
export class MathInlineExtension extends NodeExtension<MathInlineOptions> {
  get name() {
    return "math_inline" as const;
  }

  createTags() {
    return [ExtensionTag.InlineNode];
  }

  createNodeSpec(
    extra: ApplySchemaAttributes,
    override: NodeSpecOverride
  ): NodeExtensionSpec {
    return {
      group: "math",
      content: "text*",
      inline: true,
      atom: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      parseDOM: [
        {
          tag: "math-inline",
        },
        ...defaultInlineMathParseRules,
      ],
      toDOM: () => ["math-inline", { class: "math-node" }, 0],
    };
  }

  createInputRules(): InputRule[] {
    return [
      makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS_ESCAPED, this.type),
    ];
  }

  createExternalPlugins(): ProsemirrorPlugin[] {
    return [mathPlugin];
  }

  createKeymap(
    extractShortcutNames: (shortcut: string) => string[]
  ): PrioritizedKeyBindings {
    const command = chainKeyBindingCommands(
      convertCommand(deleteSelection),
      convertCommand(mathBackspaceCmd),
      convertCommand(joinBackward),
      convertCommand(selectNodeBackward)
    );
    return { Backspace: command };
  }

  @command()
  insertMathInline(): CommandFunction {
    return (props) => {
      try {
        insertMathCmd(this.type);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    };
  }
}

@extension<MathBlockOptions>({
  defaultOptions: {},
})
export class MathBlockExtension extends NodeExtension<MathBlockOptions> {
  get name() {
    return "math_display" as const;
  }

  createTags() {
    return [ExtensionTag.BlockNode];
  }

  createNodeSpec(
    extra: ApplySchemaAttributes,
    override: NodeSpecOverride
  ): NodeExtensionSpec {
    return {
      group: "block math",
      content: "text*",
      atom: true,
      code: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      parseDOM: [
        {
          tag: "math-display",
        },
        ...defaultBlockMathParseRules,
      ],
      toDOM: () => ["math-display", { class: "math-node" }, 0],
    };
  }

  createInputRules(): InputRule[] {
    return [makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, this.type)];
  }

  createExternalPlugins(): ProsemirrorPlugin[] {
    // IMPORTANT: mathPlugin should be imported only once, if it is imported by MathInlineExtension, it will fail
    return [];
  }

  createKeymap(
    extractShortcutNames: (shortcut: string) => string[]
  ): PrioritizedKeyBindings {
    const command = chainKeyBindingCommands(
      convertCommand(deleteSelection),
      convertCommand(mathBackspaceCmd),
      convertCommand(joinBackward),
      convertCommand(selectNodeBackward)
    );
    return { Backspace: command };
  }

  @command()
  insertMathBlock(): CommandFunction {
    return (props) => {
      try {
        insertMathCmd(this.type);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    };
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      math_inline: MathInlineExtension;
      block_math: MathBlockExtension;
    }
  }
}
