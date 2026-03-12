"use client";

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { VariableSchema } from "../types";
import { getNestedValue, formatVariableValue } from "../lib/resolve-variables";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type EditorSidebarProps = {
  editor: Editor | null;
  variables: VariableSchema[];
  variableData?: Record<string, unknown>;
  loading?: boolean;
  className?: string;
};

export function EditorSidebar({ editor, variables, variableData, loading, className }: EditorSidebarProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, VariableSchema[]>();
    for (const v of variables) {
      const group = v.group || "Прочее";
      const arr = map.get(group);
      if (arr) arr.push(v);
      else map.set(group, [v]);
    }
    return map;
  }, [variables]);

  const insertVariable = (v: VariableSchema) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTemplateVariable({
        path: v.path,
        label: v.label,
        fallback: v.fallback,
        format: v.format,
      })
      .run();
  };

  return (
    <aside
      className={cn(
        "editor-sidebar flex w-56 shrink-0 flex-col border-r border-border bg-card",
        className,
      )}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Переменные</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Загрузка…
          </p>
        )}
        {!loading && Array.from(grouped.entries()).map(([group, vars]) => (
          <VariableGroup
            key={group}
            group={group}
            variables={vars}
            variableData={variableData}
            onInsert={insertVariable}
          />
        ))}
        {!loading && variables.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Нет переменных
          </p>
        )}
      </div>
    </aside>
  );
}

function VariableGroup({
  group,
  variables,
  variableData,
  onInsert,
}: {
  group: string;
  variables: VariableSchema[];
  variableData?: Record<string, unknown>;
  onInsert: (v: VariableSchema) => void;
}) {
  return (
    <details className="group mb-1" open>
      <summary className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
        <ChevronDown className="size-3 shrink-0 transition-transform group-open:rotate-0 -rotate-90" />
        {group}
      </summary>
      <div className="ml-2 flex flex-col gap-0.5 py-0.5">
        {variables.map((v, i) => {
          const rawValue = variableData ? getNestedValue(variableData, v.path) : undefined;
          const displayValue =
            rawValue != null
              ? formatVariableValue(rawValue, v.format ?? null)
              : v.fallback ?? null;
          return (
            <button
              key={`${v.path}-${i}`}
              type="button"
              className="flex flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-accent"
              onClick={() => onInsert(v)}
              title={`Вставить {{${v.path}}}`}
            >
              <span className="text-xs">{v.label}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {v.path}
              </span>
              {displayValue !== null && displayValue !== "" && (
                <span className="mt-0.5 truncate text-[10px] text-muted-foreground" title={displayValue}>
                  {displayValue}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </details>
  );
}
