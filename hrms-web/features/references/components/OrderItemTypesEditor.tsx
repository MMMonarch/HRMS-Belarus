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

type OrderItemTypeRow = {
  id: string;
  number: number;
  name: string;
};

export function OrderItemTypesEditor() {
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
  } = useReferenceList<OrderItemTypeRow>({
    table: "order_item_types",
    sortFn: (a, b) => a.number - b.number,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSaveNumber = (id: string, number: number) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.number === number) return;
    const duplicate = list.some((r) => r.id !== id && r.number === number);
    if (duplicate) {
      toast.error("Такой номер уже используется. Номер типа должен быть уникальным.");
      return;
    }
    void saveField(id, "number", number);
  };

  const handleSaveName = (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    void saveField(id, "name", name.trim());
  };

  const handleAdd = async () => {
    const num = newNumber.trim() === "" ? NaN : parseInt(newNumber.trim(), 10);
    const name = newName.trim();
    if (!Number.isInteger(num) || num < 1 || !name) {
      toast.error("Укажите целое число (номер, 1 и более) и наименование типа");
      return;
    }
    if (list.some((r) => r.number === num)) {
      toast.error("Такой номер уже используется. Номер типа должен быть уникальным.");
      return;
    }
    setAdding(true);
    try {
      await addItem({ number: num, name });
      setNewNumber("");
      setNewName("");
      setAddOpen(false);
      toast.success("Тип пункта приказа добавлен");
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
                Номер {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
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
              <TableCell className="p-0 w-24">
                <InlineNumberCell
                  value={row.number}
                  min={1}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveNumber(row.id, value ?? row.number)}
                  ariaLabel="Номер типа"
                />
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Наименование типа пункта приказа"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Нет записей. Нажмите «Добавить», чтобы создать тип пункта приказа.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить тип пункта приказа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Номер
              </label>
              <Input
                type="number"
                min={1}
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="1"
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
                placeholder="Напр. Приём"
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
                newName.trim() === "" ||
                !/^\d+$/.test(newNumber.trim()) ||
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
