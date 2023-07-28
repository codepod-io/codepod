import { useCallback, useEffect, useMemo, useState } from "react";
import { Replace } from "@remirror/core";
import type {
  MentionChangeHandler,
  MentionChangeHandlerCommand,
  MentionExtensionAttributes,
} from "@remirror/extension-mention";
// import { MentionExtension } from "@remirror/extension-mention";
import { SlashExtension } from "./slash";
import {
  ChangeReason,
  ExitReason,
  SuggestChangeHandlerProps,
} from "@remirror/pm/suggest";
import { useExtensionEvent, useHelpers } from "@remirror/react-core";

import {
  FloatingWrapper,
  MentionState,
  MenuNavigationOptions,
  useCommands,
  UseMentionProps,
  UseMentionReturn,
  useMenuNavigation,
  UseMenuNavigationReturn,
} from "@remirror/react";
import { cx, replaceText } from "remirror";

function useSlash<
  Data extends MentionExtensionAttributes = MentionExtensionAttributes
>(props: UseMentionProps<Data>): UseMentionReturn<Data> {
  const {
    items,
    ignoreMatchesOnDismiss = true,
    onExit,
    direction,
    dismissKeys,
    focusOnClick,
    submitKeys,
  } = props;
  const [state, setState] = useState<MentionState | null>(null);
  const helpers = useHelpers();
  const isOpen = !!state;

  const onDismiss = useCallback(() => {
    if (!state) {
      return false;
    }

    const { range, name } = state;

    // TODO Revisit to see if the following is too extreme
    if (ignoreMatchesOnDismiss) {
      // Ignore the current mention so that it doesn't show again for this
      // matching area
      helpers
        .getSuggestMethods()
        .addIgnored({ from: range.from, name, specific: true });
    }

    // Remove the matches.
    setState(null);

    return true;
  }, [helpers, ignoreMatchesOnDismiss, state]);

  const onSubmit = useCallback(
    (item: Data) => {
      if (!state) {
        // When there is no state, defer to the next keybinding.
        return false;
      }

      const { command } = state;

      // Call the command with the item (including all the provided attributes
      // which it includes).
      command(item);

      return true;
    },
    [state]
  );

  const menu = useMenuNavigation<Data>({
    items,
    isOpen,
    onDismiss,
    onSubmit,
    direction,
    dismissKeys,
    focusOnClick,
    submitKeys,
  });
  const { setIndex } = menu;

  const { createTable, toggleHeading } = useCommands();

  /**
   * The is the callback for when a suggestion is changed.
   */
  const onChange: MentionChangeHandler = useCallback(
    (props, cmd) => {
      const {
        query,
        text,
        range,
        ignoreNextExit,
        name,
        exitReason,
        changeReason,
        textAfter,
        defaultAppendTextValue,
      } = props;

      // Ignore the next exit since it has been triggered manually but only when
      // this is caused by a change. This is because the command might be setup
      // to automatically be created on an exit.
      if (changeReason) {
        const command: MentionChangeHandlerCommand = (attrs) => {
          // Ignore the next exit since this exit is artificially being
          // generated.
          ignoreNextExit();
          if (!attrs) return;

          const regex = /^\s+/;

          const appendText = regex.test(textAfter)
            ? ""
            : defaultAppendTextValue;

          // Default to append text only when the textAfter the match does not
          // start with a whitespace character. However, this can be overridden
          // by the user.
          cmd({ appendText, ...attrs });

          // create the table here.
          // TODO different commands for different mentions.
          const { id } = attrs;
          switch (id) {
            case "table":
              createTable({
                rowsCount: 3,
                columnsCount: 3,
                withHeaderRow: false,
              });
              break;
            case "heading1":
              toggleHeading({ level: 1 });
              break;
            case "heading2":
              toggleHeading({ level: 2 });
              break;
            case "heading3":
              toggleHeading({ level: 3 });
              break;
            default:
              break;
          }

          // Reset the state, since the query has been exited.
          setState(null);
        };

        if (changeReason !== ChangeReason.Move) {
          setIndex(0);
        }

        // Update the active state after the change providing the command and
        // potentially updated index.
        setState({ reason: changeReason, name, query, text, range, command });

        return;
      }

      if (!exitReason || !onExit) {
        // Reset the state and do nothing when no onExit handler provided
        setState(null);
        return;
      }

      const exitCommand: MentionChangeHandlerCommand = (attrs) => {
        cmd({ appendText: "", ...attrs });
      };

      // Call the onExit handler.
      onExit({ reason: exitReason, name, query, text, range }, exitCommand);

      // Reset the state to remove the active query return.
      setState(null);
    },
    [setIndex, onExit]
  );

  // Add the handlers to the `MentionExtension`
  useExtensionEvent(SlashExtension, "onChange", onChange);

  return useMemo(() => ({ ...menu, state }), [menu, state]);
}

export function SlashSuggestor(): JSX.Element {
  const [users, setUsers] = useState<MentionExtensionAttributes[]>([]);
  const { state, getMenuProps, getItemProps, indexIsHovered, indexIsSelected } =
    useSlash({
      items: users,
    });

  const allUsers = [
    { id: "table", label: "Insert Table" },
    { id: "heading1", label: "Heading 1" },
    { id: "heading2", label: "Heading 2" },
    { id: "heading3", label: "Heading 3" },
  ];

  useEffect(() => {
    if (!state) {
      return;
    }

    const searchTerm = state.query.full.toLowerCase();
    const filteredUsers = allUsers
      .filter((user) => user.label.toLowerCase().includes(searchTerm))
      .sort()
      .slice(0, 5);
    setUsers(filteredUsers);
  }, [state]);

  const enabled = !!state;

  return (
    <FloatingWrapper
      positioner="cursor"
      enabled={enabled}
      placement="bottom-start"
    >
      <div {...getMenuProps()} className="suggestions">
        {enabled &&
          users.map((user, index) => {
            const isHighlighted = indexIsSelected(index);
            const isHovered = indexIsHovered(index);

            return (
              <div
                key={user.id}
                className={cx(
                  "suggestion",
                  isHighlighted && "highlighted",
                  isHovered && "hovered"
                )}
                {...getItemProps({
                  item: user,
                  index,
                })}
              >
                {user.label}
              </div>
            );
          })}
      </div>
    </FloatingWrapper>
  );
}
