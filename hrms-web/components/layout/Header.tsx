"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { ROLE_ADMIN } from "@/lib/constants";

type SessionUser = { email?: string; name?: string; role?: string };

export function Header({ className }: { className?: string }) {
  const router = useRouter();
  const { testMode, setTestMode } = useWebhookTestMode();
  const workspace = useWorkspaceOptional();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => data?.session?.user && setUser(data.session.user))
      .catch(() => setUser(null));
  }, [mounted]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setUser(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Игнорируем ошибки Supabase (например, нет сети)
    }
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Cookie всё равно сбросится при переходе
    }
    router.push("/login");
    router.refresh();
  }

  const roleLabel = user?.role === ROLE_ADMIN ? "Администратор" : user?.role ?? "Пользователь";

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4",
        className
      )}
    >
      <h1 className="text-lg font-semibold text-foreground">HRMS Belarus</h1>
      <div className="flex items-center gap-4">
        {mounted && workspace?.branchId && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Building2 className="size-4 shrink-0" />
            <span title={`${workspace.organizationName ?? ""} · ${workspace.branchName ?? ""}`}>
              {workspace.organizationName && workspace.branchName
                ? `${workspace.organizationName} · ${workspace.branchName}`
                : workspace.branchName ?? workspace.organizationName ?? "Филиал"}
            </span>
            <button
              type="button"
              onClick={() => router.push("/select-workspace")}
              className="text-primary hover:underline focus:outline-none focus:underline"
            >
              Сменить
            </button>
          </div>
        )}
        {user && (
          <span className="text-muted-foreground text-sm" title={user.role}>
            {user.name ?? user.email ?? "—"} · {roleLabel}
          </span>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <Checkbox
            checked={testMode}
            onCheckedChange={(v) => setTestMode(v === true)}
            aria-label="Тестовый режим вебхука"
          />
          <span>Тестовый режим</span>
        </label>
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          aria-label="Выйти из системы"
        >
          <LogOut className="size-4" />
          {loggingOut ? "Выход…" : "Выход"}
        </button>
      </div>
    </header>
  );
}
