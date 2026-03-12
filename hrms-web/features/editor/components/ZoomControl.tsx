"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ZoomControlProps = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
};

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

export function ZoomControl({ zoom, onZoomChange, className }: ZoomControlProps) {
  const pct = Math.round(zoom * 100);

  return (
    <div
      className={cn(
        "zoom-control flex items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-1 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={zoom <= ZOOM_MIN}
        onClick={() =>
          onZoomChange(Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2)))
        }
        title="Уменьшить"
      >
        <Minus className="size-3" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs tabular-nums">
        {pct}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={zoom >= ZOOM_MAX}
        onClick={() =>
          onZoomChange(Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2)))
        }
        title="Увеличить"
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );
}
