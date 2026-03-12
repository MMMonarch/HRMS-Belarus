import { Extension } from "@tiptap/core";

const MM_TO_PX = 3.7795275591;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphIndent: {
      setIndentLeft: (mm: number) => ReturnType;
      setIndentRight: (mm: number) => ReturnType;
      setTextIndent: (mm: number) => ReturnType;
    };
  }
}

export const ParagraphIndent = Extension.create({
  name: "paragraphIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indentLeft: {
            default: 0,
            parseHTML: (el: HTMLElement) =>
              parseFloat(el.getAttribute("data-indent-left") || "0") || 0,
            renderHTML: (attrs: Record<string, unknown>) => {
              const v = attrs.indentLeft as number;
              if (!v) return {};
              return {
                "data-indent-left": String(v),
                style: `margin-left: ${(v * MM_TO_PX).toFixed(2)}px`,
              };
            },
          },
          indentRight: {
            default: 0,
            parseHTML: (el: HTMLElement) =>
              parseFloat(el.getAttribute("data-indent-right") || "0") || 0,
            renderHTML: (attrs: Record<string, unknown>) => {
              const v = attrs.indentRight as number;
              if (!v) return {};
              return {
                "data-indent-right": String(v),
                style: `margin-right: ${(v * MM_TO_PX).toFixed(2)}px`,
              };
            },
          },
          textIndent: {
            default: 0,
            parseHTML: (el: HTMLElement) =>
              parseFloat(el.getAttribute("data-text-indent") || "0") || 0,
            renderHTML: (attrs: Record<string, unknown>) => {
              const v = attrs.textIndent as number;
              if (!v) return {};
              return {
                "data-text-indent": String(v),
                style: `text-indent: ${(v * MM_TO_PX).toFixed(2)}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setIndentLeft:
        (mm: number) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indentLeft: mm });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      setIndentRight:
        (mm: number) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indentRight: mm });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      setTextIndent:
        (mm: number) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, textIndent: mm });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
