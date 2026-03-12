/**
 * Вычисляет «следующую дату дня рождения» в формате YYYY-MM-DD для сортировки.
 * Если день рождения в этом году уже прошёл — следующий год.
 */
export function nextBirthdaySortKey(birthDateIso: string, today: Date): string {
  const s = String(birthDateIso).trim().split("T")[0];
  if (!s || s.length < 10) return "9999-12-31";
  const [y, m, d] = s.split("-").map(Number);
  const thisYear = today.getFullYear();
  let year = thisYear;
  const month = m;
  const day = d;
  const thisYearBirth = new Date(thisYear, month - 1, day);
  if (thisYearBirth < today) year = thisYear + 1;
  const next = new Date(year, month - 1, day);
  return next.toISOString().slice(0, 10);
}

/**
 * Подпись «через N дней» / «сегодня» / «завтра» для дня рождения.
 */
export function birthdayWhenLabel(birthDateIso: string, today: Date): string {
  const s = String(birthDateIso).trim().split("T")[0];
  if (!s || s.length < 10) return "—";
  const [y, m, d] = s.split("-").map(Number);
  const thisYear = today.getFullYear();
  let year = thisYear;
  const thisYearBirth = new Date(thisYear, m - 1, d);
  if (thisYearBirth < today) year = thisYear + 1;
  const next = new Date(year, m - 1, d);
  const diffMs = next.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "завтра";
  if (diffDays > 0 && diffDays <= 31) return `через ${diffDays} дн.`;
  if (diffDays > 31) return "в этом году";
  return "—";
}

/** Разница в днях между today и validTo (положительное = в будущем). */
export function daysUntil(validToIso: string, today: Date): number {
  const s = String(validToIso).trim().split("T")[0];
  if (!s || s.length < 10) return 0;
  const end = new Date(s + "T00:00:00");
  today.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export { parseListResponse } from "@/lib/n8n/client";
