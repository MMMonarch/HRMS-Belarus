"use client";

import { useCallback, useEffect, useState } from "react";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { parseListResponse, nextBirthdaySortKey, birthdayWhenLabel, daysUntil } from "../utils";
import type { DashboardBirthdayRow, DashboardExpiringDocRow, DashboardAssignmentRow } from "../types";

const TODAY = new Date();

type EmploymentRow = { id: string; person_id?: string; branch_id?: string; status?: string };
type PersonRow = {
  id: string;
  last_name?: string | null;
  first_name?: string | null;
  patronymic?: string | null;
  birth_date?: string | null;
};
type ContractRow = {
  id: string;
  person_id?: string;
  contract_type?: string;
  valid_to?: string | null;
};
type OrderItemRow = {
  id: string;
  order_id?: string;
  person_id?: string;
  item_type_number?: number;
  effective_from?: string | null;
  applied_at?: string | null;
  applied_by?: string | null;
  created_by?: string | null;
  state?: string;
};
type OrderRow = { id: string; reg_number?: string | null; order_date?: string | null };
type ProfileRow = { id: string; full_name?: string | null };

function fullName(p: PersonRow): string {
  return [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(" ") || p.id;
}

function contractTypeLabel(t: string | undefined): string {
  if (t === "contract") return "Контракт";
  if (t === "employment_contract") return "Трудовой договор";
  return t || "—";
}

export function useDashboardData() {
  const crudRef = useCrudRef();
  const auth = useSupabaseAuthOptional();
  const workspace = useWorkspaceOptional();
  const branchId = workspace?.branchId ?? null;

  const [birthdays, setBirthdays] = useState<DashboardBirthdayRow[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<DashboardExpiringDocRow[]>([]);
  const [assignments, setAssignments] = useState<DashboardAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!auth?.session || !branchId || !crudRef.current) {
      setBirthdays([]);
      setExpiringDocs([]);
      setAssignments([]);
      setLoading(false);
      return;
    }
    const crud = crudRef.current;
    setLoading(true);
    setError(null);
    try {
      // Залп 1: параллельно загружаем employments, contracts, order_items (не зависят друг от друга)
      const [empData, contractsData, itemsData] = await Promise.all([
        crud("employments", "get"),
        crud("contracts", "get"),
        crud("order_items", "get"),
      ]);

      const empList = parseListResponse(empData) as EmploymentRow[];
      const contractsList = parseListResponse(contractsData) as ContractRow[];
      const itemsList = parseListResponse(itemsData) as OrderItemRow[];

      const activePersonIds = [...new Set(empList.filter((e) => e.status === "active").map((e) => e.person_id).filter(Boolean))] as string[];
      const withValidTo = contractsList.filter((c) => c.valid_to);
      const expiringPersonIds = [...new Set(withValidTo.map((c) => c.person_id).filter(Boolean))] as string[];

      const hireOrTransfer = itemsList.filter(
        (i) => (i.item_type_number === 1 || i.item_type_number === 2) && i.state === "applied"
      );
      const byEffective = [...hireOrTransfer].sort((a, b) => (b.effective_from ?? "").localeCompare(a.effective_from ?? ""));
      const recent = byEffective.slice(0, 25);
      const orderIds = [...new Set(recent.map((i) => i.order_id).filter(Boolean))] as string[];
      const assignmentPersonIds = [...new Set(recent.map((i) => i.person_id).filter(Boolean))] as string[];
      const appliedByIds = [...new Set(recent.map((i) => i.applied_by).filter(Boolean))] as string[];
      const createdByIds = [...new Set(recent.map((i) => i.created_by).filter(Boolean))] as string[];
      const profileIds = [...new Set([...appliedByIds, ...createdByIds])];

      // Все нужные person_id одним множеством — один запрос persons вместо трёх
      const allPersonIds = [...new Set([...activePersonIds, ...expiringPersonIds, ...assignmentPersonIds])];

      // Залп 2: параллельно persons (один раз), orders, profiles (создал + применил)
      const personsPromise = allPersonIds.length > 0 ? crud("persons", "get", { id: allPersonIds }) : Promise.resolve([]);
      const ordersPromise = orderIds.length > 0 ? crud("orders", "get", { id: orderIds }) : Promise.resolve([]);
      const profilesPromise = profileIds.length > 0 ? crud("profiles", "get", { id: profileIds }) : Promise.resolve([]);

      const [personsData, ordersData, profilesData] = await Promise.all([personsPromise, ordersPromise, profilesPromise]);

      const personsList = parseListResponse(personsData) as PersonRow[];
      const personsMap = new Map<string, PersonRow>();
      personsList.forEach((p) => personsMap.set(p.id, p));

      const ordersList = parseListResponse(ordersData) as OrderRow[];
      const ordersMap = new Map<string, OrderRow>();
      ordersList.forEach((o) => ordersMap.set(o.id, o));

      const profilesList = parseListResponse(profilesData) as ProfileRow[];
      const profilesMap = new Map<string, ProfileRow>();
      profilesList.forEach((pr) => profilesMap.set(pr.id, pr));

      // Собираем результаты из общих данных

      const withBirth = personsList.filter((p) => p.birth_date && activePersonIds.includes(p.id));
      const birthdayRows: DashboardBirthdayRow[] = withBirth.map((p) => ({
        personId: p.id,
        fullName: fullName(p),
        birthDate: p.birth_date!,
        whenLabel: birthdayWhenLabel(p.birth_date!, TODAY),
        sortKey: nextBirthdaySortKey(p.birth_date!, TODAY),
      }));
      birthdayRows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      setBirthdays(birthdayRows.slice(0, 15));

      const expiringRows: DashboardExpiringDocRow[] = withValidTo.map((c) => ({
        personId: c.person_id ?? "",
        fullName: fullName(personsMap.get(c.person_id ?? "") ?? { id: c.person_id ?? "" }),
        docKind: contractTypeLabel(c.contract_type),
        validTo: c.valid_to!,
        daysLeft: daysUntil(c.valid_to!, new Date()),
      }));
      expiringRows.sort((a, b) => a.daysLeft - b.daysLeft);
      setExpiringDocs(expiringRows.slice(0, 20));

      const assignmentRows: DashboardAssignmentRow[] = recent.map((i) => ({
        id: i.id,
        effectiveFrom: i.effective_from ?? "",
        personId: i.person_id ?? "",
        personName: fullName(personsMap.get(i.person_id ?? "") ?? { id: i.person_id ?? "" }),
        itemTypeNumber: i.item_type_number ?? 0,
        typeLabel: i.item_type_number === 1 ? "Приём" : i.item_type_number === 2 ? "Перевод" : "—",
        orderRegNumber: ordersMap.get(i.order_id ?? "")?.reg_number ?? null,
        orderDate: ordersMap.get(i.order_id ?? "")?.order_date ?? null,
        createdBy: i.created_by ? profilesMap.get(i.created_by)?.full_name ?? null : null,
        appliedBy: i.applied_by ? profilesMap.get(i.applied_by)?.full_name ?? null : null,
      }));
      setAssignments(assignmentRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки дашборда");
      setBirthdays([]);
      setExpiringDocs([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.session, branchId, crudRef]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { birthdays, expiringDocs, assignments, loading, error, refetch: fetch };
}
