import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";

import { useStore } from "zustand";

import {
  LinkExtension as RemirrorLinkExtension,
  ShortcutHandlerProps,
  createMarkPositioner,
} from "remirror/extensions";

import {
  useCommands,
  CommandButton,
  CommandButtonProps,
  useChainedCommands,
  useCurrentSelection,
  useAttrs,
  useUpdateReason,
  FloatingWrapper,
} from "@remirror/react";
import { FloatingToolbar, useExtensionEvent } from "@remirror/react";

import { InputRule } from "@remirror/pm";
import { markInputRule } from "@remirror/core-utils";

import { RepoContext } from "../../../lib/store";

export class LinkExtension extends RemirrorLinkExtension {
  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: /\[([^\]]+)\]\(([^)]+)\)/,
        type: this.type,
        getAttributes: (matches: string[]) => {
          const [_, text, href] = matches;
          return { text: text, href: href };
        },
      }),
    ];
  }
}

function useLinkShortcut() {
  const [linkShortcut, setLinkShortcut] = useState<
    ShortcutHandlerProps | undefined
  >();
  const [isEditing, setIsEditing] = useState(false);

  useExtensionEvent(
    LinkExtension,
    "onShortcut",
    useCallback(
      (props) => {
        if (!isEditing) {
          setIsEditing(true);
        }

        return setLinkShortcut(props);
      },
      [isEditing]
    )
  );

  return { linkShortcut, isEditing, setIsEditing };
}

function useFloatingLinkState() {
  const chain = useChainedCommands();
  const { isEditing, linkShortcut, setIsEditing } = useLinkShortcut();
  const { to, empty } = useCurrentSelection();

  const url = (useAttrs().link()?.href as string) ?? "";
  const [href, setHref] = useState<string>(url);

  // A positioner which only shows for links.
  const linkPositioner = React.useMemo(
    () => createMarkPositioner({ type: "link" }),
    []
  );

  const onRemove = useCallback(() => {
    return chain.removeLink().focus().run();
  }, [chain]);

  const updateReason = useUpdateReason();

  React.useLayoutEffect(() => {
    if (!isEditing) {
      return;
    }

    if (updateReason.doc || updateReason.selection) {
      setIsEditing(false);
    }
  }, [isEditing, setIsEditing, updateReason.doc, updateReason.selection]);

  useEffect(() => {
    setHref(url);
  }, [url]);

  const submitHref = useCallback(() => {
    setIsEditing(false);
    const range = linkShortcut ?? undefined;

    if (href === "") {
      chain.removeLink();
    } else {
      chain.updateLink({ href, auto: false }, range);
    }

    chain.focus(range?.to ?? to).run();
  }, [setIsEditing, linkShortcut, chain, href, to]);

  const cancelHref = useCallback(() => {
    setIsEditing(false);
  }, [setIsEditing]);

  const clickEdit = useCallback(() => {
    if (empty) {
      chain.selectLink();
    }

    setIsEditing(true);
  }, [chain, empty, setIsEditing]);

  return React.useMemo(
    () => ({
      href,
      setHref,
      linkShortcut,
      linkPositioner,
      isEditing,
      clickEdit,
      onRemove,
      submitHref,
      cancelHref,
    }),
    [
      href,
      linkShortcut,
      linkPositioner,
      isEditing,
      clickEdit,
      onRemove,
      submitHref,
      cancelHref,
    ]
  );
}

const DelayAutoFocusInput = ({
  autoFocus,
  ...rest
}: React.HTMLProps<HTMLInputElement>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [autoFocus]);

  return <input ref={inputRef} {...rest} />;
};

function useUpdatePositionerOnMove() {
  // Update (all) the positioners whenever there's a move (pane) on reactflow,
  // so that the toolbar moves with the Rich pod and content.
  const { forceUpdatePositioners, emptySelection } = useCommands();
  const store = useContext(RepoContext)!;
  const moved = useStore(store, (state) => state.moved);
  const paneClicked = useStore(store, (state) => state.paneClicked);
  useEffect(() => {
    forceUpdatePositioners();
  }, [moved]);
  useEffect(() => {
    emptySelection();
  }, [paneClicked]);
  return;
}

/**
 * This is a two-buttons toolbar when user click on a link. The first button
 * edits the link, the second button opens the link.
 */
export const LinkToolbar = () => {
  const {
    isEditing,
    linkPositioner,
    clickEdit,
    onRemove,
    submitHref,
    href,
    setHref,
    cancelHref,
  } = useFloatingLinkState();
  useUpdatePositionerOnMove();
  const { empty } = useCurrentSelection();

  const handleClickEdit = useCallback(() => {
    clickEdit();
  }, [clickEdit]);

  return (
    <>
      {!isEditing && empty && (
        // By default, MUI's Popper creates a Portal, which is a ROOT html
        // elements that prevents paning on reactflow canvas. Therefore, we
        // disable the portal behavior.
        <FloatingToolbar
          disablePortal
          sx={{
            button: {
              padding: 0,
              border: "none",
              borderRadius: "5px",
              marginLeft: "5px",
            },
            paddingX: "4px",
            border: "2px solid grey",
            borderRadius: "5px",
            alignItems: "center",
            backgroundColor: "white",
          }}
          // The default positinoer will cause the toolbar only show on text
          // selection. This linkPositioner allows the toolbar to be shown
          // without any text selection
          positioner={linkPositioner}
        >
          <CommandButton
            commandName="updateLink"
            aria-label="Edit link"
            onSelect={handleClickEdit}
            icon="pencilLine"
            enabled
          />
          <CommandButton
            commandName="removeLink"
            aria-label="Open link"
            onSelect={() => {
              window.open(href, "_blank");
            }}
            icon="externalLinkFill"
            enabled
          />
        </FloatingToolbar>
      )}

      <FloatingWrapper
        positioner="always"
        placement="bottom"
        enabled={isEditing}
        renderOutsideEditor
      >
        <DelayAutoFocusInput
          style={{ zIndex: 20 }}
          autoFocus
          placeholder="Enter link..."
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setHref(event.target.value)
          }
          value={href}
          onKeyPress={(event: React.KeyboardEvent<HTMLInputElement>) => {
            const { code } = event;

            if (code === "Enter") {
              submitHref();
            }

            if (code === "Escape") {
              cancelHref();
            }
          }}
        />
      </FloatingWrapper>
    </>
  );
};
