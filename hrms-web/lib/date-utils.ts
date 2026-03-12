/**
 * Централизованные утилиты для работы с датами.
 * Все форматы: ISO (YYYY-MM-DD) ↔ Display (DD.MM.YYYY).
 */

/** ISO (YYYY-MM-DD или с "T") → DD.MM.YYYY для отображения */
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim().split("T")[0];
  if (!s || s.length < 10) return "";
  const [y, m, d] = s.split("-");
  return [d, m, y].filter(Boolean).join(".");
}

/** DD.MM.YYYY → ISO YYYY-MM-DD. Возвращает null при неверном формате. */
export function displayToIso(display: string): string | null {
  const trimmed = display.trim();
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

/** Форматирует ISO-дату для отображения (DD.MM.YYYY). Возвращает "—" при пустом значении. */
export function formatDateForDisplay(isoDate: string): string {
  return isoToDisplay(isoDate) || "—";
}

/** ISO дата-время (UTC) → "DD.MM.YYYY HH:mm" в локальной зоне пользователя */
export function isoToDateTimeDisplay(iso: string | undefined): string {
  if (!iso || !iso.trim()) return "";
  const date = new Date(iso.trim());
  if (Number.isNaN(date.getTime())) return "";
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const h = date.getHours();
  const min = date.getMinutes();
  const dateStr = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return `${dateStr} ${timeStr}`;
}

/** DD.MM.YYYY → YYYY-MM-DD для API. Возвращает "" при неверном формате. */
export function parseDateDDMMYYYY(value: string): string {
  return displayToIso(value) ?? "";
}

/** Сегодняшняя дата в формате DD.MM.YYYY */
export function formatTodayDDMMYYYY(): string {
  const today = new Date();
  const d = String(today.getDate()).padStart(2, "0");
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  return `${d}.${m}.${y}`;
}
