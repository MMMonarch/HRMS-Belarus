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
import type { Branch, Organization } from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell } from "./InlineNameCell";

export function BranchesEditor() {
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
  } = useReferenceList<Branch>({ table: "branches" });

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrganizationId, setNewOrganizationId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await crudRef.current("organizations", "get");
      const arr = parseListResponse(data) as Organization[];
      setOrganizations(Array.isArray(arr) ? arr : []);
    } catch {
      setOrganizations([]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  const orgMap = useCallback(() => {
    const m = new Map<string, string>();
    organizations.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [organizations])();

  useEffect(() => {
    if (addOpen && organizations.length > 0 && !newOrganizationId) {
      setNewOrganizationId(organizations[0].id);
    }
  }, [addOpen, organizations, newOrganizationId]);

  const handleSaveName = async (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    await saveField(id, "name", name.trim());
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !newOrganizationId) return;
    setAdding(true);
    try {
      await addItem({ name, organization_id: newOrganizationId });
      setNewName("");
      setNewOrganizationId(organizations[0]?.id ?? "");
      setAddOpen(false);
      toast.success("Филиал добавлен");
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
          disabled={organizations.length === 0}
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
        {organizations.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Сначала добавьте организацию в справочнике «Организации»
          </span>
        )}
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
                Название {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead>Организация</TableHead>
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
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Название филиала"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {orgMap.get(row.organization_id) ?? row.organization_id}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Нет записей. Нажмите «Добавить», чтобы создать филиал.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить филиал</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Название
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Головной офис"
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
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
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
              disabled={!newName.trim() || !newOrganizationId || adding}
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
