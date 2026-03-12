"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UserPlus, RefreshCw } from "lucide-react";
import type { EmployeeListItem } from "@/features/employees/types";
import { AddCandidateModal, type AddCandidateFormData } from "./AddCandidateModal";

const STATUS_OPTIONS = [
  { value: "candidates", label: "кандидаты" },
  { value: "active", label: "не уволенные (только сотрудники)" },
  { value: "all", label: "абсолютно все" },
  { value: "dismissed", label: "уволенные" },
];

// Сортировка по фамилии
const SORT_BY_NAME_OPTIONS = [
  { value: "az", label: "Фамилия А-Я" },
  { value: "za", label: "Фамилия Я-А" },
];

export type StatusFilterValue = "candidates" | "active" | "all" | "dismissed";

export type BranchOption = { id: string; name: string };

type DepartmentOption = { id: string; name: string };

type EmployeeListSidebarProps = {
  employees: EmployeeListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  totalCount?: number;
  statusFilter?: StatusFilterValue;
  onStatusFilterChange?: (value: StatusFilterValue) => void;
  /** Подразделения текущего филиала (только они показываются в фильтре) */
  departmentOptions?: DepartmentOption[];
  departmentFilterId?: string;
  onDepartmentFilterChange?: (departmentId: string) => void;
  onAddCandidate?: (data: AddCandidateFormData) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
};

export function EmployeeListSidebar({
  employees,
  selectedId,
  onSelect,
  totalCount = 0,
  statusFilter = "active",
  onStatusFilterChange,
  departmentOptions = [],
  departmentFilterId = "",
  onDepartmentFilterChange,
  onAddCandidate,
  onRefresh,
  loading = false,
  error = null,
  className,
}: EmployeeListSidebarProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sortByName, setSortByName] = useState<"az" | "za">("az");

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    list.sort((a, b) => {
      const cmp = (a.shortName ?? "").localeCompare(b.shortName ?? "", "ru");
      return sortByName === "az" ? cmp : -cmp;
    });
    return list;
  }, [employees, sortByName]);

  return (
    <>
      <AddCandidateModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={(data) => {
          onAddCandidate?.(data);
          setAddModalOpen(false);
        }}
      />
    <aside
      className={cn(
        "flex w-80 shrink-0 flex-col border-r border-border bg-card",
        className
      )}
    >
      {/* Кнопки: добавить кандидата + обновить */}
      <div className="border-b border-border p-3 flex gap-2">
        <Button className="flex-1" size="sm" onClick={() => setAddModalOpen(true)}>
          <UserPlus className="size-4 mr-2" />
          Добавить кандидата
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          title="Обновить список"
          className="shrink-0"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>
      {error && (
        <div className="border-b border-border px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Блок с фильтром по сотрудникам (филиал задаётся при входе в шапке) */}
      <div className="space-y-2 border-b border-border p-3">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange?.(e.target.value as StatusFilterValue)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={sortByName}
          onChange={(e) => setSortByName(e.target.value as "az" | "za")}
          title="Сортировка по фамилии"
        >
          {SORT_BY_NAME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={departmentFilterId}
          onChange={(e) => onDepartmentFilterChange?.(e.target.value)}
          title="Подразделение"
        >
          <option value="">Все подразделения</option>
          {departmentOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Таблица сотрудников */}
      <div className="flex-1 overflow-y-auto p-2">
        <Table>
          <TableBody>
            {sortedEmployees.map((emp) => (
              <TableRow
                key={emp.id}
                data-state={selectedId === emp.id ? "selected" : undefined}
                className={cn(
                  "cursor-pointer",
                  selectedId === emp.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => onSelect(emp.id)}
              >
                <TableCell className="font-medium">{emp.shortName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Счётчик */}
      <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
        Сотрудников в списке: {totalCount}
      </div>
    </aside>
    </>
  );
}
