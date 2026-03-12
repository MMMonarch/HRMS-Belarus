"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-9" aria-label="Тема">
        <Sun className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9">
          {isDark ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
          <span className="sr-only">
            {isDark ? "Тёмная тема" : "Светлая тема"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Тема оформления</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant={resolvedTheme === "light" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            <Sun className="size-4 mr-2" />
            Светлая
          </Button>
          <Button
            variant={resolvedTheme === "dark" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            <Moon className="size-4 mr-2" />
            Тёмная
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
