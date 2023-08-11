// Adapted from https://github.com/remirror/remirror/blob/main/packages/remirror__extension-yjs/src/yjs-extension.ts
// Added node ID to bind a different room for each rich-text instance.

import {
  defaultCursorBuilder,
  defaultDeleteFilter,
  defaultSelectionBuilder,
  redo,
  undo,
  yCursorPlugin,
  ySyncPlugin,
  ySyncPluginKey,
  yUndoPlugin,
  yUndoPluginKey,
} from "y-prosemirror";
import type { Doc, XmlFragment } from "yjs";
import { Awareness } from "y-protocols/awareness";
import { UndoManager } from "yjs";
import {
  AcceptUndefined,
  command,
  convertCommand,
  EditorState,
  ErrorConstant,
  extension,
  ExtensionPriority,
  invariant,
  isEmptyObject,
  isFunction,
  keyBinding,
  KeyBindingProps,
  NamedShortcut,
  nonChainable,
  NonChainableCommandFunction,
  OnSetOptionsProps,
  PlainExtension,
  ProsemirrorPlugin,
  Selection,
  Shape,
  Static,
} from "@remirror/core";
import { ExtensionHistoryMessages as Messages } from "@remirror/messages";
import { DecorationAttrs } from "@remirror/pm/view";

export interface ColorDef {
  light: string;
  dark: string;
}

export interface YSyncOpts {
  colors?: ColorDef[];
  colorMapping?: Map<string, ColorDef>;
  permanentUserData?: any | null;
}

export interface YjsOptions {
  yXml?: AcceptUndefined<XmlFragment>;
  awareness?: AcceptUndefined<Awareness>;

  /**
   * The options which are passed through to the Yjs sync plugin.
   */
  syncPluginOptions?: AcceptUndefined<YSyncOpts>;

  /**
   * Take the user data and transform it into a html element which is used for
   * the cursor. This is passed into the cursor builder.
   *
   * See https://github.com/yjs/y-prosemirror#remote-cursors
   */
  cursorBuilder?: (user: Shape) => HTMLElement;

  /**
   * Generator for the selection attributes
   */
  selectionBuilder?: (user: Shape) => DecorationAttrs;

  /**
   * By default all editor bindings use the awareness 'cursor' field to
   * propagate cursor information.
   *
   * @defaultValue 'cursor'
   */
  cursorStateField?: string;

  /**
   * Get the current editor selection.
   *
   * @defaultValue `(state) => state.selection`
   */
  getSelection?: (state: EditorState) => Selection;

  disableUndo?: Static<boolean>;

  /**
   * Names of nodes in the editor which should be protected.
   *
   * @defaultValue `new Set('paragraph')`
   */
  protectedNodes?: Static<Set<string>>;
  trackedOrigins?: Static<any[]>;
}

/**
 * The YJS extension is the recommended extension for creating a collaborative
 * editor.
 */
@extension<YjsOptions>({
  defaultOptions: {
    yXml: undefined,
    awareness: undefined,
    syncPluginOptions: undefined,
    cursorBuilder: defaultCursorBuilder,
    selectionBuilder: defaultSelectionBuilder,
    cursorStateField: "cursor",
    getSelection: (state) => state.selection,
    disableUndo: false,
    protectedNodes: new Set("paragraph"),
    trackedOrigins: [],
  },
  staticKeys: ["disableUndo", "protectedNodes", "trackedOrigins"],
  defaultPriority: ExtensionPriority.High,
})
export class MyYjsExtension extends PlainExtension<YjsOptions> {
  get name() {
    return "yjs" as const;
  }

  getBinding(): { mapping: Map<any, any> } | undefined {
    const state = this.store.getState();
    const { binding } = ySyncPluginKey.getState(state);
    return binding;
  }

  /**
   * Create the yjs plugins.
   */
  createExternalPlugins(): ProsemirrorPlugin[] {
    const {
      syncPluginOptions,
      cursorBuilder,
      getSelection,
      cursorStateField,
      disableUndo,
      protectedNodes,
      trackedOrigins,
      selectionBuilder,
    } = this.options;

    const type = this.options.yXml;

    const plugins = [
      ySyncPlugin(type, syncPluginOptions),
      yCursorPlugin(
        this.options.awareness,
        { cursorBuilder, getSelection, selectionBuilder },
        cursorStateField
      ),
    ];

    if (!disableUndo) {
      const undoManager = new UndoManager(type, {
        trackedOrigins: new Set([ySyncPluginKey, ...trackedOrigins]),
        deleteFilter: (item) => defaultDeleteFilter(item, protectedNodes),
      });
      plugins.push(yUndoPlugin({ undoManager }));
    }

    return plugins;
  }

  /**
   * Undo that last Yjs transaction(s)
   *
   * This command does **not** support chaining.
   * This command is a no-op and always returns `false` when the `disableUndo` option is set.
   */
  @command({
    disableChaining: true,
    description: ({ t }) => t(Messages.UNDO_DESCRIPTION),
    label: ({ t }) => t(Messages.UNDO_LABEL),
    icon: "arrowGoBackFill",
  })
  yUndo(): NonChainableCommandFunction {
    return nonChainable((props) => {
      if (this.options.disableUndo) {
        return false;
      }

      const { state, dispatch } = props;
      const undoManager: UndoManager =
        yUndoPluginKey.getState(state).undoManager;

      if (undoManager.undoStack.length === 0) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      return convertCommand(undo)(props);
    });
  }

  /**
   * Redo the last transaction undone with a previous `yUndo` command.
   *
   * This command does **not** support chaining.
   * This command is a no-op and always returns `false` when the `disableUndo` option is set.
   */
  @command({
    disableChaining: true,
    description: ({ t }) => t(Messages.REDO_DESCRIPTION),
    label: ({ t }) => t(Messages.REDO_LABEL),
    icon: "arrowGoForwardFill",
  })
  yRedo(): NonChainableCommandFunction {
    return nonChainable((props) => {
      if (this.options.disableUndo) {
        return false;
      }

      const { state, dispatch } = props;
      const undoManager: UndoManager =
        yUndoPluginKey.getState(state).undoManager;

      if (undoManager.redoStack.length === 0) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      return convertCommand(redo)(props);
    });
  }

  /**
   * Handle the undo keybinding.
   */
  @keyBinding({ shortcut: NamedShortcut.Undo, command: "yUndo" })
  undoShortcut(props: KeyBindingProps): boolean {
    return this.yUndo()(props);
  }

  /**
   * Handle the redo keybinding for the editor.
   */
  @keyBinding({ shortcut: NamedShortcut.Redo, command: "yRedo" })
  redoShortcut(props: KeyBindingProps): boolean {
    return this.yRedo()(props);
  }
}
