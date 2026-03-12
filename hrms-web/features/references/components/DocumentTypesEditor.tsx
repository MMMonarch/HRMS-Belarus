"use client";

import { useState } from "react";
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
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell, InlineNumberCell } from "./InlineNameCell";

type DocumentTypeRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export function DocumentTypesEditor() {
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
  } = useReferenceList<DocumentTypeRow>({
    table: "document_types",
    sortFn: (a, b) => a.sort_order - b.sort_order,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSaveCode = async (id: string, code: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.code === code.trim()) return;
    const duplicate = list.some((r) => r.id !== id && r.code === code.trim());
    if (duplicate) {
      toast.error("Такой код уже используется. Код должен быть уникальным.");
      return;
    }
    await saveField(id, "code", code.trim());
  };

  const handleSaveName = async (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    await saveField(id, "name", name.trim());
  };

  const handleSaveSortOrder = async (id: string, sort_order: number) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.sort_order === sort_order) return;
    await saveField(id, "sort_order", sort_order);
  };

  const handleAdd = async () => {
    const code = newCode.trim();
    const name = newName.trim();
    const sortOrder =
      newSortOrder.trim() === ""
        ? NaN
        : parseInt(newSortOrder.trim(), 10);
    if (!code || !name) {
      toast.error("Укажите код и наименование");
      return;
    }
    if (list.some((r) => r.code === code)) {
      toast.error("Такой код уже используется. Код должен быть уникальным.");
      return;
    }
    const order = Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0;
    setAdding(true);
    try {
      await addItem({
        code,
        name,
        sort_order: order,
      });
      setNewCode("");
      setNewName("");
      setNewSortOrder("");
      setAddOpen(false);
      toast.success("Тип документа добавлен");
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
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sortedList.length > 0 && selectedIds.size === sortedList.length
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
                Порядок {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead className="min-w-[140px]">Код</TableHead>
            <TableHead className="min-w-[200px]">Наименование</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedList.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleSelect(row.id)}
                  aria-label={`Выбрать ${row.name}`}
                />
              </TableCell>
              <TableCell className="p-0 w-20">
                <InlineNumberCell
                  value={row.sort_order}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveSortOrder(row.id, value ?? 0)}
                  ariaLabel="Порядок"
                  min={0}
                />
              </TableCell>
              <TableCell className="p-0 min-w-[140px]">
                <InlineNameCell
                  value={row.code}
                  saving={savingId === row.id}
                  onBlur={(v) => handleSaveCode(row.id, v)}
                  ariaLabel="Код"
                />
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(v) => handleSaveName(row.id, v)}
                  ariaLabel="Наименование"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Нет записей. Нажмите «Добавить», чтобы создать тип документа.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить тип документа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Код (латиница)
              </label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="passport_by"
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
                placeholder="Паспорт гражданина Республики Беларусь"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Порядок вывода (число)
              </label>
              <Input
                type="number"
                min={0}
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                placeholder="0"
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
              disabled={!newCode.trim() || !newName.trim() || adding}
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
