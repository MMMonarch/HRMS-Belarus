import { Extension } from "@tiptap/core";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineIndent: {
      setLineIndent: (px: number) => ReturnType;
      increaseLineIndent: (step?: number) => ReturnType;
      decreaseLineIndent: (step?: number) => ReturnType;
    };
  }
}

const DEFAULT_STEP = 10;

/**
 * Adds a `lineIndent` attribute to hardBreak nodes and renders
 * an inline-block spacer after each `<br>` that has a non-zero indent.
 *
 * Usage: press Shift+Enter to insert a hard break, then use
 * increaseLineIndent / decreaseLineIndent to adjust the indent
 * of the continuation line within the same paragraph.
 */
export const LineIndent = Extension.create({
  name: "lineIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["hardBreak"],
        attributes: {
          lineIndent: {
            default: 0,
            parseHTML: (el: HTMLElement) =>
              parseFloat(el.getAttribute("data-line-indent") || "0") || 0,
            renderHTML: (attrs: Record<string, unknown>) => {
              const v = attrs.lineIndent as number;
              if (!v) return {};
              return { "data-line-indent": String(v) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineIndent:
        (px: number) =>
        ({ tr, state, dispatch }) => {
          const { pos, attrs } = findPrecedingHardBreak(state);
          if (pos < 0 || !attrs) return false;
          tr.setNodeMarkup(pos, undefined, {
            ...attrs,
            lineIndent: Math.max(0, px),
          });
          if (dispatch) dispatch(tr);
          return true;
        },

      increaseLineIndent:
        (step?: number) =>
        ({ tr, state, dispatch }) => {
          const s = step ?? DEFAULT_STEP;
          const { pos, attrs } = findPrecedingHardBreak(state);
          if (pos < 0 || !attrs) return false;
          const current = (attrs.lineIndent as number) || 0;
          tr.setNodeMarkup(pos, undefined, {
            ...attrs,
            lineIndent: current + s,
          });
          if (dispatch) dispatch(tr);
          return true;
        },

      decreaseLineIndent:
        (step?: number) =>
        ({ tr, state, dispatch }) => {
          const s = step ?? DEFAULT_STEP;
          const { pos, attrs } = findPrecedingHardBreak(state);
          if (pos < 0 || !attrs) return false;
          const current = (attrs.lineIndent as number) || 0;
          tr.setNodeMarkup(pos, undefined, {
            ...attrs,
            lineIndent: Math.max(0, current - s),
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const widgets: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (
                node.type.name === "hardBreak" &&
                (node.attrs.lineIndent as number) > 0
              ) {
                widgets.push(
                  Decoration.widget(
                    pos + node.nodeSize,
                    () => {
                      const spacer = document.createElement("span");
                      spacer.className = "line-indent-spacer";
                      spacer.style.width = `${node.attrs.lineIndent}px`;
                      return spacer;
                    },
                    { side: -1, key: `li-${pos}` },
                  ),
                );
              }
            });
            return DecorationSet.create(state.doc, widgets);
          },
        },
      }),
    ];
  },
});

function findPrecedingHardBreak(state: EditorState): {
  pos: number;
  attrs: Record<string, unknown> | null;
} {
  const { from } = state.selection;
  const $from = state.selection.$from;
  const parent = $from.parent;
  const parentStart = $from.start();

  let lastPos = -1;
  let lastAttrs: Record<string, unknown> | null = null;

  parent.forEach((child, offset) => {
    const absPos = parentStart + offset;
    if (child.type.name === "hardBreak" && absPos < from) {
      lastPos = absPos;
      lastAttrs = { ...child.attrs };
    }
  });

  return { pos: lastPos, attrs: lastAttrs };
}

export function getCurrentLineIndent(state: EditorState): number | null {
  const { pos, attrs } = findPrecedingHardBreak(state);
  if (pos < 0 || !attrs) return null;
  return (attrs.lineIndent as number) || 0;
}
