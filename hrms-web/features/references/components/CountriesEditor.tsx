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

type CountryRow = {
  id: string;
  alpha2: string;
  name: string;
  alpha3: string | null;
  numeric3: number | null;
  sort_order: number;
};

export function CountriesEditor() {
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
  } = useReferenceList<CountryRow>({
    table: "countries",
    sortFn: (a, b) => a.sort_order - b.sort_order,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newAlpha2, setNewAlpha2] = useState("");
  const [newName, setNewName] = useState("");
  const [newAlpha3, setNewAlpha3] = useState("");
  const [newNumeric3, setNewNumeric3] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSaveAlpha2 = async (id: string, alpha2: string) => {
    const row = list.find((r) => r.id === id);
    const val = alpha2.trim().toUpperCase();
    if (!row || row.alpha2 === val) return;
    if (val.length !== 2) {
      toast.error("Код alpha-2 должен быть ровно 2 символа (ISO 3166-1)");
      return;
    }
    const duplicate = list.some((r) => r.id !== id && r.alpha2 === val);
    if (duplicate) {
      toast.error("Такой код alpha-2 уже используется.");
      return;
    }
    await saveField(id, "alpha2", val);
  };

  const handleSaveName = async (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    await saveField(id, "name", name.trim());
  };

  const handleSaveAlpha3 = async (id: string, alpha3: string) => {
    const row = list.find((r) => r.id === id);
    const val = alpha3.trim().toUpperCase() || null;
    if (!row || (row.alpha3 ?? "") === (val ?? "")) return;
    if (val && val.length !== 3) {
      toast.error("Код alpha-3 должен быть 3 символа (ISO 3166-1)");
      return;
    }
    const duplicate = val && list.some((r) => r.id !== id && (r.alpha3 ?? "") === val);
    if (duplicate) {
      toast.error("Такой код alpha-3 уже используется.");
      return;
    }
    await saveField(id, "alpha3", val);
  };

  const handleSaveNumeric3 = async (id: string, numeric3: number | null) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.numeric3 === numeric3) return;
    await saveField(id, "numeric3", numeric3);
  };

  const handleSaveSortOrder = async (id: string, sort_order: number) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.sort_order === sort_order) return;
    await saveField(id, "sort_order", sort_order);
  };

  const handleAdd = async () => {
    const alpha2 = newAlpha2.trim().toUpperCase();
    const name = newName.trim();
    const alpha3 = newAlpha3.trim().toUpperCase() || null;
    const num = newNumeric3.trim() === "" ? null : parseInt(newNumeric3.trim(), 10);
    const numeric3 = num !== null && Number.isInteger(num) && num >= 0 ? num : null;
    const sortOrder =
      newSortOrder.trim() === "" ? 0 : parseInt(newSortOrder.trim(), 10);
    const order = Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0;

    if (!alpha2 || alpha2.length !== 2) {
      toast.error("Укажите двухбуквенный код страны (ISO 3166-1 alpha-2)");
      return;
    }
    if (!name) {
      toast.error("Укажите наименование страны");
      return;
    }
    if (alpha3 && alpha3.length !== 3) {
      toast.error("Код alpha-3 должен быть 3 символа");
      return;
    }
    if (list.some((r) => r.alpha2 === alpha2)) {
      toast.error("Такой код alpha-2 уже используется.");
      return;
    }

    setAdding(true);
    try {
      await addItem({
        alpha2,
        name,
        alpha3: alpha3 || undefined,
        numeric3: numeric3 ?? undefined,
        sort_order: order,
      });
      setNewAlpha2("");
      setNewName("");
      setNewAlpha3("");
      setNewNumeric3("");
      setNewSortOrder("");
      setAddOpen(false);
      toast.success("Государство добавлено");
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
            <TableHead className="min-w-[60px]">Alpha-2</TableHead>
            <TableHead className="min-w-[160px]">Наименование</TableHead>
            <TableHead className="min-w-[70px]">Alpha-3</TableHead>
            <TableHead className="w-24">Числ.</TableHead>
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
              <TableCell className="p-0 min-w-[60px]">
                <InlineNameCell
                  value={row.alpha2}
                  saving={savingId === row.id}
                  onBlur={(v) => handleSaveAlpha2(row.id, v)}
                  ariaLabel="Alpha-2"
                  maxLength={2}
                />
              </TableCell>
              <TableCell className="p-0 min-w-[160px]">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(v) => handleSaveName(row.id, v)}
                  ariaLabel="Наименование"
                />
              </TableCell>
              <TableCell className="p-0 min-w-[70px]">
                <InlineNameCell
                  value={row.alpha3 ?? ""}
                  saving={savingId === row.id}
                  onBlur={(v) => handleSaveAlpha3(row.id, v)}
                  ariaLabel="Alpha-3"
                  maxLength={3}
                />
              </TableCell>
              <TableCell className="p-0 w-24">
                <InlineNumberCell
                  value={row.numeric3}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveNumeric3(row.id, value)}
                  ariaLabel="Числовой код"
                  nullable={true}
                  max={999}
                  placeholder="—"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Нет записей. Нажмите «Добавить», чтобы добавить государство.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить государство</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Код alpha-2 (ISO 3166-1, 2 буквы)
              </label>
              <Input
                value={newAlpha2}
                onChange={(e) => setNewAlpha2(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="BY"
                maxLength={2}
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
                placeholder="Беларусь"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Код alpha-3 (опц., 3 буквы)
              </label>
              <Input
                value={newAlpha3}
                onChange={(e) => setNewAlpha3(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="BLR"
                maxLength={3}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Числовой код (опц., 3 цифры)
              </label>
              <Input
                type="number"
                min={0}
                max={999}
                value={newNumeric3}
                onChange={(e) => setNewNumeric3(e.target.value)}
                placeholder="112"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Порядок вывода
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
              disabled={newAlpha2.trim().length !== 2 || !newName.trim() || adding}
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
