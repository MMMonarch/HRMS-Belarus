"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** DD.MM.YYYY → Date или undefined */
function parseDDMMYYYY(value: string): Date | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return undefined;
  const [, d, m, y] = match;
  const day = parseInt(d!, 10);
  const month = parseInt(m!, 10) - 1;
  const year = parseInt(y!, 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
    return undefined;
  return date;
}

/** Date → DD.MM.YYYY */
function formatDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "01.01.2025",
  className,
  id,
  "aria-label": ariaLabel,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedDate = React.useMemo(() => parseDDMMYYYY(value), [value]);

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

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatDDMMYYYY(date));
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex gap-1">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          className="h-9"
          aria-label={ariaLabel}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-label="Выбрать дату"
          disabled={disabled}
        >
          <CalendarIcon className="size-4" />
        </Button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-3 shadow-md">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate ?? new Date()}
          />
        </div>
      )}
    </div>
  );
}
