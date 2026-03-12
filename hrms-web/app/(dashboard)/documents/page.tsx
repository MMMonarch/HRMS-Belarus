"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { OrderListPanel } from "@/features/documents/components/OrderListPanel";
import { OrderDetailPanel, type SelectedItemIds } from "@/features/documents/components/OrderDetailPanel";
import { AddOrderModal, type AddOrderFormData } from "@/features/documents/components/AddOrderModal";
import { EditOrderModal } from "@/features/documents/components/EditOrderModal";
import type {
  ConsolidatedOrder,
  ConsolidatedOrderTemplate,
  OrderItem,
  OrderItemRow,
  OrderRow,
} from "@/features/documents/types";
import {
  mapOrderRowToConsolidated,
  mapOrderItemRowToOrderItem,
} from "@/features/documents/types";
import type { EmployeeOption } from "@/features/documents/components/SelectEmployeesModal";
import { parseListResponse } from "@/lib/n8n/client";
import { parseTemplateHtml } from "@/features/editor/types";
import {
  type CrudFn,
  orderDateToISO,
  toISODate,
  CANDIDATE_STATUS_PREHIRE,
  CANDIDATE_STATUS_OFFER,
  updateCandidateStatusByPerson,
  applyHireOrderItem,
  syncAssignmentForAppliedHireItem,
  syncContractForAppliedHireItem,
  getActiveEmploymentId,
  applyTransferOrderItem,
  applyTerminationOrderItem,
  applyLeaveOrderItem,
  revertTerminationOrderItem,
  revertAssignmentLinkedToOrderItem,
} from "@/features/documents/lib/order-operations";
import { TEMPLATE_TYPE, ORDER_ITEM_TYPE_NUMBER } from "@/features/documents/constants";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { toast } from "sonner";

