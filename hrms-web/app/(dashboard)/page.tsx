"use client";

import { useEffect, useState } from "react";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import {
  DashboardBirthdays,
  DashboardExpiringDocuments,
  DashboardAssignmentsTable,
} from "@/features/dashboard/components";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const workspace = useWorkspaceOptional();
  const { birthdays, expiringDocs, assignments, loading, error, refetch } = useDashboardData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Единая разметка на SSR и первом клиентском рендере, чтобы избежать hydration mismatch
  // (workspace.branchId на клиенте берётся из localStorage и появляется только после гидрации)
  if (!mounted || !workspace?.branchId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <p className="text-muted-foreground">
          {!mounted ? "Загрузка…" : "Выберите филиал в шапке, чтобы увидеть дашборд"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardBirthdays rows={birthdays} loading={loading} />
        <DashboardExpiringDocuments rows={expiringDocs} loading={loading} />
      </div>

      <DashboardAssignmentsTable rows={assignments} loading={loading} />
    </div>
  );
}
