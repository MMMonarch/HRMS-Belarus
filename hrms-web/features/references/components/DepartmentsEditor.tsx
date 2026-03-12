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
import type { Branch, Department } from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell } from "./InlineNameCell";

export function DepartmentsEditor() {
  const [branchFilterId, setBranchFilterId] = useState<string>("");

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
  } = useReferenceList<Department>({
    table: "departments",
    getSelectAllList: branchFilterId
      ? (arr) => arr.filter((r) => r.branch_id === branchFilterId)
      : undefined,
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [adding, setAdding] = useState(false);

  const filteredList = branchFilterId
    ? sortedList.filter((r) => r.branch_id === branchFilterId)
    : sortedList;

  const fetchBranches = useCallback(async () => {
    try {
      const data = await crudRef.current("branches", "get");
      const arr = parseListResponse(data) as Branch[];
      setBranches(Array.isArray(arr) ? arr : []);
    } catch {
      setBranches([]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  const branchMap = useCallback(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [branches])();

  useEffect(() => {
    if (addOpen && branches.length > 0 && !newBranchId) {
      setNewBranchId(branches[0].id);
    }
  }, [addOpen, branches, newBranchId]);

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
      await addItem({ name, branch_id: newBranchId });
      setNewName("");
      setNewBranchId(branches[0]?.id ?? "");
      setAddOpen(false);
      toast.success("Подразделение добавлено");
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
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={branches.length === 0}
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
        {branches.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Сначала добавьте филиал в справочнике «Филиалы»
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
                  ariaLabel="Название подразделения"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {branchMap.get(row.branch_id) ?? row.branch_id}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {list.length === 0
            ? "Нет записей. Нажмите «Добавить», чтобы создать подразделение."
            : "Нет записей по выбранному филиалу."}
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить подразделение</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Название
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Отдел кадров"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Филиал
              </label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
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
              disabled={!newName.trim() || !newBranchId || adding}
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
