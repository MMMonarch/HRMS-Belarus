"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/context/workspace";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";

export default function SelectWorkspacePage() {
  const router = useRouter();
  const auth = useSupabaseAuthOptional();
  const {
    organizationId,
    branchId,
    organizations,
    branches,
    loading,
    setWorkspace,
    refresh,
  } = useWorkspace();

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const branchesForOrg = selectedOrgId
    ? branches.filter((b) => b.organization_id === selectedOrgId)
    : branches;

  useEffect(() => {
    if (auth?.session) void refresh();
  }, [auth?.session, refresh]);

  useEffect(() => {
    if (organizationId && branchId && organizations.length > 0) {
      setSelectedOrgId(organizationId);
      setSelectedBranchId(branchId);
    }
  }, [organizationId, branchId, organizations.length]);

  useEffect(() => {
    if (selectedOrgId && !branchesForOrg.some((b) => b.id === selectedBranchId)) {
      const first = branchesForOrg[0];
      setSelectedBranchId(first?.id ?? "");
    }
  }, [selectedOrgId, selectedBranchId, branchesForOrg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedBranchId) return;
    setSubmitting(true);
    const org = organizations.find((o) => o.id === selectedOrgId);
    const branch = branches.find((b) => b.id === selectedBranchId);
    setWorkspace(
      selectedOrgId,
      selectedBranchId,
      org?.name ?? null,
      branch?.name ?? null
    );
    router.push("/");
    router.refresh();
    setSubmitting(false);
  };

  if (!auth?.session) {
    return (
      <div className="text-muted-foreground text-center text-sm">
        Нет сессии. Перенаправление на вход…
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 px-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">HRMS Belarus</h1>
        <p className="text-muted-foreground text-sm">
          Выберите организацию и филиал для работы
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="workspace-org" className="text-muted-foreground text-sm font-medium">
            Организация
          </label>
          <select
            id="workspace-org"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            disabled={loading}
          >
            <option value="">— Выберите организацию —</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {!loading && organizations.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Нет организаций в системе или не удалось загрузить список.{" "}
              <button
                type="button"
                onClick={() => void refresh()}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Повторить
              </button>
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="workspace-branch" className="text-muted-foreground text-sm font-medium">
            Филиал
          </label>
          <select
            id="workspace-branch"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={loading || !selectedOrgId}
          >
            <option value="">— Выберите филиал —</option>
            {branchesForOrg.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !selectedOrgId || !selectedBranchId || submitting}
        >
          {submitting ? "Вход…" : "Продолжить"}
        </Button>
      </form>
    </div>
  );
}
