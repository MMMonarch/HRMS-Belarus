"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EmployeeListSidebar } from "@/features/employees/components/EmployeeListSidebar";
import type { StatusFilterValue, BranchOption } from "@/features/employees/components/EmployeeListSidebar";
import { EmployeeDetailCard } from "@/features/employees/components/EmployeeDetailCard";
import type { EmployeeDetail } from "@/features/employees/types";
import {
  type VPersonRow,
  type AssignmentRow,
  type OnLeaveRow,
  type OnLeaveKey,
  mapVPersonToEmployee,
  getPersonType,
} from "@/features/employees/utils";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { CRUD_ABORTED, parseListResponse } from "@/lib/n8n/client";
import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import type { AddCandidateFormData } from "@/features/employees/components/AddCandidateModal";
import { toast } from "sonner";

function isCrudAborted(e: unknown): boolean {
  return e instanceof Error && e.message === CRUD_ABORTED;
}

export default function EmployeesPage() {
  const auth = useSupabaseAuthOptional();
  const workspace = useWorkspaceOptional();
  const { testMode } = useWebhookTestMode();
  const crudRef = useCrudRef();
  const isMounted = useRef(true);
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("active");
  const [departmentFilterId, setDepartmentFilterId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; branch_id: string; name: string }[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const data = await crudRef.current("branches", "get");
      if (!isMounted.current) return;
      const arr = parseListResponse(data) as BranchOption[];
      const list = Array.isArray(arr) ? arr : [];
      setBranches(list);
      const preferredId = workspace?.branchId && list.some((b) => b.id === workspace.branchId) ? workspace.branchId : null;
      setSelectedBranchId((prev) => preferredId ?? (prev || (list[0]?.id ?? "")));
    } catch (e) {
      if (isCrudAborted(e)) return;
      if (isMounted.current) setBranches([]);
    }
  }, [workspace?.branchId]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await crudRef.current("departments", "get");
      if (!isMounted.current) return;
      const arr = parseListResponse(data) as { id: string; branch_id: string; name: string }[];
      setDepartments(Array.isArray(arr) ? arr : []);
    } catch (e) {
      if (isCrudAborted(e)) return;
      if (isMounted.current) setDepartments([]);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [personsData, assignmentData, onLeaveData] = await Promise.all([
        crudRef.current("v_persons_list", "get"),
        crudRef.current("v_person_current_assignment", "get").catch((err) => {
          if (isCrudAborted(err)) throw err;
          return [];
        }),
        crudRef.current("v_person_on_leave_today", "get").catch((err) => {
          if (isCrudAborted(err)) throw err;
          return [];
        }),
      ]);
      if (!isMounted.current) return;
      const personsArr = parseListResponse(personsData) as VPersonRow[];
      const assignmentArr = parseListResponse(assignmentData) as AssignmentRow[];
      const onLeaveArr = parseListResponse(onLeaveData) as OnLeaveRow[];
      const assignmentByPersonBranch = new Map<string, AssignmentRow>();
      for (const a of assignmentArr) {
        if (a.person_id != null) {
          assignmentByPersonBranch.set(`${a.person_id}:${a.branch_id ?? ""}`, a);
        }
      }
      const onLeaveMap = new Map<OnLeaveKey, OnLeaveRow>();
      if (Array.isArray(onLeaveArr)) {
        for (const r of onLeaveArr) {
          if (r.person_id != null) {
            const key: OnLeaveKey = `${r.person_id}:${r.branch_id ?? ""}`;
            onLeaveMap.set(key, r);
          }
        }
      }
      const list = personsArr.map((row) =>
        mapVPersonToEmployee(row, assignmentByPersonBranch, onLeaveMap)
      );
      setEmployees(list);
      setSelectedId((prev) => (prev ? prev : list[0]?.id ?? null));
    } catch (e) {
      if (isCrudAborted(e)) return;
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки списка");
        setEmployees([]);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // Список филиалов — один раз при появлении сессии (нужен для выбора филиала и selectedBranchId).
  const didBranchesFetch = useRef(false);
  useEffect(() => {
    if (!auth?.session) return;
    if (didBranchesFetch.current) return;
    didBranchesFetch.current = true;
    void fetchBranches();
  }, [auth?.session, fetchBranches]);

  // Сотрудники и подразделения — только по выбранному филиалу; перезапрос при смене филиала. Не запрашиваем «всех» без branchId.
  useEffect(() => {
    if (!auth?.session || !workspace?.branchId) return;
    void fetchDepartments();
    void fetchEmployees();
  }, [auth?.session, workspace?.branchId, fetchDepartments, fetchEmployees]);

  /** Подразделения только текущего филиала — для фильтра в сайдбаре */
  const departmentsForBranch = useMemo(
    () => (selectedBranchId ? departments.filter((d) => d.branch_id === selectedBranchId) : []),
    [departments, selectedBranchId]
  );

  useEffect(() => {
    if (departmentFilterId && !departmentsForBranch.some((d) => d.id === departmentFilterId)) {
      setDepartmentFilterId("");
    }
  }, [departmentFilterId, departmentsForBranch]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (selectedBranchId) {
      list = list.filter((e) => e.branch_id === selectedBranchId);
    }
    if (statusFilter !== "all") {
      list = list.filter((e) => getPersonType(e.status) === statusFilter);
    }
    if (departmentFilterId) {
      const deptName = departmentsForBranch.find((d) => d.id === departmentFilterId)?.name;
      if (deptName) {
        list = list.filter((e) => e.department === deptName);
      }
    }
    return list;
  }, [employees, selectedBranchId, statusFilter, departmentFilterId, departmentsForBranch]);

  const selectedEmployee = useMemo(
    () => filteredEmployees.find((e) => e.id === selectedId) ?? null,
    [filteredEmployees, selectedId]
  );

  useEffect(() => {
    if (filteredEmployees.length === 0) {
      setSelectedId(null);
      return;
    }
    const isSelectedInList = filteredEmployees.some((e) => e.id === selectedId);
    if (!isSelectedInList) setSelectedId(filteredEmployees[0].id);
  }, [filteredEmployees, selectedId]);

  const handleAddCandidate = useCallback(
    (_data: AddCandidateFormData) => {
      fetchEmployees();
    },
    [fetchEmployees]
  );

  const handleDeleteEmployee = useCallback(
    async (employeeId: string) => {
      try {
        await crudRef.current("persons", "delete", undefined, employeeId);
        setSelectedId((prev) => {
          const rest = employees.filter((e) => e.id !== employeeId);
          if (prev === employeeId) return rest[0]?.id ?? null;
          return prev;
        });
        fetchEmployees();
        toast.success("Сотрудник удалён");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка при удалении");
        throw e;
      }
    },
    [employees, fetchEmployees]
  );

  const handleUpdatePerson = useCallback(
    async (
      id: string,
      payload: {
        last_name?: string;
        first_name?: string;
        patronymic?: string;
        contact_phone?: string;
        contact_email?: string;
        birth_date?: string | null;
        gender?: string | null;
        citizenship_id?: string | null;
        id_number?: string | null;
      }
    ) => {
      await crudRef.current("persons", "update", payload, id);
      fetchEmployees();
      toast.success("Данные обновлены");
    },
    [fetchEmployees]
  );

  const handleSavePassportDocument = useCallback(
    async (
      personId: string,
      payload: {
        document_type_id: string;
        series?: string | null;
        number?: string | null;
        issued_at?: string | null;
        expires_at?: string | null;
      },
      docId?: string | null,
      branchId?: string | null
    ) => {
      if (docId) {
        await crudRef.current("person_documents", "update", payload, docId);
      } else if (branchId) {
        await crudRef.current("person_documents", "create", {
          person_id: personId,
          branch_id: branchId,
          ...payload,
        });
      }
      fetchEmployees();
    },
    [fetchEmployees]
  );

  const handleUploadPhoto = useCallback(
    async (personId: string, file: File, branchId: string) => {
      const photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64 ?? "");
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await crudRef.current("persons", "update", {
        photo_base64: photoBase64,
        content_type: file.type,
        branch_id: branchId,
      }, personId);
      toast.success("Фото загружено");
      fetchEmployees();
    },
    [fetchEmployees]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] min-h-0 gap-0">
      <EmployeeListSidebar
        employees={filteredEmployees}
        selectedId={selectedId}
        onSelect={setSelectedId}
        totalCount={filteredEmployees.length}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        departmentOptions={departmentsForBranch}
        departmentFilterId={departmentFilterId}
        onDepartmentFilterChange={setDepartmentFilterId}
        onAddCandidate={handleAddCandidate}
        onRefresh={fetchEmployees}
        loading={loading}
        error={error}
      />
      <EmployeeDetailCard
        employee={selectedEmployee}
        onDelete={handleDeleteEmployee}
        onUpdatePerson={handleUpdatePerson}
        onSavePassportDocument={handleSavePassportDocument}
        onUploadPhoto={handleUploadPhoto}
        testMode={testMode}
      />
    </div>
  );
}
