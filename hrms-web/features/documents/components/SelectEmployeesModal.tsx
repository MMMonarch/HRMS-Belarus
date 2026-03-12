"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export type EmployeeOption = {
  id: string;
  fullName: string;
  /** Филиал (для фильтра «только сотрудники/кандидаты филиала») */
  branchId?: string;
  /** Кандидат (true) или сотрудник (false). По умолчанию — сотрудник. */
  isCandidate?: boolean;
  /** Статус занятости: active = уже сотрудник, terminated = уволен, null = никогда не был (кандидат). Для приказа о приёме показываем только не-active. */
  employmentStatus?: "active" | "terminated" | null;
};

const MOCK_EMPLOYEES: EmployeeOption[] = [
  { id: "e1", fullName: "Сидоров Антон Артемьевич", branchId: "b1", isCandidate: false },
  { id: "e2", fullName: "Ципляков Владимир Александрович", branchId: "b1", isCandidate: false },
  { id: "e3", fullName: "Иванов Иван Иванович", branchId: "b1", isCandidate: false },
  { id: "e4", fullName: "Петров Пётр Петрович", branchId: "b1", isCandidate: false },
  { id: "e5", fullName: "Сидорова Мария Михайловна", branchId: "b1", isCandidate: true },
  { id: "e6", fullName: "Козлова Елена Сергеевна", branchId: "b1", isCandidate: true },
  { id: "e7", fullName: "Новиков Алексей Викторович", branchId: "b1", isCandidate: true },
];

type SelectEmployeesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (employees: EmployeeOption[]) => void;
  /** Филиал приказа: по умолчанию показываются только сотрудники этого филиала. */
  branchId?: string | null;
  employees?: EmployeeOption[];
};

export function SelectEmployeesModal({
  open,
  onOpenChange,
  onConfirm,
  branchId,
  employees = MOCK_EMPLOYEES,
}: SelectEmployeesModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [onlyCandidatesOfBranch, setOnlyCandidatesOfBranch] = useState(false);
  const [onlyDismissed, setOnlyDismissed] = useState(false);

  const byBranchAndRole = useMemo(() => {
    let list = employees;
    if (branchId) {
      list = list.filter((e) => e.branchId === branchId);
    }
    if (onlyCandidatesOfBranch) {
      list = list.filter((e) => e.isCandidate === true && e.employmentStatus !== "terminated");
    } else if (onlyDismissed) {
      list = list.filter((e) => e.employmentStatus === "terminated");
    } else {
      list = list.filter((e) => e.isCandidate !== true);
    }
    return list;
  }, [employees, branchId, onlyCandidatesOfBranch, onlyDismissed]);

  const filtered = useMemo(() => {
    if (!search.trim()) return byBranchAndRole;
    const q = search.trim().toLowerCase();
    return byBranchAndRole.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [byBranchAndRole, search]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((e) => e.id)));
    else setSelectedIds(new Set());
  };

  const handleAdd = () => {
    const selected = byBranchAndRole.filter((e) => selectedIds.has(e.id));
    onConfirm(selected);
    setSelectedIds(new Set());
    setSearch("");
    onOpenChange(false);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="text-base">
              Выберите сотрудника(ов)
            </DialogTitle>
            <div className="flex flex-1 items-center gap-2 sm:max-w-xs">
              <Input
                placeholder="Поиск по ФИО"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
              <Button size="sm" onClick={handleAdd} disabled={selectedIds.size === 0}>
                <Plus className="size-4 mr-1" />
                Добавить
              </Button>
            </div>
          </div>
        </DialogHeader>
        {branchId && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-candidates"
                checked={onlyCandidatesOfBranch}
                onCheckedChange={(v) => {
                  setOnlyCandidatesOfBranch(!!v);
                  if (v) setOnlyDismissed(false);
                }}
              />
              <label
                htmlFor="only-candidates"
                className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Показать только кандидатов филиала
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-dismissed"
                checked={onlyDismissed}
                onCheckedChange={(v) => {
                  setOnlyDismissed(!!v);
                  if (v) setOnlyCandidatesOfBranch(false);
                }}
              />
              <label
                htmlFor="only-dismissed"
                className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Показать только уволенных
              </label>
            </div>
          </div>
        )}
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(v) => handleToggleAll(!!v)}
                    aria-label="Выбрать всех"
                  />
                </TableHead>
                <TableHead>ФИО</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-20 text-center text-muted-foreground text-sm">
                    Нет сотрудников
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className={cn(
                      "cursor-pointer",
                      selectedIds.has(emp.id) && "bg-muted/50"
                    )}
                    onClick={() => handleToggle(emp.id)}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(emp.id)}
                        onCheckedChange={() => handleToggle(emp.id)}
                        aria-label={emp.fullName}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{emp.fullName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
