"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseListResponse } from "@/lib/n8n/client";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Branch, Organization, Position, PositionSubcategory } from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell } from "./InlineNameCell";

export function PositionsEditor() {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrganizationId, setNewOrganizationId] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [newSubcategoryId, setNewSubcategoryId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [branchFilterId, setBranchFilterId] = useState<string>("");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subcategories, setSubcategories] = useState<PositionSubcategory[]>([]);

  const {
    list,
    sortedList,
    loading,
    error,
    selectedIds,
    sortDir,
    savingId,
    deleting,
    toggleSort,
    toggleSelect,
    toggleSelectAll,
    saveField,
    addItem,
    deleteSelected,
    crudRef,
  } = useReferenceList<Position>({
    table: "positions",
    getSelectAllList: (sorted) =>
      branchFilterId ? sorted.filter((r) => r.branch_id === branchFilterId) : sorted,
  });

  const filteredList = branchFilterId
    ? sortedList.filter((r) => r.branch_id === branchFilterId)
    : sortedList;

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await crudRef.current("organizations", "get");
      const arr = parseListResponse(data) as Organization[];
      setOrganizations(Array.isArray(arr) ? arr : []);
    } catch {
      setOrganizations([]);
    }
  }, [crudRef]);

  const fetchBranches = useCallback(async () => {
    try {
      const data = await crudRef.current("branches", "get");
      const arr = parseListResponse(data) as Branch[];
      setBranches(Array.isArray(arr) ? arr : []);
    } catch {
      setBranches([]);
    }
  }, [crudRef]);

  const fetchSubcategories = useCallback(async () => {
    try {
      const data = await crudRef.current("position_subcategories", "get");
      const arr = parseListResponse(data) as PositionSubcategory[];
      setSubcategories(Array.isArray(arr) ? arr : []);
    } catch {
      setSubcategories([]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchOrganizations();
    void fetchBranches();
    void fetchSubcategories();
  }, [fetchOrganizations, fetchBranches, fetchSubcategories]);

  const branchMap = useCallback(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [branches])();

  const subcategoryMap = useCallback(() => {
    const m = new Map<string, string>();
    subcategories.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [subcategories])();

  const getBranchOrganizationId = (branchId: string) =>
    branches.find((b) => b.id === branchId)?.organization_id;

  const subcategoriesForBranch = (branchId: string) =>
    branchId
      ? subcategories.filter(
          (s) => s.organization_id === getBranchOrganizationId(branchId)
        )
      : [];

  const branchesForAddOrg = newOrganizationId
    ? branches.filter((b) => b.organization_id === newOrganizationId)
    : [];

  const subcategoriesForAdd = newBranchId
    ? subcategoriesForBranch(newBranchId)
    : [];

  const handleSaveName = async (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    await saveField(id, "name", name.trim());
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !newBranchId) return;
    setAdding(true);
    try {
      const payload: { name: string; branch_id: string; position_subcategory_id?: string } = {
        name,
        branch_id: newBranchId,
      };
      if (newSubcategoryId) payload.position_subcategory_id = newSubcategoryId;
      await addItem(payload);
      setNewName("");
      const nextBranches = branches.filter((b) => b.organization_id === newOrganizationId);
      setNewBranchId(nextBranches[0]?.id ?? "");
      setNewSubcategoryId("");
      setAddOpen(false);
      toast.success("Должность добавлена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveSubcategory = async (
    id: string,
    position_subcategory_id: string | null
  ) => {
    const row = list.find((r) => r.id === id);
    if (!row) return;
    const value = position_subcategory_id || undefined;
    if ((row.position_subcategory_id ?? null) === (value ?? null)) return;
    await saveField(id, "position_subcategory_id", value);
  };

  useEffect(() => {
    if (addOpen && organizations.length > 0 && !newOrganizationId) {
      setNewOrganizationId(organizations[0].id);
    }
  }, [addOpen, organizations, newOrganizationId]);

  useEffect(() => {
    if (addOpen && newOrganizationId) {
      const forOrg = branches.filter((b) => b.organization_id === newOrganizationId);
      const validBranch = forOrg.some((b) => b.id === newBranchId);
      setNewBranchId(validBranch ? newBranchId : forOrg[0]?.id ?? "");
    } else if (addOpen && !newOrganizationId) {
      setNewBranchId("");
    }
  }, [addOpen, newOrganizationId, branches, newBranchId]);

  useEffect(() => {
    if (addOpen && newBranchId) {
      const first = subcategoriesForBranch(newBranchId)[0];
      setNewSubcategoryId(first?.id ?? "");
    } else if (addOpen && !newBranchId) {
      setNewSubcategoryId("");
    }
  }, [addOpen, newBranchId, subcategories]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={organizations.length === 0 || branches.length === 0}
        >
          <Plus className="size-4 mr-2" />
          Добавить
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selectedIds.size === 0 || deleting}
          onClick={deleteSelected}
        >
          <Trash2 className="size-4 mr-2" />
          Удалить
        </Button>
        <select
          value={branchFilterId}
          onChange={(e) => setBranchFilterId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          title="Филиал"
        >
          <option value="">Все филиалы</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {(organizations.length === 0 || branches.length === 0) && (
          <span className="text-xs text-muted-foreground">
            Сначала добавьте организацию и филиал в справочниках
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  filteredList.length > 0 && selectedIds.size === filteredList.length
                }
                onCheckedChange={toggleSelectAll}
                aria-label="Выбрать все"
              />
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={toggleSort}
                className="hover:underline focus:outline-none focus:underline"
              >
                Название {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead>Филиал</TableHead>
            <TableHead className="min-w-[220px] w-[280px]">Подкатегория</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredList.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleSelect(row.id)}
                  aria-label={`Выбрать ${row.name}`}
                />
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Название должности"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {branchMap.get(row.branch_id) ?? row.branch_id}
              </TableCell>
              <TableCell className="p-0">
                <SubcategoryCell
                  position={row}
                  subcategories={subcategoriesForBranch(row.branch_id)}
                  subcategoryMap={subcategoryMap}
                  saving={savingId === row.id}
                  onSave={handleSaveSubcategory}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {list.length === 0
            ? "Нет записей. Нажмите «Добавить», чтобы создать должность."
            : "Нет записей по выбранному филиалу."}
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить должность</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Название
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Инженер"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Организация
              </label>
              <select
                value={newOrganizationId}
                onChange={(e) => setNewOrganizationId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {organizations.length === 0 ? "Нет организаций" : "Выберите организацию"}
                </option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Филиал
              </label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={!newOrganizationId}
              >
                <option value="">
                  {newOrganizationId
                    ? (branchesForAddOrg.length === 0
                        ? "Нет филиалов в организации"
                        : "Выберите филиал")
                    : "Сначала выберите организацию"}
                </option>
                {branchesForAddOrg.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Подкатегория
              </label>
              <select
                value={newSubcategoryId}
                onChange={(e) => setNewSubcategoryId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={!newBranchId}
              >
                <option value="">
                  {newBranchId ? "Не выбрана" : "Сначала выберите филиал"}
                </option>
                {subcategoriesForAdd.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              disabled={!newName.trim() || !newOrganizationId || !newBranchId || adding}
              onClick={handleAdd}
            >
              {adding ? "Добавление…" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubcategoryCell({
  position,
  subcategories,
  subcategoryMap,
  saving,
  onSave,
}: {
  position: Position;
  subcategories: PositionSubcategory[];
  subcategoryMap: Map<string, string>;
  saving: boolean;
  onSave: (id: string, position_subcategory_id: string | null) => void;
}) {
  const current = position.position_subcategory_id ?? "";
  const [local, setLocal] = useState(current);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setLocal(current);
  }, [current]);

  const handleBlur = () => {
    setFocused(false);
    const value = local || null;
    if (value !== (position.position_subcategory_id ?? null)) {
      onSave(position.id, value);
    }
  };

  return (
    <select
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      disabled={saving}
      className={
        "h-8 w-full min-w-0 max-w-[260px] rounded-md border bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring " +
        (focused
          ? "border-ring"
          : "border-transparent bg-transparent shadow-none")
      }
      aria-label="Подкатегория должности"
    >
      <option value="">—</option>
      {subcategories.map((s) => (
        <option key={s.id} value={s.id}>
          {subcategoryMap.get(s.id) ?? s.name}
        </option>
      ))}
    </select>
  );
}
