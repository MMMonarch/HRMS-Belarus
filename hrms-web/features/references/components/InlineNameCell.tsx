"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function InlineNameCell({
  value,
  saving,
  onBlur,
  ariaLabel = "Название",
  maxLength,
}: {
  value: string;
  saving: boolean;
  onBlur: (value: string) => void;
  ariaLabel?: string;
  maxLength?: number;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    setFocused(false);
    const trimmed = local.trim();
    if (trimmed !== value) onBlur(trimmed);
  };

  return (
    <Input
      value={local}
      onChange={(e) =>
        setLocal(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)
      }
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      disabled={saving}
      maxLength={maxLength}
      className={focused ? "border-ring" : "border-transparent bg-transparent shadow-none"}
      aria-label={ariaLabel}
    />
  );
}

export function InlineNumberCell({
  value,
  saving,
  onBlur,
  ariaLabel,
  min = 0,
  max,
  nullable = false,
  placeholder,
}: {
  value: number | null;
  saving: boolean;
  onBlur: (value: number | null) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setLocal(value === null ? "" : String(value));
  }, [value]);

  const handleBlur = () => {
    setFocused(false);
    const trimmed = local.trim();
    if (trimmed === "") {
      if (nullable && value !== null) onBlur(null);
      else setLocal(value === null ? "" : String(value));
      return;
    }
    const num = parseInt(trimmed, 10);
    if (!Number.isInteger(num) || num < min || (max !== undefined && num > max)) {
      setLocal(value === null ? "" : String(value));
      return;
    }
    if (num !== value) onBlur(num);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      disabled={saving}
      placeholder={placeholder}
      className={focused ? "border-ring" : "border-transparent bg-transparent shadow-none"}
      aria-label={ariaLabel}
    />
  );
}
