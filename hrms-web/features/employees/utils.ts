import type { EmployeeDetail } from "./types";
import { formatDateForDisplay } from "@/lib/date-utils";
import { formatTenure } from "@/lib/utils";

export type VPersonRow = {
  id: string;
  branch_id?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  patronymic?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  employment_status?: string | null;
  employment_end_date?: string | null;
  is_candidate?: boolean | null;
  photo_path?: string | null;
};

export type AssignmentRow = {
  person_id: string;
  branch_id?: string | null;
  position_name?: string | null;
  department_name?: string | null;
  employment_start_date?: string | null;
  assignment_start_date?: string | null;
};

export type OnLeaveRow = { person_id: string; branch_id?: string | null; effective_to?: string | null };

export type OnLeaveKey = string;

export function mapVPersonToEmployee(
  row: VPersonRow,
  assignmentByPersonBranch?: Map<string, AssignmentRow>,
  onLeaveMap?: Map<OnLeaveKey, OnLeaveRow>
): EmployeeDetail {
  const last = row.last_name ?? "";
  const first = row.first_name ?? "";
  const patr = row.patronymic ?? "";
  const shortName =
    [last, first ? `${first[0]}.` : "", patr ? `${patr[0]}.` : ""].filter(Boolean).join(" ") || row.id;
  const fullName = [last, first, patr].filter(Boolean).join(" ") || row.id;
  const onLeaveKey: OnLeaveKey = `${row.id}:${row.branch_id ?? ""}`;
  const onLeaveRow = onLeaveMap?.get(onLeaveKey);
  const isOnLeaveToday = row.employment_status === "active" && onLeaveRow != null;
  const leaveEndDate = onLeaveRow?.effective_to;
  const status =
    row.employment_status === "active"
      ? isOnLeaveToday
        ? leaveEndDate
          ? `В отпуске до ${formatDateForDisplay(leaveEndDate)}`
          : "В отпуске"
        : "Работает"
      : row.employment_status === "terminated"
        ? row.employment_end_date
          ? `Уволен ${formatDateForDisplay(row.employment_end_date)}`
          : "Уволен"
        : row.is_candidate
          ? "Кандидат"
          : "—";
  const composition = row.is_candidate ? "Кандидат" : "Основной сотрудник";
  const key = `${row.id}:${row.branch_id ?? ""}`;
  const assignment = assignmentByPersonBranch?.get(key);
  const position = assignment?.position_name ?? "—";
  const department = assignment?.department_name ?? "—";
  const hiredDate = assignment?.employment_start_date
    ? formatDateForDisplay(assignment.employment_start_date)
    : "—";
  const positionStartDate = assignment?.assignment_start_date
    ? formatDateForDisplay(assignment.assignment_start_date)
    : undefined;
  const tenure =
    assignment?.employment_start_date && row.employment_status === "active"
      ? formatTenure(assignment.employment_start_date)
      : "—";
  return {
    id: row.id,
    shortName,
    branch_id: row.branch_id ?? undefined,
    fullName,
    last_name: last || undefined,
    first_name: first || undefined,
    patronymic: patr || undefined,
    contact_phone: row.contact_phone ?? undefined,
    contact_email: row.contact_email ?? undefined,
    composition,
    position,
    department: department !== "—" ? department : undefined,
    rankCategory: "—",
    status,
    hiredDate,
    positionStartDate,
    tenure,
    photo_path: row.photo_path ?? undefined,
  };
}

export function getPersonType(status: string): "candidates" | "active" | "dismissed" {
  if (status === "Кандидат") return "candidates";
  if (status === "Уволен" || status.startsWith("Уволен ")) return "dismissed";
  return "active";
}
