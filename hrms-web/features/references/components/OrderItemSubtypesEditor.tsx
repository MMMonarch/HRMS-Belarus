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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { parseListResponse } from "@/lib/n8n/client";
import type { OrderItemSubtype } from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell, InlineNumberCell } from "./InlineNameCell";

type OrderItemTypeRow = { id: string; number: number; name: string };

function normalizeRow(raw: Record<string, unknown>): OrderItemSubtype {
  return {
    id: String(raw.id ?? ""),
    order_item_type_id: String(raw.order_item_type_id ?? ""),
    code: String(raw.code ?? ""),
    name: String(raw.name ?? ""),
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : 0,
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
  };
}

export function OrderItemSubtypesEditor() {
  const {
    list,
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
  } = useReferenceList<OrderItemSubtype>({
    table: "order_item_subtypes",
    sortFn: (a, b) =>
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : (a.name ?? "").localeCompare(b.name ?? "", "ru"),
    getSelectAllList: (sortedList) =>
      typeFilterId
        ? sortedList.filter((r) => r.order_item_type_id === typeFilterId)
        : sortedList,
    normalize: (raw) => normalizeRow(raw as Record<string, unknown>),
  });

  const [types, setTypes] = useState<OrderItemTypeRow[]>([]);
  const [typeFilterId, setTypeFilterId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTypeId, setNewTypeId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [adding, setAdding] = useState(false);

  const filteredList = typeFilterId
    ? list.filter((r) => r.order_item_type_id === typeFilterId)
    : list;

  const sortedFilteredList = [...filteredList].sort((a, b) => {
    const cmp =
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : (a.name ?? "").localeCompare(b.name ?? "", "ru");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  const fetchTypes = useCallback(async () => {
    try {
      const data = await crudRef.current("order_item_types", "get");
      const arr = parseListResponse(data) as OrderItemTypeRow[];
      setTypes(Array.isArray(arr) ? arr : []);
    } catch {
      setTypes([]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    if (addOpen && types.length > 0 && !newTypeId) {
      setNewTypeId(types[0].id);
    }
  }, [addOpen, types, newTypeId]);

  const handleSaveCode = (id: string, code: string) => {
    const row = list.find((r) => r.id === id);
    const trimmed = code.trim().toLowerCase().replace(/\s+/g, "_");
    if (!row || trimmed === (row.code ?? "")) return;
    const sameType = list.filter(
      (r) => r.order_item_type_id === row.order_item_type_id
    );
    if (sameType.some((r) => r.id !== id && (r.code ?? "") === trimmed)) {
      toast.error("В рамках одного типа пункта приказа код должен быть уникальным.");
      return;
    }
    void saveField(id, "code", trimmed);
  };

  const handleSaveName = (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    void saveField(id, "name", name.trim());
  };

  const handleSaveSortOrder = (id: string, sortOrder: number) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.sort_order === sortOrder) return;
    void saveField(id, "sort_order", sortOrder);
  };

  const handleAdd = async () => {
    const typeId = newTypeId.trim();
    const code = newCode.trim().toLowerCase().replace(/\s+/g, "_");
    const name = newName.trim();
    const sortOrder = parseInt(newSortOrder.trim(), 10);
    if (!typeId || !code || !name) {
      toast.error("Укажите тип пункта приказа, код и наименование подтипа");
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error("Порядок должен быть целым числом ≥ 0");
      return;
    }
    const sameType = list.filter((r) => r.order_item_type_id === typeId);
    if (sameType.some((r) => (r.code ?? "") === code)) {
      toast.error("В рамках выбранного типа такой код уже есть.");
      return;
    }
    setAdding(true);
    try {
      await addItem({
        order_item_type_id: typeId,
        code,
        name,
        sort_order: sortOrder,
      });
      setNewTypeId(types[0]?.id ?? "");
      setNewCode("");
      setNewName("");
      setNewSortOrder("0");
      setAddOpen(false);
      toast.success("Подтип добавлен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
    }
  };

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
          disabled={types.length === 0}
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
          value={typeFilterId}
          onChange={(e) => setTypeFilterId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          title="Тип пункта приказа"
        >
          <option value="">Все типы</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {types.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Справочник типов пунктов приказа должен быть заполнен
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sortedFilteredList.length > 0 &&
                  selectedIds.size === sortedFilteredList.length
                }
                onCheckedChange={toggleSelectAll}
                aria-label="Выбрать все"
              />
            </TableHead>
            <TableHead>Тип пункта приказа</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={toggleSort}
                className="hover:underline focus:outline-none focus:underline"
              >
                Код {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead className="min-w-[200px]">Наименование</TableHead>
            <TableHead className="w-20">Порядок</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFilteredList.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleSelect(row.id)}
                  aria-label={`Выбрать ${row.name}`}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {typeMap.get(row.order_item_type_id) ?? row.order_item_type_id}
              </TableCell>
              <TableCell className="p-0 w-32">
                <InlineNameCell
                  value={row.code}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveCode(row.id, value)}
                  ariaLabel="Код подтипа"
                />
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Наименование подтипа"
                />
              </TableCell>
              <TableCell className="p-0 w-24">
                <InlineNumberCell
                  value={row.sort_order}
                  saving={savingId === row.id}
                  onBlur={(value) =>
                    handleSaveSortOrder(row.id, value ?? row.sort_order)
                  }
                  ariaLabel="Порядок"
                  min={0}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedFilteredList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {list.length === 0
            ? "Нет записей. Нажмите «Добавить», чтобы создать подтип пункта приказа."
            : "Нет записей по выбранному фильтру."}
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить подтип пункта приказа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип пункта приказа
              </label>
              <select
                value={newTypeId}
                onChange={(e) => setNewTypeId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Код (латиница, без пробелов)
              </label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="annual"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Наименование
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Трудовой отпуск"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Порядок
              </label>
              <Input
                type="number"
                min={0}
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              disabled={
                !newTypeId ||
                newCode.trim() === "" ||
                newName.trim() === "" ||
                adding
              }
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
