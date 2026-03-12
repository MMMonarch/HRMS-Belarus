"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PageSettings, PageOrientation } from "../types";
import { cn } from "@/lib/utils";

type PageSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageSettings: PageSettings;
  onApply: (settings: PageSettings) => void;
};

export function PageSettingsDialog({
  open,
  onOpenChange,
  pageSettings,
  onApply,
}: PageSettingsDialogProps) {
  const [draft, setDraft] = useState<PageSettings>(pageSettings);

  const resetDraft = useCallback(() => setDraft(pageSettings), [pageSettings]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) resetDraft();
      onOpenChange(v);
    },
    [onOpenChange, resetDraft],
  );

  const setMargin = (key: keyof PageSettings["margins"], value: string) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setDraft((prev) => ({
      ...prev,
      margins: { ...prev.margins, [key]: num },
    }));
  };

  const setOrientation = (o: PageOrientation) => {
    setDraft((prev) => ({ ...prev, orientation: o }));
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Параметры страницы</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Orientation */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Ориентация
            </p>
            <div className="flex gap-2">
              <OrientationButton
                label="Книжная"
                active={draft.orientation === "portrait"}
                onClick={() => setOrientation("portrait")}
                aspect="h-16 w-12"
              />
              <OrientationButton
                label="Альбомная"
                active={draft.orientation === "landscape"}
                onClick={() => setOrientation("landscape")}
                aspect="h-12 w-16"
              />
            </div>
          </div>

          {/* Margins */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Поля (мм)
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <MarginInput
                label="Верхнее"
                value={draft.margins.top}
                onChange={(v) => setMargin("top", v)}
              />
              <MarginInput
                label="Нижнее"
                value={draft.margins.bottom}
                onChange={(v) => setMargin("bottom", v)}
              />
              <MarginInput
                label="Левое"
                value={draft.margins.left}
                onChange={(v) => setMargin("left", v)}
              />
              <MarginInput
                label="Правое"
                value={draft.margins.right}
                onChange={(v) => setMargin("right", v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleApply}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarginInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[4.5rem] text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        max={100}
        step={1}
        className="h-7 w-16 px-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function OrientationButton({
  label,
  active,
  onClick,
  aspect,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  aspect: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border hover:bg-accent",
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "rounded-sm border",
          aspect,
          active ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/50",
        )}
      />
      {label}
    </button>
  );
}