export default function DocumentsPage() {
  const auth = useSupabaseAuthOptional();
  const workspace = useWorkspaceOptional();
  const crudRef = useCrudRef();
  const router = useRouter();
  const didInitialFetch = useRef(false);
  const [orders, setOrders] = useState<ConsolidatedOrder[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<SelectedItemIds>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [addingItems, setAddingItems] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [searchSurname, setSearchSurname] = useState("");
  const [addOrderModalOpen, setAddOrderModalOpen] = useState(false);
  const [editOrderModalOpen, setEditOrderModalOpen] = useState(false);
  const [deleteOrderConfirmOpen, setDeleteOrderConfirmOpen] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  /** id пунктов приказа для модалки подтверждения удаления (null = модалка закрыта) */
  const [deleteItemIdsToConfirm, setDeleteItemIdsToConfirm] = useState<string[] | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [orderTemplates, setOrderTemplates] = useState<ConsolidatedOrderTemplate[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [personsForOrderModal, setPersonsForOrderModal] = useState<EmployeeOption[]>([]);
  /** Типы пунктов приказа из order_item_types (для селекта в карточке пункта) */
  const [orderItemTypes, setOrderItemTypes] = useState<
    { id: string; number: number; name: string }[]
  >([]);
  /** Подтипы для «Приказ об отпуске» (order_item_subtypes по type number = 3) для селекта в карточке */
  const [orderItemSubtypesForLeave, setOrderItemSubtypesForLeave] = useState<
    { id: string; name: string }[]
  >([]);
  /** Шаблоны пункта приказа (templates с template_type = 2) для селекта в карточке */
  const [orderItemTemplates, setOrderItemTemplates] = useState<
    { id: string; name: string }[]
  >([]);
  /** Должности (positions) по филиалам — для селектов в пункте приказа */
  const [positions, setPositions] = useState<{ id: string; branch_id: string; name: string }[]>([]);
  /** Подразделения (departments) по филиалам — для селектов в пункте приказа */
  const [departments, setDepartments] = useState<{ id: string; branch_id: string; name: string }[]>([]);
  /** Шаблоны контракта/трудового договора (templates с template_type = 4) для селекта в приёме */
  const [contractTemplates, setContractTemplates] = useState<{ id: string; name: string }[]>([]);
  /** Шаблоны виз сводного приказа (templates с template_type = 5) для селекта при создании/редактировании приказа */
  const [orderVisaTemplates, setOrderVisaTemplates] = useState<{ id: string; name: string; branch_id?: string }[]>([]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;
  /** Должности филиала выбранного приказа (для карточки пункта) */
  const positionsForOrderItems = useMemo(() => {
    if (!selectedOrder?.branch_id) return [];
    return positions.filter((p) => p.branch_id === selectedOrder.branch_id);
  }, [positions, selectedOrder?.branch_id]);
  /** Подразделения филиала выбранного приказа (для карточки пункта) */
  const departmentsForOrderItems = useMemo(() => {
    if (!selectedOrder?.branch_id) return [];
    return departments.filter((d) => d.branch_id === selectedOrder.branch_id);
  }, [departments, selectedOrder?.branch_id]);
  /** Шаблоны виз для выбранного филиала (для модалки добавления приказа) */
  const visaTemplatesForAdd = useMemo(() => {
    if (!selectedBranchId) return orderVisaTemplates;
    return orderVisaTemplates.filter(
      (t) => !t.branch_id || t.branch_id === selectedBranchId
    );
  }, [orderVisaTemplates, selectedBranchId]);
  /** Шаблоны виз для филиала выбранного приказа (для модалки редактирования) */
  const visaTemplatesForEdit = useMemo(() => {
    const branchId = selectedOrder?.branch_id;
    if (!branchId) return orderVisaTemplates;
    return orderVisaTemplates.filter(
      (t) => !t.branch_id || t.branch_id === branchId
    );
  }, [orderVisaTemplates, selectedOrder?.branch_id]);

  const personsForOrderModalRef = useRef(personsForOrderModal);
  personsForOrderModalRef.current = personsForOrderModal;
  const selectedOrderIdRef = useRef(selectedOrderId);
  selectedOrderIdRef.current = selectedOrderId;

  const fetchBranches = useCallback(async () => {
    try {
      const data = await crudRef.current("branches", "get");
      const arr = parseListResponse(data) as { id: string; name: string }[];
      const list = Array.isArray(arr) ? arr : [];
      setBranches(list);
      const preferredId = workspace?.branchId && list.some((b) => b.id === workspace.branchId) ? workspace.branchId : null;
      setSelectedBranchId((prev) => preferredId ?? (prev || (list[0]?.id ?? "")));
    } catch {
      setBranches([]);
    }
  }, [workspace?.branchId]);

  const fetchOrderTemplates = useCallback(async () => {
    try {
      const data = await crudRef.current("templates", "get");
      const arr = parseListResponse(data) as {
        id: string;
        name: string;
        branch_id?: string;
        template_type?: number | string;
        template_html?: { default_title?: string } | null;
      }[];
      const isOrderHeader = (r: { template_type?: number | string }) =>
        r.template_type === TEMPLATE_TYPE.ORDER_HEADER || r.template_type === "order_header";
      const isVisa = (r: { template_type?: number | string }) =>
        r.template_type === TEMPLATE_TYPE.ORDER_VISA || r.template_type === "order_visa";
      const list = (Array.isArray(arr) ? arr : [])
        .filter(isOrderHeader)
        .map((r) => {
          const html = r.template_html;
          const default_title =
            (html && typeof html === "object" && "default_title" in html
              ? (html as { default_title?: string }).default_title
              : undefined) ?? r.name;
          return { id: r.id, name: r.name, default_title };
        });
      setOrderTemplates(list);
      const visaList = (Array.isArray(arr) ? arr : [])
        .filter(isVisa)
        .map((r) => ({ id: r.id, name: r.name, branch_id: r.branch_id }));
      setOrderVisaTemplates(visaList);
    } catch {
      setOrderTemplates([]);
      setOrderVisaTemplates([]);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await crudRef.current("orders", "get");
      const arr = parseListResponse(data) as OrderRow[];
      const list = Array.isArray(arr)
        ? arr.map((row) => mapOrderRowToConsolidated(row))
        : [];
      setOrders(list);
      setSelectedOrderId((prev) => prev || (list[0]?.id ?? null));
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : "Ошибка загрузки приказов");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchPersonsForOrderModal = useCallback(async () => {
    try {
      const data = await crudRef.current("v_persons_list", "get");
      const arr = parseListResponse(data) as {
        id: string;
        branch_id?: string | null;
        last_name?: string | null;
        first_name?: string | null;
        patronymic?: string | null;
        is_candidate?: boolean | null;
        employment_status?: string | null;
      }[];
      const list = (Array.isArray(arr) ? arr : []).map((r) => {
        const fullName = [r.last_name, r.first_name, r.patronymic]
          .filter(Boolean)
          .join(" ") || r.id;
        const status = r.employment_status as "active" | "terminated" | undefined;
        return {
          id: r.id,
          fullName,
          branchId: r.branch_id ?? undefined,
          isCandidate: !!r.is_candidate,
          employmentStatus: status === "active" || status === "terminated" ? status : null,
        };
      });
      setPersonsForOrderModal(list);
    } catch {
      setPersonsForOrderModal([]);
    }
  }, []);

  const fetchOrderItemTypes = useCallback(async () => {
    try {
      const data = await crudRef.current("order_item_types", "get");
      const arr = parseListResponse(data) as { id: string; number: number; name: string }[];
      const list = Array.isArray(arr)
        ? arr.sort((a, b) => a.number - b.number)
        : [];
      setOrderItemTypes(list);
    } catch {
      setOrderItemTypes([]);
    }
  }, []);

  const fetchOrderItemSubtypesForLeave = useCallback(async () => {
    try {
      const [typesData, subtypesData] = await Promise.all([
        crudRef.current("order_item_types", "get"),
        crudRef.current("order_item_subtypes", "get"),
      ]);
      const typesArr = parseListResponse(typesData) as { id: string; number: number }[];
      const leaveType = Array.isArray(typesArr) ? typesArr.find((t) => t.number === ORDER_ITEM_TYPE_NUMBER.LEAVE) : null;
      const leaveTypeId = leaveType?.id ?? null;
      const subtypesArr = parseListResponse(subtypesData) as {
        id: string;
        order_item_type_id: string;
        name: string;
        sort_order?: number;
      }[];
      if (!leaveTypeId || !Array.isArray(subtypesArr)) {
        setOrderItemSubtypesForLeave([]);
        return;
      }
      const leaveSubtypes = subtypesArr
        .filter((s) => s.order_item_type_id === leaveTypeId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((s) => ({ id: s.id, name: s.name }));
      setOrderItemSubtypesForLeave(leaveSubtypes);
    } catch {
      setOrderItemSubtypesForLeave([]);
    }
  }, []);

  const fetchOrderItemTemplates = useCallback(async () => {
    try {
      const data = await crudRef.current("templates", "get");
      const arr = parseListResponse(data) as {
        id: string;
        name: string;
        template_type?: number | string;
      }[];
      const list = (Array.isArray(arr) ? arr : [])
        .filter((r) => r.template_type === TEMPLATE_TYPE.ORDER_ITEM || r.template_type === "order_item")
        .map((r) => ({ id: r.id, name: r.name }));
      setOrderItemTemplates(list);
    } catch {
      setOrderItemTemplates([]);
    }
  }, []);

  const fetchContractTemplates = useCallback(async () => {
    try {
      const data = await crudRef.current("templates", "get");
      const arr = parseListResponse(data) as {
        id: string;
        name: string;
        template_type?: number | string;
      }[];
      const list = (Array.isArray(arr) ? arr : [])
        .filter((r) => r.template_type === TEMPLATE_TYPE.CONTRACT)
        .map((r) => ({ id: r.id, name: r.name }));
      setContractTemplates(list);
    } catch {
      setContractTemplates([]);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const data = await crudRef.current("positions", "get");
      const arr = parseListResponse(data) as { id: string; branch_id: string; name: string }[];
      setPositions(Array.isArray(arr) ? arr : []);
    } catch {
      setPositions([]);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await crudRef.current("departments", "get");
      const arr = parseListResponse(data) as { id: string; branch_id: string; name: string }[];
      setDepartments(Array.isArray(arr) ? arr : []);
    } catch {
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    if (!auth?.session) return;
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    void fetchBranches();
    void fetchOrderTemplates();
    void fetchOrders();
    void fetchPersonsForOrderModal();
    void fetchOrderItemTypes();
    void fetchOrderItemSubtypesForLeave();
    void fetchOrderItemTemplates();
    void fetchContractTemplates();
    void fetchPositions();
    void fetchDepartments();
  }, [
    auth?.session,
    fetchBranches,
    fetchOrderTemplates,
    fetchOrders,
    fetchPersonsForOrderModal,
    fetchOrderItemTypes,
    fetchOrderItemSubtypesForLeave,
    fetchOrderItemTemplates,
    fetchContractTemplates,
    fetchPositions,
    fetchDepartments,
  ]);

  const fetchOrderItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    setOrderItemsLoading(true);
    try {
      const [orderItemsData, profilesData] = await Promise.all([
        crudRef.current("order_items", "get"),
        crudRef.current("profiles", "get"),
      ]);
      const arr = parseListResponse(orderItemsData) as OrderItemRow[];
      const profilesArr = parseListResponse(profilesData) as { id: string; full_name?: string | null }[];
      const profilesMap = new Map(
        (Array.isArray(profilesArr) ? profilesArr : []).map((p) => [
          p.id,
          (p.full_name ?? p.id).trim() || p.id,
        ])
      );
      const rows = Array.isArray(arr) ? arr : [];
      const forOrder = rows.filter((r) => r.order_id === orderId);
      const persons = personsForOrderModalRef.current;
      const personsMap = new Map(persons.map((p) => [p.id, p.fullName]));
      const items = forOrder
        .sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0))
        .map((r) => mapOrderItemRowToOrderItem(r, personsMap.get(r.person_id), profilesMap));
      const currentSelected = selectedOrderIdRef.current;
      setOrderItemsByOrderId((prev) => ({ ...prev, [orderId]: items }));
      setOrderItems((prev) => (currentSelected === orderId ? items : prev));
      if (currentSelected === orderId) setSelectedItemIds([]);
      return items;
    } catch {
      setOrderItemsByOrderId((prev) => ({ ...prev, [orderId]: [] }));
      if (selectedOrderIdRef.current === orderId) setOrderItems([]);
      return [];
    } finally {
      setOrderItemsLoading(false);
    }
  }, []);

  // При смене приказа подгружаем пункты из API и сбрасываем выбор
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderItems([]);
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds([]);
    setOrderItems(orderItemsByOrderId[selectedOrderId] ?? []);
    fetchOrderItems(selectedOrderId);
  }, [selectedOrderId, fetchOrderItems]); // orderItemsByOrderId intentionally omitted to avoid overwriting after fetch

  const handleDeleteOrderClick = () => {
    setDeleteOrderConfirmOpen(true);
  };

  const [printingOrder, setPrintingOrder] = useState(false);

  const handlePrintOrder = useCallback(async () => {
    if (!selectedOrderId) return;
    setPrintingOrder(true);
    try {
      let printData: Record<string, unknown> | null = null;

      // 1. Запрашиваем приказ из БД, чтобы проверить print_output
      const orderRes = await crudRef.current("orders", "get", undefined, selectedOrderId);
      const rows = parseListResponse(orderRes) as Record<string, unknown>[];
      const orderRow = rows.find((r) => r.id === selectedOrderId) ?? rows[0] ?? null;

      if (orderRow) {
        let po = orderRow.print_output;
        if (typeof po === "string") {
          try { po = JSON.parse(po); } catch { po = null; }
        }
        if (po && typeof po === "object" && !Array.isArray(po)) {
          printData = po as Record<string, unknown>;
        }
      }

      // 2. Если print_output пуст — генерируем через вебхук EDITOR
      if (!printData) {
        const res = await crudRef.current("EDITOR", "get", {
          type: "order",
          id: selectedOrderId,
        });
        const editorRows = parseListResponse(res);
        const raw = editorRows[0] ?? (res && typeof res === "object" && !Array.isArray(res) ? res : null);
        if (raw && typeof raw === "object") {
          printData = raw as Record<string, unknown>;
        }
      }

      if (!printData) {
        toast.error("Не удалось получить данные для печати");
        return;
      }

      sessionStorage.setItem(
        `print-order-${selectedOrderId}`,
        JSON.stringify(printData),
      );
      router.push(`/editor?orderId=${selectedOrderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка печати");
    } finally {
      setPrintingOrder(false);
    }
  }, [selectedOrderId, router]);

  const [recreateConfirmOpen, setRecreateConfirmOpen] = useState(false);
  const [recreatingOrder, setRecreatingOrder] = useState(false);

  const handleRecreateClick = useCallback(() => {
    if (!selectedOrderId) return;
    setRecreateConfirmOpen(true);
  }, [selectedOrderId]);

  const handleConfirmRecreate = useCallback(async () => {
    if (!selectedOrderId) return;
    setRecreateConfirmOpen(false);
    setRecreatingOrder(true);
    try {
      const res = await crudRef.current("EDITOR", "get", {
        type: "order",
        id: selectedOrderId,
      });
      const editorRows = parseListResponse(res);
      const raw = editorRows[0] ?? (res && typeof res === "object" && !Array.isArray(res) ? res : null);
      if (!raw || typeof raw !== "object") {
        toast.error("Не удалось сгенерировать печатную форму");
        return;
      }
      const printData = raw as Record<string, unknown>;

      sessionStorage.setItem(
        `print-order-${selectedOrderId}`,
        JSON.stringify(printData),
      );
      router.push(`/editor?orderId=${selectedOrderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка пересоздания");
    } finally {
      setRecreatingOrder(false);
    }
  }, [selectedOrderId, router]);

  const handleConfirmDeleteOrder = async () => {
    if (!selectedOrderId) return;
    setDeletingOrder(true);
    try {
      await crudRef.current("orders", "delete", undefined, selectedOrderId);
      setSelectedOrderId(null);
      await fetchOrders();
      setDeleteOrderConfirmOpen(false);
      toast.success("Сводный приказ удалён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleAddOrder = async (data: AddOrderFormData) => {
    const branchId = selectedBranchId || branches[0]?.id;
    if (!branchId) {
      toast.error("Выберите филиал");
      return;
    }
    setAddOrderModalOpen(false);
    try {
      const payload = {
        branch_id: branchId,
        template_id: data.templateId,
        visa_template_id: data.visaTemplateId || undefined,
        order_date: data.orderDateISO,
        reg_number: data.regNumber.trim() || undefined,
        title: data.title.trim(),
        status: "draft",
      };
      const res = await crudRef.current("orders", "create", payload);
      const raw = Array.isArray(res) ? res[0] : res;
      const id =
        raw && typeof raw === "object" && "id" in raw
          ? String((raw as { id: string }).id)
          : null;
      await fetchOrders();
      if (id) setSelectedOrderId(id);
      toast.success("Сводный приказ создан");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания приказа");
    }
  };

  const handleEditOrder = async (data: AddOrderFormData) => {
    if (!selectedOrderId) return;
    setEditOrderModalOpen(false);
    try {
      await crudRef.current("orders", "update", {
        order_date: data.orderDateISO,
        reg_number: data.regNumber.trim() || undefined,
        title: data.title.trim(),
        template_id: data.templateId,
        visa_template_id: data.visaTemplateId || undefined,
      }, selectedOrderId);
      await fetchOrders();
      toast.success("Сводный приказ сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения приказа");
    }
  };

  const handleAddItems = async (employees: EmployeeOption[]) => {
    if (!selectedOrderId || employees.length === 0) return;
    const effectiveFrom =
      selectedOrder?.orderDate ?
        orderDateToISO(selectedOrder.orderDate)
      : new Date().toISOString().slice(0, 10);
    const startSeq = orderItems.length + 1;
    try {
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i]!;
        // У уже работающих (active) нельзя создавать пункт «Приём» — создаём «Прочий» (4), тип можно сменить в карточке на Перевод/Увольнение/Отпуск
        const itemTypeNumber = emp.employmentStatus === "active" ? ORDER_ITEM_TYPE_NUMBER.OTHER : ORDER_ITEM_TYPE_NUMBER.HIRE;
        await crudRef.current("order_items", "create", {
          order_id: selectedOrderId,
          person_id: emp.id,
          line_no: startSeq + i,
          item_type_number: itemTypeNumber,
          state: "draft",
          effective_from: effectiveFrom,
        });
      }
      const nextItems = await fetchOrderItems(selectedOrderId);
      const lastId = nextItems[nextItems.length - 1]?.id ?? null;
      setSelectedItemIds(lastId ? [lastId] : []);
      toast.success(
        employees.length === 1
          ? "Пункт приказа добавлен"
          : `Добавлено пунктов: ${employees.length}`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Ошибка добавления пунктов приказа"
      );
    } finally {
      setAddingItems(false);
    }
  };

  const handleRequestDeleteItems = () => {
    if (selectedItemIds.length === 0) return;
    setDeleteItemIdsToConfirm([...selectedItemIds]);
  };

  const handleConfirmDeleteItems = async () => {
    if (!selectedOrderId || !deleteItemIdsToConfirm || deleteItemIdsToConfirm.length === 0)
      return;
    const branchId = selectedOrder?.branch_id;
    setDeletingItem(true);
    try {
      for (const id of deleteItemIdsToConfirm) {
        const item = orderItems.find((i) => i.id === id);
        const isHireItem = item?.itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.HIRE;
        const isTerminationItem = item?.itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.TERMINATION && item?.status === "applied";
        const personId = item?.employeeId;
        if (isTerminationItem && item.employmentId && item.effectiveFrom) {
          await revertTerminationOrderItem(
            crudRef.current,
            id,
            item.employmentId,
            toISODate(item.effectiveFrom) ?? item.effectiveFrom
          );
        }
        await revertAssignmentLinkedToOrderItem(crudRef.current, id);
        await crudRef.current("order_items", "delete", undefined, id);
        if (isHireItem && personId && branchId) {
          await updateCandidateStatusByPerson(
            crudRef.current,
            personId,
            branchId,
            CANDIDATE_STATUS_OFFER
          );
        }
      }
      await fetchOrderItems(selectedOrderId);
      setDeleteItemIdsToConfirm(null);
      setSelectedItemIds([]);
      const n = deleteItemIdsToConfirm.length;
      toast.success(
        n === 1 ? "Пункт приказа удалён" : `Удалено пунктов приказа: ${n}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления пункта приказа");
    } finally {
      setDeletingItem(false);
    }
  };

  const handleSaveItem = async (id: string, data: Partial<OrderItem>) => {
    if (!selectedOrderId) return;
    setSavingItemId(id);
    const itemTypeNumber = data.itemTypeNumber ?? ORDER_ITEM_TYPE_NUMBER.HIRE;
    const isHire = itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.HIRE;
    const isTransfer = itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.TRANSFER;
    const isLeave = itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.LEAVE;
    const isTermination = itemTypeNumber === ORDER_ITEM_TYPE_NUMBER.TERMINATION;
    const item = orderItems.find((i) => i.id === id);
    const personId = item?.employeeId ?? data.employeeId;
      const mergedData = { ...(item?.data ?? {}), ...(data.data ?? {}) };
      const positionId = mergedData.positionId as string | undefined;
      const departmentId = mergedData.departmentId as string | undefined;
      const newPositionId = mergedData.newPositionId as string | undefined;
      const newDepartmentId = mergedData.newDepartmentId as string | undefined;
      const contractType = mergedData.contractType as "employment_contract" | "contract" | undefined;
      const contractTermKind = mergedData.contractTermKind as string | undefined;
      const validFromContract = mergedData.validFrom as string | undefined;
      const validToContract = mergedData.validTo as string | null | undefined;
    const effectiveFromISO = toISODate(data.effectiveFrom);
    const effectiveToISO = toISODate(data.effectiveTo);
    const branchId = selectedOrder?.branch_id ?? undefined;
    try {
      // Если тип сменили на не-перевод (например «Прочий»), откатить назначение и сшить цепочку,
      // чтобы средний перевод не оставлял «висячее» назначение.
      if (itemTypeNumber !== ORDER_ITEM_TYPE_NUMBER.TRANSFER) {
        await revertAssignmentLinkedToOrderItem(crudRef.current, id);
      }
      let employmentId: string | null = null;
      if ((isTransfer || isTermination || isLeave) && branchId && personId) {
        employmentId = (item?.employmentId ?? data.employmentId ?? null) || null;
        if (!employmentId) {
          employmentId = await getActiveEmploymentId(crudRef.current, personId, branchId);
        }
        if (!employmentId) {
          toast.error(
            isTermination
              ? "Не найдена активная занятость сотрудника в филиале приказа. Увольнение возможно только для работающих."
              : isLeave
                ? "Не найдена активная занятость сотрудника в филиале приказа. Приказ об отпуске возможен только для работающих."
                : "Не найдена активная занятость сотрудника в филиале приказа. Перевод возможен только для работающих."
          );
          setSavingItemId(null);
          return;
        }
      }
      if (isTermination && !effectiveFromISO) {
        toast.error("Укажите дату увольнения (дата начала действия пункта).");
        setSavingItemId(null);
        return;
      }
      if (isLeave && (!effectiveFromISO || !effectiveToISO)) {
        toast.error("Укажите дату начала и дату окончания отпуска.");
        setSavingItemId(null);
        return;
      }
      const payload: Record<string, unknown> = {
        item_type_number: itemTypeNumber,
        effective_from: effectiveFromISO,
        effective_to: effectiveToISO,
        payload: {
          body: data.body ?? "",
          ...(data.data ?? {}),
        },
      };
      if ((isTransfer || isTermination || isLeave) && employmentId) {
        payload.employment_id = employmentId;
      }
      if (data.itemSubtypeId !== undefined) {
        payload.item_subtype_id = data.itemSubtypeId && String(data.itemSubtypeId).trim() ? data.itemSubtypeId : null;
      }
      await crudRef.current("order_items", "update", payload, id);
      const alreadyApplied = item?.status === "applied";
      const appliedByUserId = auth?.session?.user?.id ?? null;
      if (isHire && personId && branchId && !alreadyApplied) {
        if (positionId && departmentId && effectiveFromISO) {
          await applyHireOrderItem(
            crudRef.current,
            id,
            personId,
            branchId,
            effectiveFromISO,
            positionId,
            departmentId,
            {
              contractType: contractType ?? "employment_contract",
              contractTermKind: contractTermKind ?? "indefinite",
              validFrom: validFromContract ?? effectiveFromISO,
              validTo: validToContract ?? undefined,
            },
            appliedByUserId
          );
          toast.success("Пункт приказа сохранён, приём оформлен — сотрудник принят");
        } else {
          await updateCandidateStatusByPerson(
            crudRef.current,
            personId,
            branchId,
            CANDIDATE_STATUS_PREHIRE
          );
          toast.success(
            "Пункт приказа сохранён. Укажите должность и подразделение и нажмите «Сохранить» ещё раз, чтобы оформить приём."
          );
        }
      } else if (isHire && alreadyApplied && positionId && departmentId) {
        await syncAssignmentForAppliedHireItem(crudRef.current, id, positionId, departmentId, {
          employmentId: item?.employmentId ?? null,
          branchId,
          startDate: effectiveFromISO ?? item?.effectiveFrom ?? "",
        });
        await syncContractForAppliedHireItem(crudRef.current, id, item?.contractId, {
          contractType: contractType ?? undefined,
          contractTermKind: contractTermKind ?? undefined,
          validFrom: validFromContract ?? undefined,
          validTo: validToContract !== undefined ? validToContract : undefined,
        });
        toast.success("Пункт приказа сохранён, назначение обновлено");
      } else if (isHire && alreadyApplied) {
        await syncContractForAppliedHireItem(crudRef.current, id, item?.contractId, {
          contractType: contractType ?? undefined,
          contractTermKind: contractTermKind ?? undefined,
          validFrom: validFromContract ?? undefined,
          validTo: validToContract !== undefined ? validToContract : undefined,
        });
        toast.success("Пункт приказа сохранён");
      } else if (isTransfer && employmentId && branchId && effectiveFromISO && newPositionId && newDepartmentId) {
        await applyTransferOrderItem(
          crudRef.current,
          id,
          employmentId,
          branchId,
          effectiveFromISO,
          newPositionId,
          newDepartmentId,
          appliedByUserId
        );
        toast.success(
          alreadyApplied
            ? "Пункт приказа сохранён, назначение обновлено"
            : "Пункт приказа сохранён, перевод оформлен — должность/подразделение обновлены"
        );
      } else if (isTransfer && (!newPositionId || !newDepartmentId || !effectiveFromISO)) {
        toast.success(
          "Пункт приказа сохранён. Укажите дату перевода, должность и подразделение и нажмите «Сохранить» ещё раз, чтобы оформить перевод."
        );
      } else if (isTransfer) {
        toast.success("Пункт приказа сохранён");
      } else if (isTermination && employmentId && branchId && effectiveFromISO) {
        if (!alreadyApplied) {
          await applyTerminationOrderItem(
            crudRef.current,
            id,
            employmentId,
            branchId,
            effectiveFromISO,
            appliedByUserId
          );
          toast.success("Пункт приказа сохранён, увольнение оформлено — сотрудник уволен");
        } else {
          toast.success("Пункт приказа сохранён");
        }
      } else if (isLeave && employmentId && !alreadyApplied) {
        await applyLeaveOrderItem(crudRef.current, id, employmentId, appliedByUserId);
        toast.success("Пункт приказа сохранён, отпуск применён");
      } else if (isLeave && alreadyApplied) {
        toast.success("Пункт приказа сохранён");
      } else if (!alreadyApplied) {
        // Прочий и остальные типы: при сохранении сразу применяем
        await crudRef.current("order_items", "update", {
          state: "applied",
          applied_at: new Date().toISOString(),
          ...(appliedByUserId ? { applied_by: appliedByUserId } : {}),
        }, id);
        toast.success("Пункт приказа сохранён и применён");
      }
      await fetchOrderItems(selectedOrderId);
      if (alreadyApplied && !isHire && !isTransfer && !isTermination && !isLeave) {
        toast.success("Пункт приказа сохранён");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения пункта приказа");
    } finally {
      setSavingItemId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (selectedBranchId) {
      list = list.filter((o) => o.branch_id === selectedBranchId);
    }
    if (sortBy === "number") {
      list.sort((a, b) => a.regNumber.localeCompare(b.regNumber));
    } else {
      list.sort((a, b) => {
        const dA = a.orderDate.split(".").reverse().join("");
        const dB = b.orderDate.split(".").reverse().join("");
        return dA.localeCompare(dB);
      });
    }
    if (searchSurname.trim()) {
      const q = searchSurname.trim().toLowerCase();
      list = list.filter((o) =>
        (orderItemsByOrderId[o.id] ?? []).some((i) =>
          i.employeeName.toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [orders, selectedBranchId, sortBy, searchSurname, orderItemsByOrderId]);

  const addDisabled = ordersLoading || !selectedBranchId;

  if (ordersLoading && orders.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        Загрузка приказов…
      </div>
    );
  }

  if (ordersError && orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-destructive">
        <p>{ordersError}</p>
        <button
          type="button"
          onClick={() => fetchOrders()}
          className="text-sm underline underline-offset-2"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] min-h-0 gap-0">
      <OrderListPanel
        orders={filteredOrders}
        selectedId={selectedOrderId}
        onSelect={setSelectedOrderId}
        onAddClick={() => setAddOrderModalOpen(true)}
        onEditClick={() => setEditOrderModalOpen(true)}
        onDeleteClick={handleDeleteOrderClick}
        onPrintClick={handlePrintOrder}
        onRecreateClick={handleRecreateClick}
        printLoading={printingOrder}
        recreateLoading={recreatingOrder}
        deleteDisabled={deletingOrder}
        addDisabled={addDisabled}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchSurname={searchSurname}
        onSearchSurnameChange={setSearchSurname}
      />
      <AddOrderModal
        open={addOrderModalOpen}
        onOpenChange={setAddOrderModalOpen}
        onConfirm={handleAddOrder}
        templates={orderTemplates.length > 0 ? orderTemplates : undefined}
        visaTemplates={visaTemplatesForAdd}
      />
      <EditOrderModal
        open={editOrderModalOpen}
        onOpenChange={setEditOrderModalOpen}
        onConfirm={handleEditOrder}
        order={selectedOrder}
        templates={orderTemplates.length > 0 ? orderTemplates : undefined}
        visaTemplates={visaTemplatesForEdit}
      />
      <Dialog open={deleteOrderConfirmOpen} onOpenChange={setDeleteOrderConfirmOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              Удалить сводный приказ{selectedOrder?.regNumber ? ` № ${selectedOrder.regNumber}` : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Это действие необратимо. Будет удалён приказ и все связанные с ним пункты. Отменить удаление будет невозможно.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOrderConfirmOpen(false)}
              disabled={deletingOrder}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmDeleteOrder}
              disabled={deletingOrder}
            >
              {deletingOrder ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={recreateConfirmOpen} onOpenChange={setRecreateConfirmOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              Пересоздать печатную форму{selectedOrder?.regNumber ? ` приказа № ${selectedOrder.regNumber}` : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Печатная форма будет сгенерирована заново. Все ранее внесённые правки в печатную форму будут утеряны.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecreateConfirmOpen(false)}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmRecreate}
              disabled={recreatingOrder}
            >
              {recreatingOrder ? "Пересоздание…" : "Пересоздать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteItemIdsToConfirm !== null && deleteItemIdsToConfirm.length > 0}
        onOpenChange={(open) => !open && setDeleteItemIdsToConfirm(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {deleteItemIdsToConfirm?.length === 1
                ? "Удалить пункт приказа?"
                : `Удалить выбранные пункты (${deleteItemIdsToConfirm?.length ?? 0})?`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteItemIdsToConfirm?.length === 1 ? (
              <>
                Будет удалён пункт по сотруднику{" "}
                <strong>
                  {orderItems.find((i) => i.id === deleteItemIdsToConfirm?.[0])?.employeeName ?? "—"}
                </strong>
                . Действие безвозвратное. Отменить удаление будет невозможно.
              </>
            ) : (
              <>
                Будет удалено пунктов приказа: <strong>{deleteItemIdsToConfirm?.length ?? 0}</strong>.
                Действие безвозвратное. Отменить удаление будет невозможно.
              </>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteItemIdsToConfirm(null)}
              disabled={deletingItem}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmDeleteItems}
              disabled={deletingItem}
            >
              {deletingItem ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OrderDetailPanel
        order={selectedOrder}
        items={orderItems}
        selectedItemIds={selectedItemIds}
        onToggleItemSelection={(id) =>
          setSelectedItemIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
        onAddItems={handleAddItems}
        onRequestDelete={handleRequestDeleteItems}
        onSaveItem={handleSaveItem}
        savingItemId={savingItemId}
        employeesForAddModal={
          personsForOrderModal.length > 0 && selectedOrder?.branch_id
            ? personsForOrderModal.filter((p) => p.branchId === selectedOrder.branch_id)
            : undefined
        }
        personIdsWithActiveEmployment={
          selectedOrder?.branch_id
            ? personsForOrderModal
                .filter(
                  (p) =>
                    p.branchId === selectedOrder.branch_id && p.employmentStatus === "active"
                )
                .map((p) => p.id)
            : []
        }
        orderItemTypes={orderItemTypes.length > 0 ? orderItemTypes : undefined}
        orderItemSubtypesForLeave={
          orderItemSubtypesForLeave.length > 0 ? orderItemSubtypesForLeave : undefined
        }
        orderItemTemplates={orderItemTemplates.length > 0 ? orderItemTemplates : undefined}
        positionsForOrderItems={positionsForOrderItems}
        departmentsForOrderItems={departmentsForOrderItems}
        contractTemplatesForOrderItems={contractTemplates.length > 0 ? contractTemplates : undefined}
        addItemsLoading={addingItems}
        itemsLoading={orderItemsLoading}
      />
    </div>
  );
}
