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
import type {
  Organization,
  PositionCategory,
  PositionSubcategory,
} from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell } from "./InlineNameCell";

export function PositionSubcategoriesEditor() {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrganizationId, setNewOrganizationId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [adding, setAdding] = useState(false);
  const [organizationFilterId, setOrganizationFilterId] = useState<string>("");
  const [categoryFilterId, setCategoryFilterId] = useState<string>("");

  const [categories, setCategories] = useState<PositionCategory[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

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
  } = useReferenceList<PositionSubcategory>({
    table: "position_subcategories",
    getSelectAllList: (sorted) =>
      sorted.filter((r) => {
        if (organizationFilterId && r.organization_id !== organizationFilterId)
          return false;
        if (categoryFilterId && r.category_id !== categoryFilterId) return false;
        return true;
      }),
  });

  const filteredList = sortedList.filter((r) => {
    if (organizationFilterId && r.organization_id !== organizationFilterId)
      return false;
    if (categoryFilterId && r.category_id !== categoryFilterId) return false;
    return true;
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await crudRef.current("organizations", "get");
      const arr = parseListResponse(data) as Organization[];
      setOrganizations(Array.isArray(arr) ? arr : []);
    } catch {
      setOrganizations([]);
    }
  }, [crudRef]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await crudRef.current("position_categories", "get");
      const arr = parseListResponse(data) as PositionCategory[];
      setCategories(Array.isArray(arr) ? arr : []);
    } catch {
      setCategories([]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchOrganizations();
    void fetchCategories();
  }, [fetchOrganizations, fetchCategories]);

  const orgMap = useCallback(() => {
    const m = new Map<string, string>();
    organizations.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [organizations])();

  const categoryMap = useCallback(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories])();

  const categoriesForFilter =
    organizationFilterId
      ? categories.filter((c) => c.organization_id === organizationFilterId)
      : categories;

  const categoriesForAdd =
    newOrganizationId
      ? categories.filter((c) => c.organization_id === newOrganizationId)
      : categories;

  const handleSaveName = async (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    await saveField(id, "name", name.trim());
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !newOrganizationId || !newCategoryId) return;
    const category = categories.find((c) => c.id === newCategoryId);
    if (!category || category.organization_id !== newOrganizationId) return;
    setAdding(true);
    try {
      await addItem({
        name,
        category_id: newCategoryId,
        organization_id: newOrganizationId,
      });
      setNewName("");
      setNewOrganizationId(organizations[0]?.id ?? "");
      setNewCategoryId("");
      setAddOpen(false);
      toast.success("Подкатегория добавлена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    if (addOpen && organizations.length > 0 && !newOrganizationId) {
      setNewOrganizationId(organizations[0].id);
    }
  }, [addOpen, organizations, newOrganizationId]);

  useEffect(() => {
    if (addOpen && newOrganizationId) {
      const firstInOrg = categories.find(
        (c) => c.organization_id === newOrganizationId
      );
      setNewCategoryId(firstInOrg?.id ?? "");
    } else if (addOpen && !newOrganizationId) {
      setNewCategoryId("");
    }
  }, [addOpen, newOrganizationId, categories]);

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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={categories.length === 0}
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
          value={organizationFilterId}
          onChange={(e) => setOrganizationFilterId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          title="Организация"
        >
          <option value="">Все организации</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilterId}
          onChange={(e) => setCategoryFilterId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          title="Категория"
        >
          <option value="">Все категории</option>
          {categoriesForFilter.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {categories.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Сначала добавьте категории в справочнике «Категории должностей»
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
            <TableHead className="w-12 text-right tabular-nums">№</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={toggleSort}
                className="hover:underline focus:outline-none focus:underline"
              >
                Наименование подкатегории {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead>Категория</TableHead>
            <TableHead>Организация</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredList.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleSelect(row.id)}
                  aria-label={`Выбрать ${row.name}`}
                />
              </TableCell>
              <TableCell className="w-12 text-right tabular-nums text-muted-foreground">
                {index + 1}
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Наименование подкатегории"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {categoryMap.get(row.category_id) ?? row.category_id}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.organization_id
                  ? orgMap.get(row.organization_id) ?? row.organization_id
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {list.length === 0
            ? "Нет записей. Сначала добавьте категории должностей, затем подкатегории."
            : "Нет записей по выбранной категории."}
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить подкатегорию должности</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Наименование подкатегории
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Главные специалисты"
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
                <option value="">Выберите организацию</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Категория
              </label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={!newOrganizationId}
              >
                <option value="">
                  {newOrganizationId ? "Выберите категорию" : "Сначала выберите организацию"}
                </option>
                {categoriesForAdd.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
              disabled={!newName.trim() || !newOrganizationId || !newCategoryId || adding}
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
