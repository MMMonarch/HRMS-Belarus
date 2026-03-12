"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Printer,
  Scissors,
} from "lucide-react";
import type { ConsolidatedOrder } from "@/features/documents/types";

const SORT_OPTIONS = [
  { value: "number", label: "По номеру приказа" },
  { value: "date", label: "По дате приказа" },
];

export type BranchOption = { id: string; name: string };

type OrderListPanelProps = {
  orders: ConsolidatedOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onPrintClick?: () => void;
  onRecreateClick?: () => void;
  printLoading?: boolean;
  recreateLoading?: boolean;
  deleteDisabled?: boolean;
  addDisabled?: boolean;
  sortBy?: string;
  onSortChange?: (value: string) => void;
  searchSurname?: string;
  onSearchSurnameChange?: (value: string) => void;
  className?: string;
};

export function OrderListPanel({
  orders,
  selectedId,
  onSelect,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onPrintClick,
  onRecreateClick,
  printLoading = false,
  recreateLoading = false,
  deleteDisabled = false,
  addDisabled = false,
  sortBy = "date",
  onSortChange,
  searchSurname = "",
  onSearchSurnameChange,
  className,
}: OrderListPanelProps) {
  return (
    <aside
      className={cn(
        "flex w-[360px] shrink-0 flex-col border-r border-border bg-card",
        className
      )}
    >
      {/* Филиал задаётся при входе в шапке */}
      {/* Блок фильтров и сортировок сводных приказов */}
      <div className="space-y-2 border-b border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Фильтры и сортировки сводных приказов
        </p>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          title="Сортировка"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="Поиск по фамилии"
          value={searchSurname}
          onChange={(e) => onSearchSurnameChange?.(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Кнопки: добавить, редактировать, удалить, печать, пересоздать */}
      <div className="flex flex-wrap gap-1 border-b border-border p-3">
        <Button
          size="icon"
          variant="default"
          title={addDisabled ? "Выберите филиал для добавления приказа" : "Добавить"}
          onClick={onAddClick}
          disabled={addDisabled}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={!selectedId}
          title="Редактировать сводный приказ"
          onClick={onEditClick}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          disabled={!selectedId || deleteDisabled}
          title="Удалить сводный приказ"
          onClick={onDeleteClick}
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={!selectedId || printLoading}
          title="Печать"
          onClick={onPrintClick}
        >
          <Printer className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={!selectedId || recreateLoading}
          title="Пересоздать приказ (печатная форма)"
          onClick={onRecreateClick}
        >
          <Scissors className="size-4" />
        </Button>
      </div>

      {/* Таблица со сводными приказами */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Дата</TableHead>
              <TableHead className="w-16">№</TableHead>
              <TableHead>Наименование</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground text-sm">
                  Нет приказов
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === order.id && "bg-accent"
                  )}
                  onClick={() => onSelect(order.id)}
                >
                  <TableCell className="text-sm">{order.orderDate}</TableCell>
                  <TableCell className="text-sm">{order.regNumber}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-sm" title={order.title}>
                    {order.title}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </aside>
  );
}
