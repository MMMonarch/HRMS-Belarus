import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TemplateVariableView } from "../components/TemplateVariableView";

export interface TemplateVariableOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateVariable: {
      insertTemplateVariable: (attrs: {
        path: string;
        label: string;
        fallback?: string;
        format?: string;
      }) => ReturnType;
    };
  }
}

export const TemplateVariable = Node.create<TemplateVariableOptions>({
  name: "templateVariable",

  group: "inline",

  inline: true,

  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      path: { default: "" },
      label: { default: "" },
      fallback: { default: "" },
      format: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-template-variable]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-template-variable": HTMLAttributes.path as string,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateVariableView);
  },

  addCommands() {
    return {
      insertTemplateVariable:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
