"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { parseListResponse } from "@/lib/n8n/client";

const WORKSPACE_STORAGE_KEY = "hrms_workspace";

export type OrganizationOption = { id: string; name: string };
export type BranchOption = { id: string; name: string; organization_id?: string };

type WorkspaceState = {
  organizationId: string | null;
  branchId: string | null;
  organizationName: string | null;
  branchName: string | null;
};

type WorkspaceContextValue = {
  /** Текущая организация (id) */
  organizationId: string | null;
  /** Текущий филиал (id) */
  branchId: string | null;
  /** Название организации для отображения */
  organizationName: string | null;
  /** Название филиала для отображения */
  branchName: string | null;
  /** Список организаций (загружается при наличии сессии) */
  organizations: OrganizationOption[];
  /** Список филиалов (все или по выбранной организации) */
  branches: BranchOption[];
  /** Загрузка списков org/branches */
  loading: boolean;
  setOrganizationId: (id: string | null) => void;
  setBranchId: (id: string | null) => void;
  /** Установить организацию и филиал (и сохранить в localStorage) */
  setWorkspace: (orgId: string | null, branchId: string | null, orgName?: string | null, branchName?: string | null) => void;
  /** Перезагрузить списки организаций и филиалов */
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadFromStorage(): WorkspaceState {
  if (typeof window === "undefined")
    return { organizationId: null, branchId: null, organizationName: null, branchName: null };
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return { organizationId: null, branchId: null, organizationName: null, branchName: null };
    const data = JSON.parse(raw) as WorkspaceState;
    return {
      organizationId: data.organizationId ?? null,
      branchId: data.branchId ?? null,
      organizationName: data.organizationName ?? null,
      branchName: data.branchName ?? null,
    };
  } catch {
    return { organizationId: null, branchId: null, organizationName: null, branchName: null };
  }
}

function saveToStorage(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuthOptional();
  const { webhookBaseUrl } = useWebhookTestMode();
  const crudUrl = `${webhookBaseUrl.replace(/\/$/, "")}/crud`;
  const [organizationId, setOrganizationIdState] = useState<string | null>(() => loadFromStorage().organizationId);
  const [branchId, setBranchIdState] = useState<string | null>(() => loadFromStorage().branchId);
  const [organizationName, setOrganizationNameState] = useState<string | null>(() => loadFromStorage().organizationName);
  const [branchName, setBranchNameState] = useState<string | null>(() => loadFromStorage().branchName);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);

  const persist = useCallback((state: WorkspaceState) => {
    saveToStorage(state);
  }, []);

  const setWorkspace = useCallback(
    (orgId: string | null, bid: string | null, orgName?: string | null, bName?: string | null) => {
      setOrganizationIdState(orgId);
      setBranchIdState(bid);
      setOrganizationNameState(orgName ?? null);
      setBranchNameState(bName ?? null);
      persist({
        organizationId: orgId,
        branchId: bid,
        organizationName: orgName ?? null,
        branchName: bName ?? null,
      });
    },
    [persist]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = auth ? await auth.getAccessToken() : null;
      if (!token) {
        setOrganizations([]);
        setBranches([]);
        return;
      }
      const [orgRes, branchRes] = await Promise.all([
        fetch(crudUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table: "organizations", action: "get", payload: null, access_token: token }),
        }),
        fetch(crudUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table: "branches", action: "get", payload: null, access_token: token }),
        }),
      ]);
      const orgData = orgRes.ok ? await orgRes.json() : null;
      const branchData = branchRes.ok ? await branchRes.json() : null;
      const orgList = parseListResponse(orgData) as { id: string; name?: string }[];
      const branchList = parseListResponse(branchData) as { id: string; name?: string; organization_id?: string }[];
      setOrganizations(Array.isArray(orgList) ? orgList.map((o) => ({ id: o.id, name: o.name ?? o.id })) : []);
      setBranches(
        Array.isArray(branchList)
          ? branchList.map((b) => ({ id: b.id, name: b.name ?? b.id, organization_id: b.organization_id }))
          : []
      );
    } catch {
      setOrganizations([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [auth, crudUrl]);


  const setOrganizationId = useCallback(
    (id: string | null) => {
      const org = organizations.find((o) => o.id === id);
      const orgBranches = id ? branches.filter((b) => b.organization_id === id) : [];
      const keepBranch = id && branchId && orgBranches.some((b) => b.id === branchId);
      const newBranch = keepBranch ? orgBranches.find((b) => b.id === branchId)! : orgBranches[0];
      setOrganizationIdState(id);
      setOrganizationNameState(org?.name ?? null);
      setBranchIdState(newBranch?.id ?? null);
      setBranchNameState(newBranch?.name ?? null);
      persist({
        organizationId: id,
        branchId: newBranch?.id ?? null,
        organizationName: org?.name ?? null,
        branchName: newBranch?.name ?? null,
      });
    },
    [organizations, branches, branchId, persist]
  );

  const setBranchId = useCallback(
    (id: string | null) => {
      const branch = branches.find((b) => b.id === id);
      setBranchIdState(id);
      setBranchNameState(branch?.name ?? null);
      persist({
        organizationId,
        branchId: id,
        organizationName,
        branchName: branch?.name ?? null,
      });
    },
    [branches, organizationId, organizationName, persist]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      organizationId,
      branchId,
      organizationName,
      branchName,
      organizations,
      branches,
      loading,
      setOrganizationId,
      setBranchId,
      setWorkspace,
      refresh,
    }),
    [
      organizationId,
      branchId,
      organizationName,
      branchName,
      organizations,
      branches,
      loading,
      setOrganizationId,
      setBranchId,
      setWorkspace,
      refresh,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}


export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
