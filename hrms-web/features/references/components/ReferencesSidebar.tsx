"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DIRECTORY_ITEMS } from "../constants";
import type { DirectoryId } from "../types";

type ReferencesSidebarProps = {
  selectedId: DirectoryId | null;
  onSelect: (id: DirectoryId) => void;
  className?: string;
};

export function ReferencesSidebar({
  selectedId,
  onSelect,
  className,
}: ReferencesSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? DIRECTORY_ITEMS.filter((item) =>
          item.label.toLowerCase().includes(q)
        )
      : [...DIRECTORY_ITEMS];
    return list.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [search]);

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-border bg-card p-3",
        className
      )}
    >
      <Input
        type="search"
        placeholder="Поиск по таблицам"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
        aria-label="Поиск по таблицам"
      />
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm transition-colors",
              selectedId === item.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
