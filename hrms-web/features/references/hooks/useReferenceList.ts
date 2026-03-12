"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { parseListResponse } from "@/lib/n8n/client";
import { toast } from "sonner";

type SortDir = "asc" | "desc";

export type UseReferenceListOptions<T extends { id: string }> = {
  table: string;
  /** Sort comparator for the list. Default: compare by `name` field localeCompare("ru"). */
  sortFn?: (a: T, b: T) => number;
  /** When provided, toggleSelectAll uses this list instead of sortedList (e.g. for filtered views). */
  getSelectAllList?: (sortedList: T[]) => T[];
  /** Transform raw API rows to T. When provided, each row is passed through before storing. */
  normalize?: (raw: unknown) => T;
};

export function useReferenceList<T extends { id: string }>(
  options: UseReferenceListOptions<T>
) {
  const { table, sortFn, getSelectAllList, normalize } = options;
  const auth = useSupabaseAuthOptional();
  const crudRef = useCrudRef();
  const didInitialFetch = useRef(false);
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crudRef.current(table, "get");
      const arr = parseListResponse(data);
      const items = Array.isArray(arr)
        ? arr.map((r) => (normalize ? normalize(r) : (r as T)))
        : [];
      setList(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [table, normalize]);

  useEffect(() => {
    if (!auth?.session) return;
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    void fetchList();
  }, [auth?.session, fetchList]);

  const defaultSort = (a: T, b: T) => {
    const aVal = (a as Record<string, unknown>).name as string ?? "";
    const bVal = (b as Record<string, unknown>).name as string ?? "";
    return aVal.localeCompare(bVal, "ru");
  };

  const sortedList = (() => {
    const arr = [...list];
    const cmpFn = sortFn ?? defaultSort;
    arr.sort((a, b) => {
      const cmp = cmpFn(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  })();

  const toggleSort = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const listToUse = getSelectAllList ? getSelectAllList(sortedList) : sortedList;
    if (selectedIds.size === listToUse.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(listToUse.map((r) => r.id)));
  };

  const saveField = async (id: string, field: string, value: unknown) => {
    setSavingId(id);
    try {
      await crudRef.current(table, "update", { [field]: value }, id);
      await fetchList();
      toast.success("Сохранено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingId(null);
    }
  };

  const addItem = async (payload: Record<string, unknown>) => {
    await crudRef.current(table, "create", payload);
    await fetchList();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await crudRef.current(table, "delete", undefined, id);
      }
      setSelectedIds(new Set());
      await fetchList();
      toast.success("Записи удалены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  return {
    list,
    sortedList,
    loading,
    error,
    selectedIds,
    sortDir,
    savingId,
    deleting,
    fetchList,
    toggleSort,
    toggleSelect,
    toggleSelectAll,
    saveField,
    addItem,
    deleteSelected,
    crudRef,
  };
}
