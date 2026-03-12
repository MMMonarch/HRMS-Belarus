"use client";

import { formatDateForDisplay } from "@/lib/utils";
import type { DashboardExpiringDocRow } from "../types";

type Props = { rows: DashboardExpiringDocRow[]; loading?: boolean };

function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return `просрочено ${Math.abs(daysLeft)} дн.`;
  if (daysLeft === 0) return "сегодня";
  if (daysLeft === 1) return "завтра";
  return `через ${daysLeft} дн.`;
}

export function DashboardExpiringDocuments({ rows, loading }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Окончание трудовых документов</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет документов с указанным сроком</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={`${r.personId}-${r.validTo}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="truncate font-medium">{r.fullName}</span>
              <span className="text-muted-foreground shrink-0">{r.docKind}</span>
              <span className="shrink-0">{formatDateForDisplay(r.validTo)}</span>
              <span className={r.daysLeft < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                {daysLabel(r.daysLeft)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
