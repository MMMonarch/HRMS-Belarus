"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateForDisplay } from "@/lib/utils";
import type { DashboardAssignmentRow } from "../types";

type Props = { rows: DashboardAssignmentRow[]; loading?: boolean };

export function DashboardAssignmentsTable({ rows, loading }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Кто когда перевёл / назначил</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет данных</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Приказ</TableHead>
              <TableHead>Создал</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDateForDisplay(r.effectiveFrom)}</TableCell>
                <TableCell>{r.personName}</TableCell>
                <TableCell>{r.typeLabel}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.orderRegNumber ?? (r.orderDate ? formatDateForDisplay(r.orderDate) : "—")}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.createdBy ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
