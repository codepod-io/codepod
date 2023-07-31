// Code developed based on https://github.com/ueberdosis/tiptap/issues/323#issuecomment-506637799

import { Node } from "@remirror/pm/model";
import { NodeSelection } from "@remirror/pm/state";
// import { __serializeForClipboard as serializeForClipboard } from "@remirror/pm/view";
// import { serializeForClipboard } from "prosemirror-view/src/clipboard";
// import {serializeForClipboard} from "@remirror/pm/view/dist/src/clipboard"
// @ts-ignore
import { __serializeForClipboard as serializeForClipboard } from "prosemirror-view";

import {
  ApplySchemaAttributes,
  EditorView,
  NodeExtension,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod,
  PlainExtension,
  ProsemirrorNode,
  extension,
  setStyle,
} from "remirror";

function removeNode(node) {
  node.parentNode.removeChild(node);
}

function absoluteRect(node) {
  const data = node.getBoundingClientRect();

  return {
    top: data.top,
    left: data.left,
    width: data.width,
  };
}

function blockPosAtCoords(coords, view) {
  const pos = view.posAtCoords(coords);
  if (!pos) return null;
  let node = view.domAtPos(pos.pos);

  node = node.node;

  if (!node) return;
  // Text node is not draggable. Must be a element node.
  if (node.nodeType === node.TEXT_NODE) {
    node = node.parentNode;
  }
  // Support bullet list and ordered list.
  if (["LI", "UL"].includes(node.parentNode.tagName)) {
    node = node.parentNode;
  }
  // Support task list.
  // li[data-task-list-item] > div > p
  if (
    node.parentNode.parentNode
      .getAttributeNames()
      .includes("data-task-list-item")
  ) {
    node = node.parentNode.parentNode;
  }

  if (node && node.nodeType === 1) {
    const desc = view.docView.nearestDesc(node, true);

    if (!(!desc || desc === view.docView)) {
      return desc.posBefore;
    }
  }
  return null;
}

function dragStart(e, view) {
  if (!e.dataTransfer) {
    return;
  }

  const coords = { left: e.clientX + 50, top: e.clientY };
  const pos = blockPosAtCoords(coords, view);

  if (pos != null) {
    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))
    );

    const slice = view.state.selection.content();
    const { dom, text } = serializeForClipboard(view, slice);

    e.dataTransfer.clearData();
    e.dataTransfer.setData("text/html", dom.innerHTML);
    e.dataTransfer.setData("text/plain", text);

    const el = document.querySelector(".ProseMirror-selectednode");

    e.dataTransfer?.setDragImage(el, 0, 0);
    view.dragging = { slice, move: true };
  }
}

@extension({})
export class BlockHandleExtension extends PlainExtension {
  get name(): string {
    return "block-handle";
  }

  createPlugin() {
    let dropElement;
    const WIDTH = 28;
    return {
      view(editorView) {
        const element = document.createElement("div");

        element.draggable = true;
        element.classList.add("global-drag-handle");
        element.addEventListener("dragstart", (e) => dragStart(e, editorView));
        dropElement = element;
        document.body.appendChild(dropElement);

        return {
          destroy() {
            removeNode(dropElement);
            dropElement = null;
          },
        };
      },
      props: {
        handleDOMEvents: {
          mousemove(view, event) {
            const coords = {
              left: event.clientX + WIDTH + 50,
              top: event.clientY,
            };
            const pos = view.posAtCoords(coords);

            if (pos) {
              let node = view.domAtPos(pos?.pos);

              if (node) {
                node = node.node;
                // Text node is not draggable. Must be a element node.
                if (node.nodeType === node.TEXT_NODE) {
                  node = node.parentNode;
                }
                // Locate the actual node instead of a <mark>.
                while (node.tagName === "MARK") {
                  node = node.parentNode;
                }
                // if (!(node instanceof Element)) return;
                // Use the y-pos of the first node.
                // const rect0 = absoluteRect(node);

                // while (node && node.parentNode) {
                //   if (node.parentNode?.classList?.contains("ProseMirror")) {
                //     // todo
                //     break;
                //   }
                //   node = node.parentNode;
                // }

                if (node instanceof Element) {
                  const cstyle = window.getComputedStyle(node);
                  const lineHeight = parseInt(cstyle.lineHeight, 10);
                  // const top = parseInt(cstyle.marginTop, 10) + parseInt(cstyle.paddingTop, 10)
                  const top = 0;
                  const rect = absoluteRect(node);
                  const win = node.ownerDocument.defaultView;

                  // rect0.top += win!.pageYOffset + (lineHeight - 24) / 2 + top;
                  rect.top += win!.pageYOffset + (lineHeight - 24) / 2 + top;
                  rect.left += win!.pageXOffset;
                  rect.width = `${WIDTH}px`;

                  // The default X offset
                  let offset = -8;
                  if (
                    node.parentNode &&
                    (node.parentNode as HTMLElement).classList.contains(
                      "ProseMirror"
                    )
                  ) {
                    // The X offset for top-level nodes.
                    offset = 8;
                  }

                  dropElement.style.left = `${-WIDTH + rect.left + offset}px`;
                  dropElement.style.top = `${rect.top}px`;
                  dropElement.style.display = "block";
                }
              }
            }
          },
        },
      },
    };
  }
}
