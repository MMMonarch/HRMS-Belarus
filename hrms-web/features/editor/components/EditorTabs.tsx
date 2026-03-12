"use client";

import { LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabState } from "../store/editor-tabs-store";

type EditorTabsProps = {
  tabs: TabState[];
  activeTabId: string | null;
  onSelectTab: (id: string | null) => void;
  onCloseTab: (id: string) => void;
};

export function EditorTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: EditorTabsProps) {
  const isTemplatesActive = activeTabId === null;

  return (
    <div className="editor-tabs flex items-center gap-0 border-b border-border bg-muted/30 overflow-x-auto">
      {/* Permanent "Шаблоны" tab */}
      <div
        className={cn(
          "flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs cursor-pointer select-none transition-colors shrink-0",
          isTemplatesActive
            ? "bg-card text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        onClick={() => onSelectTab(null)}
      >
        <LayoutGrid className="size-3.5" />
        <span>Шаблоны</span>
      </div>

      {/* Dynamic template tabs */}
      {tabs.map((tab) => {
        const isActive = tab.tabId === activeTabId;
        return (
          <div
            key={tab.tabId}
            className={cn(
              "group flex items-center gap-1 border-r border-border px-3 py-1.5 text-xs cursor-pointer select-none transition-colors",
              isActive
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => onSelectTab(tab.tabId)}
          >
            <span className="max-w-[160px] truncate">
              {tab.name}
              {tab.modified && <span className="text-muted-foreground"> *</span>}
            </span>
            <button
              type="button"
              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.tabId);
              }}
              title="Закрыть вкладку"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
