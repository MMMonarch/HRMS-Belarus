import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Склонение для русских числительных (год/года/лет, месяц/месяца/месяцев, день/дня/дней) */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/**
 * Считает стаж с даты приёма до сегодня: сколько лет, месяцев и дней сотрудник числится.
 * Дата приёма — из последнего приказа о приёме (employment.start_date).
 * @param startDateIso — дата начала в формате ISO (YYYY-MM-DD или с временем)
 * @param endDate — конечная дата (по умолчанию — сегодня)
 */
export function formatTenure(startDateIso: string, endDate: Date = new Date()): string {
  const s = String(startDateIso).trim().split("T")[0]
  if (!s || s.length < 10) return "—"
  const start = new Date(s + "T00:00:00")
  if (Number.isNaN(start.getTime())) return "—"
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  if (start > end) return "—"
  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()
  if (days < 0) {
    months -= 1
    const lastDayPrev = new Date(end.getFullYear(), end.getMonth(), 0).getDate()
    days += lastDayPrev
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${pluralRu(years, "год", "года", "лет")}`)
  if (months > 0) parts.push(`${months} ${pluralRu(months, "месяц", "месяца", "месяцев")}`)
  if (days > 0) parts.push(`${days} ${pluralRu(days, "день", "дня", "дней")}`)
  if (parts.length === 0) return "менее дня"
  return parts.join(" ")
}

export { formatDateForDisplay } from "./date-utils"
