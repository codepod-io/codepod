import {
  BulletListExtension as RemirrorBulletListExtension,
  OrderedListExtension as RemirrorOrderedListExtension,
  TaskListExtension as RemirrorTaskListExtension,
} from "remirror/extensions";

import { ExtensionListTheme } from "@remirror/theme";
import { NodeViewMethod, ProsemirrorNode } from "@remirror/core";

function addSpine(dom, view, getPos) {
  const pos = (getPos as () => number)();
  const $pos = view.state.doc.resolve(pos + 1);

  const parentListItemNode: ProsemirrorNode | undefined = $pos.node(
    $pos.depth - 1
  );

  const isNotFirstLevel = ["listItem", "taskListItem"].includes(
    parentListItemNode?.type?.name || ""
  );

  if (isNotFirstLevel) {
    const spine = document.createElement("div");
    spine.contentEditable = "false";
    spine.classList.add(ExtensionListTheme.LIST_SPINE);
    dom.append(spine);
  }
}

/**
 * Add spline but not listener.
 */
export class BulletListExtension extends RemirrorBulletListExtension {
  createNodeViews(): NodeViewMethod | Record<string, never> {
    return (_, view, getPos) => {
      const dom = document.createElement("div");
      dom.style.position = "relative";

      addSpine(dom, view, getPos);

      const contentDOM = document.createElement("ul");
      dom.append(contentDOM);

      return {
        dom,
        contentDOM,
      };
    };
  }
}

export class OrderedListExtension extends RemirrorOrderedListExtension {
  createNodeViews(): NodeViewMethod | Record<string, never> {
    return (_, view, getPos) => {
      const dom = document.createElement("div");
      dom.style.position = "relative";

      addSpine(dom, view, getPos);

      const contentDOM = document.createElement("ol");
      dom.append(contentDOM);

      return {
        dom,
        contentDOM,
      };
    };
  }
}

export class TaskListExtension extends RemirrorTaskListExtension {
  createNodeViews(): NodeViewMethod | Record<string, never> {
    return (_, view, getPos) => {
      const dom = document.createElement("div");
      dom.style.position = "relative";

      addSpine(dom, view, getPos);

      const contentDOM = document.createElement("ul");
      dom.append(contentDOM);

      return {
        dom,
        contentDOM,
      };
    };
  }
}
