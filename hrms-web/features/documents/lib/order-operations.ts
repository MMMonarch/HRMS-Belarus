import { parseListResponse } from "@/lib/n8n/client";

export type CrudFn = (
  table: string,
  action: "get" | "create" | "update" | "delete",
  payload?: Record<string, unknown>,
  id?: string
) => Promise<unknown>;

/** Дата приказа DD.MM.YYYY → YYYY-MM-DD для API */
export function orderDateToISO(orderDate: string): string {
  const parts = orderDate.trim().split(".");
  if (parts.length !== 3) return new Date().toISOString().slice(0, 10);
  const [d, m, y] = parts;
  return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

/** Любая дата (DD.MM.YYYY или YYYY-MM-DD) → YYYY-MM-DD для API */
export function toISODate(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined;
  const s = value.trim();
  if (s.includes("-")) return s.slice(0, 10);
  return orderDateToISO(s);
}

const CANDIDATE_STATUS_PREHIRE = "prehire";
const CANDIDATE_STATUS_OFFER = "offer";
const CANDIDATE_STATUS_CLOSED = "closed";

export { CANDIDATE_STATUS_PREHIRE, CANDIDATE_STATUS_OFFER, CANDIDATE_STATUS_CLOSED };

export async function updateCandidateStatusByPerson(
  crudFn: CrudFn,
  personId: string,
  branchId: string | undefined,
  status: string
): Promise<void> {
  if (!branchId) return;
  try {
    const data = await crudFn("candidates", "get");
    const arr = parseListResponse(data) as { id: string; person_id?: string; branch_id?: string }[];
    const list = Array.isArray(arr) ? arr : [];
    const candidate = list.find((c) => c.person_id === personId && c.branch_id === branchId);
    if (candidate?.id) {
      await crudFn("candidates", "update", { status }, candidate.id);
    }
  } catch {
    // no-op: candidate may not exist
  }
}

export function getCreatedId(res: unknown): string | null {
  if (res && typeof res === "object" && "id" in res && typeof (res as { id: unknown }).id === "string") {
    return (res as { id: string }).id;
  }
  if (Array.isArray(res) && res[0] && typeof res[0] === "object" && "id" in res[0]) {
    const id = (res[0] as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  const o = res as Record<string, unknown> | undefined;
  if (o?.data && typeof o.data === "object" && o.data !== null && "id" in o.data) {
    const id = (o.data as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export type HireContractData = {
  contractType?: "employment_contract" | "contract";
  contractTermKind?: string;
  validFrom?: string;
  validTo?: string | null;
};

export async function applyHireOrderItem(
  crudFn: CrudFn,
  orderItemId: string,
  personId: string,
  branchId: string,
  startDate: string,
  positionId: string,
  departmentId: string,
  contractData?: HireContractData | null,
  appliedByUserId?: string | null
): Promise<void> {
  const employmentRes = await crudFn("employments", "create", {
    branch_id: branchId,
    person_id: personId,
    employment_type: "main",
    status: "active",
    start_date: startDate,
    hire_order_item_id: orderItemId,
  });
  const employmentId = getCreatedId(employmentRes);
  if (!employmentId) {
    throw new Error("Не удалось создать занятость (нет id в ответе)");
  }
  await crudFn("assignments", "create", {
    branch_id: branchId,
    employment_id: employmentId,
    department_id: departmentId,
    position_id: positionId,
    start_date: startDate,
    basis_order_item_id: orderItemId,
  });

  let contractId: string | null = null;
  const contractType = contractData?.contractType ?? "employment_contract";
  const contractTermKind = contractData?.contractTermKind ?? "indefinite";
  const validFrom = contractData?.validFrom ?? startDate;
  const validTo = contractData?.validTo ?? undefined;
  const contractRes = await crudFn("contracts", "create", {
    branch_id: branchId,
    person_id: personId,
    employment_id: employmentId,
    contract_type: contractType,
    contract_term_kind: contractTermKind,
    valid_from: validFrom || null,
    valid_to: validTo ?? null,
    hire_order_item_id: orderItemId,
  });
  contractId = getCreatedId(contractRes);

  await crudFn("order_items", "update", {
    state: "applied",
    applied_at: new Date().toISOString(),
    employment_id: employmentId,
    ...(contractId ? { contract_id: contractId } : {}),
    ...(appliedByUserId ? { applied_by: appliedByUserId } : {}),
  }, orderItemId);
  await updateCandidateStatusByPerson(crudFn, personId, branchId, CANDIDATE_STATUS_CLOSED);
}

export async function syncAssignmentForAppliedHireItem(
  crudFn: CrudFn,
  orderItemId: string,
  positionId: string,
  departmentId: string,
  context: { employmentId: string | null; branchId: string | undefined; startDate: string }
): Promise<void> {
  const data = await crudFn("assignments", "get");
  const arr = parseListResponse(data) as { id: string; basis_order_item_id?: string }[];
  const list = Array.isArray(arr) ? arr : [];
  const assignment = list.find((a) => a.basis_order_item_id === orderItemId);
  if (assignment?.id) {
    await crudFn("assignments", "update", {
      position_id: positionId,
      department_id: departmentId,
    }, assignment.id);
    return;
  }
  if (context.employmentId && context.branchId && context.startDate) {
    await crudFn("assignments", "create", {
      branch_id: context.branchId,
      employment_id: context.employmentId,
      department_id: departmentId,
      position_id: positionId,
      start_date: context.startDate,
      basis_order_item_id: orderItemId,
    });
  }
}

export async function syncContractForAppliedHireItem(
  crudFn: CrudFn,
  orderItemId: string,
  contractIdFromItem: string | undefined | null,
  contractData: { contractType?: string; contractTermKind?: string; validFrom?: string; validTo?: string | null }
): Promise<void> {
  let contractId = contractIdFromItem ?? null;
  if (!contractId) {
    const contractsData = await crudFn("contracts", "get");
    const contractsArr = parseListResponse(contractsData) as { id: string; hire_order_item_id?: string }[];
    const list = Array.isArray(contractsArr) ? contractsArr : [];
    const contract = list.find((c) => c.hire_order_item_id === orderItemId);
    contractId = contract?.id ?? null;
  }
  if (!contractId) return;
  const payload: Record<string, unknown> = {};
  if (contractData.contractType !== undefined) payload.contract_type = contractData.contractType;
  if (contractData.contractTermKind !== undefined) payload.contract_term_kind = contractData.contractTermKind;
  if (contractData.validFrom !== undefined) payload.valid_from = contractData.validFrom || null;
  if (contractData.validTo !== undefined) payload.valid_to = contractData.validTo ?? null;
  if (Object.keys(payload).length === 0) return;
  await crudFn("contracts", "update", payload, contractId);
}

export async function getActiveEmploymentId(
  crudFn: CrudFn,
  personId: string,
  branchId: string
): Promise<string | null> {
  const data = await crudFn("employments", "get");
  const arr = parseListResponse(data) as { id: string; person_id?: string; branch_id?: string; status?: string }[];
  const list = Array.isArray(arr) ? arr : [];
  const emp = list.find(
    (e) => e.person_id === personId && e.branch_id === branchId && e.status === "active"
  );
  return emp?.id ?? null;
}

export async function applyTransferOrderItem(
  crudFn: CrudFn,
  orderItemId: string,
  employmentId: string,
  branchId: string,
  effectiveFrom: string,
  newPositionId: string,
  newDepartmentId: string,
  appliedByUserId?: string | null
): Promise<void> {
  const assignmentsData = await crudFn("assignments", "get");
  const assignmentsArr = parseListResponse(assignmentsData) as {
    id: string;
    employment_id?: string;
    end_date?: string | null;
    basis_order_item_id?: string | null;
    start_date?: string | null;
  }[];
  const assignments = Array.isArray(assignmentsArr) ? assignmentsArr : [];
  const existingByItem = assignments.find((a) => a.basis_order_item_id === orderItemId);
  const forEmployment = assignments.filter((a) => a.employment_id === employmentId);

  if (existingByItem?.id) {
    await crudFn("assignments", "update", {
      start_date: effectiveFrom,
      department_id: newDepartmentId,
      position_id: newPositionId,
    }, existingByItem.id);
  } else {
    const containing = forEmployment.find(
      (a) =>
        (a.start_date ?? "") <= effectiveFrom &&
        (a.end_date == null || (a.end_date ?? "") >= effectiveFrom)
    );
    if (containing?.id) {
      await crudFn("assignments", "update", { end_date: effectiveFrom }, containing.id);
    }
    const nextAfter = forEmployment
      .filter(
        (a) =>
          (a.start_date ?? "") >= effectiveFrom &&
          a.id !== containing?.id
      )
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0];
    const newEndDate = nextAfter?.start_date ?? null;
    await crudFn("assignments", "create", {
      branch_id: branchId,
      employment_id: employmentId,
      department_id: newDepartmentId,
      position_id: newPositionId,
      start_date: effectiveFrom,
      ...(newEndDate ? { end_date: newEndDate } : {}),
      basis_order_item_id: orderItemId,
    });
  }
  await crudFn("order_items", "update", {
    state: "applied",
    applied_at: new Date().toISOString(),
    employment_id: employmentId,
    ...(appliedByUserId ? { applied_by: appliedByUserId } : {}),
  }, orderItemId);
}

export async function applyTerminationOrderItem(
  crudFn: CrudFn,
  orderItemId: string,
  employmentId: string,
  branchId: string,
  effectiveFrom: string,
  appliedByUserId?: string | null
): Promise<void> {
  await crudFn("employments", "update", {
    end_date: effectiveFrom,
    status: "terminated",
    termination_order_item_id: orderItemId,
  }, employmentId);
  const assignmentsData = await crudFn("assignments", "get");
  const assignmentsArr = parseListResponse(assignmentsData) as {
    id: string;
    employment_id?: string;
    end_date?: string | null;
  }[];
  const assignments = Array.isArray(assignmentsArr) ? assignmentsArr : [];
  const currentAssignment = assignments.find(
    (a) => a.employment_id === employmentId && (a.end_date == null || a.end_date === "")
  );
  if (currentAssignment?.id) {
    await crudFn("assignments", "update", { end_date: effectiveFrom }, currentAssignment.id);
  }
  await crudFn("order_items", "update", {
    state: "applied",
    applied_at: new Date().toISOString(),
    employment_id: employmentId,
    ...(appliedByUserId ? { applied_by: appliedByUserId } : {}),
  }, orderItemId);
}

export async function applyLeaveOrderItem(
  crudFn: CrudFn,
  orderItemId: string,
  employmentId: string,
  appliedByUserId?: string | null
): Promise<void> {
  await crudFn("order_items", "update", {
    state: "applied",
    applied_at: new Date().toISOString(),
    employment_id: employmentId,
    ...(appliedByUserId ? { applied_by: appliedByUserId } : {}),
  }, orderItemId);
}

export async function revertTerminationOrderItem(
  crudFn: CrudFn,
  orderItemId: string,
  employmentId: string,
  effectiveFrom: string
): Promise<void> {
  await crudFn("employments", "update", {
    end_date: null,
    status: "active",
    termination_order_item_id: null,
  }, employmentId);
  const assignmentsData = await crudFn("assignments", "get");
  const assignmentsArr = parseListResponse(assignmentsData) as {
    id: string;
    employment_id?: string;
    end_date?: string | null;
  }[];
  const assignments = Array.isArray(assignmentsArr) ? assignmentsArr : [];
  const closedByTermination = assignments.find(
    (a) => a.employment_id === employmentId && (a.end_date ?? "").startsWith(effectiveFrom)
  );
  if (closedByTermination?.id) {
    await crudFn("assignments", "update", { end_date: null }, closedByTermination.id);
  }
}

export async function revertAssignmentLinkedToOrderItem(
  crudFn: CrudFn,
  orderItemId: string
): Promise<void> {
  const assignmentsData = await crudFn("assignments", "get");
  const arr = parseListResponse(assignmentsData) as {
    id: string;
    employment_id?: string;
    start_date?: string | null;
    end_date?: string | null;
    basis_order_item_id?: string | null;
  }[];
  const list = Array.isArray(arr) ? arr : [];
  const assignment = list.find((a) => a.basis_order_item_id === orderItemId);
  if (!assignment?.id || !assignment.employment_id) return;
  const employmentId = assignment.employment_id;
  const startDate = assignment.start_date ?? null;
  const endDate = assignment.end_date ?? null;
  const previous = startDate
    ? list.find(
        (a) =>
          a.employment_id === employmentId &&
          a.end_date === startDate &&
          a.id !== assignment.id
      )
    : null;
  const next = endDate
    ? list.find(
        (a) =>
          a.employment_id === employmentId &&
          a.start_date === endDate &&
          a.id !== assignment.id
      )
    : null;
  await crudFn("assignments", "delete", undefined, assignment.id);
  if (previous?.id) {
    await crudFn(
      "assignments",
      "update",
      { end_date: next ? next.start_date : null },
      previous.id
    );
  }
}
