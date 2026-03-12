import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEditorMode } from "../context/editor-mode";
import { getNestedValue, formatVariableValue } from "../lib/resolve-variables";

export function TemplateVariableView({ node }: NodeViewProps) {
  const { mode, variableData } = useEditorMode();
  const { path, label, fallback, format } = node.attrs as {
    path: string;
    label: string;
    fallback: string;
    format: string | null;
  };

  if (mode === "document") {
    const raw = getNestedValue(variableData, path);
    const display =
      raw != null
        ? formatVariableValue(raw, format)
        : fallback || `[${label || path}]`;
    return (
      <NodeViewWrapper as="span" className="template-var-inline">
        <span contentEditable={false}>{display}</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="template-var-inline">
      <span
        className="inline-flex items-center rounded-sm bg-sky-100 px-1 py-0.5 text-xs font-mono text-gray-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-200 dark:text-gray-900 dark:ring-sky-400"
        contentEditable={false}
        title={label || path}
      >
        {`{{${path}}}`}
      </span>
    </NodeViewWrapper>
  );
}
