"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScrollableSelectOption = { value: string; label: string };

type ScrollableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ScrollableSelectOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** Максимальная высота списка (по умолчанию 280px), чтобы при большом числе опций не растягивался. */
  listMaxHeight?: string;
};

export function ScrollableSelect({
  value,
  onChange,
  options,
  placeholder = "—",
  "aria-label": ariaLabel,
  className,
  listMaxHeight = "max-h-[280px]",
}: ScrollableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "text-left"
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md",
            listMaxHeight
          )}
        >
          <li
            role="option"
            aria-selected={value === ""}
            className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </li>
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
