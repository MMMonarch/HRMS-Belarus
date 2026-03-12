import { TableCell } from "@tiptap/extension-table";
import { TableHeader } from "@tiptap/extension-table";
import { mergeAttributes } from "@tiptap/core";

function borderAttrs() {
  return {
    borderTop: {
      default: true,
      parseHTML: (el: HTMLElement) => el.getAttribute("data-border-top") !== "false",
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.borderTop === false) return { "data-border-top": "false" };
        return {};
      },
    },
    borderRight: {
      default: true,
      parseHTML: (el: HTMLElement) => el.getAttribute("data-border-right") !== "false",
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.borderRight === false) return { "data-border-right": "false" };
        return {};
      },
    },
    borderBottom: {
      default: true,
      parseHTML: (el: HTMLElement) => el.getAttribute("data-border-bottom") !== "false",
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.borderBottom === false) return { "data-border-bottom": "false" };
        return {};
      },
    },
    borderLeft: {
      default: true,
      parseHTML: (el: HTMLElement) => el.getAttribute("data-border-left") !== "false",
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.borderLeft === false) return { "data-border-left": "false" };
        return {};
      },
    },
    borderWidth: {
      default: 1,
      parseHTML: (el: HTMLElement) => {
        const val = el.getAttribute("data-border-width");
        return val ? parseInt(val, 10) : 1;
      },
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.borderWidth && attrs.borderWidth !== 1) {
          return { "data-border-width": String(attrs.borderWidth) };
        }
        return {};
      },
    },
    verticalAlign: {
      default: "top",
      parseHTML: (el: HTMLElement) => el.getAttribute("data-vertical-align") || "top",
      renderHTML: (attrs: Record<string, unknown>) => {
        if (attrs.verticalAlign && attrs.verticalAlign !== "top") {
          return { "data-vertical-align": attrs.verticalAlign as string };
        }
        return {};
      },
    },
  };
}

function buildInlineStyle(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  if (attrs.verticalAlign && attrs.verticalAlign !== "top") {
    parts.push(`vertical-align:${attrs.verticalAlign}`);
  }
  if (attrs.borderWidth && attrs.borderWidth !== 1) {
    parts.push(`border-width:${attrs.borderWidth}px`);
  }
  return parts.join(";");
}

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...borderAttrs(),
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = buildInlineStyle(node.attrs);
    const extra: Record<string, string> = {};
    if (style) extra.style = style;
    return ["td", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, extra), 0];
  },
});

export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...borderAttrs(),
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = buildInlineStyle(node.attrs);
    const extra: Record<string, string> = {};
    if (style) extra.style = style;
    return ["th", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, extra), 0];
  },
});
