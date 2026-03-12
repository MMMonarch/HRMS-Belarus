"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWorkspaceOptional } from "@/lib/context/workspace";

/**
 * Редирект на /select-workspace, если пользователь в дашборде без выбранного филиала
 * (например, очистил localStorage). Не редиректит во время первой загрузки (гидрация).
 */
export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useSupabaseAuthOptional();
  const workspace = useWorkspaceOptional();
  const didCheck = useRef(false);

  useEffect(() => {
    if (didCheck.current || !workspace) return;
    if (!auth?.session) return;
    if (workspace.loading) return;
    if (workspace.branchId) return;
    didCheck.current = true;
    router.replace("/select-workspace");
  }, [auth?.session, workspace?.branchId, workspace?.loading, workspace, router]);

  return <>{children}</>;
}
