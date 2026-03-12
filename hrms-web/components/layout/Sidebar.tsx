"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Users,
  FileText,
  BookMarked,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { isAdmin } from "@/lib/constants";

type N8nStatus = "idle" | "checking" | "online" | "offline";

const N8N_CHECK_INTERVAL_MS = 30_000;

// Подсистемы — заголовок секции; пункты ниже — ссылки на подсистемы
const subsystemItems = [
  { href: "/employees", label: "Сотрудник", icon: Users },
  { href: "/editor", label: "Редактор", icon: Pencil },
  { href: "/documents", label: "Сводные приказы", icon: FileText },
  // { href: "/orders-register", label: "Журнал регистрации приказов", icon: BookOpen },
  { href: "/references", label: "Справочники системы", icon: BookMarked },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [n8nStatus, setN8nStatus] = useState<N8nStatus>("idle");
  const workspace = useWorkspaceOptional();
  const auth = useSupabaseAuthOptional();
  const { webhookBaseUrl } = useWebhookTestMode();
  const crudUrl = `${webhookBaseUrl.replace(/\/$/, "")}/crud`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !auth?.session) {
      setN8nStatus("idle");
      return;
    }
    let cancelled = false;
    const check = async () => {
      setN8nStatus("checking");
      try {
        const token = await auth.getAccessToken();
        if (cancelled || !token) {
          setN8nStatus("offline");
          return;
        }
        const res = await fetch(crudUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table: "organizations", action: "get", payload: null }),
        });
        if (cancelled) return;
        setN8nStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setN8nStatus("offline");
      }
    };
    check();
    const t = setInterval(check, N8N_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mounted, auth?.session, crudUrl, auth]);

  const user = mounted ? auth?.session?.user : null;
  const userName = (user?.user_metadata?.full_name as string) ?? user?.email ?? "—";
  const roleRaw = user?.user_metadata?.role;
  const roleLabel =
    isAdmin(roleRaw)
      ? "Администратор"
      : typeof roleRaw === "string" && roleRaw
        ? roleRaw
        : "Пользователь";
  const orgName = mounted ? (workspace?.organizationName ?? "—") : "—";

  const connectionLabel =
    n8nStatus === "checking"
      ? "проверка…"
      : n8nStatus === "online"
        ? "online"
        : n8nStatus === "offline"
          ? "Нет доступа к серверу"
          : "—";
  const connectionOk = n8nStatus === "online";

  return (
    <aside
      className={cn(
        "flex h-[calc(100vh-3.5rem)] flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Блок: организация, пользователь, роль, статус подключения */}
      <div
        className={cn(
          "border-b border-border p-3",
          collapsed && "p-2 text-center"
        )}
      >
        {!collapsed && (
          <>
            <p className="text-xs text-muted-foreground">
              Организация: {orgName}
            </p>
            <p className="text-xs text-muted-foreground">
              Пользователь: {userName}
            </p>
            <p className="text-xs text-muted-foreground">
              Роль: {roleLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              Статус подключения:{" "}
              <span
                className={
                  connectionOk
                    ? "text-green-600 dark:text-green-400"
                    : n8nStatus === "offline"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {connectionLabel}
              </span>
            </p>
          </>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {/* Дашборд — отдельный пункт */}
        <Link href="/">
          <Button
            variant={pathname === "/" ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              collapsed && "justify-center px-0"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            {!collapsed && <span>Дашборд</span>}
          </Button>
        </Link>

        {/* Подсистемы — заголовок секции, не ссылка */}
        {!collapsed && (
          <p className="mt-3 px-3 text-xs font-medium text-muted-foreground">
            Подсистемы
          </p>
        )}
        {subsystemItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link key={item.href + item.label} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Подсказка и кнопка сворачивания */}
      <div className={cn("border-t border-border p-2", collapsed && "p-2")}>
        {!collapsed && (
          <p className="mb-2 text-xs text-muted-foreground">
            Панель навигации можно скрывать и открывать.
          </p>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Открыть панель" : "Скрыть панель"}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
