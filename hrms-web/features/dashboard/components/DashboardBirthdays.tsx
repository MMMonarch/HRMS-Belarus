"use client";

import { formatDateForDisplay } from "@/lib/utils";
import type { DashboardBirthdayRow } from "../types";

type Props = { rows: DashboardBirthdayRow[]; loading?: boolean };

export function DashboardBirthdays({ rows, loading }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Ближайшие дни рождения</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет данных</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.personId} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.fullName}</span>
              <span className="text-muted-foreground shrink-0">
                {formatDateForDisplay(r.birthDate)} — {r.whenLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
